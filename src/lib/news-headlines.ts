/**
 * Build a short list of "news ticker" strings appropriate for the current topic.
 * The strings are scrolled across the bottom of the Pet News canvas.
 */

import type { Topic } from "@/app/pet-news/components/TopicSelector";

const SEPARATOR = "    ★    ";

const TICKERS: Record<Topic, { vi: string[]; en: string[] }> = {
  weather: {
    vi: [
      "BREAKING: Bầu trời được xác nhận là màu xanh",
      "Dự báo: 100% khả năng pet ngủ trưa cả ngày",
      "Cảnh báo: Cấp độ đáng yêu cao kỷ lục",
      "Thời tiết hoàn hảo cho việc ngủ trên ghế sofa",
    ],
    en: [
      "BREAKING: Sky confirmed blue, more details after the bork",
      "Forecast: 100% chance of pet napping all day",
      "Cuteness levels reach historic high",
      "Perfect weather for sofa sleep",
    ],
  },
  tech: {
    vi: [
      "Pet Industries IPO thành công",
      "AI mới có thể đếm số lần mèo ngáp",
      "Smart home: tự động mở tủ lạnh khi pet đến gần",
      "Kỷ nguyên mới: bàn phím tự lăn theo pet",
    ],
    en: [
      "Pet Industries goes public, paw-stocks soar",
      "New AI counts cat yawns with 99% accuracy",
      "Smart home: fridge auto-opens for approaching pets",
      "Tech breakthrough: keyboards self-roll for pets",
    ],
  },
  catfacts: {
    vi: [
      "Mèo ngủ tới 70% cuộc đời — nhân viên xuất sắc",
      "Mèo nhà có thể chạy nhanh hơn Usain Bolt",
      "Một con mèo có 32 cơ ở mỗi tai",
      "Râu mèo dài bằng chiều rộng cơ thể nó",
    ],
    en: [
      "Cats sleep up to 70% of their lives — employee of the month",
      "Domestic cats can outrun Usain Bolt over short distances",
      "Each cat ear has 32 muscles",
      "Whiskers are as wide as the cat's body",
    ],
  },
  custom: {
    vi: [
      "Bạn đang xem Pet News Network",
      "Tin nóng từ thế giới thú cưng",
      "Cảm ơn bạn đã theo dõi",
    ],
    en: [
      "You are watching Pet News Network",
      "Hot news from the pet world",
      "Thank you for tuning in",
    ],
  },
};

/**
 * Build the ticker string for a given topic. Joined with star separators
 * so the ticker can scroll continuously without an obvious "loop".
 */
export function buildTicker(topic: Topic, lang: "vi" | "en"): string {
  const set = TICKERS[topic] ?? TICKERS.custom;
  const items = set[lang] ?? set.vi;
  return items.join(SEPARATOR) + SEPARATOR;
}

/** Channel name shown in the lower-third banner. */
export function channelName(lang: "vi" | "en"): string {
  return lang === "vi" ? "PET NEWS NETWORK" : "PET NEWS NETWORK";
}

/** Lower-third strapline ("LIVE • Tin nhanh"). */
export function liveStrap(lang: "vi" | "en"): string {
  return lang === "vi" ? "TRỰC TIẾP • Tin nhanh" : "LIVE • Breaking news";
}
