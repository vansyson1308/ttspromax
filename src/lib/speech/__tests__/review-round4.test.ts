import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";
import { applyLexicon, VI_BUILTIN_LEXICON } from "../lexicon";

describe("round 4 blockers", () => {
  it("reads capital L as litres", () => {
    expect(vi("Tủ lạnh 300L.")).toBe("Tủ lạnh ba trăm lít.");
    expect(vi("Can 20 L")).toBe("Can hai mươi lít");
  });
  it("reads scores in common sports phrasing", () => {
    expect(vi("giành chiến thắng 2-1 trước Malaysia")).toBe("giành chiến thắng hai một trước Malaysia");
    expect(vi("SLNA thắng Hoàng Anh Gia Lai 2-1")).toBe("SLNA thắng Hoàng Anh Gia Lai hai một");
    expect(vi("Thắng 3-1, đội nhà lên đầu bảng")).toBe("Thắng ba một, đội nhà lên đầu bảng");
    expect(vi("Thua 0-2 trên sân nhà")).toBe("Thua không hai trên sân nhà");
    expect(vi("thắng Hải Phòng 2-1, lên nhì bảng")).toBe("thắng Hải Phòng hai một, lên nhì bảng");
  });
  it("keeps anniversary dates after 'Chiến thắng'", () => {
    expect(vi("Chiến thắng 30-4 là mốc lịch sử")).toBe("Chiến thắng ba mươi tháng tư là mốc lịch sử");
  });
  it("keeps non-score ranges near names", () => {
    expect(vi("Hòa Phát lãi 2-3 nghìn tỷ")).toBe("Hòa Phát lãi hai đến ba nghìn tỷ");
    expect(vi("Có 2-3, thậm chí 4 người")).toBe("Có hai đến ba, thậm chí bốn người");
  });
  it("reads listed holiday dates without 'ngày'", () => {
    expect(vi("Nghỉ lễ 30-4 và 1-5")).toBe("Nghỉ lễ ba mươi tháng tư và một tháng năm");
  });
  it("reads hour ranges starting with minutes", () => {
    expect(vi("Mở cửa 7h30-9h.")).toBe("Mở cửa bảy giờ ba mươi đến chín giờ.");
    expect(vi("7h30-11h30")).toBe("bảy giờ ba mươi đến mười một giờ ba mươi");
  });
  it("reads day ranges within a month", () => {
    expect(vi("Ngày 2-3/5")).toBe("Ngày hai đến ba tháng năm");
    expect(vi("từ 30/4-1/5")).toBe("từ ba mươi tháng tư đến một tháng năm");
  });
});

describe("round 4 lexicon perf", () => {
  it("compiles 500 entries quickly", () => {
    const lex = Array.from({ length: 500 }, (_, i) => ({ from: `thương hiệu số ${i}`, to: `x${i}` }));
    const t0 = performance.now();
    applyLexicon("thương hiệu số 42 và Tp HCM", [...lex, ...VI_BUILTIN_LEXICON]);
    expect(performance.now() - t0).toBeLessThan(150);
    expect(applyLexicon("thương hiệu số 42 và Tp HCM", [...lex, ...VI_BUILTIN_LEXICON])).toBe("x42 và Tp Hồ Chí Minh");
  });
});
