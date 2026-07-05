/** Lightweight script language detection for Pet News voice selection safety. */

/**
 * Detect whether text is likely Vietnamese or English.
 *
 * Uses deterministic heuristics:
 * - Vietnamese diacritics (á, à, ả, ã, ạ, ă, â, đ, ê, ô, ơ, ư) are strong signals
 * - English common words pattern
 * - If no clear signal, defaults to "en" (safer — English voices won't mangle VN diacritics as badly)
 */
export function detectScriptLang(text: string): "vi" | "en" {
  if (!text || text.trim().length < 10) return "en"; // Too short to determine

  // Vietnamese diacritics — strong indicator
  const VI_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

  const trimmed = text.trim();

  // If >30% of non-space characters have diacritics, it's Vietnamese
  const viChars = (trimmed.match(VI_DIACRITICS) || []).length;
  const totalChars = trimmed.replace(/\s/g, "").length;

  if (totalChars > 0 && viChars / totalChars > 0.15) {
    return "vi";
  }

  // Fallback: check for common Vietnamese words
  const viWords = ["xin chào", "chào", "cảm ơn", "hôm nay", "thời tiết", "tin tức", "bản tin", "phóng viên", "khán giả", "thú cưng", "mèo", "chó"];
  const lower = trimmed.toLowerCase();
  if (viWords.some((w) => lower.includes(w))) return "vi";

  return "en";
}
