import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";
import { applyLexicon, VI_BUILTIN_LEXICON } from "../lexicon";
import { splitSentences } from "../segmenter";
import { planScript, prepareSpoken } from "../planner";
import { splitCue } from "../subtitles";

describe("vi-normalizer review regressions", () => {
  it("reads hyphen holiday dates", () => {
    expect(vi("ngày 30-4 và 1-5")).toBe("ngày ba mươi tháng bốn và một tháng năm");
    expect(vi("Đại lễ 30-4")).toBe("Đại lễ ba mươi tháng bốn");
  });
  it("reads scores as scores", () => {
    expect(vi("thắng 2-1")).toBe("thắng hai một");
    expect(vi("tỷ số 3-0")).toBe("tỷ số ba không");
  });
  it("leaves codes and dashed phones alone or reads digits", () => {
    expect(vi("Gọi 0912-345-678")).toBe("Gọi không chín một hai ba bốn năm sáu bảy tám");
    expect(vi("hợp đồng số 12-2024")).not.toContain("đến");
    expect(vi("Mã số 123-456")).not.toContain("đến");
  });
  it("handles k/tr shorthand safely", () => {
    expect(vi("màn hình 4K")).not.toContain("nghìn");
    expect(vi("giá 2,5k")).toBe("giá hai phẩy năm nghìn");
    expect(vi("sinh năm 2k6")).not.toContain("nghìn");
    expect(vi("lương 5tr5")).not.toContain("triệu5");
  });
  it("does not read letters as roman numerals", () => {
    expect(vi("phần C của đề thi")).toBe("phần C của đề thi");
    expect(vi("chương XI")).toBe("chương mười một");
  });
});

describe("lexicon spacing", () => {
  it("keeps a space after punctuation-ending expansions", () => {
    expect(applyLexicon("TP.Hà Nội", VI_BUILTIN_LEXICON)).toBe("thành phố Hà Nội");
    expect(applyLexicon("GS.Nguyễn Văn A", VI_BUILTIN_LEXICON)).toBe("giáo sư Nguyễn Văn A");
    expect(applyLexicon("Q.1", VI_BUILTIN_LEXICON)).toBe("quận 1");
  });
});

describe("segmenter review regressions", () => {
  it("splits after ordinary words that look like abbreviations", () => {
    expect(splitSentences("Họp lúc 10h. Mọi người đến đủ.")).toHaveLength(2);
    expect(splitSentences("Đây là hoa sen. Mỗi năm nở một lần.")).toHaveLength(2);
    expect(splitSentences("Do đột biến gen. Các nhà khoa học lo ngại.")).toHaveLength(2);
    expect(splitSentences("Tôi ăn no. Sau đó đi ngủ.")).toHaveLength(2);
    expect(splitSentences("Nhiệt độ lên 38 độ C. Người dân mệt mỏi.")).toHaveLength(2);
  });
  it("still keeps real abbreviations and initials", () => {
    expect(splitSentences("GS. Lê Văn A phát biểu.")).toHaveLength(1);
    expect(splitSentences("George W. Bush arrived.")).toHaveLength(1);
  });
});

describe("planner review regressions", () => {
  it("reads all-caps headlines without mangling words or numerals", () => {
    expect(prepareSpoken("AI LÀ NGƯỜI CHIẾN THẮNG", "vi", VI_BUILTIN_LEXICON, false)).toBe("Ai là người chiến thắng");
    expect(prepareSpoken("ĐẠI HỘI XIII CỦA ĐẢNG", "vi", VI_BUILTIN_LEXICON, false)).toBe("Đại hội mười ba của đảng");
    expect(prepareSpoken("UBND TP.HCM HỌP KHẨN", "vi", VI_BUILTIN_LEXICON, false)).toBe(
      "Ủy ban nhân dân Thành phố Hồ Chí Minh họp khẩn",
    );
  });
  it("honours an explicit zero pause", () => {
    const plan = planScript("Câu một.\n[pause 0]\nCâu hai.", { lang: "vi" });
    expect(plan.segments[1].pauseBeforeMs).toBe(0);
    expect(plan.segments[1].manualPause).toBe(true);
  });
});

describe("subtitle review regressions", () => {
  it("never overlaps chunks even when spoken text is much shorter", () => {
    const words = [
      { text: "a", startMs: 0, endMs: 100 },
      { text: "b", startMs: 150, endMs: 200 },
    ];
    const cues = splitCue({ index: 0, text: "x ".repeat(120).trim(), startMs: 0, endMs: 250, words }, 40);
    for (let i = 1; i < cues.length; i++) expect(cues[i].startMs).toBeGreaterThanOrEqual(cues[i - 1].endMs);
  });
});

describe("ndjson reader", () => {
  it("surfaces plain JSON error bodies without a trailing newline", async () => {
    const { readNdjsonAudioStream } = await import("@/lib/ndjson-audio-stream");
    const res = new Response(JSON.stringify({ status: "error", message: "No speakable text" }), { status: 400 });
    const errors: string[] = [];
    await readNdjsonAudioStream(res, { onError: (m) => errors.push(String(m.message)) });
    expect(errors[0]).toBe("No speakable text");
  });
});
