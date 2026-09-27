import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";

describe("round 11", () => {
  it.each([
    ["Mức độ hài lòng từ 1-5.", "Mức độ hài lòng từ một đến năm."],
    ["Thang điểm đánh giá từ 1-5.", "Thang điểm đánh giá từ một đến năm."],
    ["Mức độ đau được đánh giá từ 1-10.", "Mức độ đau được đánh giá từ một đến mười."],
    ["Cấp độ cảnh báo lũ từ 1-3.", "Cấp độ cảnh báo lũ từ một đến ba."],
    ["Mức lương cơ sở tăng từ 1-7.", "Mức lương cơ sở tăng từ một tháng bảy."],
    ["Sau 1-1 ở hiệp một, hai đội tăng tốc.", "Sau một một ở hiệp một, hai đội tăng tốc."],
    ["Sau 1-1, nhiều quy định mới có hiệu lực.", "Sau một tháng một, nhiều quy định mới có hiệu lực."],
    ["Trận đấu diễn ra vào 5-5.", "Trận đấu diễn ra vào năm tháng năm."],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});
