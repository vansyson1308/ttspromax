import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";

describe("round 12 (final) minors", () => {
  it.each([
    ["Hợp đồng lao động chấm dứt từ 1-7.", "Hợp đồng lao động chấm dứt từ một tháng bảy."],
    ["Thông tư về đánh giá học sinh tiểu học có hiệu lực từ 1-9.", "Thông tư về đánh giá học sinh tiểu học có hiệu lực từ một tháng chín."],
    ["Mức độ hài lòng từ 1-5.", "Mức độ hài lòng từ một đến năm."],
    ["Đến 9-9 lượt khách tham quan tăng mạnh.", "Đến chín tháng chín lượt khách tham quan tăng mạnh."],
    ["Sau 1-1 ở hiệp một, hai đội tăng tốc.", "Sau một một ở hiệp một, hai đội tăng tốc."],
    ["Nghỉ lễ Quốc khánh từ 1-9 đến 3-9.", "Nghỉ lễ Quốc khánh từ một tháng chín đến ba tháng chín."],
    ["Hội chợ diễn ra từ 1-6 đến 5-6.", "Hội chợ diễn ra từ một tháng sáu đến năm tháng sáu."],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});
