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

function isAcronym(s: string): boolean {
  return /\p{Lu}/u.test(s) && s === s.toUpperCase();
}

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

interface Candidate {
  from: string;
  /** Lower-cased form for case-insensitive comparison. */
  lower: string;
  to: string;
  cs: boolean;
  /** Needs a token boundary after it (ends in a letter/digit). */
  endsWord: boolean;
  /** Needs a token boundary before it (starts with a letter/digit). */
  startsWord: boolean;
  /** Position in the entry list — lower wins ties (user entries first). */
  order: number;
}

/**
 * Index entries by their first character (lower-cased). Matching then only
 * compares the handful of entries that start with the character at a token
 * boundary — no giant alternation regex, so 500 entries compile in well
 * under a millisecond and the preview stays responsive on phones.
 */
function compile(entries: LexiconEntry[]): Map<string, Candidate[]> | null {
  const byFirst = new Map<string, Candidate[]>();
  const seen = new Set<string>();
  entries.forEach((e, order) => {
    // Spoken text is NFC; entries typed/pasted in NFD must still match.
    const from = e.from.normalize("NFC").trim();
    const to = e.to.normalize("NFC").trim();
    if (!from || !to) return;
    const cs = e.caseSensitive ?? isAcronym(from);
    const key = `${cs ? "s" : "i"}:${cs ? from : from.toLowerCase()}`;
    if (seen.has(key)) return; // earlier entries (the user's) win
    seen.add(key);
    const first = from[0].toLowerCase();
    const list = byFirst.get(first) ?? [];
    list.push({
      from,
      lower: from.toLowerCase(),
      to,
      cs,
      endsWord: isWordChar(from[from.length - 1]),
      startsWord: isWordChar(from[0]),
      order,
    });
    byFirst.set(first, list);
  });
  if (!byFirst.size) return null;
  // Longest first ("TP.HCM" before "TP."), then entry order.
  for (const list of byFirst.values()) list.sort((x, y) => y.from.length - x.from.length || x.order - y.order);
  return byFirst;
}

const compiledCache = new WeakMap<LexiconEntry[], Map<string, Candidate[]> | null>();

function compiled(entries: LexiconEntry[]) {
  if (!compiledCache.has(entries)) compiledCache.set(entries, compile(entries));
  return compiledCache.get(entries) ?? null;
}

function matchAt(text: string, i: number, list: Candidate[], midWord: boolean): Candidate | null {
  for (const c of list) {
    // Mid-word, only entries starting with punctuation may match ("30°C").
    if (midWord && c.startsWord) continue;
    const slice = text.slice(i, i + c.from.length);
    if (slice.length !== c.from.length) continue;
    if (c.cs ? slice !== c.from : slice.toLowerCase() !== c.lower) continue;
    if (c.endsWord && isWordChar(text[i + c.from.length])) continue;
    return c;
  }
  return null;
}

/**
 * Replace lexicon entries in one left-to-right pass at token starts. Output
 * text is never re-scanned, so an expansion can't be rewritten by another
 * entry. Case-sensitive and -insensitive entries compete on length, then on
 * entry order, so a user's override beats a built-in for the same word and a
 * longer entry that differs in case ("TP HCM" vs "Tp HCM") falls back to a
 * shorter one ("HCM").
 */
export function applyLexicon(text: string, entries: LexiconEntry[]): string {
  const index = entries.length ? compiled(entries) : null;
  if (!index) return text;
  let out = "";
  let last = 0;
  let i = 0;
  while (i < text.length) {
    const list = index.get(text[i].toLowerCase());
    const hit = list ? matchAt(text, i, list, isWordChar(text[i - 1])) : null;
    if (!hit) {
      i++;
      continue;
    }
    const end = i + hit.from.length;
    // "TP.Hà Nội" → "thành phố Hà Nội": re-insert the space the dot stood in for.
    const glue = !hit.endsWord && isWordChar(text[end]) ? " " : "";
    // "30°C" → "30 độ C": same on the left for entries starting with punctuation.
    const lead = !hit.startsWord && isWordChar(text[i - 1]) ? " " : "";
    out += text.slice(last, i) + lead + hit.to + glue;
    last = i = end;
  }
  return out + text.slice(last);
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
    const f = from.normalize("NFC").trim().slice(0, 80);
    const tt = to.normalize("NFC").trim().slice(0, 200);
    if (!f || !tt) continue;
    out.push({ from: f, to: tt, caseSensitive: typeof caseSensitive === "boolean" ? caseSensitive : undefined });
    if (out.length >= max) break;
  }
  return out;
}
