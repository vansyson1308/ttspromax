import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";
import { applyLexicon } from "../lexicon";

describe("round 5: scores", () => {
  it("reads large set/basketball scores as scores", () => {
    expect(vi("Tay vợt thua 19-21")).toBe("Tay vợt thua mười chín hai mươi mốt");
    expect(vi("thắng 102-98")).toBe("thắng một trăm lẻ hai chín mươi tám");
  });
  it("reads counted ranges as ranges even near score words", () => {
    expect(vi("Đội tuyển thắng trận đầu tiên sau 2-3 năm")).toBe("Đội tuyển thắng trận đầu tiên sau hai đến ba năm");
    expect(vi("Sau trận thua, đội bóng được nghỉ 2-3 ngày")).toBe("Sau trận thua, đội bóng được nghỉ hai đến ba ngày");
    expect(vi("HLV Park chiến thắng 2-3 lần")).toBe("HLV Park chiến thắng hai đến ba lần");
    expect(vi("Tỷ số không quan trọng, cần 2-3 điểm nữa")).toBe("Tỷ số không quan trọng, cần hai đến ba điểm nữa");
    expect(vi("Thắng thầu 2-3 gói")).toBe("Thắng thầu hai đến ba gói");
    expect(vi("Thua kiện 2-3 lần")).toBe("Thua kiện hai đến ba lần");
  });
  it("only treats Hòa/Thắng as possible names", () => {
    expect(vi("Thua Indonesia 1-2, HLV từ chức")).toBe("Thua Indonesia một hai, HLV từ chức");
    expect(vi("Đánh bại Úc 2-1")).toBe("Đánh bại Úc hai một");
    expect(vi("Hòa Phát lãi 2-3 nghìn tỷ")).toBe("Hòa Phát lãi hai đến ba nghìn tỷ");
  });
  it("does not date listed scores", () => {
    expect(vi("Việt Nam thắng 3-1 và 2-1")).toBe("Việt Nam thắng ba một và hai một");
    expect(vi("Tỷ số 10-2 và 8-1")).toBe("Tỷ số mười hai và tám một");
  });
  it("keeps the earlier fixes", () => {
    expect(vi("Chiến thắng 30-4 là mốc lịch sử")).toBe("Chiến thắng ba mươi tháng tư là mốc lịch sử");
    expect(vi("Nghỉ lễ 30-4 và 1-5")).toBe("Nghỉ lễ ba mươi tháng tư và một tháng năm");
    expect(vi("ngày 2-9 năm 1945")).toBe("ngày hai tháng chín năm một nghìn chín trăm bốn mươi lăm");
  });
});

describe("round 5: times", () => {
  it("reads colon and capital-H hour ranges", () => {
    expect(vi("Từ 7:30-9:00")).toBe("Từ bảy giờ ba mươi đến chín giờ");
    expect(vi("7H30-9H")).toBe("bảy giờ ba mươi đến chín giờ");
  });
});

describe("round 5: lexicon", () => {
  it("matches entries that start with punctuation after a digit", () => {
    expect(applyLexicon("30°C", [{ from: "°C", to: "độ xê" }])).toBe("30 độ xê");
  });
});
