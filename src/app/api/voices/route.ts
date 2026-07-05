export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import voicesData from "@/data/voices.json";

// 2271 voice clones database with Fish Audio reference IDs

interface VoiceEntry {
  id: number;
  voice_id: string;
  locale: string;
  display_name: string;
  gender: string;
  description: string;
  type: string;
}

const voices = voicesData as VoiceEntry[];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locale = searchParams.get("locale");
  const search = searchParams.get("search");

  let filtered = voices;

  if (locale && locale !== "all") {
    filtered = filtered.filter((v) => v.locale === locale);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (v) =>
        v.display_name.toLowerCase().includes(q) ||
        v.locale.toLowerCase().includes(q)
    );
  }

  return NextResponse.json(filtered, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=3600" },
  });
}
