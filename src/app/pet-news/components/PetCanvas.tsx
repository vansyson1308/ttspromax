"use client";

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { AVATAR_CONFIG } from "@/lib/avatar-config";
import { computeMouthShape, drawMouth, type MouthRegion, type VisemeState } from "@/lib/mouth-renderer";
import { detectPetMouth, type DetectionResult, type PetBBox } from "@/lib/pet-detector";
import { getModelWarmupState, warmupPetDetector } from "@/lib/pet-detector-warmup";
import { importWithTimeout, CdnLoadTimeout } from "@/lib/cdn-loader";
import { logger } from "@/lib/logger";
import {
  computePetFraming,
  reprojectNorm,
  fitCentred,
  type PetFraming,
} from "@/lib/pet-framing";
import { PetAnimator, drawEyeBlink } from "@/lib/pet-animator";
import { ParticleSystem } from "@/lib/particle-system";
import {
  drawBroadcastBackground,
  drawNewsOverlay,
  defaultOverlayState,
  type NewsOverlayState,
} from "@/lib/news-overlay-renderer";

const HEADAUDIO_CDN = "https://cdn.jsdelivr.net/npm/@met4citizen/headaudio@0.1.0/modules/headaudio.mjs";
const CDN_TIMEOUT_MS = 8000;
const TICKER_SPEED_PX_PER_SEC = 80;
const NUDGE_STEP = 0.02;

const log = logger.child("PetCanvas");

export interface PetCanvasHandle {
  playWithLipSync: (blob: Blob) => Promise<void>;
  playAndRecord: (blob: Blob) => Promise<Blob>;
  getRecordingCanvas: () => HTMLCanvasElement | null;
  getAudioCtx: () => AudioContext | null;
}

interface Props {
  imageUrl: string | null;
  mouthRegion: MouthRegion;
  onMouthRegionChange: (region: MouthRegion) => void;
  onDetection: (result: DetectionResult) => void;
  /** Auto-frame the pet to the canvas centre. Default: on. */
  autoFrame?: boolean;
  /** Show news studio overlay (lower third + ticker + logo). Default: on. */
  showNewsOverlay?: boolean;
  /** Show particle effects when speaking. Default: on. */
  showParticles?: boolean;
  /** Initial overlay state — channel name, ticker text, etc. */
  overlay?: Partial<NewsOverlayState>;
}

const CANVAS_W = 640;
const CANVAS_H = 480;

const PetCanvas = forwardRef<PetCanvasHandle, Props>(
  function PetCanvas(
    {
      imageUrl,
      mouthRegion,
      onMouthRegionChange,
      onDetection,
      autoFrame = true,
      showNewsOverlay = true,
      showParticles = true,
      overlay,
    },
    ref,
  ) {
    // ─── Single visible canvas + offscreen recording mirror ───────────────
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Audio + viseme refs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headAudioRef = useRef<any>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animRef = useRef<number>(0);
    const visemeRef = useRef<VisemeState>({});
    const lastTimeRef = useRef(0);
    const isPlayingRef = useRef(false);
    const playStartTimeRef = useRef<number>(0);

    // Image + framing
    const imgRef = useRef<HTMLImageElement | null>(null);
    const framingRef = useRef<PetFraming | null>(null);
    const bboxRef = useRef<PetBBox | null>(null);

    // Animation/effects
    const animatorRef = useRef<PetAnimator>(new PetAnimator());
    const particlesRef = useRef<ParticleSystem>(new ParticleSystem());

    // Live overlay state (mutable; updated from props)
    const overlayStateRef = useRef<NewsOverlayState>({
      ...defaultOverlayState(),
      ...overlay,
    });

    // Toggles (kept in refs so animate() always sees latest)
    const autoFrameRef = useRef(autoFrame);
    const showOverlayRef = useRef(showNewsOverlay);
    const showParticlesRef = useRef(showParticles);
    const mouthRegionRef = useRef<MouthRegion>(mouthRegion);

    useEffect(() => { autoFrameRef.current = autoFrame; }, [autoFrame]);
    useEffect(() => { showOverlayRef.current = showNewsOverlay; }, [showNewsOverlay]);
    useEffect(() => { showParticlesRef.current = showParticles; }, [showParticles]);
    useEffect(() => { mouthRegionRef.current = mouthRegion; }, [mouthRegion]);
    useEffect(() => {
      overlayStateRef.current = { ...overlayStateRef.current, ...overlay };
    }, [overlay]);

    // Detection lifecycle
    const [detecting, setDetecting] = useState(false);
    const detectionGenerationRef = useRef(0);
    const [animationError, setAnimationError] = useState<string | null>(null);
    const [modelState, setModelState] = useState<"idle" | "warming" | "ready">(getModelWarmupState());
    const [liveStatus, setLiveStatus] = useState("");

    // ─── Load image + run detection ────────────────────────────────────────
    useEffect(() => {
      if (!imageUrl) return;
      detectionGenerationRef.current += 1;
      const generation = detectionGenerationRef.current;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        if (detectionGenerationRef.current !== generation) return;
        imgRef.current = img;
        framingRef.current = computePetFraming(
          { width: img.width, height: img.height },
          null,
          CANVAS_W,
          CANVAS_H,
        );
        bboxRef.current = null;
        animatorRef.current.reset();
        particlesRef.current.clear();

        if (getModelWarmupState() === "idle") {
          warmupPetDetector().catch(() => undefined);
        }

        setDetecting(true);
        setLiveStatus("Detecting pet position");
        try {
          // Detection runs against an offscreen canvas snapshot of the original image.
          const off = document.createElement("canvas");
          off.width = CANVAS_W;
          off.height = CANVAS_H;
          const offCtx = off.getContext("2d")!;
          const fit = fitCentred(img, CANVAS_W, CANVAS_H);
          offCtx.fillStyle = "#000";
          offCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
          offCtx.drawImage(img, fit.drawX, fit.drawY, fit.drawW, fit.drawH);

          const result = await detectPetMouth(off, CANVAS_W, CANVAS_H);
          if (detectionGenerationRef.current !== generation) return;

          onDetection(result);
          if (result.detected && result.bbox) {
            bboxRef.current = result.bbox;
            framingRef.current = computePetFraming(
              { width: img.width, height: img.height },
              result.bbox,
              CANVAS_W,
              CANVAS_H,
            );
            // Mouth region must be re-projected through the framing.
            const mouthCenter = reprojectNorm(
              { x: result.mouthRegion.x, y: result.mouthRegion.y },
              framingRef.current,
              CANVAS_W,
              CANVAS_H,
            );
            const reprojected: MouthRegion = {
              x: mouthCenter.x,
              y: mouthCenter.y,
              w: Math.min(0.4, result.mouthRegion.w * framingRef.current.zoom),
              h: Math.min(0.2, result.mouthRegion.h * framingRef.current.zoom),
            };
            onMouthRegionChange(reprojected);
            setLiveStatus(
              `${result.petClass} detected with ${Math.round(result.confidence * 100)}% confidence`,
            );
          } else {
            setLiveStatus("Pet not clearly detected. Click to position the mouth manually.");
          }
        } catch {
          /* fallback stays */
        } finally {
          setDetecting(false);
        }
      };
      img.onerror = () => {
        if (detectionGenerationRef.current !== generation) return;
        imgRef.current = null;
        framingRef.current = null;
        setLiveStatus("Failed to load pet image");
      };
      img.src = imageUrl;
    }, [imageUrl, onDetection, onMouthRegionChange]);

    // ─── Animation loop ───────────────────────────────────────────────────
    const animate = useCallback((time: number) => {
      const dt = lastTimeRef.current ? time - lastTimeRef.current : 16;
      lastTimeRef.current = time;

      // Drive HeadAudio analysis (still produces visemes when playing)
      headAudioRef.current?.update(dt);

      const mainCanvas = canvasRef.current;
      if (mainCanvas) {
        const ctx = mainCanvas.getContext("2d");
        if (ctx) {
          drawFrame(ctx, time, dt);
        }
      }

      // Mirror to recording canvas (only while recording — saves CPU otherwise).
      if (recordCanvasRef.current && isPlayingRef.current && mainCanvas) {
        const rCtx = recordCanvasRef.current.getContext("2d");
        if (rCtx) rCtx.drawImage(mainCanvas, 0, 0);
      }

      animRef.current = requestAnimationFrame(animate);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Composite a single frame onto the supplied 2D context. */
    const drawFrame = useCallback((ctx: CanvasRenderingContext2D, timeMs: number, dtMs: number) => {
      const seconds = timeMs / 1000;
      const animState = animatorRef.current.update(timeMs);

      // 1. Background
      drawBroadcastBackground(ctx, CANVAS_W, CANVAS_H, seconds);

      // 2. Pet image with body transform + auto-framing
      const img = imgRef.current;
      if (img) {
        const framing = autoFrameRef.current && framingRef.current
          ? framingRef.current
          : computePetFraming({ width: img.width, height: img.height }, null, CANVAS_W, CANVAS_H);

        ctx.save();
        // Animator transforms applied AROUND the pet centre.
        const centreX = CANVAS_W / 2;
        const centreY = CANVAS_H / 2;
        ctx.translate(centreX, centreY + animState.body.translateY);
        ctx.rotate(animState.body.rotate);
        ctx.scale(animState.body.scale, animState.body.scale);
        ctx.translate(-centreX, -centreY);

        // Framing (zoom/pan) inside the body transform.
        ctx.translate(framing.panX, framing.panY);
        ctx.translate(centreX, centreY);
        ctx.scale(framing.zoom, framing.zoom);
        ctx.translate(-centreX, -centreY);

        const fit = fitCentred(img, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, fit.drawX, fit.drawY, fit.drawW, fit.drawH);
        ctx.restore();
      }

      // 3. Eye blink overlay (use bbox + framing-projected coords)
      if (bboxRef.current && animState.blink > 0 && autoFrameRef.current && framingRef.current) {
        // bbox is normalised in original-canvas coords; framing has already been baked
        // into the photo transform, so we use the same framing to derive eye position.
        const eyeAnchor = reprojectNorm(
          { x: bboxRef.current.cx, y: bboxRef.current.y + bboxRef.current.h * 0.42 },
          framingRef.current,
          CANVAS_W,
          CANVAS_H,
        );
        drawEyeBlink(
          ctx,
          {
            x: eyeAnchor.x - (bboxRef.current.w * framingRef.current.zoom) / 2,
            y: eyeAnchor.y - (bboxRef.current.h * framingRef.current.zoom) * 0.05,
            w: bboxRef.current.w * framingRef.current.zoom,
            h: bboxRef.current.h * framingRef.current.zoom * 0.1,
          },
          animState.blink,
          CANVAS_W,
          CANVAS_H,
        );
      } else if (bboxRef.current && animState.blink > 0) {
        drawEyeBlink(ctx, bboxRef.current, animState.blink, CANVAS_W, CANVAS_H);
      }

      // 4. Mouth — animated when playing, indicator when paused
      const region = mouthRegionRef.current;
      if (isPlayingRef.current) {
        const shape = computeMouthShape(visemeRef.current);
        drawMouth(ctx, region, CANVAS_W, CANVAS_H, shape);
      } else {
        drawMouthIndicator(ctx, region);
      }

      // 5. Particles
      if (showParticlesRef.current) {
        if (isPlayingRef.current) {
          particlesRef.current.spawnFromAmplitude(
            animState.amplitude,
            region.x * CANVAS_W,
            region.y * CANVAS_H - 8,
            dtMs,
          );
        }
        particlesRef.current.update(dtMs);
        particlesRef.current.draw(ctx);
      }

      // 6. News overlay (lower third + ticker + logo)
      if (showOverlayRef.current) {
        if (isPlayingRef.current) {
          const elapsedSec = (timeMs - playStartTimeRef.current) / 1000;
          overlayStateRef.current.tickerOffsetPx = elapsedSec * TICKER_SPEED_PX_PER_SEC;
        }
        drawNewsOverlay(ctx, overlayStateRef.current, CANVAS_W, CANVAS_H, seconds);
      }
    }, []);

    // ─── Mouth click + keyboard nudge ──────────────────────────────────────
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const x = ((e.clientX - rect.left) * scaleX) / CANVAS_W;
      const y = ((e.clientY - rect.top) * scaleY) / CANVAS_H;
      onMouthRegionChange({ ...mouthRegionRef.current, x, y });
      setLiveStatus(`Mouth repositioned to ${Math.round(x * 100)}%, ${Math.round(y * 100)}%`);
    }, [onMouthRegionChange]);

    const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      const region = mouthRegionRef.current;
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case "ArrowLeft": dx = -NUDGE_STEP; break;
        case "ArrowRight": dx = NUDGE_STEP; break;
        case "ArrowUp": dy = -NUDGE_STEP; break;
        case "ArrowDown": dy = NUDGE_STEP; break;
        default: return;
      }
      e.preventDefault();
      const newX = Math.max(0.05, Math.min(0.95, region.x + dx));
      const newY = Math.max(0.05, Math.min(0.95, region.y + dy));
      onMouthRegionChange({ ...region, x: newX, y: newY });
      setLiveStatus(`Mouth moved to ${Math.round(newX * 100)}%, ${Math.round(newY * 100)}%`);
    }, [onMouthRegionChange]);

    // ─── HeadAudio + recording bootstrap ──────────────────────────────────
    useEffect(() => {
      let disposed = false;

      async function init() {
        try {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          await ctx.audioWorklet.addModule(AVATAR_CONFIG.headWorkletUrl);
          if (disposed) return;

          let mod: unknown;
          try {
            mod = await importWithTimeout<unknown>(HEADAUDIO_CDN, { timeoutMs: CDN_TIMEOUT_MS });
          } catch (err) {
            if (err instanceof CdnLoadTimeout) {
              log.warn("HeadAudio CDN timeout — pet will play audio without lip-sync:", err.message);
              if (!disposed) setAnimationError("Animation engine offline — audio only.");
            } else {
              log.error("HeadAudio CDN import failed:", err);
              if (!disposed) setAnimationError("Failed to load animation engine.");
            }
            // Even without HeadAudio, start the animation loop so background/particles work.
            if (!disposed) {
              const rc = document.createElement("canvas");
              rc.width = CANVAS_W;
              rc.height = CANVAS_H;
              recordCanvasRef.current = rc;
              animRef.current = requestAnimationFrame(animate);
            }
            return;
          }
          if (disposed) return;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const HaClass = (mod as any).HeadAudio;
          if (!HaClass) {
            if (!disposed) setAnimationError("Animation engine module missing.");
            return;
          }
          const ha = new HaClass(ctx);
          try {
            await ha.loadModel(AVATAR_CONFIG.headAudioModelUrl);
          } catch (err) {
            log.error("HeadAudio model loading failed:", err);
            if (!disposed) setAnimationError("Lip-sync model unavailable. Pet still animates.");
            return;
          }
          if (disposed) return;

          ha.onvalue = (key: string, value: number) => {
            visemeRef.current[key] = value;
          };
          headAudioRef.current = ha;
          setAnimationError(null);

          const rc = document.createElement("canvas");
          rc.width = CANVAS_W;
          rc.height = CANVAS_H;
          recordCanvasRef.current = rc;

          animRef.current = requestAnimationFrame(animate);
        } catch (err) {
          log.error("Animation engine initialization failed:", err);
          if (!disposed) setAnimationError("Animation engine failed.");
        }
      }

      init();

      return () => {
        disposed = true;
        cancelAnimationFrame(animRef.current);
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
        headAudioRef.current = null;
        analyserRef.current = null;
      };
    }, [animate]);

    useEffect(() => {
      if (modelState === "idle") {
        warmupPetDetector().then(
          () => setModelState("ready"),
          () => setModelState("idle"),
        );
      }
    }, [modelState]);

    // ─── Imperative handle ─────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      playWithLipSync: async (blob: Blob) => {
        const ctx = audioCtxRef.current;
        if (!ctx) throw new Error("Audio not initialized");

        await ctx.resume();
        if (sourceRef.current) {
          try { sourceRef.current.stop(); } catch { /* */ }
          sourceRef.current.disconnect();
        }

        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        // Always wire analyser so animator gets amplitude even without HeadAudio.
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyserRef.current = analyser;
        animatorRef.current.attachAnalyser(analyser);

        if (headAudioRef.current) source.connect(headAudioRef.current);
        source.connect(ctx.destination);

        sourceRef.current = source;
        isPlayingRef.current = true;
        playStartTimeRef.current = performance.now();
        animatorRef.current.triggerBlink(performance.now());

        return new Promise<void>((resolve) => {
          source.onended = () => {
            isPlayingRef.current = false;
            sourceRef.current = null;
            animatorRef.current.attachAnalyser(null);
            if (showParticlesRef.current) {
              particlesRef.current.burstConfetti(CANVAS_W / 2, CANVAS_H * 0.55);
            }
            resolve();
          };
          source.start(0);
        });
      },

      playAndRecord: async (blob: Blob): Promise<Blob> => {
        const ctx = audioCtxRef.current;
        const recCanvas = recordCanvasRef.current;
        if (!ctx || !recCanvas) throw new Error("Animation engine not initialized");

        await ctx.resume();
        if (sourceRef.current) {
          try { sourceRef.current.stop(); } catch { /* */ }
          sourceRef.current.disconnect();
        }

        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyserRef.current = analyser;
        animatorRef.current.attachAnalyser(analyser);

        if (headAudioRef.current) source.connect(headAudioRef.current);

        const audioDest = ctx.createMediaStreamDestination();
        source.connect(audioDest);
        source.connect(ctx.destination);

        sourceRef.current = source;
        isPlayingRef.current = true;
        playStartTimeRef.current = performance.now();
        animatorRef.current.triggerBlink(performance.now());

        const { detectRecordingFormat } = await import("@/lib/video-recorder");
        const format = detectRecordingFormat();

        const videoStream = recCanvas.captureStream(30);
        const combined = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDest.stream.getAudioTracks(),
        ]);

        const mediaRecorder = new MediaRecorder(combined, { mimeType: format.mimeType });
        const chunks: Blob[] = [];
        const startTime = Date.now();

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        mediaRecorder.start(100);
        source.start(0);

        return new Promise<Blob>((resolve, reject) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            isPlayingRef.current = false;
            sourceRef.current = null;
            animatorRef.current.attachAnalyser(null);
            if (showParticlesRef.current) {
              particlesRef.current.burstConfetti(CANVAS_W / 2, CANVAS_H * 0.55);
            }
            // Give the confetti burst a moment to render before stopping the recording.
            setTimeout(() => mediaRecorder.stop(), 700);
          };

          source.onended = finish;

          mediaRecorder.onstop = async () => {
            try {
              const duration = Date.now() - startTime;
              const rawBlob = new Blob(chunks, { type: format.mimeType });
              if (format.extension === "webm") {
                const { default: fixWebmDuration } = await import("fix-webm-duration");
                const fixedBlob = await fixWebmDuration(rawBlob, duration, { logger: false });
                resolve(fixedBlob);
              } else {
                resolve(rawBlob);
              }
            } catch (err) {
              reject(err instanceof Error ? err : new Error("Failed to finalize recording"));
            }
          };
        });
      },

      getRecordingCanvas: () => recordCanvasRef.current,
      getAudioCtx: () => audioCtxRef.current,
    }), []);

    // ─── Render ───────────────────────────────────────────────────────────
    return (
      <>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{liveStatus}</div>

        <div
          className="relative rounded-xl overflow-hidden bg-black cursor-crosshair w-full"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          role="img"
          aria-label="Pet news canvas. Click to set mouth animation position. Use arrow keys to nudge."
          tabIndex={0}
          onKeyDown={handleCanvasKeyDown}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full h-full block"
            onClick={handleCanvasClick}
            aria-hidden="true"
          />

          {detecting && (
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-lg animate-pulse">
              Detecting pet...
            </div>
          )}
          {modelState === "warming" && !detecting && (
            <div className="absolute top-2 left-2 bg-black/70 text-gray-300 text-xs font-medium px-2 py-1 rounded-lg">
              Preparing detector...
            </div>
          )}
          {animationError && (
            <div className="absolute top-2 left-2 right-16 bg-red-900/80 text-red-100 text-xs font-bold px-3 py-2 rounded-lg" role="alert">
              ⚠️ {animationError}
            </div>
          )}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-gray-200 text-[10px] px-2 py-1 rounded opacity-90 pointer-events-none select-none">
            Tap to reposition mouth
          </div>
        </div>
      </>
    );
  },
);

PetCanvas.displayName = "PetCanvas";
export default PetCanvas;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function drawMouthIndicator(ctx: CanvasRenderingContext2D, region: MouthRegion): void {
  const cx = region.x * CANVAS_W;
  const cy = region.y * CANVAS_H;
  const rw = (region.w * CANVAS_W) / 2;
  const rh = (region.h * CANVAS_H) / 2;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 80, 80, 0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
