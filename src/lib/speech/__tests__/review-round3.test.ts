import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";
import { applyLexicon, sanitizeLexicon } from "../lexicon";
import { mergeLexicons } from "../planner";

describe("round 3: score context is word-bounded", () => {
  it("does not treat names/ordinary words as score verbs", () => {
    expect(vi("Ông Hoàng cho biết cần 2-3 ngày.")).toBe("Ông Hoàng cho biết cần hai đến ba ngày.");
    expect(vi("Dự án hoàn thành trong 2-3 năm")).toBe("Dự án hoàn thành trong hai đến ba năm");
    expect(vi("thua lỗ 2-3 năm")).toBe("thua lỗ hai đến ba năm");
    expect(vi("thắng lợi 2-3 ngày")).toBe("thắng lợi hai đến ba ngày");
    expect(vi("chiến thắng lịch sử 30-4")).toBe("chiến thắng lịch sử ba mươi tháng tư");
  });
  it("still reads real scores", () => {
    expect(vi("Hà Nội FC thắng HAGL 2-1")).toBe("Hà Nội FC thắng HAGL hai một");
  });
});

describe("round 3: time-of-day words", () => {
  it("reads counts after time-of-day words as ranges", () => {
    expect(vi("khuya 2-3 giờ")).toBe("khuya hai đến ba giờ");
    expect(vi("Sáng 2-3 người đến")).toBe("Sáng hai đến ba người đến");
    expect(vi("từ 2-3 đến 5-6 ngày")).toBe("từ hai đến ba đến năm đến sáu ngày");
  });
  it("keeps datelines", () => {
    expect(vi("Chiều 5-6, Quốc hội họp")).toBe("Chiều năm tháng sáu, Quốc hội họp");
    expect(vi("Đêm 31-12 người dân đổ ra đường")).toBe("Đêm ba mươi mốt tháng mười hai người dân đổ ra đường");
  });
});

describe("round 3: slashes", () => {
  it("reads dates after approximators", () => {
    expect(vi("Gần 30/4, giá vé tăng")).toBe("Gần ba mươi tháng tư, giá vé tăng");
    expect(vi("Hơn 2/9 năm ngoái")).toBe("Hơn hai tháng chín năm ngoái");
  });
  it("still reads ratios", () => {
    expect(vi("hơn 1/2 dân số")).toBe("hơn một phần hai dân số");
    expect(vi("Tỷ lệ 1/3")).toBe("Tỷ lệ một phần ba");
  });
  it("leaves legal document numbers alone and reads quarters", () => {
    expect(vi("Thông tư 12/2020/TT-BTC")).not.toContain("tháng");
    expect(vi("Luật số 12/2024/QH15")).not.toContain("tháng");
    expect(vi("quý 1/2025")).toBe("quý một năm hai nghìn không trăm hai mươi lăm");
  });
  it("does not let the date rule eat decimal ranges", () => {
    expect(vi("Dài 1,5-2 km")).toBe("Dài một phẩy năm đến hai ki-lô-mét");
  });
});

describe("round 3: units and money", () => {
  it("reads $5m as five million dollars", () => {
    expect(vi("Quỹ huy động $5m")).toBe("Quỹ huy động năm triệu đô la");
  });
  it("reads heights with a leading zero", () => {
    expect(vi("cao 1m05")).toBe("cao một mét lẻ năm");
  });
  it("does not read 4G/5G as grams", () => {
    expect(vi("mạng 5G")).not.toContain("gam");
  });
  it("reads shorthand and hour ranges without a stray hyphen", () => {
    expect(vi("giá 50-100k")).toBe("giá năm mươi đến một trăm nghìn");
    expect(vi("mở cửa 8h-17h")).toBe("mở cửa tám giờ đến mười bảy giờ");
  });
});

describe("round 3: lexicon", () => {
  it("normalises user entries to NFC", () => {
    const nfd = "đường".normalize("NFD");
    const lex = sanitizeLexicon([{ from: nfd, to: "con đường" }]);
    expect(applyLexicon("đường".normalize("NFC"), lex)).toBe("con đường");
  });
  it("matches titlecase letters themselves", () => {
    expect(applyLexicon("ǅem", [{ from: "ǅem", to: "xx", caseSensitive: false }])).toBe("xx");
  });
  it("a user's case-sensitive entry does not remove a different-case built-in", () => {
    const lex = mergeLexicons([{ from: "Ai", to: "người nào", caseSensitive: true }], "vi");
    expect(applyLexicon("GDP và AI", lex)).toBe("gi đi pi và ây ai");
  });
  it("mergeLexicons returns a stable array for the same input", () => {
    const user = [{ from: "X", to: "ích" }];
    expect(mergeLexicons(user, "vi")).toBe(mergeLexicons(user, "vi"));
  });
});
