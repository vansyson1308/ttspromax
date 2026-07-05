export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { petImageQuerySchema } from "@/lib/api-validators";
import { logger } from "@/lib/logger";

const log = logger.child("api/pet-image");

/** Proxy pet images to avoid canvas taint from CORS restrictions. */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const validated = petImageQuerySchema.safeParse(params);
  if (!validated.success) {
    return new Response("Missing or invalid url param", { status: 400 });
  }
  const { url } = validated.data;

  // Only allow http(s) — block file://, data:, etc.
  if (!/^https?:\/\//i.test(url)) {
    return new Response("Only http(s) URLs are allowed", { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TTS-Pro/1.0" },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new Response("Upstream did not return an image", { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    log.warn("Pet image proxy failed for", url, err);
    return new Response("Failed to fetch image", { status: 502 });
  }
}
