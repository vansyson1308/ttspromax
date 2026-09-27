/**
 * Zod schemas for validating incoming API request bodies.
 * Each route imports its schema and calls `parse()`; failures bubble up as
 * 400 responses via `formatValidationError`.
 */

import { z } from "zod";
import { LEGACY_MAX_CHARS, TTS_MAX_CHARS } from "@/lib/speech/limits";

export { TTS_MAX_CHARS };

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const lexiconEntrySchema = z.object({
  from: z.string().min(1).max(80),
  to: z.string().min(1).max(200),
  caseSensitive: z.boolean().optional(),
});

export const ttsSchema = z.object({
  text: z.string().min(1, "Text is required").max(TTS_MAX_CHARS, `Text too long (max ${TTS_MAX_CHARS})`),
  id: z.number().int().positive(),
  style: z.enum(["natural", "news", "story", "podcast", "ads"]).optional(),
  /** Speaking-rate offset in %. */
  rate: z.number().min(-50).max(100).optional(),
  /** Pitch offset in Hz. */
  pitch: z.number().min(-50).max(50).optional(),
  /** Multiplier for automatic pauses. */
  pauseScale: z.number().min(0.3).max(3).optional(),
  /** Insert breath pauses in long clauses. */
  phrasing: z.boolean().optional(),
  /** Force text language instead of auto-detect. */
  lang: z.enum(["vi", "en"]).optional(),
  /** User pronunciation dictionary. */
  lexicon: z.array(lexiconEntrySchema).max(500).optional(),
});
export type TtsBody = z.infer<typeof ttsSchema>;

export const makevoiceSchema = z.object({
  voice_id: z.string().min(1),
  text: z.string().min(1).max(LEGACY_MAX_CHARS),
  model_id: z.string().optional(),
  lexicon: z.array(lexiconEntrySchema).max(500).optional(),
});

export const geminiTtsSchema = z.object({
  text: z.string().min(1).max(TTS_MAX_CHARS),
  /** Prebuilt Gemini voice name, e.g. "Kore". */
  voice: z.string().min(1).max(40).regex(/^[A-Za-z]+$/),
  style: z.enum(["natural", "news", "story", "podcast", "ads"]).optional(),
  /** Extra free-text direction appended to the style prompt. */
  direction: z.string().max(300).optional(),
  pauseScale: z.number().min(0.3).max(3).optional(),
  lang: z.enum(["vi", "en"]).optional(),
  lexicon: z.array(lexiconEntrySchema).max(500).optional(),
});
export type GeminiTtsBody = z.infer<typeof geminiTtsSchema>;
export type MakevoiceBody = z.infer<typeof makevoiceSchema>;

export const tiktokTtsSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().min(1),
});
export type TiktokTtsBody = z.infer<typeof tiktokTtsSchema>;

// pet-image is GET with `?url=` querystring — validated at the route since it's a URLSearchParams check.
export const petImageQuerySchema = z.object({
  url: z.string().url("Must be a valid URL"),
});
export type PetImageQuery = z.infer<typeof petImageQuerySchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export interface ValidationFailure {
  status: "error";
  message: string;
  issues: Array<{ path: string; message: string }>;
}

export function formatValidationError(err: z.ZodError): ValidationFailure {
  return {
    status: "error",
    message: "Invalid request body",
    issues: err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

/**
 * Run a Zod schema against unknown input and return either the parsed body
 * or a Response that should be returned directly from the route.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError("Request body must be valid JSON", 400),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: new Response(JSON.stringify(formatValidationError(result.error)), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { ok: true, data: result.data };
}

export function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ status: "error", message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
