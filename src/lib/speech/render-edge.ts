/**
 * Render a ScriptPlan with Edge TTS into one continuous MP3 with
 * broadcast-grade pause control and per-sentence/word timings.
 *
 * Each sentence is synthesised separately (in parallel, bounded), then
 * stitched in order:
 *
 *   [clip 1 speech][tail] [silence] [lead][clip 2 speech][tail] ...
 *                   └───── pauseBeforeMs of clip 2 ─────┘
 *
 * Edge pads every request with ~100 ms of lead-in and 350–850 ms of trailing
 * silence (voice dependent). Naive concatenation therefore produces pauses
 * that are too long and inconsistent. We cut each clip shortly after its
 * last word (word-boundary metadata) and insert exactly the silence needed
 * so that speech-to-speech gaps match the plan.
 *
 * Server-only (depends on the Edge client).
 */

import { synthesizeClip, type EdgeClip } from "@/lib/edge-tts-stream";
import { frameMs, parseMp3, silence, sliceMp3 } from "./mp3";
import { formatPitch, formatRate, type ScriptPlan } from "./planner";

/** Audio kept after the last word's end (release + MP3 decoder delay). */
const TAIL_KEEP_MS = 140;
/** Shortest tail we ever keep, so word endings are never clipped. */
const MIN_TAIL_MS = 48;
/** Typical Edge lead-in before the first word (~87–125 ms measured). */
const EXPECTED_LEAD_MS = 100;
/** Tail kept on the final sentence so the file doesn't end abruptly. */
const FINAL_TAIL_MS = 450;
/** Sentences synthesised ahead of the one currently being emitted. */
const LOOKAHEAD = 8;

export interface CueWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface Cue {
  index: number;
  paragraph: number;
  text: string;
  spoken: string;
  startMs: number;
  endMs: number;
  words: CueWord[];
}

export type RenderEvent =
  | { type: "audio"; data: Uint8Array }
  | { type: "cue"; cue: Cue }
  | { type: "progress"; done: number; total: number }
  | { type: "done"; durationMs: number };

export interface RenderOptions {
  voice: string;
  isCancelled?: () => boolean;
}

export async function* renderPlanWithEdge(
  plan: ScriptPlan,
  { voice, isCancelled }: RenderOptions,
): AsyncGenerator<RenderEvent> {
  const segs = plan.segments;
  if (!segs.length) throw new Error("No speakable text");

  const pending = new Map<number, Promise<EdgeClip>>();
  const start = (i: number) => {
    if (i >= segs.length || pending.has(i)) return;
    const s = segs[i];
    const p = synthesizeClip({ text: s.spoken, voice, rate: formatRate(s.rate), pitch: formatPitch(s.pitch) });
    p.catch(() => undefined); // surfaced when awaited
    pending.set(i, p);
  };
  for (let i = 0; i < Math.min(LOOKAHEAD, segs.length); i++) start(i);

  let header: Uint8Array | null = null;
  let perFrame = 24;
  let cursorMs = 0; // length of audio emitted so far
  let prevSpeechEndMs = 0; // absolute time the previous sentence's speech ended

  for (let i = 0; i < segs.length; i++) {
    if (isCancelled?.()) return;
    const seg = segs[i];
    const clip = await pending.get(i)!;
    pending.delete(i);
    start(i + LOOKAHEAD);

    const bytes = new Uint8Array(clip.audio.buffer, clip.audio.byteOffset, clip.audio.byteLength);
    const stream = parseMp3(bytes);
    if (!stream.frames.length || !stream.header) continue;
    if (!header) {
      header = stream.header;
      perFrame = frameMs(stream) || perFrame;
    }

    const words = clip.words;
    const leadMs = words.length ? words[0].startMs : 0;
    const lastEndMs = words.length ? words[words.length - 1].endMs : stream.durationMs;

    // Silence so that this sentence's speech starts `pauseBeforeMs` after the previous one ended.
    const targetStart = i === 0 ? seg.pauseBeforeMs : prevSpeechEndMs + seg.pauseBeforeMs;
    const gapMs = targetStart - cursorMs - leadMs;
    if (gapMs >= perFrame / 2 && header) {
      const pad = silence(header, gapMs);
      if (pad.length) {
        yield { type: "audio", data: pad };
        cursorMs += Math.round(gapMs / perFrame) * perFrame;
      }
    }

    // Short planned pauses (ads, clause breaks, pauseScale < 1) need a shorter
    // tail, because the next clip's own lead-in also counts toward the gap.
    // Effective floor ≈ MIN_TAIL_MS + lead-in ≈ 150 ms.
    const isLast = i === segs.length - 1;
    const tail = isLast
      ? FINAL_TAIL_MS
      : Math.max(MIN_TAIL_MS, Math.min(TAIL_KEEP_MS, segs[i + 1].pauseBeforeMs - EXPECTED_LEAD_MS));
    const keepUntil = words.length ? lastEndMs + tail : stream.durationMs;
    const kept = sliceMp3(bytes, stream, keepUntil);
    const keptMs = Math.min(stream.frames.length, Math.max(1, Math.ceil(keepUntil / perFrame))) * perFrame;
    const clipStart = cursorMs;
    yield { type: "audio", data: kept };
    cursorMs += Math.min(keptMs, stream.durationMs);

    yield {
      type: "cue",
      cue: {
        index: seg.index,
        paragraph: seg.paragraph,
        text: seg.display,
        spoken: seg.spoken,
        startMs: Math.round(clipStart + leadMs),
        endMs: Math.round(clipStart + lastEndMs),
        words: words.map((w) => ({
          text: w.text,
          startMs: Math.round(clipStart + w.startMs),
          endMs: Math.round(clipStart + w.endMs),
        })),
      },
    };
    yield { type: "progress", done: i + 1, total: segs.length };
    prevSpeechEndMs = clipStart + lastEndMs;
  }

  if (plan.trailingPauseMs > 0 && header) {
    const extra = plan.trailingPauseMs - FINAL_TAIL_MS;
    const pad = silence(header, extra);
    if (pad.length) {
      yield { type: "audio", data: pad };
      cursorMs += Math.round(extra / perFrame) * perFrame;
    }
  }

  yield { type: "done", durationMs: Math.round(cursorMs) };
}
