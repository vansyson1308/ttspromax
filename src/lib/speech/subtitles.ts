/**
 * Subtitle export (SRT / WebVTT) from render cues.
 *
 * Cues are per sentence (Edge) or per paragraph (Gemini). Long cues are
 * split into readable chunks (≤ 2 lines × 42 chars, broadcast convention),
 * and each chunk is timed from the word-boundary marks when available,
 * otherwise interpolated linearly across the cue.
 */

export interface CueWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TimedCue {
  index: number;
  /** Paragraph index, used for transcript layout. */
  paragraph?: number;
  text: string;
  startMs: number;
  endMs: number;
  words?: CueWord[];
}

export const LINE_CHARS = 42;
export const CUE_CHARS = LINE_CHARS * 2;

/**
 * Split text into balanced chunks of at most `max` chars (no orphan
 * one-word cues), preferring to break after clause punctuation.
 */
export function chunkText(text: string, max = CUE_CHARS): string[] {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean ? [clean] : [];
  const tokens = clean.split(" ");
  const n = Math.ceil(clean.length / max);
  const target = clean.length / n;
  const chunks: string[] = [];
  let cur = "";
  for (const tok of tokens) {
    const candidate = cur ? `${cur} ${tok}` : tok;
    const remainingChunks = n - chunks.length;
    if (cur && remainingChunks > 1 && (candidate.length > Math.min(max, target * 1.2))) {
      chunks.push(cur);
      cur = tok;
      continue;
    }
    cur = candidate;
    if (remainingChunks > 1 && /[,;:.!?…]$/.test(tok) && cur.length >= target * 0.75) {
      chunks.push(cur);
      cur = "";
    }
  }
  if (cur) chunks.push(cur);
  // Safety: any chunk still over the limit gets a hard greedy split.
  return chunks.flatMap((c) => {
    if (c.length <= max) return [c];
    const out: string[] = [];
    let acc = "";
    for (const tok of c.split(" ")) {
      if (acc && `${acc} ${tok}`.length > max) {
        out.push(acc);
        acc = tok;
      } else acc = acc ? `${acc} ${tok}` : tok;
    }
    if (acc) out.push(acc);
    return out;
  });
}

/** Wrap one chunk into at most two balanced lines. */
export function wrapLines(text: string, max = LINE_CHARS): string {
  if (text.length <= max) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " " && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best === -1 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
}

function timeAtFraction(cue: TimedCue, f: number): number {
  const words = cue.words ?? [];
  if (words.length >= 2) {
    const lens = words.map((w) => w.text.length + 1);
    const total = lens.reduce((a, b) => a + b, 0);
    const target = f * total;
    let acc = 0;
    for (let i = 0; i < words.length; i++) {
      if (acc + lens[i] > target) return words[i].startMs;
      acc += lens[i];
    }
    return cue.endMs;
  }
  return cue.startMs + (cue.endMs - cue.startMs) * f;
}

export function splitCue(cue: TimedCue, max = CUE_CHARS): TimedCue[] {
  const text = cue.text.replace(/\s+/g, " ").trim();
  if (text.length <= max) return [{ ...cue, text }];
  const chunks = chunkText(text, max);
  const out: TimedCue[] = [];
  let consumed = 0;
  chunks.forEach((chunk, i) => {
    const startF = consumed / text.length;
    consumed += chunk.length + 1;
    const endF = Math.min(1, consumed / text.length);
    const startMs = i === 0 ? cue.startMs : timeAtFraction(cue, startF);
    const endMs = i === chunks.length - 1 ? cue.endMs : Math.max(startMs + 300, timeAtFraction(cue, endF) - 40);
    out.push({ index: cue.index, text: chunk, startMs, endMs });
  });
  return out;
}

function stamp(ms: number, sep: "," | "."): string {
  const t = Math.max(0, Math.round(ms));
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  const r = t % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

function expand(cues: TimedCue[]): TimedCue[] {
  return cues
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .flatMap((c) => splitCue(c));
}

export function toSrt(cues: TimedCue[]): string {
  return expand(cues)
    .map((c, i) => `${i + 1}\n${stamp(c.startMs, ",")} --> ${stamp(c.endMs, ",")}\n${wrapLines(c.text)}\n`)
    .join("\n");
}

export function toVtt(cues: TimedCue[]): string {
  const body = expand(cues)
    .map((c) => `${stamp(c.startMs, ".")} --> ${stamp(c.endMs, ".")}\n${wrapLines(c.text)}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}
