"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { AVATAR_CONFIG } from "@/lib/avatar-config";
import { getOrCreatePipeline, playAudioBlob, setPitch, stopPlayback, destroyPipeline } from "@/lib/audio-pipeline";
import { importWithTimeout, parallelWithTimeout, CdnLoadTimeout } from "@/lib/cdn-loader";
import { logger } from "@/lib/logger";

const TALKINGHEAD_CDN = "https://cdn.jsdelivr.net/npm/@met4citizen/talkinghead@1.7.0/modules/talkinghead.mjs";
const HEADAUDIO_CDN = "https://cdn.jsdelivr.net/npm/@met4citizen/headaudio@0.1.0/modules/headaudio.mjs";
const CDN_TIMEOUT_MS = 8000;

export interface AvatarHandle {
  playAudio: (blob: Blob) => Promise<void>;
  setPitch: (semitones: number) => void;
  stop: () => void;
}

const log = logger.child("Avatar");

const AvatarContainer = forwardRef<AvatarHandle, { className?: string }>(
  function AvatarContainer({ className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headRef = useRef<any>(null);
    const animFrameRef = useRef<number>(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headAudioRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [degraded, setDegraded] = useState(false);
    const lastTimeRef = useRef(0);

    const animate = useCallback((time: number) => {
      const dt = lastTimeRef.current ? time - lastTimeRef.current : 16;
      lastTimeRef.current = time;
      headAudioRef.current?.update(dt);
      animFrameRef.current = requestAnimationFrame(animate);
    }, []);

    useEffect(() => {
      let disposed = false;
      const abortController = new AbortController();

      async function init() {
        if (!containerRef.current) return;

        try {
          // Load TalkingHead + HeadAudio in parallel — neither depends on the other for import.
          const [thModule, haModule, pipeline] = await parallelWithTimeout([
            importWithTimeout<{ TalkingHead: new (el: HTMLElement, opts: object) => unknown }>(
              TALKINGHEAD_CDN,
              { timeoutMs: CDN_TIMEOUT_MS, signal: abortController.signal },
            ),
            importWithTimeout<{ HeadAudio: new (ctx: AudioContext) => unknown }>(
              HEADAUDIO_CDN,
              { timeoutMs: CDN_TIMEOUT_MS, signal: abortController.signal },
            ),
            getOrCreatePipeline(),
          ], CDN_TIMEOUT_MS + 4000);

          if (disposed) return;

          // ─── Initialise TalkingHead avatar ─────────────────────────
          const TalkingHead = thModule.TalkingHead;
          const head = new TalkingHead(containerRef.current, {
            ttsEndpoint: "",
            lipsyncModules: [],
            modelFPS: 30,
            cameraView: "upper",
            cameraRotateEnable: true,
            cameraPanEnable: false,
            cameraZoomEnable: false,
            lightAmbientIntensity: 2,
            lightDirectIntensity: 20,
            avatarMood: "neutral",
            avatarMute: true,
          }) as unknown as { showAvatar: (cfg: object) => Promise<void>; setValue: (k: string, v: number) => void; stop: () => void };

          await head.showAvatar({
            url: AVATAR_CONFIG.avatarUrl,
            body: "F",
            lipsyncLang: "en",
          });

          if (disposed) { head.stop(); return; }
          headRef.current = head;

          // ─── Wire up HeadAudio for visemes ─────────────────────────
          await pipeline.ctx.audioWorklet.addModule(AVATAR_CONFIG.headWorkletUrl);

          const HeadAudio = haModule.HeadAudio;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ha = new HeadAudio(pipeline.ctx) as any;

          try {
            await ha.loadModel(AVATAR_CONFIG.headAudioModelUrl);
          } catch (modelErr) {
            log.error("HeadAudio model failed to load:", modelErr);
            // Avatar still renders, but no lip-sync.
            setDegraded(true);
          }

          ha.onvalue = (key: string, value: number) => {
            if (headRef.current) {
              headRef.current.setValue(key, value);
            }
          };

          headAudioRef.current = ha;
          pipeline.headAudioNode = ha;

          animFrameRef.current = requestAnimationFrame(animate);
          setLoading(false);
        } catch (err) {
          if (disposed) return;
          if (err instanceof CdnLoadTimeout) {
            log.warn("CDN timeout — falling back to audio-only mode:", err.message);
            setError("Animation engine offline — playing audio without lip-sync.");
          } else {
            log.error("Init failed:", err);
            setError(err instanceof Error ? err.message : String(err));
          }
          setLoading(false);
        }
      }

      init();

      return () => {
        disposed = true;
        abortController.abort();
        cancelAnimationFrame(animFrameRef.current);
        headRef.current?.stop();
        headRef.current = null;
        headAudioRef.current = null;
        destroyPipeline();
      };
    }, [animate]);

    useImperativeHandle(ref, () => ({
      playAudio: async (blob: Blob) => {
        // Even when avatar is degraded we still play audio through the pipeline.
        await playAudioBlob(blob);
      },
      setPitch: (semitones: number) => {
        setPitch(semitones);
      },
      stop: () => {
        stopPlayback();
      },
    }), []);

    return (
      <div className={`relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 ${className || ""}`}>
        <div ref={containerRef} className="w-full" style={{ height: "300px" }} />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 dark:bg-gray-900/80">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading 3D Avatar...
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-x-0 top-0 px-3 py-2 bg-amber-100/90 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-bold text-center" role="alert">
            ⚠️ {error}
          </div>
        )}

        {degraded && !error && (
          <div className="absolute inset-x-0 top-0 px-3 py-2 bg-amber-100/90 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-bold text-center" role="status">
            ⚠️ Lip-sync unavailable — audio only.
          </div>
        )}
      </div>
    );
  }
);

AvatarContainer.displayName = "AvatarContainer";
export default AvatarContainer;
