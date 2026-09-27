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

/** Fraction digits after "phẩy": leading zeros are spoken ("05" → "không năm"). */
function fractionToVietnamese(frac: string): string {
  const zeros = frac.match(/^0*/)![0].length;
  const rest = frac.slice(zeros);
  const words = Array(zeros).fill("không");
  if (rest) words.push(numberToVietnamese(rest));
  return words.join(" ") || "không";
}

/** "2,05" (or "2.05") → "hai phẩy không năm"; integers pass through. */
export function decimalToVietnamese(value: string): string {
  const [whole, frac] = value.split(/[.,]/);
  return frac ? `${numberToVietnamese(whole)} phẩy ${fractionToVietnamese(frac)}` : numberToVietnamese(whole);
}

/** Month names as anchors say them: April is "tháng tư". */
function monthToVietnamese(m: string | number): string {
  const n = Number(m);
  return n === 4 ? "tư" : numberToVietnamese(String(n));
}

const numericValue = (v: string) => parseFloat(v.replace(",", "."));

// ─── Text Processing Functions ───────────────────────────────────────────────

function removeThousandsSeparators(text: string): string {
  return text.replace(/(\d{1,3}(?:\.\d{3})+)(?=\s|$|[^\d.,])/g, (m) =>
    m.replace(/\./g, "")
  );
}

function convertDecimals(text: string): string {
  return text.replace(/(\d+),(\d+)(?=\s|$|[^\d,])/g, (_m, whole, frac) => decimalToVietnamese(`${whole},${frac}`));
}

function convertPercentages(text: string): string {
  let t = text;
  // Range: 10-20%, 2,5-3%
  t = t.replace(/(?<![\d,])(\d+(?:,\d+)?)\s*[-–—]\s*(\d+(?:,\d+)?)\s*%/g, (_m, a, b) =>
    `${decimalToVietnamese(a)} đến ${decimalToVietnamese(b)} phần trăm`
  );
  // Decimal or simple: 3,5% / 15%
  t = t.replace(/(?<![\d,])(\d+(?:,\d+)?)\s*%/g, (_m, n) => decimalToVietnamese(n) + " phần trăm");
  return t;
}

const MULTIPLIER = "(?:\\s*(nghìn|ngàn|triệu|tỷ|tỉ)|(k|K|m|M|bn|B)(?![\\p{L}\\d]))?";
const SHORT_MULTIPLIER: Record<string, string> = { k: "nghìn", K: "nghìn", m: "triệu", M: "triệu", bn: "tỷ", B: "tỷ" };

function convertCurrency(text: string): string {
  let t = text;
  const amount = (n: string, mult?: string) => decimalToVietnamese(n) + (mult ? ` ${mult}` : "");
  // Ranges: "300-500đ/lít", "5-10 USD" (number pairs skip these for us)
  const moneyRange = (unit: string) => (m: string, a: string, b: string) =>
    numericValue(a) < numericValue(b) ? `${amount(a)} đến ${amount(b)} ${unit}` : m;
  t = t.replace(
    /(?<![\d.,])(\d+(?:,\d+)?)\s*[-–—]\s*(\d+(?:,\d+)?)\s*(?:đồng(?!\s+(?:bào|loạt|chí|nghiệp|thời|nghĩa))|VND|vnđ|đ(?!\/c(?!\p{L})))(?![\p{L}])/giu,
    moneyRange("đồng"),
  );
  t = t.replace(/(?<![\d.,])(\d+(?:,\d+)?)\s*[-–—]\s*(\d+(?:,\d+)?)\s*(?:USD|\$)/giu, moneyRange("đô la"));
  t = t.replace(/\$\s*(\d+(?:,\d+)?)\s*[-–—]\s*(\d+(?:,\d+)?)(?!\d|,\d)/g, moneyRange("đô la"));
  // VND: 100000đồng, 100000VND, 100000đ, 1,2 tỷ đồng
  t = t.replace(/(\d+(?:,\d+)?)\s*(?:đồng|VND|vnđ)(?![\p{L}])/giu, (_m, n) => amount(n) + " đồng");
  t = t.replace(/(\d+(?:,\d+)?)đ(?![a-zà-ỹ])/gi, (_m, n) => amount(n) + " đồng");
  // USD: $100, $1,5 triệu, 100 USD, 2 tỷ USD
  t = t.replace(new RegExp(`\\$\\s*(\\d+(?:,\\d+)?)${MULTIPLIER}`, "gu"), (_m, n, mult, short) =>
    amount(n, mult ?? SHORT_MULTIPLIER[short]) + " đô la");
  t = t.replace(/(\d+(?:,\d+)?)\s*(?:USD|\$)/gi, (_m, n) => amount(n) + " đô la");
  return t;
}

function convertTimes(text: string): string {
  let t = text;
  // Hour ranges: "8h-17h", "7h30-9h" → "tám giờ đến mười bảy giờ"
  const hour = (h: string, min?: string) =>
    `${numberToVietnamese(h)} giờ${min && parseInt(min) > 0 ? " " + numberToVietnamese(min) : ""}`;
  t = t.replace(/(?<![\d:])(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})(?![\d:])/g, (m, h1, m1, h2, m2) =>
    parseInt(h1) <= 24 && parseInt(h2) <= 24 ? `${hour(h1, m1)} đến ${hour(h2, m2)}` : m
  );
  t = t.replace(/(?<!\d)(\d{1,2})h(\d{2})?\s*[-–]\s*(\d{1,2})h(\d{2})?(?![a-zà-ỹ\d])/gi, (m, h1, m1, h2, m2) =>
    parseInt(h1) <= 24 && parseInt(h2) <= 24 ? `${hour(h1, m1)} đến ${hour(h2, m2)}` : m
  );
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
  // Xh (standalone) — "24h qua" is a duration, so allow 24.
  t = t.replace(/(\d{1,2})h(?![a-zà-ỹ\d])/gi, (_m, h) => {
    const hi = parseInt(h, 10);
    return hi >= 0 && hi <= 24 ? numberToVietnamese(h) + " giờ" : _m;
  });
  return t;
}

function convertDates(text: string): string {
  let t = text;

  function isValidDay(d: number, m: number): boolean {
    return d >= 1 && d <= 31 && m >= 1 && m <= 12;
  }

  const dayWords = (d: string, m: string) => `${numberToVietnamese(d)} tháng ${monthToVietnamese(m)}`;

  // Date ranges: "30/4-1/5" and "2-3/5" (days 2 to 3 of May).
  t = t.replace(/(?<![\d.,/])(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})(?![/\d])/g, (m, d1, m1, d2, m2) =>
    isValidDay(parseInt(d1), parseInt(m1)) && isValidDay(parseInt(d2), parseInt(m2))
      ? `${dayWords(d1, m1)} đến ${dayWords(d2, m2)}`
      : m
  );
  t = t.replace(/(?<![\d.,/-])(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})(?![/\d])/g, (m, d1, d2, mo) =>
    parseInt(d1) < parseInt(d2) && isValidDay(parseInt(d2), parseInt(mo))
      ? `${numberToVietnamese(d1)} đến ${dayWords(d2, mo)}`
      : m
  );

  // DD/MM/YYYY — don't repeat "ngày" when the text already says it.
  t = t.replace(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/g, (_m, d, m, y, offset, full) => {
    if (!isValidDay(parseInt(d), parseInt(m))) return _m;
    const prefix = /ngày\s*$/i.test(full.slice(0, offset)) ? "" : "ngày ";
    return `${prefix}${dayWords(d, m)} năm ${numberToVietnamese(y)}`;
  });
  // MM/YYYY — "tháng 12/2024", "12/2024"
  t = t.replace(/(tháng\s*)?(?<!\d[/-]?)(\d{1,2})[/-](\d{4})(?![\d/])/gi, (_m, kw, m, y, offset, full) => {
    const mi = parseInt(m);
    const before = full.slice(0, offset);
    // Legal document numbers: "Thông tư 12/2020/TT-BTC", "Luật số 12/2024"
    if (!kw && /(?:số|thông tư|nghị định|quyết định|luật|chỉ thị|điều|công văn)\s*$/i.test(before)) return _m;
    // Quarters: "quý 1/2025" → "quý một năm …"
    if (!kw && /quý\s*$/i.test(before) && mi >= 1 && mi <= 4)
      return `${numberToVietnamese(m)} năm ${numberToVietnamese(y)}`;
    if (mi < 1 || mi > 12) return _m;
    return `${kw ? kw.trimEnd() + " " : "tháng "}${monthToVietnamese(m)} năm ${numberToVietnamese(y)}`;
  });
  // DD/MM (slash). A date unless it reads as a rank ("thứ 3/10") or a
  // ratio ("tỷ lệ 1/3"). Hyphenated pairs ("30-4", "2-1", "2-3") are
  // classified separately by convertNumberPairs.
  t = t.replace(/(?<![\d.,:-])(\d{1,2})\/(\d{1,2})(?![/-]?\d|:\d)/g, (_m, d, m, offset, full) => {
    const after = full.slice(offset + _m.length);
    const before = full.slice(0, offset);
    if (/^\s*%/.test(after)) return _m;
    if (parseInt(d) < parseInt(m)) {
      if (/(?:thứ|hạng|xếp|top)\s*$/i.test(before)) return `${numberToVietnamese(d)} trên ${numberToVietnamese(m)}`;
      const approx = /(?:khoảng|gần|hơn)\s*$/i.test(before) && /^\s*\p{Ll}/u.test(after) && !/^\s*năm/.test(after);
      if (/(?:tỷ lệ|tỉ lệ|chiếm)\s*$/i.test(before) || approx)
        return `${numberToVietnamese(d)} phần ${numberToVietnamese(m)}`;
    }
    if (isValidDay(parseInt(d), parseInt(m))) return dayWords(d, m);
    return _m;
  });
  return t;
}

/** Leftover "tháng 5", "ngày 12" → words (after hyphen pairs are classified). */
function convertDayMonthWords(text: string): string {
  let t = text.replace(/tháng\s*(\d+)(?![\d,])/g, (_m, m) => {
    const mi = parseInt(m);
    return mi >= 1 && mi <= 12 ? "tháng " + monthToVietnamese(m) : _m;
  });
  t = t.replace(/ngày\s*(\d+)/g, (_m, d) => {
    const di = parseInt(d);
    return di >= 1 && di <= 31 ? "ngày " + numberToVietnamese(d) : _m;
  });
  return t;
}

function convertYearRanges(text: string): string {
  return text.replace(/(?<![\d.]|(?<!\d{4}),)(\d{4})\s*[-–—]\s*(\d{4})(?!\d|[.,]\d(?!\d{3}(?!\d)))/g, (_m, a, b) =>
    numberToVietnamese(a) + " đến " + numberToVietnamese(b)
  );
}

// ─── Hyphenated number pairs ─────────────────────────────────────────────────
//
// "30-4" (date), "thắng 2-1" (score), "2-3 ngày" (range) and "số 12-2024"
// (code) look identical. Each pair is classified ONCE, on the raw text, by
// checking these signals in priority order (first match wins):
//
//   1. "tháng 3-4"                        → month range
//   2. code prefix ("số", "mã")           → keep as written
//   3. date word before ("ngày", "mùng")  → date
//   4. listed right after a date/score    → same class ("30-4 và 1-5",
//      ("và", ",", "đến", "-" between)       "thắng 3-1 và 2-1", "4-6, 3-6")
//   5. time-of-day dateline ("Chiều 5-6,")→ date
//   6. score word in the same clause      → score
//   7. unambiguous date partner after     → date ("từ 1-5 đến 10-5")
//   8. event word + date-like tail        → date ("Từ 1-7 năm nay,", "lễ 2-9 kéo dài")
//   9. ascending + counting noun after    → range ("2-3 ngày", "2-3 ngày sau")
//  10. event/deadline word before         → date ("kết thúc 1-5", "dịp 2-9")
//  11. small equal pair                   → score (a draw: "1-1")
//      day ≥ month, valid date            → date ("30-4", "10-10")
//  12. ascending                          → range
//  13. otherwise                          → keep

/** Words that make "D-M" a date: "ngày 2-9", "mùng 2-9". */
const DATE_KEYWORDS = /(?<!\p{L})(?:ngày|hôm|mùng|mồng)\s*$/iu;
/**
 * Time-of-day words start datelines ("Chiều 5-6, …", "Chiều 5-6 năm nay")
 * but also counts ("Sáng 2-3 người"): a date only when the pair is followed
 * by punctuation, the end, a capitalised word or "năm nay/ngoái/<year>".
 */
const TIME_OF_DAY = /(?<!\p{L})(?:sáng|trưa|chiều|tối|đêm|khuya|rạng sáng)\s*$/iu;
const DATELINE_END = /^\s*(?:[,.;:!?)]|$|\p{Lu}|năm\s+(?:nay|ngoái|\d))/u;
/** Event/deadline words: a valid D-M right after them is a date ("kết thúc 1-5", "dịp 2-9"). */
const EVENT_BEFORE =
  /(?<!\p{L})(?:kết thúc|bắt đầu|khai mạc|bế mạc|diễn ra|khởi công|khánh thành|hết hạn|có hiệu lực|đến hết|dịp|lễ|quốc khánh|tết|dương lịch|âm lịch)\s*$/iu;
/** "từ"/"trước" also start date phrases, but only with a date-like tail: "Từ 1-7 năm nay,". */
const EVENT_OR_FROM_BEFORE =
  /(?<!\p{L})(?:kết thúc|bắt đầu|khai mạc|bế mạc|diễn ra|khởi công|khánh thành|hết hạn|có hiệu lực|đến hết|dịp|lễ|quốc khánh|tết|dương lịch|âm lịch|từ|trước)\s*$/iu;
const DATE_TAIL = /^\s*(?:[,.;:!?)]|$|năm\s+(?:nay|ngoái|\d)|đồng loạt|kéo dài|có hiệu lực|\p{Lu})/u;
const CODE_PREFIX = /(?<!t[ỷỉ]\s)(?:số|mã|ký hiệu|kí hiệu|No\.?)\s*$/iu;
const LIST_CONNECTOR = /^\s*(?:và|,|đến|tới|hoặc|-)\s*$/i;

/** Match-report vocabulary: "thắng HAGL 2-1", "Thua 0-2", "tỷ số chung cuộc 3-0". */
const SCORE_WORDS =
  /(?<!\p{L})(?:t[ỷỉ] số|chung cuộc|cách biệt|đánh bại|hạ gục|dẫn trước|vượt qua|đè bẹp|thất bại|kết thúc|kết quả|chiến thắng|thắng(?! (?:lợi|thầu|kiện))|thua(?! (?:lỗ|kiện))|(?:cầm |gỡ )?h(?:òa|oà)(?! (?:bình|giải|hợp|nhập|thuận|vốn)))(?!\p{L})/giu;

/**
 * Score words that are just as common outside sport ("Khuyến mãi kết thúc
 * 30-4", "đảo chính thất bại 15-7"): they only count with a sports cue in
 * the clause, or a capitalised team name right after them.
 */
const WEAK_SCORE_WORDS = /^(?:vượt qua|đè bẹp|thất bại|kết thúc|kết quả)$/iu;
const SPORTS_CUE =
  /(?<!\p{L})(?:trận|đấu|hiệp|set|ván|lượt|bán kết|chung kết|tứ kết|vòng bảng|t[ỷỉ] số|đội|tuyển|CLB|FC|U\d{2}|sân nhà|sân khách|bàn thắng)(?!\p{L})/iu;

/**
 * Score words that double as names: "Hòa Phát", "Khánh Hòa", "Thắng",
 * "Chiến thắng Điện Biên Phủ" (an event). Only these are skipped when
 * capitalised next to another capitalised word.
 */
const NAME_CAPABLE = /^(?:h(?:òa|oà)|thắng|chiến thắng)$/iu;

/**
 * A currency unit after the pair ("300-500đ/lít", "5-10 USD"). "đồng" opens
 * many ordinary words (đồng bào, đồng loạt, đồng thời…) and "đ/c" is
 * "đồng chí", so those don't count.
 */
const CURRENCY_AFTER =
  /^\s*(?:VNĐ|VND|vnđ|USD|\$|đ(?!\/c(?!\p{L}))|đồng(?!\s+(?:bào|loạt|chí|nghiệp|thời|nghĩa|hồ|hành|ý|tình|lòng|minh|đội|ruộng|bằng|cỏ|phục|dạng|âm|hương|tâm|khởi|ca|lõa|lõa|Nai|Tháp|Hới|Xoài|Văn|Tháp)))(?![\p{L}\d])/u;

/** Counting nouns: "2-3 ngày", "6-7 tấn" are quantities. */
const COUNTER_AFTER =
  /^\s*(ngày|tuần|tháng|năm|quý|lần|trận|vòng|lượt|mùa|hiệp|phiên|điểm|bàn|tấn|gói|vụ|nhiệm kỳ|người|triệu|tỷ|tỉ|nghìn|ngàn|giờ|tiếng|phút|giây|mét|ki-lô|xăng-ti|mi-li|héc-ta|lít|độ|con|cái|chiếc|căn|hộ|bước|tầng|suất|món|tuổi|đợt|chuyến|cuộc|bài|câu|học sinh|doanh nghiệp|dự án)(?!\p{L})/iu;
/** Time/phase nouns that, followed by these, date the event instead: "3-0 năm 2018", "2-1 lượt đi". */
const TIME_COUNTERS = /^(?:ngày|tuần|tháng|năm|quý|trận|vòng|lượt|mùa|hiệp)$/i;
const TIME_DEIXIS = /^\s+(?:\d|ngoái|nay|này|trước|sau|tới|đi|về|lượt|ra quân|phụ|đầu|cuối|chót|bù giờ)(?!\p{L})/iu;

function followedByCounter(after: string): boolean {
  const m = after.match(COUNTER_AFTER);
  if (!m) return false;
  return !(TIME_COUNTERS.test(m[1]) && TIME_DEIXIS.test(after.slice(m[0].length)));
}

/**
 * A score word within the last six words of the current clause (text after
 * the last , ; . ! ? — a colon doesn't end it: "Tỷ số: 2-1"), with no
 * counting noun after the pair. "chiến thắng" only takes small numbers so
 * "chiến thắng 30-4" (the anniversary) stays a date.
 */
function inScoreContext(before: string, a: string, b: string, after: string): boolean {
  if (parseInt(a, 10) < parseInt(b, 10) && followedByCounter(after)) return false;
  const clause = before.split(/[,;.!?]/).pop() ?? "";
  const window = clause.trim().split(/\s+/).slice(-6).join(" ");
  for (const m of window.matchAll(SCORE_WORDS)) {
    const word = m[0];
    const big = parseFloat(a) >= 20 || parseFloat(b) >= 20;
    if (/^chiến/i.test(word) && big) continue;
    const between = window.slice(m.index! + word.length).trim().split(/\s+/).filter(Boolean);
    const restOfClause = after.split(/[,;.!?]/)[0];
    // A team next to the verb or the pair:
    //  - right after the verb ("đè bẹp MU 6-3")
    //  - before "vượt qua/thất bại/đè bẹp": an acronym ("MU", "HAGL") or a
    //    two-word name ("Việt Nam") — not for "kết thúc/kết quả", whose
    //    subjects are usually events ("Festival Huế kết thúc 12-6")
    //  - an opponent after the pair ("… 0-2 trước Liverpool")
    //  - "Team X-Y Team" ("Kết quả: Hà Nội 2-1 Viettel")
    // A place after the pair ("… 30-4 tại Hà Nội") does not count.
    const beforeVerb = window.slice(0, m.index).trim().split(/\s+/).filter(Boolean);
    const last = beforeVerb[beforeVerb.length - 1] ?? "";
    const teamBeforeVerb =
      !/^kết/iu.test(word) &&
      (/^\p{Lu}{2,}$/u.test(last) || (/^\p{Lu}/u.test(last) && /^\p{Lu}/u.test(beforeVerb[beforeVerb.length - 2] ?? "")));
    const teamNearby =
      /^\p{Lu}/u.test(between[0] ?? "") ||
      teamBeforeVerb ||
      /(?<!\p{L})(?:trước|với)\s+\p{Lu}/u.test(restOfClause) ||
      (/^\s*\p{Lu}/u.test(restOfClause) && /\p{Lu}\S*\s*$/u.test(window));
    if (WEAK_SCORE_WORDS.test(word) && !SPORTS_CUE.test(clause) && !SPORTS_CUE.test(restOfClause) && !teamNearby)
      continue;
    // "thắng lớn dịp 30-4", "Thắng lớn 30-4": a big date-like pair only
    // scores right after the score word or an intensifier ("thua đậm 25-12").
    const intensifiersOnly = between.every((w) => /^(?:đậm|nhọc|sát|nút|tưng|bừng|kịch|tính|nghẹt|thở)$/iu.test(w));
    if (big && parseInt(b, 10) <= 12 && !intensifiersOnly) continue;
    if (/^\p{Lu}/u.test(word) && NAME_CAPABLE.test(word)) {
      const prev = window.slice(0, m.index).trimEnd().split(" ").pop() ?? "";
      const next = window.slice(m.index! + word.length).trimStart().split(" ")[0] ?? "";
      if (/^\p{Lu}/u.test(prev) || /^\p{Lu}/u.test(next)) continue;
    }
    return true;
  }
  return false;
}

type PairClass = "months" | "keep" | "date" | "score" | "range";

function classifyPair(a: string, b: string, before: string, after: string, listed: PairClass | null): PairClass {
  if (a.includes(",") || b.includes(",")) {
    // Decimal money ranges ("12,5-13 USD") are read by convertCurrency.
    if (CURRENCY_AFTER.test(after)) return "keep";
    return numericValue(a) < numericValue(b) ? "range" : "keep";
  }
  const x = parseInt(a, 10);
  const y = parseInt(b, 10);
  const validDate = x >= 1 && x <= 31 && y >= 1 && y <= 12;
  if (/tháng\s*$/i.test(before)) return x >= 1 && x < y && y <= 12 ? "months" : "keep";
  if (CODE_PREFIX.test(before)) return "keep";
  if (validDate && DATE_KEYWORDS.test(before)) return "date";
  if (listed === "score") return "score";
  if (listed === "date" && validDate) return "date";
  if (validDate && TIME_OF_DAY.test(before) && DATELINE_END.test(after)) return "date";
  if (inScoreContext(before, a, b, after)) return "score";
  // Leave ascending money ranges for convertCurrency ("300-500đ", "5-10 USD").
  if (x < y && CURRENCY_AFTER.test(after)) return "keep";
  const partner = after.match(/^\s*(?:và|,|đến|tới|hoặc)\s*(\d{1,2})-(\d{1,2})(?![-\d])/i);
  if (validDate && partner && parseInt(partner[1]) >= parseInt(partner[2]) && parseInt(partner[2]) <= 12) return "date";
  // Ranges ascend; "Đêm 31-12 người dân…" is still a date.
  // …except on scales and levels: "Thang điểm từ 1-5.", "lớp từ 1-5".
  // (only when the scale word is right before "từ": "Mức lương tăng từ 1-7" is a date)
  // Rating scales name their dimension first: "Mức độ hài lòng từ 1-5",
  // "Thang điểm đánh giá từ 1-5", "Cấp độ rủi ro thiên tai từ 1-5".
  const scale =
    /(?<!\p{L})(?:điểm|thang|số|lớp|mức|cấp|hạng)(?:\s+\p{L}+)?\s+từ\s*$/iu.test(before) ||
    /(?<!\p{L})(?:(?:mức|cấp)\s+độ|thang\s+(?:điểm|đo)|đánh giá|chấm)(?!\p{L})[^,;.!?]*?\s+từ\s*$/iu.test(before);
  if (validDate && !scale && EVENT_OR_FROM_BEFORE.test(before) && DATE_TAIL.test(after)) return "date";
  if (x < y && COUNTER_AFTER.test(after)) return "range";
  if (validDate && EVENT_BEFORE.test(before)) return "date";
  // Small equal pairs are draws ("Man City 1-1 Arsenal"), not dates —
  // unless a time preposition leads in ("Từ 1-1 đến nay", "Sau 1-1,") or
  // "đến nay" follows, outside a sports clause ("Sau 1-1 ở hiệp một").
  if (x === y && x < 10) {
    const clause = (before.split(/[,;.!?]/).pop() ?? "") + after.split(/[,;.!?]/)[0];
    // "vào/từ/trước 5-5" is always a date; "sau/đến 1-1" can be a
    // running score in a sports clause ("Sau 1-1 ở hiệp một").
    const firmLead = /(?<!\p{L})(?:từ|trước|vào|kể từ|tính từ)\s*$/iu.test(before) || /^\s*đến nay/iu.test(after);
    const softLead = /(?<!\p{L})(?:sau|đến)\s*$/iu.test(before) && !SPORTS_CUE.test(clause);
    return validDate && (firmLead || softLead) ? "date" : "score";
  }
  // Day ≥ month can't be an ascending range: "30-4", "10-10".
  if (validDate && x >= y) return "date";
  if (x < y && a.length <= 6 && b.length <= 6) return "range";
  return "keep";
}

/**
 * Hyphenated number pairs (runs after units, times and slash dates; before
 * percentages/shorthand, which handle their own ranges). Chains
 * ("123-456-789"), times ("7:30-9:00") and percent/k/tr ranges are skipped.
 */
function convertNumberPairs(text: string): string {
  let lastClass: PairClass | null = null;
  let lastEnd = -1;
  return text.replace(
    /(?<![\d.,:\-–—/$]|\d[hH]|\$\s)(\d+(?:,\d+)?)\s*[-–—]\s*(\d+(?:,\d+)?)(?![\d/%]|,\d|:\d|\s*[-–—]\s*\d|\s*%|\s*(?:k|tr)(?![\p{L}\d]))/gu,
    (m, a, b, offset, full) => {
      const before = full.slice(0, offset);
      const after = full.slice(offset + m.length);
      const listed = lastEnd >= 0 && LIST_CONNECTOR.test(full.slice(lastEnd, offset)) ? lastClass : null;
      const cls = classifyPair(a, b, before, after, listed);
      lastClass = cls;
      lastEnd = offset + m.length;
      switch (cls) {
        case "months":
          return `${monthToVietnamese(a)} đến tháng ${monthToVietnamese(b)}`;
        case "date":
          return `${numberToVietnamese(a)} tháng ${monthToVietnamese(b)}`;
        case "score":
          return `${numberToVietnamese(a)} ${numberToVietnamese(b)}`;
        case "range":
          return `${decimalToVietnamese(a)} đến ${decimalToVietnamese(b)}`;
        default:
          return m;
      }
    },
  );
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
    `${decimalToVietnamese(f ? `${w},${f}` : w)} ${unit}`;
  // Ranges: "50-100k" → "năm mươi đến một trăm nghìn"
  t = t.replace(/(?<![\d.,])(\d+(?:,\d+)?)\s*[-–]\s*(\d+(?:,\d+)?)\s*(k|tr)(?![a-zà-ỹ\d])/g, (_m, a, b, u) =>
    `${decimalToVietnamese(a)} đến ${decimalToVietnamese(b)} ${u === "k" ? "nghìn" : "triệu"}`
  );
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
  ml: "mi-li-lít", l: "lít", L: "lít",
  "m²": "mét vuông", m2: "mét vuông", "km²": "ki-lô-mét vuông", km2: "ki-lô-mét vuông",
  ha: "héc-ta", "m³": "mét khối", m3: "mét khối",
  "°C": "độ C", "°F": "độ F",
  "km/h": "ki-lô-mét trên giờ", "m/s": "mét trên giây",
  h: "giờ", hr: "giờ", min: "phút", s: "giây",
};

function convertUnits(text: string): string {
  // Height shorthand: "1m75" → "một mét bảy mươi lăm"
  let t = text.replace(/(?<![\d,])(\d)m(\d{2})(?![\d\p{L}])/gu, (_m, a, b) =>
    `${numberToVietnamese(a)} mét ${b[0] === "0" ? "lẻ " + DIGITS[b[1]] : numberToVietnamese(b)}`
  );
  const units = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length);
  for (const unit of units) {
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Never inside a dollar amount ("$5m" is five million dollars).
    const lead = "(?<!\\$\\s*[\\d,]*)";
    const pattern = unit.length === 1
      ? `${lead}(\\d+)\\s*${escaped}(?!\\s*[a-zA-Zà-ỹ])(?=\\s*[^a-zA-Zà-ỹ]|$)`
      : `${lead}(\\d+)\\s*${escaped}(?=\\s|[^\\w]|$)`;
    // Single-letter units are lowercase only: "5G"/"4G" are networks, not grams.
    const regex = new RegExp(pattern, unit.length === 1 ? "g" : "gi");
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
  t = convertTimes(t);              // 14:30, 7h30-9h → mười bốn giờ ba mươi …
  t = convertUnits(t);              // 5km → 5 ki-lô-mét (number read later, so ranges/decimals keep the unit)
  t = convertDates(t);              // 22/1/2024, 30/4, 2-3/5 → ngày hai mươi hai tháng một…
  t = convertNumberPairs(t);        // 30-4 / thắng 2-1 / 2-3 ngày → date / score / range
  t = convertDayMonthWords(t);      // tháng 5, ngày 12 → words
  t = convertCurrency(t);           // 100.000đ → một trăm nghìn đồng
  t = convertShorthandAmounts(t);   // 50k → năm mươi nghìn, 5tr → năm triệu
  t = convertPercentages(t);        // 15% → mười lăm phần trăm
  t = convertRomanNumerals(t);      // thế kỷ XXI → thế kỷ hai mươi mốt
  t = convertPhoneNumbers(t);       // 0912345678 → không chín một hai...
  t = convertDecimals(t);           // 3,5 → ba phẩy năm
  t = convertRemainingNumbers(t);   // Any remaining numbers → words
  t = cleanWhitespace(t);

  return t;
}
