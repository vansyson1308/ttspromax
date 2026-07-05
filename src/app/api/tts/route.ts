export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { streamEdgeTts } from "@/lib/edge-tts-stream";
import { normalizeVietnameseText } from "@/lib/vi-normalizer";
import voicesData from "@/data/voices.json";
import { parseBody, ttsSchema } from "@/lib/api-validators";
import { logger } from "@/lib/logger";

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
 * POST /api/tts
 *
 * Core technology: Edge TTS (Microsoft Neural voices).
 * voice_id = Edge TTS ShortName (e.g. "vi-VN-HoaiMyNeural", "fr-FR-VivienneMultilingualNeural").
 * ANY Edge TTS voice can speak ANY language — the voice provides the timbre/character,
 * Edge TTS handles the pronunciation. This is how 322 voices can all speak Vietnamese.
 *
 * Vietnamese text is normalized (numbers→words, dates→words) before synthesis.
 * Audio is streamed as base64 NDJSON chunks for realtime playback.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, ttsSchema);
  if (!parsed.ok) return parsed.response;
  const { text, id } = parsed.data;

  try {
    const voice = voices.find((v) => v.id === id);
    if (!voice) {
      return jsonResponse({ status: "error", message: "Voice not found" }, 404);
    }

    if (voice.type === "onnx") {
      return jsonResponse({ status: "error", message: "ONNX voices are processed client-side" }, 400);
    }

    // ─── All non-ONNX voices use Edge TTS ────────────────────────────
    // voice_id IS the Edge TTS ShortName (e.g. "vi-VN-HoaiMyNeural").
    const edgeVoiceName = voice.voice_id;

    const isVietnamese = voice.locale === "vi-VN" || /vi/i.test(voice.locale);
    const processedText = isVietnamese
      ? normalizeVietnameseText(text.trim())
      : text.trim();

    return streamEdgeTtsResponse(processedText, edgeVoiceName);
  } catch (error) {
    log.error("TTS error:", error);
    return jsonResponse(
      { status: "error", message: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
}

/**
 * Stream Edge TTS audio chunks as NDJSON.
 */
async function streamEdgeTtsResponse(text: string, edgeVoice: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        const allChunks: Buffer[] = [];

        for await (const chunk of streamEdgeTts(text, edgeVoice)) {
          if (chunk.type === "audio" && chunk.data) {
            send({ status: "audio_chunk", chunk: chunk.data.toString("base64") });
            allChunks.push(chunk.data);
          } else if (chunk.type === "error") {
            send({ status: "error", message: chunk.error || "Edge TTS error" });
            controller.close();
            return;
          } else if (chunk.type === "done") {
            if (allChunks.length > 0) {
              const { randomUUID } = await import("crypto");
              const { writeFile, mkdir } = await import("fs/promises");
              const { join } = await import("path");

              const outputDir = join(process.cwd(), "public", "outputs");
              await mkdir(outputDir, { recursive: true });
              const filename = `${randomUUID()}.mp3`;
              await writeFile(join(outputDir, filename), Buffer.concat(allChunks));

              send({ status: "done", url: `/outputs/${filename}` });
            } else {
              send({ status: "error", message: "No audio generated" });
            }
            controller.close();
            return;
          }
        }

        controller.close();
      } catch (err) {
        send({ status: "error", message: err instanceof Error ? err.message : "TTS failed" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
