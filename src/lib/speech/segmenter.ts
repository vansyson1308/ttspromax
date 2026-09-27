/**
 * Script segmenter: raw user text → ordered speech units and explicit pauses.
 *
 * Every sentence becomes its own synthesis unit. That is what lets the
 * renderer control pause length precisely (Edge TTS rejects SSML <break>)
 * and emit exact per-sentence subtitle timings.
 *
 * Understands:
 *   - paragraphs (blank line) vs. line breaks (single newline)
 *   - headlines: short line without terminal punctuation, or ALL CAPS
 *   - abbreviations that end in "." (TP., GS., Mr., U.S.) — not sentence ends
 *   - manual pause tags: [pause 1s], [ngắt 500ms], [nghỉ 2 giây], [pause],
 *     <break time="800ms"/>
 */

export type SentenceType = "statement" | "question" | "exclamation" | "heading";

/** What separates a unit from the previous one — drives pause length. */
export type Boundary = "start" | "clause" | "sentence" | "line" | "paragraph";

export interface SpeechUnit {
  kind: "speech";
  /** Text exactly as the user wrote it (used for subtitles/karaoke). */
  text: string;
  type: SentenceType;
  boundary: Boundary;
  /** Paragraph index (0-based). */
  paragraph: number;
  /** Position inside paragraph. */
  first: boolean;
  last: boolean;
}

export interface PauseUnit {
  kind: "pause";
  ms: number;
}

export type ScriptUnit = SpeechUnit | PauseUnit;

export const MAX_MANUAL_PAUSE_MS = 10_000;
export const DEFAULT_MANUAL_PAUSE_MS = 700;
/** Hard ceiling per synthesis unit; longer sentences are split at clauses. */
export const MAX_UNIT_CHARS = 450;

const PAUSE_TAG =
  /\[\s*(?:pause|break|ngắt|ngat|nghỉ|nghi|dừng|dung)\s*:?\s*(?:(\d+(?:[.,]\d+)?)\s*(ms|s|giây|giay|sec)?)?\s*\]|<break\s+time\s*=\s*["']?(\d+(?:\.\d+)?)\s*(ms|s)?["']?\s*\/?>/giu;

function parsePauseMs(num: string | undefined, unit: string | undefined): number {
  if (!num) return DEFAULT_MANUAL_PAUSE_MS;
  const n = parseFloat(num.replace(",", "."));
  if (!isFinite(n)) return DEFAULT_MANUAL_PAUSE_MS;
  const u = (unit || "").toLowerCase();
  // Bare numbers: ≤ 10 means seconds ("[pause 2]"), otherwise ms.
  const ms = u === "ms" ? n : u ? n * 1000 : n <= 10 ? n * 1000 : n;
  return Math.max(0, Math.min(MAX_MANUAL_PAUSE_MS, Math.round(ms)));
}

/** Remove pause tags (for engines that can't honour them). */
export function stripPauseTags(text: string, replacement = " "): string {
  return text.replace(PAUSE_TAG, replacement);
}

/** Replace pause tags using a callback that receives the duration in ms. */
export function mapPauseTags(text: string, fn: (ms: number) => string): string {
  return text.replace(PAUSE_TAG, (_m, n1, u1, n2, u2) => fn(parsePauseMs(n1 ?? n2, u1 ?? u2)));
}

// Tokens that end with "." but do not end a sentence. Only unambiguous
// titles/abbreviations: ordinary words ("sen", "gen", "no", "h" in "10h")
// and forms that often end a sentence ("etc.", "v.v.", "p.m.") are excluded.
const ABBREVIATIONS = new Set(
  [
    // Vietnamese
    "tp", "gs", "pgs", "ts", "ths", "bs", "ks", "nxb", "tx", "gs.ts", "pgs.ts", "cty", "tnhh", "sđt",
    // English
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "e.g", "i.e", "vol", "fig", "jan", "feb",
    "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "u.s", "u.k", "approx",
    "dept", "gen", "gov", "sen", "rep",
  ].map((s) => s.toLowerCase()),
);

// Titles that are also everyday Vietnamese words: only abbreviations when
// they start with a capital ("Sen." the senator vs "hoa sen.").
const CAPITALIZED_ONLY = new Set(["gen", "sen", "rep", "gov", "mar", "dec"]);

const TERMINATORS = /[.!?…。！？]/;
const CLOSERS = /["'”’)\]»]/;

function isAbbreviationBefore(text: string, dotIndex: number): boolean {
  // Grab the token (letters, dots) immediately before the dot.
  let i = dotIndex - 1;
  while (i >= 0 && /[\p{L}.]/u.test(text[i])) i--;
  const token = text.slice(i + 1, dotIndex).toLowerCase();
  if (!token) return false;
  const raw = text.slice(i + 1, dotIndex);
  if (ABBREVIATIONS.has(token)) return !CAPITALIZED_ONLY.has(token) || /^\p{Lu}/u.test(raw);
  // Single-letter initials ("J. Smith", "Nguyễn V. A"): the word before must
  // be capitalised or absent — "38 độ C." and "vitamin C." end sentences.
  if (/^\p{Lu}$/u.test(raw)) {
    const prevWord = text.slice(0, i + 1).trimEnd().split(/\s+/).pop() ?? "";
    return prevWord === "" || /^\p{Lu}/u.test(prevWord);
  }
  return false;
}

/** Split one line into sentences. */
export function splitSentences(line: string): string[] {
  const out: string[] = [];
  let start = 0;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (TERMINATORS.test(ch)) {
      // Consume runs like "?!", "...", and closing quotes/brackets.
      let j = i + 1;
      while (j < line.length && (TERMINATORS.test(line[j]) || CLOSERS.test(line[j]))) j++;
      const next = line.slice(j);
      const atEnd = next.trim().length === 0;
      const followedBySpace = /^\s/.test(next);
      if (atEnd) {
        break;
      }
      if (followedBySpace) {
        const nextChar = next.trimStart()[0] ?? "";
        const isEllipsis = ch === "…" || line.slice(i, i + 3) === "...";
        const upcomingStartsSentence = /[\p{Lu}\p{N}"“'‘(\[«-]/u.test(nextChar);
        const abbreviation = ch === "." && !isEllipsis && isAbbreviationBefore(line, i);
        if (upcomingStartsSentence && !abbreviation) {
          out.push(line.slice(start, j).trim());
          start = j;
        }
      }
      i = j;
      continue;
    }
    i++;
  }
  const rest = line.slice(start).trim();
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** Split an over-long sentence at clause punctuation nearest the middle. */
export function splitLongSentence(sentence: string, max = MAX_UNIT_CHARS): string[] {
  if (sentence.length <= max) return [sentence];
  const mid = sentence.length / 2;
  let best = -1;
  let bestScore = Infinity;
  const re = /[;:,]\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence))) {
    const pos = m.index + 1;
    // Prefer semicolons/colons over commas.
    const weight = m[0][0] === "," ? 1 : 0.6;
    const score = Math.abs(pos - mid) * weight;
    if (score < bestScore) {
      bestScore = score;
      best = pos;
    }
  }
  if (best <= 0) {
    // No clause punctuation: fall back to the space nearest the middle.
    const left = sentence.lastIndexOf(" ", mid);
    best = left > 0 ? left : Math.floor(mid);
  }
  const a = sentence.slice(0, best).trim();
  const b = sentence.slice(best).trim();
  return [...splitLongSentence(a, max), ...splitLongSentence(b, max)];
}

function classify(sentence: string): SentenceType {
  const s = sentence.replace(/["'”’)\]»\s]+$/u, "");
  if (/[?？]$/.test(s)) return "question";
  if (/[!！]$/.test(s)) return "exclamation";
  return "statement";
}

function isAllCaps(line: string): boolean {
  const letters = line.match(/\p{L}/gu) || [];
  if (letters.length < 6) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return upper / letters.length > 0.85 && /\s/.test(line.trim());
}

const VI_VOWELS = "aeiouyàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ";
/** Onset + vowel nucleus + final allowed by Vietnamese phonotactics. */
const VI_SYLLABLE = new RegExp(
  `^(?:ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdđghklmnpqrstvx])?[${VI_VOWELS}]{1,3}(?:ch|ng|nh|[cmnpt])?$`,
  "iu",
);

/**
 * Sentence-case an ALL CAPS headline so the voice doesn't spell it out,
 * while keeping acronyms (short tokens that can't be a Vietnamese syllable,
 * e.g. "UBND", "BHXH", "TP") and Roman numerals intact, so the lexicon and
 * normaliser can still expand them afterwards.
 */
export function decapitalize(line: string): string {
  let first = true;
  return line.replace(/\p{L}+/gu, (w) => {
    const roman = w.length > 1 && /^[IVXLC]+$/.test(w); // "ĐẠI HỘI XIII"
    // Short tokens that can't be a Vietnamese syllable are acronyms
    // ("UBND", "BHXH", "TP"); "AI", "LÀ" are words and get lowercased.
    const acronym = w.length <= 4 && !VI_SYLLABLE.test(w);
    const out = acronym || roman ? w : first ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase();
    first = false;
    return out;
  });
}

/** True when a line is written in ALL CAPS (typical for headlines). */
export { isAllCaps };

function looksLikeHeading(line: string, isLastLine: boolean): boolean {
  const t = line.trim();
  if (isAllCaps(t)) return true;
  if (isLastLine) return false;
  if (t.length > 110) return false;
  if (/[.!?…:;,]["'”’)\]»]?$/u.test(t)) return false;
  const words = t.split(/\s+/).length;
  return words >= 2 && words <= 18;
}

/**
 * Parse the whole script. Pause tags become PauseUnits; everything else
 * becomes one SpeechUnit per sentence (or clause, for very long sentences).
 */
export function segmentScript(input: string): ScriptUnit[] {
  const units: ScriptUnit[] = [];
  const text = input.replace(/\r\n?/g, "\n").normalize("NFC");
  const lines = text.split("\n");

  let paragraph = -1;
  let pendingBoundary: Boundary = "start";
  let blankRun = true; // treat the beginning as after a blank line

  const nonEmptyIdx = lines.map((l, i) => (stripPauseTags(l).trim() ? i : -1)).filter((i) => i >= 0);
  const lastLineIdx = nonEmptyIdx[nonEmptyIdx.length - 1] ?? -1;

  lines.forEach((rawLine, lineIdx) => {
    if (!rawLine.trim()) {
      blankRun = true;
      return;
    }
    // A line holding only pause tags doesn't start or end a paragraph.
    if (!stripPauseTags(rawLine).trim()) {
      rawLine.replace(PAUSE_TAG, (m, n1, u1, n2, u2) => {
        units.push({ kind: "pause", ms: parsePauseMs(n1 ?? n2, u1 ?? u2) });
        return m;
      });
      return;
    }
    const isNewParagraph = blankRun || paragraph < 0;
    if (isNewParagraph) paragraph++;
    if (units.length) pendingBoundary = isNewParagraph ? "paragraph" : "line";
    blankRun = false;

    // Split the line on pause tags, keeping order.
    const pieces: Array<{ pause?: number; text?: string }> = [];
    let last = 0;
    rawLine.replace(PAUSE_TAG, (m, n1, u1, n2, u2, offset: number) => {
      pieces.push({ text: rawLine.slice(last, offset) });
      pieces.push({ pause: parsePauseMs(n1 ?? n2, u1 ?? u2) });
      last = offset + m.length;
      return m;
    });
    pieces.push({ text: rawLine.slice(last) });

    const lineText = stripPauseTags(rawLine).trim();
    const heading = looksLikeHeading(lineText, lineIdx === lastLineIdx) && splitSentences(lineText).length === 1;

    const lineUnits: SpeechUnit[] = [];
    for (const piece of pieces) {
      if (piece.pause !== undefined) {
        units.push({ kind: "pause", ms: piece.pause });
        continue;
      }
      const chunk = (piece.text || "").trim();
      if (!chunk) continue;
      const sentences = splitSentences(chunk);
      sentences.forEach((sentence, si) => {
        const parts = splitLongSentence(sentence);
        parts.forEach((part, pi) => {
          const unit: SpeechUnit = {
            kind: "speech",
            text: part,
            type: heading ? "heading" : classify(pi === parts.length - 1 ? sentence : part),
            boundary: pi > 0 ? "clause" : si > 0 || lineUnits.length ? "sentence" : pendingBoundary,
            paragraph,
            first: false,
            last: false,
          };
          if (units.length === 0 || (units.every((u) => u.kind === "pause") && unit.boundary !== "clause")) {
            unit.boundary = "start";
          }
          units.push(unit);
          lineUnits.push(unit);
        });
      });
    }
  });

  // Mark first/last per paragraph.
  const speech = units.filter((u): u is SpeechUnit => u.kind === "speech");
  speech.forEach((u, i) => {
    u.first = i === 0 || speech[i - 1].paragraph !== u.paragraph;
    u.last = i === speech.length - 1 || speech[i + 1].paragraph !== u.paragraph;
  });
  return units;
}
