/**
 * Zod schemas for validating incoming API request bodies.
 * Each route imports its schema and calls `parse()`; failures bubble up as
 * 400 responses via `formatValidationError`.
 */

import { z } from "zod";

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const ttsSchema = z.object({
  text: z.string().min(1, "Text is required").max(5000, "Text too long (max 5000)"),
  id: z.number().int().positive(),
});
export type TtsBody = z.infer<typeof ttsSchema>;

export const makevoiceSchema = z.object({
  voice_id: z.string().min(1),
  text: z.string().min(1).max(5000),
  model_id: z.string().optional(),
});
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
