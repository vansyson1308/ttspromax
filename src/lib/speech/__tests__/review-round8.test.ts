import { describe, expect, it } from "vitest";
import { normalizeVietnameseText as vi } from "@/lib/vi-normalizer";

describe("round 8: weak score verbs outside sports", () => {
  it.each([
    ["Khuyến mãi kết thúc 30-4.", "Khuyến mãi kết thúc ba mươi tháng tư."],
    ["Năm học kết thúc 31-5.", "Năm học kết thúc ba mươi mốt tháng năm."],
    ["Đợt giảm giá kết thúc vào 15-6.", "Đợt giảm giá kết thúc vào mười lăm tháng sáu."],
    ["Cuộc đảo chính thất bại 15-7", "Cuộc đảo chính thất bại mười lăm tháng bảy"],
    // sports cues keep the score reading
    ["Trận đấu kết thúc 3-3.", "Trận đấu kết thúc ba ba."],
    ["U23 Việt Nam vượt qua Thái Lan 2-1.", "U23 Việt Nam vượt qua Thái Lan hai một."],
    ["Man City đè bẹp MU 6-3", "Man City đè bẹp MU sáu ba"],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 8: 'đồng' compounds are not currency", () => {
  it.each([
    ["Ngày 2-9 đồng bào cả nước", "Ngày hai tháng chín đồng bào cả nước"],
    ["Dịp 30-4 đồng loạt giảm giá", "Dịp ba mươi tháng tư đồng loạt giảm giá"],
    ["Việt Nam thắng 2-1 đồng thời lên đầu bảng", "Việt Nam thắng hai một đồng thời lên đầu bảng"],
    ["Ngày 12-5 USD giảm", "Ngày mười hai tháng năm USD giảm"],
    ["giá 20-25 nghìn đồng", "giá hai mươi đến hai mươi lăm nghìn đồng"],
    ["tăng 300-500đ/lít", "tăng ba trăm đến năm trăm đồng/lít"],
    ["Giá $5-10 mỗi món", "Giá năm đến mười đô la mỗi món"],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 8: minor", () => {
  it.each([
    ["Thắng lớn 30-4 năm nay", "Thắng lớn ba mươi tháng tư năm nay"],
    ["thua đậm 25-12", "thua đậm hai mươi lăm mười hai"],
    [
      "Giai đoạn 2021-2025,2026-2030",
      "Giai đoạn hai nghìn không trăm hai mươi mốt đến hai nghìn không trăm hai mươi lăm,hai nghìn không trăm hai mươi sáu đến hai nghìn không trăm ba mươi",
    ],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 8: corpus follow-ups", () => {
  it.each([
    ["Arsenal nhận thất bại 1-3 trên sân nhà.", "Arsenal nhận thất bại một ba trên sân nhà."],
    ["Giá 12,5-13 USD/thùng.", "Giá mười hai phẩy năm đến mười ba đô la/thùng."],
    ["Giá 5.000-10.000đ/cái.", "Giá năm nghìn đến mười nghìn đồng/cái."],
    ["Đợt bán hàng kết thúc 10-10.", "Đợt bán hàng kết thúc mười tháng mười."],
    ["Sáng 3-2 đ/c Bí thư dự lễ.", "Sáng ba tháng hai đ/c Bí thư dự lễ."],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 8: event words date ambiguous pairs", () => {
  it.each([
    ["Kỳ nghỉ kết thúc 2-9.", "Kỳ nghỉ kết thúc hai tháng chín."],
    ["Dịp 2-9 năm nay", "Dịp hai tháng chín năm nay"],
    ["Hội nghị kết thúc 2-3 ngày sau khi khai mạc.", "Hội nghị kết thúc hai đến ba ngày sau khi khai mạc."],
    ["Từ 2-3 người tham gia", "Từ hai đến ba người tham gia"],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});

describe("round 8: event tails", () => {
  it.each([
    ["Luật có hiệu lực từ 1-7 năm 2025.", "Luật có hiệu lực từ một tháng bảy năm hai nghìn không trăm hai mươi lăm."],
    ["Nghỉ lễ 2-9 kéo dài 4 ngày.", "Nghỉ lễ hai tháng chín kéo dài bốn ngày."],
    ["Từ 1-7 đồng loạt áp dụng mức phạt mới.", "Từ một tháng bảy đồng loạt áp dụng mức phạt mới."],
    ["Hội chợ từ 5-7 tháng 10.", "Hội chợ từ năm đến bảy tháng mười."],
    ["Dành cho trẻ từ 3-6 tuổi.", "Dành cho trẻ từ ba đến sáu tuổi."],
  ])("%s", (input, expected) => expect(vi(input)).toBe(expected));
});
