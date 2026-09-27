import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";

describe("round 7", () => {
  it.each([
    ["Việt Nam thắng 2-1 trận giao hữu", "Việt Nam thắng hai một trận giao hữu"],
    ["thắng 3-2 trận bán kết", "thắng ba hai trận bán kết"],
    ["thắng 3-0 trận mở màn", "thắng ba không trận mở màn"],
    ["Du lịch thắng lớn dịp 30-4", "Du lịch thắng lớn dịp ba mươi tháng tư"],
    ["thua đậm 25-12", "thua đậm hai mươi lăm mười hai"],
    ["Giá xăng tăng 300-500đ/lít", "Giá xăng tăng ba trăm đến năm trăm đồng/lít"],
    ["giá 5-10 USD", "giá năm đến mười đô la"],
    ["Phạt 800.000-1.000.000 đồng", "Phạt tám trăm nghìn đến một triệu đồng"],
    ["vượt qua Thái Lan 2-1", "vượt qua Thái Lan hai một"],
    ["thất bại 2-3 lần", "thất bại hai đến ba lần"],
    ["năm học 2024-2025", "năm học hai nghìn không trăm hai mươi tư đến hai nghìn không trăm hai mươi lăm"],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});
