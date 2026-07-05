export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { parseBody, tiktokTtsSchema } from "@/lib/api-validators";
import { logger } from "@/lib/logger";

const DEFAULT_TIKTOK_TTS_PROXY = "https://tiktok-tts.weilnet.workers.dev/api/generation";
const log = logger.child("api/tiktok-tts");

/**
 * POST /api/tiktok-tts
 * Proxy to a TikTok TTS worker. Set `TIKTOK_TTS_PROXY` env var to override.
 * Body: { text: string, voice: string }
 * Returns: { success: boolean, data: string (base64 mp3) }
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, tiktokTtsSchema);
  if (!parsed.ok) return parsed.response;
  const { text, voice } = parsed.data;

  if (text.length > 300) {
    return NextResponse.json(
      { success: false, error: "max 300 chars per request" },
      { status: 400 },
    );
  }

  const endpoint = process.env.TIKTOK_TTS_PROXY ?? DEFAULT_TIKTOK_TTS_PROXY;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
      redirect: "follow",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `TikTok TTS error: ${res.status} ${errText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    log.error("TikTok proxy fetch failed:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
