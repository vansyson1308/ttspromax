"use client";

import { useCallback } from "react";
import { useLang } from "@/lib/i18n";

/**
 * Co-located bilingual strings for the Studio UI: `tr("Tiếng Việt", "English")`.
 * Keeps each label next to where it's used instead of growing i18n.tsx by
 * a hundred keys.
 */
export function useTr() {
  const { lang } = useLang();
  return useCallback((vi: string, en: string) => (lang === "en" ? en : vi), [lang]);
}
