import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";
import { applyLexicon, VI_BUILTIN_LEXICON } from "../lexicon";
import { mergeLexicons, prepareSpoken } from "../planner";

describe("round 2: dates", () => {
  it("reads datelines after a time of day", () => {
    expect(vi("Chiều 5-6, Quốc hội họp")).toBe("Chiều năm tháng sáu, Quốc hội họp");
    expect(vi("Sáng 1-10")).toBe("Sáng một tháng mười");
  });
  it("reads date ranges and month ranges", () => {
    expect(vi("Từ 1-5 đến 10-5")).toBe("Từ một tháng năm đến mười tháng năm");
    expect(vi("tháng 3-4")).toBe("tháng ba đến tháng tư");
  });
  it("says 'tháng tư' for April", () => {
    expect(vi("ngày 30/4")).toBe("ngày ba mươi tháng tư");
  });
  it("does not double 'ngày' and reads month/year", () => {
    expect(vi("Hà Nội, ngày 15/8/2024")).toBe("Hà Nội, ngày mười lăm tháng tám năm hai nghìn không trăm hai mươi tư");
    expect(vi("Tháng 12/2024")).toBe("Tháng mười hai năm hai nghìn không trăm hai mươi tư");
  });
  it("reads ranks and ratios, not dates", () => {
    expect(vi("Xếp thứ 3/10")).toBe("Xếp thứ ba trên mười");
    expect(vi("Tỷ lệ 1/3")).toBe("Tỷ lệ một phần ba");
  });
});

describe("round 2: numbers", () => {
  it("keeps units after ranges and decimals", () => {
    expect(vi("mưa 100-200mm")).toBe("mưa một trăm đến hai trăm mi-li-mét");
    expect(vi("nặng 2,5kg")).toBe("nặng hai phẩy năm ki-lô-gam");
    expect(vi("nhiệt độ 20-30°C")).toBe("nhiệt độ hai mươi đến ba mươi độ C");
    expect(vi("cao 1m75")).toBe("cao một mét bảy mươi lăm");
  });
  it("reads decimal leading zeros", () => {
    expect(vi("GDP tăng 5,05%")).toBe("GDP tăng năm phẩy không năm phần trăm");
    expect(vi("giá 2,05k")).toBe("giá hai phẩy không năm nghìn");
  });
  it("reads decimal ranges with percent", () => {
    expect(vi("Mức 2,5-3%")).toBe("Mức hai phẩy năm đến ba phần trăm");
  });
  it("reads scores even with team names between verb and score", () => {
    expect(vi("Hà Nội FC thắng HAGL 2-1")).toBe("Hà Nội FC thắng HAGL hai một");
    expect(vi("Tỷ số chung cuộc là 3-0")).toBe("Tỷ số chung cuộc là ba không");
  });
  it("reads 24h and dollar amounts with multipliers", () => {
    expect(vi("Trong 24h qua")).toBe("Trong hai mươi tư giờ qua");
    expect(vi("thu về $1,5 triệu")).toBe("thu về một phẩy năm triệu đô la");
  });
});

describe("round 2: acronyms and lexicon", () => {
  it("keeps long acronyms in all-caps headlines", () => {
    expect(prepareSpoken("VKSND TỐI CAO KIẾN NGHỊ", "vi", mergeLexicons([], "vi"), false)).toBe(
      "Viện kiểm sát nhân dân tối cao kiến nghị",
    );
    expect(prepareSpoken("KINH TẾ ĐBSCL KHỞI SẮC", "vi", mergeLexicons([], "vi"), false)).toBe(
      "Kinh tế Đồng bằng sông Cửu Long khởi sắc",
    );
  });
  it("falls back to shorter entries when a longer case-sensitive one differs in case", () => {
    expect(applyLexicon("Tp HCM", VI_BUILTIN_LEXICON)).toBe("Tp Hồ Chí Minh");
  });
  it("user case-insensitive overrides beat built-ins", () => {
    const lex = mergeLexicons([{ from: "AI", to: "trí tuệ nhân tạo", caseSensitive: false }], "vi");
    expect(applyLexicon("Ứng dụng AI", lex)).toBe("Ứng dụng trí tuệ nhân tạo");
  });
});
