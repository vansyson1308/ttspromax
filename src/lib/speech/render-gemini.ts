/**
 * Gemini TTS engine (premium, optional — needs GEMINI_API_KEY).
 *
 * Gemini's speech models are LLM-based: they read whole paragraphs with
 * context-aware intonation and follow a natural-language style direction
 * ("measured TV news anchor…"). As of Sept 2026 they top blind
 * preference rankings for Vietnamese.
 *
 * We render one request per paragraph (so intonation flows across
 * sentences), trim each result's silence sample-accurately, and splice the
 * planned paragraph / manual pauses ourselves. Output is 24 kHz mono WAV.
 *
 * API: Interactions endpoint, https://ai.google.dev/gemini-api/docs/speech-generation
 */

import type { PlannedSegment, ScriptLang, ScriptPlan, StyleId } from "./planner";
import { encodeWav, fadeEdges, parseWav, silenceSamples, speechBounds } from "./wav";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
export const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const MAX_BLOCK_CHARS = 1500;
const CONCURRENCY = 3;
const EDGE_PAD_MS = 60;

export const GEMINI_VOICES: Array<{ name: string; gender: "female" | "male"; trait: string }> = [
  { name: "Kore", gender: "female", trait: "Firm" },
  { name: "Aoede", gender: "female", trait: "Breezy" },
  { name: "Leda", gender: "female", trait: "Youthful" },
  { name: "Despina", gender: "female", trait: "Smooth" },
  { name: "Erinome", gender: "female", trait: "Clear" },
  { name: "Sulafat", gender: "female", trait: "Warm" },
  { name: "Vindemiatrix", gender: "female", trait: "Gentle" },
  { name: "Charon", gender: "male", trait: "Informative" },
  { name: "Orus", gender: "male", trait: "Firm" },
  { name: "Iapetus", gender: "male", trait: "Clear" },
  { name: "Rasalgethi", gender: "male", trait: "Informative" },
  { name: "Sadaltager", gender: "male", trait: "Knowledgeable" },
  { name: "Algieba", gender: "male", trait: "Smooth" },
  { name: "Gacrux", gender: "male", trait: "Mature" },
];

const STYLE_DIRECTIONS: Record<StyleId, string> = {
  natural:
    "Natural, warm, human delivery. Conversational but clear, with natural breathing pauses at punctuation.",
  news:
    "Professional television news anchor. Clear, confident and credible; measured broadcast pace; precise phrasing with crisp pauses at commas and full stops; subtle emphasis on key figures, names and places; no exaggerated emotion.",
  story:
    "Audiobook narrator. Warm, expressive and immersive; unhurried pace; deeper pauses between sentences; let emotion follow the story.",
  podcast:
    "Friendly podcast host talking to one listener. Relaxed, engaging, smiling voice; lively rhythm.",
  ads:
    "Energetic commercial voice-over. Upbeat, persuasive, punchy rhythm; highlight the key offer.",
};

function direction(style: StyleId, lang: ScriptLang, extra?: string): string {
  const langHint =
    lang === "vi"
      ? " Speak Vietnamese with native, standard pronunciation and correct tones."
      : " Speak English with a natural, neutral accent.";
  return STYLE_DIRECTIONS[style] + langHint + (extra ? ` ${extra}` : "");
}

export function geminiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

interface Block {
  text: string;
  segments: PlannedSegment[];
  pauseBeforeMs: number;
}

/** Group sentences into paragraph blocks; break at paragraphs/lines/manual pauses. */
export function groupBlocks(segments: PlannedSegment[]): Block[] {
  const blocks: Block[] = [];
  for (const seg of segments) {
    const cur = blocks[blocks.length - 1];
    const joinable =
      cur &&
      !seg.manualPause &&
      (seg.boundary === "sentence" || seg.boundary === "clause") &&
      cur.text.length + seg.spoken.length < MAX_BLOCK_CHARS;
    if (joinable) {
      cur.text += " " + seg.spoken;
      cur.segments.push(seg);
    } else {
      blocks.push({ text: seg.spoken, segments: [seg], pauseBeforeMs: seg.pauseBeforeMs });
    }
  }
  return blocks;
}

function findAudioBase64(node: unknown): string | null {
  let best: string | null = null;
  const visit = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(visit);
    const o = n as Record<string, unknown>;
    const mime = String(o.mime_type ?? o.mimeType ?? o.type ?? "");
    if (typeof o.data === "string" && (/audio/i.test(mime) || o.data.length > 1000)) {
      if (!best || o.data.length > best.length) best = o.data;
    }
    Object.values(o).forEach(visit);
  };
  visit(node);
  return best;
}

async function synthesizeBlock(text: string, voice: string, style: string, signal?: AbortSignal) {
  const res = await fetch(API_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
    },
    body: JSON.stringify({
      model: GEMINI_TTS_MODEL,
      input: [
        {
          type: "user_input",
          content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }],
        },
      ],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let message = `Gemini TTS error (HTTP ${res.status})`;
    try {
      const j = JSON.parse(detail);
      message = j.error?.message || message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const json = await res.json();
  const b64 = findAudioBase64(json);
  if (!b64) throw new Error("Gemini TTS returned no audio");
  return parseWav(new Uint8Array(Buffer.from(b64, "base64")));
}

export interface GeminiCue {
  index: number;
  paragraph: number;
  text: string;
  startMs: number;
  endMs: number;
}

export async function renderPlanWithGemini(
  plan: ScriptPlan,
  opts: { voice: string; direction?: string; signal?: AbortSignal; onProgress?: (done: number, total: number) => void },
): Promise<{ wav: Uint8Array; cues: GeminiCue[]; durationMs: number }> {
  const blocks = groupBlocks(plan.segments);
  const style = direction(plan.style, plan.lang, opts.direction);

  // Bounded parallelism, results kept in order. The first failure (or a
  // client cancel) aborts the remaining paid requests.
  const abort = new AbortController();
  const onCancel = () => abort.abort();
  opts.signal?.addEventListener("abort", onCancel);
  const results: Awaited<ReturnType<typeof synthesizeBlock>>[] = new Array(blocks.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < blocks.length && !abort.signal.aborted) {
      const i = next++;
      results[i] = await synthesizeBlock(blocks[i].text, opts.voice, style, abort.signal);
      opts.onProgress?.(++done, blocks.length);
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, blocks.length) }, () =>
        worker().catch((err) => {
          abort.abort();
          throw err;
        }),
      ),
    );
  } finally {
    opts.signal?.removeEventListener("abort", onCancel);
  }
  if (abort.signal.aborted) throw new Error("Gemini render cancelled");

  const sampleRate = results[0]?.sampleRate ?? 24_000;
  const chunks: Int16Array[] = [];
  const cues: GeminiCue[] = [];
  let cursor = 0; // samples
  const pad = silenceSamples(EDGE_PAD_MS, sampleRate);

  blocks.forEach((block, i) => {
    const pcm = results[i];
    const { start, end } = speechBounds(pcm);
    const speech = fadeEdges(pcm.samples.subarray(start, end), sampleRate);
    const gap = i === 0 ? block.pauseBeforeMs : Math.max(0, block.pauseBeforeMs - 2 * EDGE_PAD_MS);
    const lead = silenceSamples(gap, sampleRate);
    chunks.push(lead, pad);
    cursor += lead.length + pad.length;
    const startMs = (cursor / sampleRate) * 1000;
    chunks.push(speech);
    cursor += speech.length;
    const endMs = (cursor / sampleRate) * 1000;
    chunks.push(pad);
    cursor += pad.length;
    cues.push({
      index: i,
      paragraph: block.segments[0].paragraph,
      text: block.segments.map((s) => s.display).join(" "),
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
    });
  });
  if (plan.trailingPauseMs > 0) {
    const tail = silenceSamples(plan.trailingPauseMs, sampleRate);
    chunks.push(tail);
    cursor += tail.length;
  }

  return { wav: encodeWav(chunks, sampleRate), cues, durationMs: Math.round((cursor / sampleRate) * 1000) };
}
