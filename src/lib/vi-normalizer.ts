/**
 * Vietnamese Text Normalizer for TTS.
 * Converts numbers, dates, times, currency, units, etc. to Vietnamese words
 * before sending to TTS engine. This dramatically improves pronunciation
 * because TTS models can't natively read "22/1" or "100.000đ" in Vietnamese.
 *
 * Ported from nghitts.app's tts-worker.
 */

// ─── Number to Vietnamese Words ──────────────────────────────────────────────

const DIGITS: Record<string, string> = {
  "0": "không", "1": "một", "2": "hai", "3": "ba", "4": "bốn",
  "5": "năm", "6": "sáu", "7": "bảy", "8": "tám", "9": "chín",
};

const TEENS: Record<string, string> = {
  "10": "mười", "11": "mười một", "12": "mười hai", "13": "mười ba",
  "14": "mười bốn", "15": "mười lăm", "16": "mười sáu", "17": "mười bảy",
  "18": "mười tám", "19": "mười chín",
};

const TENS: Record<string, string> = {
  "2": "hai mươi", "3": "ba mươi", "4": "bốn mươi", "5": "năm mươi",
  "6": "sáu mươi", "7": "bảy mươi", "8": "tám mươi", "9": "chín mươi",
};

export function numberToVietnamese(input: string): string {
  const s = input.replace(/^0+/, "") || "0";
  if (s.startsWith("-")) return "âm " + numberToVietnamese(s.substring(1));

  const n = parseInt(s, 10);
  if (isNaN(n)) return input;
  if (n === 0) return "không";
  if (n < 10) return DIGITS[String(n)];
  if (n < 20) return TEENS[String(n)];

  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[String(t)];
    if (u === 1) return TENS[String(t)] + " mốt";
    if (u === 4) return TENS[String(t)] + " tư";
    if (u === 5) return TENS[String(t)] + " lăm";
    return TENS[String(t)] + " " + DIGITS[String(u)];
  }

  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const result = DIGITS[String(h)] + " trăm";
    if (r === 0) return result;
    if (r < 10) return result + " lẻ " + DIGITS[String(r)];
    return result + " " + numberToVietnamese(String(r));
  }

  if (n < 1_000_000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const result = numberToVietnamese(String(th)) + " nghìn";
    if (r === 0) return result;
    if (r < 10) return result + " không trăm lẻ " + DIGITS[String(r)];
    if (r < 100) return result + " không trăm " + numberToVietnamese(String(r));
    return result + " " + numberToVietnamese(String(r));
  }

  if (n < 1_000_000_000) {
    const m = Math.floor(n / 1_000_000);
    const r = n % 1_000_000;
    const result = numberToVietnamese(String(m)) + " triệu";
    if (r === 0) return result;
    return result + " " + numberToVietnamese(String(r));
  }

  if (n < 1_000_000_000_000) {
    const b = Math.floor(n / 1_000_000_000);
    const r = n % 1_000_000_000;
    const result = numberToVietnamese(String(b)) + " tỷ";
    if (r === 0) return result;
    return result + " " + numberToVietnamese(String(r));
  }

  // Fallback: read digit by digit
  return s.split("").map((d) => DIGITS[d] || d).join(" ");
}

// ─── Text Processing Functions ───────────────────────────────────────────────

function removeThousandsSeparators(text: string): string {
  return text.replace(/(\d{1,3}(?:\.\d{3})+)(?=\s|$|[^\d.,])/g, (m) =>
    m.replace(/\./g, "")
  );
}

function convertDecimals(text: string): string {
  return text.replace(/(\d+),(\d+)(?=\s|$|[^\d,])/g, (_m, whole, frac) => {
    const w = numberToVietnamese(whole);
    const f = numberToVietnamese(frac.replace(/^0+/, "") || "0");
    return `${w} phẩy ${f}`;
  });
}

function convertPercentages(text: string): string {
  let t = text;
  // Range: 10-20%
  t = t.replace(/(\d+)\s*[-–—]\s*(\d+)\s*%/g, (_m, a, b) =>
    `${numberToVietnamese(a)} đến ${numberToVietnamese(b)} phần trăm`
  );
  // Decimal: 3,5%
  t = t.replace(/(\d+),(\d+)\s*%/g, (_m, w, f) =>
    `${numberToVietnamese(w)} phẩy ${numberToVietnamese(f.replace(/^0+/, "") || "0")} phần trăm`
  );
  // Simple: 15%
  t = t.replace(/(\d+)\s*%/g, (_m, n) => numberToVietnamese(n) + " phần trăm");
  return t;
}

function convertCurrency(text: string): string {
  let t = text;
  // VND: 100000đồng, 100000VND, 100000đ
  t = t.replace(/(\d+(?:,\d+)?)\s*(?:đồng|VND|vnđ)\b/gi, (_m, n) =>
    numberToVietnamese(n.replace(/,/g, "")) + " đồng"
  );
  t = t.replace(/(\d+(?:,\d+)?)đ(?![a-zà-ỹ])/gi, (_m, n) =>
    numberToVietnamese(n.replace(/,/g, "")) + " đồng"
  );
  // USD: $100, 100USD
  t = t.replace(/\$\s*(\d+(?:,\d+)?)/g, (_m, n) =>
    numberToVietnamese(n.replace(/,/g, "")) + " đô la"
  );
  t = t.replace(/(\d+(?:,\d+)?)\s*(?:USD|\$)/gi, (_m, n) =>
    numberToVietnamese(n.replace(/,/g, "")) + " đô la"
  );
  return t;
}

function convertTimes(text: string): string {
  let t = text;
  // HH:MM:SS
  t = t.replace(/(\d{1,2}):(\d{2})(?::(\d{2}))?/g, (_m, h, min, sec) => {
    let r = numberToVietnamese(h) + " giờ";
    if (min) r += " " + numberToVietnamese(min) + " phút";
    if (sec) r += " " + numberToVietnamese(sec) + " giây";
    return r;
  });
  // Xh30
  t = t.replace(/(\d{1,2})h(\d{2})(?![a-zà-ỹ])/gi, (_m, h, min) => {
    const hi = parseInt(h, 10);
    const mi = parseInt(min, 10);
    if (hi >= 0 && hi <= 23 && mi >= 0 && mi <= 59)
      return numberToVietnamese(h) + " giờ " + numberToVietnamese(min);
    return _m;
  });
  // Xh (standalone)
  t = t.replace(/(\d{1,2})h(?![a-zà-ỹ\d])/gi, (_m, h) => {
    const hi = parseInt(h, 10);
    return hi >= 0 && hi <= 23 ? numberToVietnamese(h) + " giờ" : _m;
  });
  return t;
}

function convertDates(text: string): string {
  let t = text;

  function isValidDay(d: number, m: number): boolean {
    return d >= 1 && d <= 31 && m >= 1 && m <= 12;
  }

  // DD/MM/YYYY
  t = t.replace(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/g, (_m, d, m, y) => {
    if (isValidDay(parseInt(d), parseInt(m)))
      return `ngày ${numberToVietnamese(d)} tháng ${numberToVietnamese(m)} năm ${numberToVietnamese(y)}`;
    return _m;
  });
  // DD/MM — a slash is always a date. A hyphen is a date when it follows
  // "ngày"/"hôm"/"mùng" (also "ngày 30-4 và 1-5"), or when day > month
  // ("30-4"); otherwise "2-3 ngày" is a range and "2-1" a score.
  t = t.replace(/(?<![\d-])(\d{1,2})([/-])(\d{1,2})(?![/-]?\d)/g, (_m, d, sep, m, offset, full) => {
    const after = full.slice(offset + _m.length);
    const before = full.slice(0, offset);
    if (/^\s*%/.test(after)) return _m;
    if (sep === "-") {
      const afterKeyword = /(?:ngày|hôm|mùng|mồng)\s*$/i.test(before);
      const listedAfterDate = /(?:ngày|hôm|mùng|mồng)\s*\d{1,2}-\d{1,2}\s*(?:và|,|đến|tới|hoặc)\s*$/i.test(before);
      const dayAfterMonth = parseInt(d) > parseInt(m) && !SCORE_CONTEXT.test(before);
      if (!afterKeyword && !listedAfterDate && !dayAfterMonth) return _m;
    }
    if (isValidDay(parseInt(d), parseInt(m)))
      return `${numberToVietnamese(d)} tháng ${numberToVietnamese(m)}`;
    return _m;
  });
  // tháng X
  t = t.replace(/tháng\s*(\d+)/g, (_m, m) => {
    const mi = parseInt(m);
    return mi >= 1 && mi <= 12 ? "tháng " + numberToVietnamese(m) : _m;
  });
  // ngày X
  t = t.replace(/ngày\s*(\d+)/g, (_m, d) => {
    const di = parseInt(d);
    return di >= 1 && di <= 31 ? "ngày " + numberToVietnamese(d) : _m;
  });
  return t;
}

function convertYearRanges(text: string): string {
  return text.replace(/(\d{4})\s*[-–—]\s*(\d{4})/g, (_m, a, b) =>
    numberToVietnamese(a) + " đến " + numberToVietnamese(b)
  );
}

/** Words that introduce a match score: "thắng 2-1", "tỷ số 3-0". */
const SCORE_CONTEXT = /(?:tỷ số|tỉ số|thắng|thua|hòa|hoà|cách biệt|dẫn|gỡ hòa|gỡ hoà)\s*$/i;

/**
 * Hyphenated number pairs, after dates/percentages:
 *   "thắng 2-1" → "thắng hai một" (score)
 *   "2-3 ngày", "10–15 người" → "hai đến ba ngày" (ascending range)
 * Codes and chains ("số 12-2024", "123-456-789") are left alone.
 */
function convertRanges(text: string): string {
  return text.replace(/(?<![\d.,\-–—])(\d+)\s*[-–—]\s*(\d+)(?![\d/%]|\s*[-–—]\s*\d)/g, (m, a, b, offset, full) => {
    const before = full.slice(0, offset);
    if (SCORE_CONTEXT.test(before)) return `${numberToVietnamese(a)} ${numberToVietnamese(b)}`;
    if (/(?:số|mã|ký hiệu|kí hiệu|No\.?)\s*$/i.test(before)) return m;
    if (a.length > 4 || b.length > 4 || parseInt(a, 10) >= parseInt(b, 10)) return m;
    return `${numberToVietnamese(a)} đến ${numberToVietnamese(b)}`;
  });
}

/** "0912-345-678", "0912 345 678" → digit by digit (before ranges/dates). */
function convertGroupedPhoneNumbers(text: string): string {
  return text.replace(/(?<![\d])(?:\+84|0)\d{2,3}[-. ]\d{3}[-. ]\d{3,4}(?!\d)/g, (m) =>
    m.match(/\d/g)!.map((d) => DIGITS[d] || d).join(" ")
  );
}

/** Informal money shorthand common in Vietnamese copy: 50k, 5tr, 2 tỷ. */
function convertShorthandAmounts(text: string): string {
  let t = text;
  const amount = (w: string, f: string | undefined, unit: string) =>
    f
      ? `${numberToVietnamese(w)} phẩy ${numberToVietnamese(f.replace(/^0+/, "") || "0")} ${unit}`
      : `${numberToVietnamese(w)} ${unit}`;
  // Lowercase only ("4K" is a resolution) and never glued to more digits
  // ("2k6", "5tr5" are slang we leave untouched).
  t = t.replace(/(?<![\d.,])(\d+)(?:[.,](\d+))?\s*tr(?![a-zà-ỹ\d])/g, (_m, w, f) => amount(w, f, "triệu"));
  t = t.replace(/(?<![\d.,])(\d+)(?:[.,](\d+))?\s*k(?![a-zà-ỹ\d])/g, (_m, w, f) => amount(w, f, "nghìn"));
  return t;
}

const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function romanToNumber(roman: string): number | null {
  if (!/^[IVXLCDM]+$/.test(roman)) return null;
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const v = ROMAN_VALUES[roman[i]];
    const next = ROMAN_VALUES[roman[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  // Reject non-canonical forms like "IIII" or "VX".
  const canonical = numberToRoman(total);
  return canonical === roman ? total : null;
}

function numberToRoman(n: number): string {
  const map: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

/** "thế kỷ XXI", "Đại hội XIII", "khóa XV" → Vietnamese numbers. */
function convertRomanNumerals(text: string): string {
  return text.replace(
    /((?:thế kỷ|thế kỉ|đại hội|khóa|khoá|kỳ họp|chương|hội nghị|quý|lần thứ)\s+)([IVXLC]+)(?![\p{L}\d])/giu,
    (m, prefix, roman) => {
      // Numerals must be written in capitals; a lone C/L is a letter ("mục C").
      if (roman !== roman.toUpperCase() || /^[CL]$/.test(roman)) return m;
      const n = romanToNumber(roman);
      return n ? prefix + numberToVietnamese(String(n)) : m;
    }
  );
}

function convertPhoneNumbers(text: string): string {
  const readDigits = (s: string) =>
    s.match(/\d/g)!.map((d) => DIGITS[d] || d).join(" ");
  let t = text;
  t = t.replace(/0\d{9,10}/g, readDigits);
  t = t.replace(/\+84\d{9,10}/g, readDigits);
  return t;
}

const UNIT_MAP: Record<string, string> = {
  m: "mét", cm: "xăng-ti-mét", mm: "mi-li-mét", km: "ki-lô-mét",
  kg: "ki-lô-gam", g: "gam", mg: "mi-li-gam",
  ml: "mi-li-lít", l: "lít",
  "m²": "mét vuông", m2: "mét vuông", "km²": "ki-lô-mét vuông", km2: "ki-lô-mét vuông",
  ha: "héc-ta", "m³": "mét khối", m3: "mét khối",
  "°C": "độ C", "°F": "độ F",
  "km/h": "ki-lô-mét trên giờ", "m/s": "mét trên giây",
  h: "giờ", hr: "giờ", min: "phút", s: "giây",
};

function convertUnits(text: string): string {
  let t = text;
  const units = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length);
  for (const unit of units) {
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = unit.length === 1
      ? `(\\d+)\\s*${escaped}(?!\\s*[a-zA-Zà-ỹ])(?=\\s*[^a-zA-Zà-ỹ]|$)`
      : `(\\d+)\\s*${escaped}(?=\\s|[^\\w]|$)`;
    const regex = new RegExp(pattern, "gi");
    t = t.replace(regex, (_m, num) => num + " " + UNIT_MAP[unit]);
  }
  return t;
}

function convertRemainingNumbers(text: string): string {
  return text.replace(/\b\d+\b/g, (m) => numberToVietnamese(m));
}

function cleanSpecialChars(text: string): string {
  let t = text;
  t = t.replace(/&/g, " và ");
  t = t.replace(/@/g, " a còng ");
  t = t.replace(/#/g, " thăng ");
  t = t.replace(/[*_~`^]/g, "");
  t = t.replace(/https?:\/\/\S+/g, "");
  t = t.replace(/www\.\S+/g, "");
  t = t.replace(/\S+@\S+\.\S+/g, "");
  return t;
}

function normalizePunctuation(text: string): string {
  let t = text;
  t = t.replace(/[""„‟]/g, '"');
  t = t.replace(/[''‚‛]/g, "'");
  t = t.replace(/[–—−]/g, "-");
  t = t.replace(/\.{3,}/g, "...");
  t = t.replace(/…/g, "...");
  t = t.replace(/([!?.]){2,}/g, "$1");
  return t;
}

function removeEmojis(text: string): string {
  return text
    .replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{FE0F}]|[\u{200D}]/gu,
      ""
    )
    .replace(/[\\()¯]/g, "")
    .replace(/["""]/g, "")
    .replace(/\s—/g, ".")
    .replace(/\b_\b/g, " ");
}

function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Normalize Vietnamese text for TTS.
 * Converts all numbers, dates, times, currency, units to spoken Vietnamese words.
 * Must be called BEFORE sending text to any TTS engine.
 */
export function normalizeVietnameseText(text: string): string {
  if (!text || typeof text !== "string") return "";

  let t = text;
  t = t.normalize("NFC");           // Unicode NFC normalize (critical for Vietnamese diacritics)
  t = removeEmojis(t);
  t = cleanSpecialChars(t);
  t = normalizePunctuation(t);
  t = removeThousandsSeparators(t); // 100.000 → 100000
  t = convertGroupedPhoneNumbers(t); // 0912-345-678 → digit by digit
  t = convertYearRanges(t);         // 2020-2025 → hai nghìn hai mươi đến...
  t = convertDates(t);              // 22/1/2024 → ngày hai mươi hai tháng một...
  t = convertTimes(t);              // 14:30 → mười bốn giờ ba mươi
  t = convertCurrency(t);           // 100.000đ → một trăm nghìn đồng
  t = convertShorthandAmounts(t);   // 50k → năm mươi nghìn, 5tr → năm triệu
  t = convertPercentages(t);        // 15% → mười lăm phần trăm
  t = convertRanges(t);             // 2-3 ngày → hai đến ba ngày
  t = convertRomanNumerals(t);      // thế kỷ XXI → thế kỷ hai mươi mốt
  t = convertPhoneNumbers(t);       // 0912345678 → không chín một hai...
  t = convertDecimals(t);           // 3,5 → ba phẩy năm
  t = convertUnits(t);              // 5km → năm ki-lô-mét
  t = convertRemainingNumbers(t);   // Any remaining numbers → words
  t = cleanWhitespace(t);

  return t;
}
