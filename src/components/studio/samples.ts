/** One-click sample scripts that showcase each style. */
export interface SampleScript {
  id: string;
  label: { vi: string; en: string };
  style: "natural" | "news" | "story" | "podcast" | "ads";
  lang: "vi" | "en";
  text: string;
}

export const SAMPLE_SCRIPTS: SampleScript[] = [
  {
    id: "news-vi",
    label: { vi: "Bản tin", en: "VN news" },
    style: "news",
    lang: "vi",
    text: `BẢN TIN KINH TẾ SÁNG NAY
Giá vàng trong nước sáng 27/9 tăng thêm 500.000 đồng mỗi lượng, lên mức 128,5 triệu đồng. Theo các chuyên gia, xu hướng tăng có thể kéo dài 2-3 tuần tới nhưng nhà đầu tư cần thận trọng trước những biến động khó lường của thị trường thế giới.

Cũng trong sáng nay, UBND TP.HCM công bố kế hoạch phát triển kinh tế số giai đoạn 2025-2030, với mục tiêu kinh tế số đóng góp 40% GDP của thành phố. Liệu mục tiêu này có khả thi?
[ngắt 1s]
Quý vị vừa theo dõi bản tin kinh tế. Xin cảm ơn và hẹn gặp lại!`,
  },
  {
    id: "story-vi",
    label: { vi: "Kể chuyện", en: "VN story" },
    style: "story",
    lang: "vi",
    text: `Ngày xưa, ở một làng nhỏ ven sông, có một cậu bé tên là An.

Mỗi sớm mai, khi sương còn giăng trắng mặt nước, An lại ra bến ngồi nhìn những con thuyền lặng lẽ trôi xa... Cậu tự hỏi: "Bên kia dòng sông là gì nhỉ?"

Rồi một ngày, người lái đò già mỉm cười và nói với cậu: "Muốn biết thì phải tự mình đi, cháu ạ!"`,
  },
  {
    id: "ads-vi",
    label: { vi: "Quảng cáo", en: "VN ad" },
    style: "ads",
    lang: "vi",
    text: `Bạn đã sẵn sàng cho mùa hè rực rỡ nhất?
Siêu sale cuối tuần đã trở lại! Giảm đến 50% cho hàng nghìn sản phẩm, freeship toàn quốc cho đơn từ 99k.
Chỉ duy nhất từ 20/7 đến 22/7. Nhanh tay lên nào!`,
  },
  {
    id: "news-en",
    label: { vi: "Tin tiếng Anh", en: "EN news" },
    style: "news",
    lang: "en",
    text: `TOP STORY TONIGHT
Global markets closed higher on Friday as investors welcomed fresh data showing inflation cooling for the third straight month. The S&P 500 gained 1.2% while the Nasdaq rose nearly 2% however analysts warn that volatility could return before the central bank meets next week.

In other news, scientists say this year's Arctic summer ice was among the lowest on record. What does that mean for the rest of us?
[pause 1s]
That's all for now. Thanks for watching, and good night.`,
  },
];
