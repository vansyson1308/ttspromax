import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";

describe("round 10", () => {
  it.each([
    ["Chương trình kết thúc 30-4 tại Hà Nội.", "Chương trình kết thúc ba mươi tháng tư tại Hà Nội."],
    ["Cuộc đảo chính thất bại 15-7 ở Thổ Nhĩ Kỳ.", "Cuộc đảo chính thất bại mười lăm tháng bảy ở Thổ Nhĩ Kỳ."],
    ["Festival Huế kết thúc 12-6.", "Festival Huế kết thúc mười hai tháng sáu."],
    ["Kết quả: Hà Nội 2-1 Viettel.", "Kết quả: Hà Nội hai một Viettel."],
    ["Arsenal thất bại 0-2 trước Liverpool.", "Arsenal thất bại không hai trước Liverpool."],
    ["Mức lương cơ sở tăng từ 1-7.", "Mức lương cơ sở tăng từ một tháng bảy."],
    ["Lớp 1 nhập học từ 1-9.", "Lớp một nhập học từ một tháng chín."],
    ["Thang điểm từ 1-5.", "Thang điểm từ một đến năm."],
    ["Từ 1-1 đến nay, giá xăng tăng 5 lần.", "Từ một tháng một đến nay, giá xăng tăng năm lần."],
    ["Từ 3-3 đến 3-4", "Từ ba tháng ba đến ba tháng tư"],
    ["Man City 1-1 Arsenal.", "Man City một một Arsenal."],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 10 follow-ups", () => {
  it("reads counted visits as ranges", () => {
    expect(vi("Thủ tướng kết thúc 3-4 chuyến thăm Pháp.")).toBe("Thủ tướng kết thúc ba đến bốn chuyến thăm Pháp.");
  });
});
