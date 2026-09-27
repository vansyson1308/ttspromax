import { describe, expect, it } from "vitest";
import { normalizeVietnameseText, romanToNumber } from "@/lib/vi-normalizer";
import { applyLexicon, VI_BUILTIN_LEXICON } from "../lexicon";
import { insertPhraseBreaks } from "../phrasing";
import { segmentScript, splitSentences, stripPauseTags, decapitalize } from "../segmenter";
import { planScript } from "../planner";

describe("vi-normalizer", () => {
  it("reads numeric ranges as ranges, not dates", () => {
    expect(normalizeVietnameseText("Mưa kéo dài 2-3 ngày")).toBe("Mưa kéo dài hai đến ba ngày");
  });
  it("keeps hyphen dates after 'ngày'", () => {
    expect(normalizeVietnameseText("Lễ kỷ niệm ngày 2-9")).toBe("Lễ kỷ niệm ngày hai tháng chín");
  });
  it("reads slash dates", () => {
    expect(normalizeVietnameseText("Hôm nay 22/1/2024")).toContain("ngày hai mươi hai tháng một năm hai nghìn không trăm hai mươi tư");
  });
  it("reads money shorthand", () => {
    expect(normalizeVietnameseText("Giá 50k")).toBe("Giá năm mươi nghìn");
    expect(normalizeVietnameseText("Lương 15tr")).toBe("Lương mười lăm triệu");
  });
  it("reads roman numerals in context", () => {
    expect(normalizeVietnameseText("Đại hội XIII của Đảng")).toBe("Đại hội mười ba của Đảng");
    expect(normalizeVietnameseText("thế kỷ XXI")).toBe("thế kỷ hai mươi mốt");
    expect(romanToNumber("IIII")).toBeNull();
  });
  it("reads percentages and thousands", () => {
    expect(normalizeVietnameseText("tăng 15% lên 100.000 đồng")).toBe("tăng mười lăm phần trăm lên một trăm nghìn đồng");
  });
});

describe("lexicon", () => {
  it("expands news abbreviations, longest match first", () => {
    expect(applyLexicon("UBND TP.HCM họp", VI_BUILTIN_LEXICON)).toBe("Ủy ban nhân dân Thành phố Hồ Chí Minh họp");
    expect(applyLexicon("GS.TS Nguyễn Văn A", VI_BUILTIN_LEXICON)).toBe("giáo sư tiến sĩ Nguyễn Văn A");
  });
  it("does not match inside other words", () => {
    expect(applyLexicon("HTTP. và AIR", VI_BUILTIN_LEXICON)).toBe("HTTP. và AIR");
  });
  it("user entries win", () => {
    const lex = [{ from: "AI", to: "trí tuệ nhân tạo" }, ...VI_BUILTIN_LEXICON];
    expect(applyLexicon("Ứng dụng AI", lex)).toBe("Ứng dụng trí tuệ nhân tạo");
  });
});

describe("segmenter", () => {
  it("does not split on abbreviations or initials", () => {
    expect(splitSentences("GS. Lê Văn A phát biểu. Sau đó TP. Huế công bố.")).toEqual([
      "GS. Lê Văn A phát biểu.",
      "Sau đó TP. Huế công bố.",
    ]);
    expect(splitSentences("Mr. J. Smith arrived. He smiled!")).toEqual(["Mr. J. Smith arrived.", "He smiled!"]);
  });
  it("keeps decimals and lowercase continuations", () => {
    expect(splitSentences("Tăng 3.5 lần... rồi giảm. Hết")).toEqual(["Tăng 3.5 lần... rồi giảm.", "Hết"]);
  });
  it("detects headings, paragraphs and manual pauses", () => {
    const units = segmentScript("Bản tin sáng nay\nGiá vàng tăng mạnh. Liệu có tiếp tục?\n\n[ngắt 2s]\nĐoạn mới.");
    const speech = units.filter((u) => u.kind === "speech");
    expect(speech.map((u) => (u.kind === "speech" ? [u.type, u.boundary] : null))).toEqual([
      ["heading", "start"],
      ["statement", "line"],
      ["question", "sentence"],
      ["statement", "paragraph"],
    ]);
    expect(units.find((u) => u.kind === "pause")).toEqual({ kind: "pause", ms: 2000 });
  });
  it("parses break tags and strips them", () => {
    expect(stripPauseTags('A <break time="1.5s"/> B [pause] C').replace(/\s+/g, " ")).toBe("A B C");
  });
  it("sentence-cases all-caps headlines but keeps vowel-less acronyms", () => {
    expect(decapitalize("BẢN TIN BHXH HÔM NAY")).toBe("Bản tin BHXH hôm nay");
  });
});

describe("phrasing", () => {
  it("adds a breath before connectives in long clauses", () => {
    const s = "Giá xăng dầu trong nước đã tăng liên tục trong ba tuần qua nhưng người dân vẫn bình tĩnh.";
    expect(insertPhraseBreaks(s, "vi")).toBe(
      "Giá xăng dầu trong nước đã tăng liên tục trong ba tuần qua, nhưng người dân vẫn bình tĩnh.",
    );
  });
  it("leaves short clauses alone", () => {
    expect(insertPhraseBreaks("Trời mưa nhưng vui.", "vi")).toBe("Trời mưa nhưng vui.");
  });
  it("does not double punctuation", () => {
    const s = "Giá xăng dầu trong nước đã tăng liên tục trong ba tuần qua, nhưng người dân vẫn bình tĩnh.";
    expect(insertPhraseBreaks(s, "vi")).toBe(s);
  });
});

describe("planner", () => {
  it("plans news pauses: longer after headline, manual pauses exact", () => {
    const plan = planScript("TIN NÓNG HÔM NAY\nUBND TP.HCM họp khẩn. Kết quả sẽ công bố sau.\n[pause 1.5s]\nCảm ơn quý vị!", {
      style: "news",
    });
    expect(plan.lang).toBe("vi");
    expect(plan.segments.map((s) => s.pauseBeforeMs)).toEqual([0, 900, 340, 1500]);
    expect(plan.segments[0].spoken).toBe("Tin nóng hôm nay");
    expect(plan.segments[1].spoken).toBe("Ủy ban nhân dân Thành phố Hồ Chí Minh họp khẩn.");
    expect(plan.segments[1].display).toBe("UBND TP.HCM họp khẩn.");
    expect(plan.segments[0].rate).toBeLessThan(plan.segments[1].rate);
  });
  it("scales automatic pauses", () => {
    const a = planScript("Một câu. Hai câu.", { pauseScale: 2, lang: "vi" });
    expect(a.segments[1].pauseBeforeMs).toBe(800);
  });
});
