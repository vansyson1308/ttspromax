/**
 * Prosody planner ("đạo diễn giọng đọc").
 *
 * Turns a script into an ordered list of synthesis segments, each with:
 *   - display text (what the user wrote — for subtitles/karaoke)
 *   - spoken text (lexicon + normalisation + phrasing applied)
 *   - rate/pitch for this sentence (style + subtle per-sentence variation)
 *   - the silence to place before it (boundary-aware, style-aware)
 *
 * Pure and deterministic — used server-side for rendering and client-side
 * for the "how will it be read" preview.
 */

import { normalizeVietnameseText } from "@/lib/vi-normalizer";
import { detectScriptLang } from "@/lib/script-lang-detect";
import { applyLexicon, builtinLexicon, type LexiconEntry } from "./lexicon";
import { insertPhraseBreaks } from "./phrasing";
import {
  decapitalize,
  isAllCaps,
  segmentScript,
  type Boundary,
  type SentenceType,
} from "./segmenter";

export type StyleId = "natural" | "news" | "story" | "podcast" | "ads";
export type ScriptLang = "vi" | "en";

interface Tweak {
  rate: number;
  pitch: number;
}

export interface StylePreset {
  id: StyleId;
  label: { vi: string; en: string };
  hint: { vi: string; en: string };
  /** Base speaking-rate offset in % (Edge prosody rate). */
  rate: number;
  /** Base pitch offset in Hz. */
  pitch: number;
  /** Silence between end of one sentence's speech and start of the next. */
  pauses: Record<Exclude<Boundary, "start">, number> & { afterHeading: number; afterQuestion: number };
  heading: Tweak;
  question: Tweak;
  exclamation: Tweak;
  /** Pitch reset at the start of a paragraph (declination reset). */
  paragraphStart: Tweak;
  /** Final lengthening at the end of a paragraph. */
  paragraphEnd: Tweak;
}

export const STYLE_PRESETS: Record<StyleId, StylePreset> = {
  natural: {
    id: "natural",
    label: { vi: "Tự nhiên", en: "Natural" },
    hint: { vi: "Giọng đọc đời thường, nhịp cân bằng", en: "Everyday delivery, balanced rhythm" },
    rate: 0,
    pitch: 0,
    pauses: { clause: 180, sentence: 400, line: 520, paragraph: 820, afterHeading: 700, afterQuestion: 480 },
    heading: { rate: -3, pitch: 2 },
    question: { rate: 0, pitch: 2 },
    exclamation: { rate: 2, pitch: 2 },
    paragraphStart: { rate: 0, pitch: 1 },
    paragraphEnd: { rate: -2, pitch: 0 },
  },
  news: {
    id: "news",
    label: { vi: "Bản tin thời sự", en: "Newscast" },
    hint: { vi: "Dứt khoát, rõ ràng, ngắt nghỉ chuẩn phát thanh viên", en: "Crisp, authoritative anchor pacing" },
    rate: 3,
    pitch: -1,
    pauses: { clause: 150, sentence: 340, line: 480, paragraph: 760, afterHeading: 900, afterQuestion: 420 },
    heading: { rate: -5, pitch: 3 },
    question: { rate: 0, pitch: 2 },
    exclamation: { rate: 1, pitch: 1 },
    paragraphStart: { rate: 0, pitch: 1 },
    paragraphEnd: { rate: -2, pitch: 0 },
  },
  story: {
    id: "story",
    label: { vi: "Kể chuyện / Sách nói", en: "Storytelling" },
    hint: { vi: "Chậm, ấm, ngắt nghỉ sâu cho audiobook", en: "Slower, warm, deep pauses for audiobooks" },
    rate: -8,
    pitch: 0,
    pauses: { clause: 240, sentence: 600, line: 720, paragraph: 1150, afterHeading: 1200, afterQuestion: 700 },
    heading: { rate: -6, pitch: 1 },
    question: { rate: -1, pitch: 3 },
    exclamation: { rate: 2, pitch: 3 },
    paragraphStart: { rate: 0, pitch: 1 },
    paragraphEnd: { rate: -4, pitch: -1 },
  },
  podcast: {
    id: "podcast",
    label: { vi: "Podcast / Trò chuyện", en: "Podcast" },
    hint: { vi: "Gần gũi, nhịp nhanh vừa phải", en: "Friendly, conversational pace" },
    rate: 2,
    pitch: 0,
    pauses: { clause: 150, sentence: 320, line: 440, paragraph: 650, afterHeading: 650, afterQuestion: 380 },
    heading: { rate: -2, pitch: 2 },
    question: { rate: 0, pitch: 3 },
    exclamation: { rate: 3, pitch: 3 },
    paragraphStart: { rate: 0, pitch: 1 },
    paragraphEnd: { rate: -1, pitch: 0 },
  },
  ads: {
    id: "ads",
    label: { vi: "Quảng cáo / TVC", en: "Advertising" },
    hint: { vi: "Năng lượng cao, tiết tấu nhanh", en: "High energy, punchy pace" },
    rate: 9,
    pitch: 2,
    pauses: { clause: 110, sentence: 250, line: 330, paragraph: 480, afterHeading: 450, afterQuestion: 300 },
    heading: { rate: 0, pitch: 4 },
    question: { rate: 2, pitch: 4 },
    exclamation: { rate: 4, pitch: 4 },
    paragraphStart: { rate: 0, pitch: 1 },
    paragraphEnd: { rate: -1, pitch: 0 },
  },
};

export const STYLE_IDS = Object.keys(STYLE_PRESETS) as StyleId[];

export interface PlanOptions {
  style?: StyleId;
  /** User speaking-rate offset in %, added to the style. */
  rate?: number;
  /** User pitch offset in Hz, added to the style. */
  pitch?: number;
  /** Multiplier for automatic pauses (manual [pause] tags are exact). */
  pauseScale?: number;
  /** Insert breath commas in long clauses. */
  phrasing?: boolean;
  /** User pronunciation entries (override built-ins). */
  lexicon?: LexiconEntry[];
  /** Force text language; defaults to detection. */
  lang?: ScriptLang;
  /**
   * Expand numbers/dates/units into words (Vietnamese). On by default;
   * LLM-based engines (Gemini) read raw numbers well and may skip it.
   */
  normalize?: boolean;
}

export interface PlannedSegment {
  index: number;
  display: string;
  spoken: string;
  type: SentenceType;
  paragraph: number;
  boundary: Boundary;
  /** True when pauseBeforeMs came from a manual [pause] tag. */
  manualPause: boolean;
  /** Edge prosody values. */
  rate: number;
  pitch: number;
  /** Silence (ms) between the previous segment's speech and this one. */
  pauseBeforeMs: number;
}

export interface ScriptPlan {
  lang: ScriptLang;
  style: StyleId;
  segments: PlannedSegment[];
  /** Pause tags after the last sentence. */
  trailingPauseMs: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function formatRate(rate: number): string {
  const r = Math.round(clamp(rate, -50, 100));
  return `${r >= 0 ? "+" : ""}${r}%`;
}

export function formatPitch(pitch: number): string {
  const p = Math.round(clamp(pitch, -50, 50));
  return `${p >= 0 ? "+" : ""}${p}Hz`;
}

function mergeLexicons(user: LexiconEntry[], lang: ScriptLang): LexiconEntry[] {
  const userKeys = new Set(user.map((e) => e.from.trim().toLowerCase()));
  return [...user, ...builtinLexicon(lang).filter((e) => !userKeys.has(e.from.toLowerCase()))];
}

/**
 * Prepare what the voice will actually say for one sentence.
 */
export function prepareSpoken(
  display: string,
  lang: ScriptLang,
  lexicon: LexiconEntry[],
  phrasing: boolean,
  normalize = true,
): string {
  let t = display.normalize("NFC");
  t = applyLexicon(t, lexicon);
  if (isAllCaps(t)) t = decapitalize(t);
  if (lang === "vi" && normalize) t = normalizeVietnameseText(t);
  else t = t.replace(/\s+/g, " ").trim();
  if (phrasing) t = insertPhraseBreaks(t, lang);
  return t;
}

export function planScript(text: string, options: PlanOptions = {}): ScriptPlan {
  const style = STYLE_PRESETS[options.style ?? "natural"] ?? STYLE_PRESETS.natural;
  const lang: ScriptLang = options.lang ?? detectScriptLang(text);
  const pauseScale = clamp(options.pauseScale ?? 1, 0.3, 3);
  const userRate = options.rate ?? 0;
  const userPitch = options.pitch ?? 0;
  const phrasing = options.phrasing ?? true;
  const lexicon = mergeLexicons(options.lexicon ?? [], lang);

  const units = segmentScript(text);
  const segments: PlannedSegment[] = [];
  let manualPause = 0;
  let prevType: SentenceType | null = null;

  for (const unit of units) {
    if (unit.kind === "pause") {
      manualPause += unit.ms;
      continue;
    }
    const spoken = prepareSpoken(unit.text, lang, lexicon, phrasing, options.normalize ?? true);
    if (!/[\p{L}\p{N}]/u.test(spoken)) continue;

    let autoPause = 0;
    if (unit.boundary !== "start" && segments.length) {
      autoPause = style.pauses[unit.boundary];
      if (prevType === "heading") autoPause = Math.max(autoPause, style.pauses.afterHeading);
      else if (prevType === "question" && unit.boundary !== "clause")
        autoPause = Math.max(autoPause, style.pauses.afterQuestion);
      autoPause *= pauseScale;
    }

    let rate = style.rate + userRate;
    let pitch = style.pitch + userPitch;
    const tweaks: Tweak[] = [];
    if (unit.type === "heading") tweaks.push(style.heading);
    if (unit.type === "question") tweaks.push(style.question);
    if (unit.type === "exclamation") tweaks.push(style.exclamation);
    if (unit.first && unit.type !== "heading") tweaks.push(style.paragraphStart);
    if (unit.last && !unit.first && unit.type !== "heading") tweaks.push(style.paragraphEnd);
    for (const tw of tweaks) {
      rate += tw.rate;
      pitch += tw.pitch;
    }

    segments.push({
      index: segments.length,
      display: unit.text,
      spoken,
      type: unit.type,
      paragraph: unit.paragraph,
      boundary: unit.boundary,
      manualPause: manualPause > 0 && segments.length > 0,
      rate: clamp(Math.round(rate), -50, 100),
      pitch: clamp(Math.round(pitch), -50, 50),
      pauseBeforeMs: Math.round(segments.length ? (manualPause > 0 ? manualPause : autoPause) : manualPause),
    });
    manualPause = 0;
    prevType = unit.type;
  }

  return { lang, style: style.id, segments, trailingPauseMs: manualPause };
}
