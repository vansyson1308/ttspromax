export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { parseBody, makevoiceSchema } from "@/lib/api-validators";
import { logger } from "@/lib/logger";

const MAKEVOICE_API = "https://makevoice.io/api";
const log = logger.child("api/makevoice-tts");

/**
 * POST /api/makevoice-tts
 *
 * Synthesize speech using MakeVoice.io (ElevenLabs) public API.
 * Returns NDJSON stream with audio chunks similar to Edge TTS endpoint.
 *
 * Request body:
 *   { voice_id: string, text: string, model?: string, model_id?: string }
 *   - model: Model name (preferred, e.g., "eleven_turbo_v2_5")
 *   - model_id: Legacy model ID
 *   If neither provided, auto-detects Vietnamese text and uses turbo v2.5.
 *
 * Response: NDJSON stream with status "audio_chunk", "done", or "error".
 */
// Simple language detection for Vietnamese
function detectLanguage(text: string): "vi" | "en" | "unknown" {
  const textLower = text.toLowerCase();
  
  // Vietnamese keywords
  const vietnameseKeywords = ["xin chào", "tiếng việt", "việt nam"];
  for (const keyword of vietnameseKeywords) {
    if (textLower.includes(keyword)) {
      return "vi";
    }
  }
  
  // Vietnamese characters with diacritics
  const vietnameseChars = ['á', 'à', 'ả', 'ã', 'ạ', 'ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ',
                          'â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ', 'é', 'è', 'ẻ', 'ẽ', 'ẹ',
                          'ê', 'ế', 'ề', 'ể', 'ễ', 'ệ', 'í', 'ì', 'ỉ', 'ĩ', 'ị',
                          'ó', 'ò', 'ỏ', 'õ', 'ọ', 'ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ',
                          'ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ', 'ú', 'ù', 'ủ', 'ũ', 'ụ',
                          'ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ',
                          'đ'];
  for (const char of vietnameseChars) {
    if (textLower.includes(char)) {
      return "vi";
    }
  }
  
  return "en"; // default to English
}

// Select appropriate model based on text
function selectModel(text: string, preferredModel?: string, preferredModelId?: string): string {
  // Priority: model > model_id > auto-detection
  if (preferredModel) return preferredModel;
  if (preferredModelId) return preferredModelId;
  
  const lang = detectLanguage(text);
  if (lang === "vi") {
    return "eleven_turbo_v2_5"; // Use turbo v2.5 for Vietnamese
  }
  
  return "eleven_multilingual_v2"; // Default
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, makevoiceSchema);
  if (!parsed.ok) return parsed.response;
  const { voice_id, text, model_id } = parsed.data;

  try {
    // Select model with auto-detection
    const selectedModel = selectModel(text, undefined, model_id);

    // Forward request to MakeVoice.io API
    // Use 'model' parameter (MakeVoice.io accepts both 'model' and 'model_id')
    const makevoiceResponse = await fetch(`${MAKEVOICE_API}/text-to-speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({
        voice_id,
        text,
        model: selectedModel,
        // token and captcha omitted for public API
      }),
    });

    if (!makevoiceResponse.ok) {
      const errorText = await makevoiceResponse.text();
      let errorMsg = "MakeVoice API error";
      try {
        const errJson = JSON.parse(errorText);
        errorMsg = errJson.message || errJson.error || errorMsg;
      } catch {
        // ignore
      }
      return jsonResponse({ status: "error", message: errorMsg }, makevoiceResponse.status);
    }

    const audioBuffer = await makevoiceResponse.arrayBuffer();
    
    // Stream as NDJSON
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send audio chunk as base64
          const base64Audio = Buffer.from(audioBuffer).toString("base64");
          controller.enqueue(
            encoder.encode(JSON.stringify({ status: "audio_chunk", chunk: base64Audio }) + "\n")
          );

          // Send done status
          controller.enqueue(
            encoder.encode(JSON.stringify({ status: "done" }) + "\n")
          );

          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ 
              status: "error", 
              message: err instanceof Error ? err.message : "Streaming failed" 
            }) + "\n")
          );
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

  } catch (error) {
    log.error("MakeVoice TTS error:", error);
    return jsonResponse(
      { status: "error", message: error instanceof Error ? error.message : "Internal server error" },
      500
    );
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}