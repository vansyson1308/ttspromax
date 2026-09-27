export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { geminiTtsSchema, parseBody } from "@/lib/api-validators";
import { logger } from "@/lib/logger";
import { planScript } from "@/lib/speech/planner";
import { GEMINI_TTS_MODEL, GEMINI_VOICES, geminiEnabled, renderPlanWithGemini } from "@/lib/speech/render-gemini";

const log = logger.child("api/gemini-tts");

/** GET /api/gemini-tts — whether the premium engine is configured. */
export async function GET() {
  return Response.json({
    enabled: geminiEnabled(),
    model: GEMINI_TTS_MODEL,
    voices: GEMINI_VOICES,
  });
}

/**
 * POST /api/gemini-tts — premium, context-aware Gemini voices.
 * Same NDJSON protocol as /api/tts; audio is a single WAV (24 kHz mono)
 * split across `audio_chunk` lines, cues are per paragraph.
 */
export async function POST(request: NextRequest) {
  if (!geminiEnabled()) {
    return Response.json(
      { status: "error", message: "Gemini TTS is not configured (set GEMINI_API_KEY)" },
      { status: 503 },
    );
  }
  const parsed = await parseBody(request, geminiTtsSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!GEMINI_VOICES.some((v) => v.name === body.voice)) {
    return Response.json({ status: "error", message: "Unknown Gemini voice" }, { status: 400 });
  }

  const plan = planScript(body.text, {
    style: body.style,
    pauseScale: body.pauseScale,
    lexicon: body.lexicon,
    lang: body.lang,
    // Gemini reads numbers/dates in context; lexicon still applies.
    normalize: false,
    phrasing: false,
  });
  if (!plan.segments.length) {
    return Response.json({ status: "error", message: "No speakable text" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const abort = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (!abort.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };
      try {
        send({ status: "plan", lang: plan.lang, style: plan.style, segments: plan.segments.length });
        const result = await renderPlanWithGemini(plan, {
          voice: body.voice,
          direction: body.direction,
          signal: abort.signal,
          onProgress: (done, total) => send({ status: "progress", done, total }),
        });
        const CHUNK = 512 * 1024;
        for (let off = 0; off < result.wav.length; off += CHUNK) {
          send({ status: "audio_chunk", chunk: Buffer.from(result.wav.subarray(off, off + CHUNK)).toString("base64") });
        }
        for (const cue of result.cues) send({ status: "cue", cue: { ...cue, words: [] } });
        send({ status: "done", durationMs: result.durationMs, format: "wav" });
      } catch (err) {
        if (!abort.signal.aborted) {
          log.error("Gemini render failed:", err);
          send({ status: "error", message: err instanceof Error ? err.message : "Gemini TTS failed" });
        }
      } finally {
        if (!abort.signal.aborted) controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
}
