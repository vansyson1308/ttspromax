/**
 * Pronunciation lexicon ("Từ điển phát âm").
 *
 * Professional TTS products (Vbee, FPT.AI, Azure, ElevenLabs) all ship a
 * lexicon because no neural front-end reads every acronym, brand name or
 * abbreviation correctly. We apply:
 *   1. the user's own entries (highest priority — they always win),
 *   2. a curated built-in list of Vietnamese news/admin abbreviations.
 *
 * Matching is whole-token and Unicode-aware, so "TP." never matches inside
 * "HTTP." and "UBND" never matches inside "UBNDX".
 */

export interface LexiconEntry {
  /** Written form as it appears in the text (e.g. "UBND", "TP.HCM"). */
  from: string;
  /** How it should be read (e.g. "Ủy ban nhân dân"). */
  to: string;
  /** Match case exactly. Defaults to true for acronyms, false otherwise. */
  caseSensitive?: boolean;
}

/**
 * Built-in Vietnamese entries. Deliberately conservative: only expansions
 * that are unambiguous in news, government and business copy.
 * Entries must not introduce commas (subtitle alignment relies on them).
 */
export const VI_BUILTIN_LEXICON: LexiconEntry[] = [
  // Places
  { from: "TP.HCM", to: "Thành phố Hồ Chí Minh" },
  { from: "TP. HCM", to: "Thành phố Hồ Chí Minh" },
  { from: "Tp.HCM", to: "Thành phố Hồ Chí Minh" },
  { from: "TPHCM", to: "Thành phố Hồ Chí Minh" },
  { from: "TP HCM", to: "Thành phố Hồ Chí Minh" },
  { from: "HCM", to: "Hồ Chí Minh" },
  { from: "TP.", to: "thành phố" },
  { from: "Tp.", to: "thành phố" },
  { from: "VN", to: "Việt Nam" },
  { from: "BR-VT", to: "Bà Rịa Vũng Tàu" },
  { from: "ĐBSCL", to: "Đồng bằng sông Cửu Long" },
  // State bodies
  { from: "UBND", to: "Ủy ban nhân dân" },
  { from: "HĐND", to: "Hội đồng nhân dân" },
  { from: "MTTQ", to: "Mặt trận Tổ quốc" },
  { from: "ĐBQH", to: "đại biểu Quốc hội" },
  { from: "UBTVQH", to: "Ủy ban Thường vụ Quốc hội" },
  { from: "TW", to: "Trung ương" },
  { from: "BCH", to: "Ban Chấp hành" },
  { from: "BCT", to: "Bộ Chính trị" },
  { from: "CSGT", to: "cảnh sát giao thông" },
  { from: "CAND", to: "Công an nhân dân" },
  { from: "QĐND", to: "Quân đội nhân dân" },
  { from: "VKSND", to: "Viện kiểm sát nhân dân" },
  { from: "TAND", to: "Tòa án nhân dân" },
  { from: "BHXH", to: "bảo hiểm xã hội" },
  { from: "BHYT", to: "bảo hiểm y tế" },
  { from: "BHTN", to: "bảo hiểm thất nghiệp" },
  { from: "NHNN", to: "Ngân hàng Nhà nước" },
  { from: "KCN", to: "khu công nghiệp" },
  { from: "DNNN", to: "doanh nghiệp nhà nước" },
  { from: "CNTT", to: "công nghệ thông tin" },
  { from: "GD-ĐT", to: "giáo dục và đào tạo" },
  { from: "GD&ĐT", to: "giáo dục và đào tạo" },
  { from: "KH&CN", to: "khoa học và công nghệ" },
  { from: "THPT", to: "trung học phổ thông" },
  { from: "THCS", to: "trung học cơ sở" },
  { from: "ĐH", to: "đại học" },
  { from: "ĐHQG", to: "Đại học Quốc gia" },
  // Titles
  { from: "GS.TS.", to: "giáo sư tiến sĩ" },
  { from: "GS.TS", to: "giáo sư tiến sĩ" },
  { from: "PGS.TS.", to: "phó giáo sư tiến sĩ" },
  { from: "PGS.TS", to: "phó giáo sư tiến sĩ" },
  { from: "GS.", to: "giáo sư" },
  { from: "PGS.", to: "phó giáo sư" },
  { from: "TS.", to: "tiến sĩ" },
  { from: "ThS.", to: "thạc sĩ" },
  { from: "BS.", to: "bác sĩ" },
  { from: "NSND", to: "Nghệ sĩ Nhân dân" },
  { from: "NSƯT", to: "Nghệ sĩ Ưu tú" },
  { from: "TGĐ", to: "tổng giám đốc" },
  { from: "HĐQT", to: "hội đồng quản trị" },
  // Common written shorthand
  { from: "v.v.", to: "vân vân" },
  { from: "v.v", to: "vân vân" },
  { from: "k/g", to: "kính gửi" },
  { from: "Q.", to: "quận", caseSensitive: true },
  // Tech / economy acronyms read the Vietnamese way
  { from: "GDP", to: "gi đi pi" },
  { from: "CPI", to: "xi pi ai" },
  { from: "FDI", to: "ép đê i" },
  { from: "AI", to: "ây ai" },
  { from: "COVID-19", to: "Cô vít mười chín" },
  { from: "Covid-19", to: "Cô vít mười chín" },
  { from: "WTO", to: "vê kép tê ô" },
  { from: "ASEAN", to: "A-xê-an" },
];

export const EN_BUILTIN_LEXICON: LexiconEntry[] = [
  { from: "e.g.", to: "for example", caseSensitive: false },
  { from: "i.e.", to: "that is", caseSensitive: false },
  { from: "etc.", to: "et cetera", caseSensitive: false },
  { from: "vs.", to: "versus", caseSensitive: false },
  { from: "approx.", to: "approximately", caseSensitive: false },
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive pattern for one literal, without a global `i` flag. */
function caseless(s: string): string {
  return [...s]
    .map((ch) => {
      const lo = ch.toLowerCase();
      const up = ch.toUpperCase();
      return lo !== up && lo.length === 1 && up.length === 1 ? `[${lo}${up}]` : escapeRegex(ch);
    })
    .join("");
}

function isAcronym(s: string): boolean {
  return /\p{Lu}/u.test(s) && s === s.toUpperCase();
}

/** Replacement plus its position in the entry list (lower = higher priority). */
interface Target {
  to: string;
  order: number;
}

interface Matcher {
  re: RegExp;
  /** Case-sensitive entries, keyed by exact written form. */
  exact: Map<string, Target>;
  /** Case-insensitive entries, keyed by lower-cased written form. */
  folded: Map<string, Target>;
}

/**
 * Compile all entries into ONE alternation regex (longest first, so
 * "TP.HCM" wins over "TP." and "GS.TS" over "GS."). A single pass keeps
 * 500+ entries cheap enough to re-run on every keystroke for the preview.
 */
function compile(entries: LexiconEntry[]): Matcher | null {
  const exact = new Map<string, Target>();
  const folded = new Map<string, Target>();
  const forms: Array<{ from: string; cs: boolean }> = [];
  entries.forEach((e, order) => {
    const from = e.from.trim();
    const to = e.to.trim();
    if (!from || !to) return;
    const cs = e.caseSensitive ?? isAcronym(from);
    const map = cs ? exact : folded;
    const key = cs ? from : from.toLowerCase();
    if (map.has(key)) return; // earlier entries (the user's) win
    map.set(key, { to, order });
    forms.push({ from, cs });
  });
  if (!forms.length) return null;
  // No global `i` flag: case-insensitive entries get per-letter classes, so
  // every regex match is a real entry and shorter entries still get a turn
  // when a longer case-sensitive one differs in case ("Tp HCM").
  const alternatives = forms
    .sort((a, b) => b.from.length - a.from.length)
    .map(({ from, cs }) => {
      // Token boundary after entries ending in a letter/digit; entries ending
      // in punctuation (e.g. "TP.") already carry their boundary.
      const tail = /[\p{L}\p{N}]$/u.test(from) ? "(?![\\p{L}\\p{N}])" : "";
      return (cs ? escapeRegex(from) : caseless(from)) + tail;
    });
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})`, "gu");
  return { re, exact, folded };
}

const compiledCache = new WeakMap<LexiconEntry[], Matcher | null>();

function compiled(entries: LexiconEntry[]): Matcher | null {
  if (!compiledCache.has(entries)) compiledCache.set(entries, compile(entries));
  return compiledCache.get(entries) ?? null;
}

/**
 * Replace every lexicon match in one left-to-right pass. Output text is never
 * re-scanned, so an expansion can't be rewritten by another entry.
 */
export function applyLexicon(text: string, entries: LexiconEntry[]): string {
  const m = entries.length ? compiled(entries) : null;
  if (!m) return text;
  return text.replace(m.re, (match: string, offset: number, full: string) => {
    // Both maps may hold the word (e.g. a user's case-insensitive "AI" and
    // the built-in case-sensitive "AI"); the earlier entry — the user's — wins.
    const candidates = [m.exact.get(match), m.folded.get(match.toLowerCase())].filter(Boolean) as Target[];
    if (!candidates.length) return match;
    const to = candidates.sort((a, b) => a.order - b.order)[0].to;
    // "TP.Hà Nội" → "thành phố Hà Nội": re-insert the space the dot stood in for.
    const next = full[offset + match.length] ?? "";
    return /[^\p{L}\p{N}]$/u.test(match) && /[\p{L}\p{N}]/u.test(next) ? `${to} ` : to;
  });
}

const formsCache = new WeakMap<LexiconEntry[], Set<string>>();

/** Written forms of case-sensitive (acronym) entries, e.g. "VKSND", "ĐBSCL". */
export function caseSensitiveForms(entries: LexiconEntry[]): Set<string> {
  let set = formsCache.get(entries);
  if (!set) {
    set = new Set(entries.filter((e) => e.caseSensitive ?? isAcronym(e.from.trim())).map((e) => e.from.trim()));
    formsCache.set(entries, set);
  }
  return set;
}

export function builtinLexicon(lang: "vi" | "en"): LexiconEntry[] {
  return lang === "vi" ? VI_BUILTIN_LEXICON : EN_BUILTIN_LEXICON;
}

/** Sanitise user-supplied entries (from localStorage / request body). */
export function sanitizeLexicon(raw: unknown, max = 500): LexiconEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LexiconEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { from, to, caseSensitive } = item as Record<string, unknown>;
    if (typeof from !== "string" || typeof to !== "string") continue;
    const f = from.trim().slice(0, 80);
    const tt = to.trim().slice(0, 200);
    if (!f || !tt) continue;
    out.push({ from: f, to: tt, caseSensitive: typeof caseSensitive === "boolean" ? caseSensitive : undefined });
    if (out.length >= max) break;
  }
  return out;
}
