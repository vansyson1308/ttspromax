export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import voicesData from "@/data/voices.json";
import { parseBody, ttsSchema } from "@/lib/api-validators";
import { logger } from "@/lib/logger";
import { planScript } from "@/lib/speech/planner";
import { renderPlanWithEdge } from "@/lib/speech/render-edge";

interface VoiceEntry {
  id: number;
  voice_id: string;
  locale: string;
  display_name: string;
  gender: string;
  type: string;
}

const voices = voicesData as VoiceEntry[];
const log = logger.child("api/tts");

/**
 * POST /api/tts — Edge TTS (Microsoft Neural) with the Voice Studio pipeline.
 *
 * text → lexicon → normalisation → sentence plan (style, pauses, prosody)
 *      → parallel per-sentence synthesis → trimmed + spliced MP3.
 *
 * NDJSON response lines:
 *   { status: "plan", segments, lang, style }
 *   { status: "audio_chunk", chunk }               base64 MP3, in order
 *   { status: "cue", cue: { index, text, startMs, endMs, words[] } }
 *   { status: "progress", done, total }
 *   { status: "done", durationMs }
 *   { status: "error", message }
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, ttsSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const voice = voices.find((v) => v.id === body.id);
  if (!voice) return jsonResponse({ status: "error", message: "Voice not found" }, 404);
  if (voice.type === "onnx" || voice.type === "makevoice") {
    return jsonResponse({ status: "error", message: "This voice is not served by /api/tts" }, 400);
  }

  const plan = planScript(body.text, {
    style: body.style,
    rate: body.rate,
    pitch: body.pitch,
    pauseScale: body.pauseScale,
    phrasing: body.phrasing,
    lexicon: body.lexicon,
    // Native Vietnamese voices always get Vietnamese normalisation;
    // multilingual voices follow the text.
    lang: body.lang ?? (voice.locale === "vi-VN" ? "vi" : undefined),
  });
  if (!plan.segments.length) {
    return jsonResponse({ status: "error", message: "No speakable text" }, 400);
  }

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };
      try {
        send({
          status: "plan",
          lang: plan.lang,
          style: plan.style,
          segments: plan.segments.map((s) => ({
            index: s.index,
            text: s.display,
            spoken: s.spoken,
            pauseBeforeMs: s.pauseBeforeMs,
          })),
        });
        for await (const ev of renderPlanWithEdge(plan, { voice: voice.voice_id, isCancelled: () => cancelled })) {
          if (ev.type === "audio") send({ status: "audio_chunk", chunk: Buffer.from(ev.data).toString("base64") });
          else if (ev.type === "cue") send({ status: "cue", cue: ev.cue });
          else if (ev.type === "progress") send({ status: "progress", done: ev.done, total: ev.total });
          else if (ev.type === "done") send({ status: "done", durationMs: ev.durationMs });
        }
      } catch (err) {
        log.error("TTS render failed:", err);
        send({ status: "error", message: err instanceof Error ? err.message : "TTS failed" });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
