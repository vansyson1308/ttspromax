/**
 * Pet animator — produces lifelike micro-motion driven by audio amplitude.
 *
 * Outputs three independent streams (read each frame):
 *   - body transform (translate/rotate/scale) for breathing + bobbing + tilt
 *   - blink mask (0..1) for eye-close opacity
 *   - amplitude (0..1) for downstream effects (particle bursts, etc.)
 *
 * Owns nothing render-related; the canvas is the caller's job.
 */

export interface BodyTransform {
  /** Pixel offset added to the photo's vertical position. */
  translateY: number;
  /** Rotation in radians applied to the photo (small, ±2°). */
  rotate: number;
  /** Scale multiplier (subtle "breathing" — 0.99..1.01). */
  scale: number;
}

export interface AnimatorState {
  body: BodyTransform;
  /** 0 = eyes open, 1 = fully closed. Use as alpha for an overlay over eye region. */
  blink: number;
  /** Rolling 0..1 amplitude (peak-following, not raw RMS). */
  amplitude: number;
}

const TWO_PI = Math.PI * 2;

interface AnimatorOptions {
  /** Idle breathing amplitude in pixels (default 4). */
  breathPx?: number;
  /** Breathing period in seconds (default 3). */
  breathPeriod?: number;
  /** Audio bob multiplier in pixels (default 14). */
  audioBobPx?: number;
  /** Tilt period in seconds (default 6). */
  tiltPeriod?: number;
  /** Tilt amplitude in radians (default 0.025 ≈ 1.4°). */
  tiltAmplitude?: number;
  /** Smoothing for amplitude follower in [0..1] (default 0.85). */
  amplitudeSmoothing?: number;
  /** Blink duration in ms (default 220). */
  blinkDurationMs?: number;
  /** Mean time between blinks in ms (default 4000, randomised ±50%). */
  blinkIntervalMs?: number;
}

export class PetAnimator {
  private opts: Required<AnimatorOptions>;
  private analyser: AnalyserNode | null = null;
  private analyserBuf: Uint8Array<ArrayBuffer> | null = null;
  private smoothedAmp = 0;
  private nextBlinkAt: number;
  private blinkStart = 0;
  private state: AnimatorState = {
    body: { translateY: 0, rotate: 0, scale: 1 },
    blink: 0,
    amplitude: 0,
  };

  constructor(options: AnimatorOptions = {}) {
    this.opts = {
      breathPx: options.breathPx ?? 4,
      breathPeriod: options.breathPeriod ?? 3,
      audioBobPx: options.audioBobPx ?? 14,
      tiltPeriod: options.tiltPeriod ?? 6,
      tiltAmplitude: options.tiltAmplitude ?? 0.025,
      amplitudeSmoothing: options.amplitudeSmoothing ?? 0.85,
      blinkDurationMs: options.blinkDurationMs ?? 220,
      blinkIntervalMs: options.blinkIntervalMs ?? 4000,
    };
    this.nextBlinkAt = this.scheduleNextBlink(0);
  }

  /** Plug in a Web Audio analyser. Pass `null` to detach (back to idle). */
  attachAnalyser(analyser: AnalyserNode | null): void {
    this.analyser = analyser;
    if (analyser) {
      this.analyserBuf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    } else {
      this.analyserBuf = null;
    }
  }

  /** Call once per frame with the current high-resolution time in ms. */
  update(timeMs: number): AnimatorState {
    const seconds = timeMs / 1000;

    // ─── Amplitude (peak follower) ─────────────────────────────────
    let rawAmp = 0;
    if (this.analyser && this.analyserBuf) {
      this.analyser.getByteTimeDomainData(this.analyserBuf);
      let peak = 0;
      // Sample a sparse subset — much cheaper than scanning all 2048 bytes.
      const stride = Math.max(1, Math.floor(this.analyserBuf.length / 64));
      for (let i = 0; i < this.analyserBuf.length; i += stride) {
        const v = Math.abs(this.analyserBuf[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      rawAmp = peak;
    }
    const a = this.opts.amplitudeSmoothing;
    this.smoothedAmp = this.smoothedAmp * a + rawAmp * (1 - a);

    // ─── Body transform ────────────────────────────────────────────
    const breath = Math.sin((seconds / this.opts.breathPeriod) * TWO_PI) * this.opts.breathPx;
    const audioBob = -this.smoothedAmp * this.opts.audioBobPx;
    const tilt = Math.sin((seconds / this.opts.tiltPeriod) * TWO_PI) * this.opts.tiltAmplitude;
    // Subtle scale "breathing" — barely visible, adds life.
    const scale = 1 + Math.sin((seconds / this.opts.breathPeriod) * TWO_PI) * 0.005;

    // ─── Blink (instantaneous schedule) ────────────────────────────
    let blink = 0;
    if (this.blinkStart > 0) {
      const elapsed = timeMs - this.blinkStart;
      if (elapsed < this.opts.blinkDurationMs) {
        // Triangle wave: 0 → 1 → 0 over duration.
        const phase = elapsed / this.opts.blinkDurationMs;
        blink = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      } else {
        this.blinkStart = 0;
        this.nextBlinkAt = this.scheduleNextBlink(timeMs);
      }
    } else if (timeMs >= this.nextBlinkAt) {
      this.blinkStart = timeMs;
    }

    this.state.body.translateY = breath + audioBob;
    this.state.body.rotate = tilt;
    this.state.body.scale = scale;
    this.state.blink = blink;
    this.state.amplitude = this.smoothedAmp;
    return this.state;
  }

  /** Force a blink (e.g. when audio starts). */
  triggerBlink(timeMs: number): void {
    this.blinkStart = timeMs;
  }

  /** Reset internal state — call when switching pet image / track. */
  reset(): void {
    this.smoothedAmp = 0;
    this.blinkStart = 0;
    this.nextBlinkAt = this.scheduleNextBlink(0);
    this.state.body.translateY = 0;
    this.state.body.rotate = 0;
    this.state.body.scale = 1;
    this.state.blink = 0;
    this.state.amplitude = 0;
  }

  private scheduleNextBlink(now: number): number {
    // Uniform jitter in [0.5, 1.5] × interval.
    const jitter = 0.5 + Math.random();
    return now + this.opts.blinkIntervalMs * jitter;
  }
}

/**
 * Draw a pair of dark "closed eyelid" arcs over the eye region.
 * Eye region is derived from pet bbox: roughly upper-third of bbox, two horizontal slits.
 */
export function drawEyeBlink(
  ctx: CanvasRenderingContext2D,
  bbox: { x: number; y: number; w: number; h: number },
  blinkAlpha: number,
  canvasW: number,
  canvasH: number,
): void {
  if (blinkAlpha <= 0) return;

  const eyeY = (bbox.y + bbox.h * 0.42) * canvasH;
  const eyeBaseW = bbox.w * canvasW * 0.18;
  const eyeBaseH = Math.max(4, bbox.h * canvasH * 0.05);
  const cx = (bbox.x + bbox.w / 2) * canvasW;
  const eyeOffset = bbox.w * canvasW * 0.18;

  ctx.save();
  ctx.globalAlpha = blinkAlpha * 0.85;
  ctx.fillStyle = "rgba(20,20,20,1)";

  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + sign * eyeOffset, eyeY, eyeBaseW * 0.6, eyeBaseH, 0, 0, TWO_PI);
    ctx.fill();
  }
  ctx.restore();
}
