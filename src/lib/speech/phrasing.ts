/**
 * Prosodic phrasing ("ngắt hơi").
 *
 * Neural voices pause at punctuation, but Vietnamese news copy is full of
 * 30–50 syllable sentences with no commas, which voices then read in one
 * breathless, flat run. Human anchors breathe before discourse connectives
 * ("tuy nhiên", "trong khi đó", "nhằm"…) — so we add a soft comma there,
 * but only when the clause before it is already long enough that a breath
 * is natural, and the rest of the sentence is long enough to stand alone.
 *
 * Target phrase length: ~8–14 syllables (Vietnamese words are mostly
 * monosyllabic, so whitespace tokens ≈ syllables).
 */

const VI_CONNECTIVES = [
  "tuy nhiên", "trong khi đó", "trong khi", "thế nhưng", "nhưng", "song song với",
  "bởi vì", "vì vậy", "vì thế", "do đó", "do vậy", "cho nên", "mặc dù", "dù vậy",
  "đồng thời", "ngoài ra", "bên cạnh đó", "theo đó", "qua đó", "từ đó", "nhằm",
  "trong đó", "cũng như", "kể cả", "tức là", "nghĩa là", "khiến cho", "dẫn đến",
  "sau khi", "trước khi", "để từ đó",
];

const EN_CONNECTIVES = [
  "however", "but", "although", "though", "whereas", "because", "therefore",
  "meanwhile", "while", "which means", "so that", "even though", "unless",
];

const MIN_LEFT_WORDS = 9;
const MIN_RIGHT_WORDS = 4;

function wordsSinceLastBreak(before: string): number {
  const lastBreak = Math.max(
    before.lastIndexOf(","),
    before.lastIndexOf(";"),
    before.lastIndexOf(":"),
    before.lastIndexOf("("),
    before.lastIndexOf("-"),
    before.lastIndexOf("–"),
  );
  const segment = before.slice(lastBreak + 1).trim();
  return segment ? segment.split(/\s+/).length : 0;
}

function wordsUntilNextBreak(after: string): number {
  const m = after.search(/[,;:.!?]/);
  const segment = (m === -1 ? after : after.slice(0, m)).trim();
  return segment ? segment.split(/\s+/).length : 0;
}

/**
 * Insert breath commas before connectives in long clauses.
 * Never touches text that already has punctuation at that spot.
 */
export function insertPhraseBreaks(sentence: string, lang: "vi" | "en"): string {
  const connectives = (lang === "vi" ? VI_CONNECTIVES : EN_CONNECTIVES)
    .slice()
    .sort((a, b) => b.length - a.length);
  const alternation = connectives.map((c) => c.replace(/\s+/g, "\\s+")).join("|");
  // Preceded by a space (not punctuation) and followed by a word boundary.
  const re = new RegExp(`(?<=[\\p{L}\\p{N}])\\s+(${alternation})(?![\\p{L}\\p{N}])`, "giu");

  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence))) {
    const before = out + sentence.slice(last, m.index);
    const after = sentence.slice(m.index + m[0].length);
    if (
      wordsSinceLastBreak(before) >= MIN_LEFT_WORDS &&
      wordsUntilNextBreak(after) + m[1].split(/\s+/).length >= MIN_RIGHT_WORDS
    ) {
      out = before + "," + m[0];
    } else {
      out = before + m[0];
    }
    last = m.index + m[0].length;
  }
  return out + sentence.slice(last);
}
