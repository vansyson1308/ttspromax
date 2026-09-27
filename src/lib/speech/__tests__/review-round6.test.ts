import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";
import { applyLexicon } from "../lexicon";

describe("round 6: scores followed by time phrases", () => {
  it.each([
    ["thắng 2-1 lượt đi", "thắng hai một lượt đi"],
    ["thua 0-1 lượt về", "thua không một lượt về"],
    ["Việt Nam thắng Thái Lan 3-0 năm 2018", "Việt Nam thắng Thái Lan ba không năm hai nghìn không trăm mười tám"],
    ["Trận thua 0-3 năm ngoái", "Trận thua không ba năm ngoái"],
    ["thắng 3-1 tuần trước", "thắng ba một tuần trước"],
    ["Thắng 2-0 trận ra quân", "Thắng hai không trận ra quân"],
    ["Hòa 1-1 trận lượt đi", "Hòa một một trận lượt đi"],
    ["Thắng 2-1 ngày 15-3", "Thắng hai một ngày mười lăm tháng ba"],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 6: colons, thắng lớn, event names, listed pairs", () => {
  it.each([
    ["Tỷ số: 2-1", "Tỷ số: hai một"],
    ["Chung cuộc: 3-2", "Chung cuộc: ba hai"],
    ["Tỷ số hiệp 1: 0-0", "Tỷ số hiệp một: không không"],
    ["Việt Nam thắng lớn 4-1 trước Lào", "Việt Nam thắng lớn bốn một trước Lào"],
    ["Chiến thắng Điện Biên Phủ 7-5", "Chiến thắng Điện Biên Phủ bảy tháng năm"],
    ["Kỷ niệm chiến thắng 30-4 và 1-5", "Kỷ niệm chiến thắng ba mươi tháng tư và một tháng năm"],
    ["thua 4-6, 3-6", "thua bốn sáu, ba sáu"],
    ["Chiều 5-6 năm nay", "Chiều năm tháng sáu năm nay"],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 6: earlier behaviour kept", () => {
  it.each([
    ["chiến thắng 2-3 lần trước", "chiến thắng hai đến ba lần trước"],
    ["Bà con thắng lớn vụ lúa, năng suất 6-7 tấn", "Bà con thắng lớn vụ lúa, năng suất sáu đến bảy tấn"],
    ["Sáng 2-3 người đến", "Sáng hai đến ba người đến"],
    ["mưa 100-200mm", "mưa một trăm đến hai trăm mi-li-mét"],
    ["Mức 2,5-3%", "Mức hai phẩy năm đến ba phần trăm"],
    ["giá 50-100k", "giá năm mươi đến một trăm nghìn"],
    ["Từ 1-5 đến 10-5", "Từ một tháng năm đến mười tháng năm"],
    ["hợp đồng số 12-2024", "hợp đồng số mười hai-hai nghìn không trăm hai mươi tư"],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 6: lexicon consecutive punctuation entries", () => {
  it("separates consecutive punctuation-led replacements", () => {
    expect(applyLexicon("C++", [{ from: "+", to: "cộng" }])).toBe("C cộng cộng");
  });
});

describe("round 6: corpus comparison follow-ups", () => {
  it.each([
    ["Thắng cử 5-4 phiếu", "Thắng cử năm bốn phiếu"],
    ["Ông thắng cử 2-3 nhiệm kỳ liên tiếp.", "Ông thắng cử hai đến ba nhiệm kỳ liên tiếp."],
    ["Thắng 3-2 hiệp phụ.", "Thắng ba hai hiệp phụ."],
    ["Hà Nội FC thua liên tiếp trong 2-3 tuần qua.", "Hà Nội FC thua liên tiếp trong hai đến ba tuần qua."],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});
