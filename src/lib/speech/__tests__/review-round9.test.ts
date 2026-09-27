import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";

describe("round 9", () => {
  it.each([
    ["Man City 1-1 Arsenal.", "Man City một một Arsenal."],
    ["Hòa Thái Lan 1-1, Việt Nam vẫn đi tiếp.", "Hòa Thái Lan một một, Việt Nam vẫn đi tiếp."],
    ["Kết quả lượt đi 2-0, lượt về 1-1.", "Kết quả lượt đi hai không, lượt về một một."],
    ["Đợt bán hàng kết thúc 10-10.", "Đợt bán hàng kết thúc mười tháng mười."],
    ["từ 1-5 đến 5-5", "từ một tháng năm đến năm tháng năm"],
    ["Giá $10-20, tùy loại.", "Giá mười đến hai mươi đô la, tùy loại."],
    ["Arsenal thất bại 0-2 trước Liverpool.", "Arsenal thất bại không hai trước Liverpool."],
    ["MU thất bại 1-3.", "MU thất bại một ba."],
    ["Khuyến mãi kết thúc 30-4.", "Khuyến mãi kết thúc ba mươi tháng tư."],
    ["Đợt khuyến mãi kết thúc 1-2 đợt nữa", "Đợt khuyến mãi kết thúc một đến hai đợt nữa"],
    ["Thang điểm từ 1-5.", "Thang điểm từ một đến năm."],
    ["Từ 1-7 năm nay, lương tăng.", "Từ một tháng bảy năm nay, lương tăng."],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 9 follow-ups", () => {
  it.each([
    ["Kỳ nghỉ Tết kết thúc 10-2.", "Kỳ nghỉ Tết kết thúc mười tháng hai."],
    ["Tết Dương lịch 1-1.", "Tết Dương lịch một tháng một."],
    ["Việt Nam thất bại 0-3.", "Việt Nam thất bại không ba."],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});
