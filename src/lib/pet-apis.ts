/** Free API fetchers for Pet News Network. All are keyless and CORS-friendly. */

import { logger } from "./logger";

export async function fetchDogPhoto(): Promise<string> {
  const res = await fetch("https://dog.ceo/api/breeds/image/random");
  const data = await res.json();
  return data.message; // Direct image URL
}

export async function fetchCatPhoto(): Promise<string> {
  const res = await fetch("https://api.thecatapi.com/v1/images/search");
  const data = await res.json();
  return data[0].url;
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  city: string;
}

const WEATHER_CODES: Record<number, [string, string]> = {
  0: ["trời quang", "clear sky"],
  1: ["ít mây", "mainly clear"],
  2: ["mây rải rác", "partly cloudy"],
  3: ["nhiều mây", "overcast"],
  45: ["sương mù", "foggy"],
  48: ["sương mù đóng băng", "rime fog"],
  51: ["mưa phùn nhẹ", "light drizzle"],
  53: ["mưa phùn", "moderate drizzle"],
  55: ["mưa phùn dày", "dense drizzle"],
  61: ["mưa nhẹ", "light rain"],
  63: ["mưa vừa", "moderate rain"],
  65: ["mưa to", "heavy rain"],
  71: ["tuyết nhẹ", "light snow"],
  73: ["tuyết vừa", "moderate snow"],
  75: ["tuyết dày", "heavy snow"],
  80: ["mưa rào nhẹ", "light showers"],
  81: ["mưa rào", "moderate showers"],
  82: ["mưa rào nặng hạt", "violent showers"],
  95: ["giông bão", "thunderstorm"],
  96: ["giông bão kèm mưa đá nhẹ", "thunderstorm with light hail"],
  99: ["giông bão kèm mưa đá", "thunderstorm with heavy hail"],
};

export function getWeatherDescription(code: number, lang: "vi" | "en"): string {
  const idx = lang === "vi" ? 0 : 1;
  return WEATHER_CODES[code]?.[idx] || WEATHER_CODES[2]![idx];
}

/** Fetch weather for given coordinates. City label is optional metadata. */
export async function fetchWeather(lat: number, lon: number, city = ""): Promise<WeatherData> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
  );
  const data = await res.json();
  const cw = data.current_weather;
  return {
    temperature: Math.round(cw.temperature),
    windSpeed: Math.round(cw.windspeed),
    weatherCode: cw.weathercode,
    isDay: !!cw.is_day,
    city: city || "",
  };
}

/** Resolve location via browser geolocation, then fetch weather. Falls back to Hanoi. */
export async function fetchWeatherWithLocation(): Promise<WeatherData> {
  const FALLBACK = { lat: 21.0285, lon: 105.8542, city: "Hà Nội" };

  // Try browser geolocation
  if (typeof navigator !== "undefined" && "geolocation" in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 300_000, // 5 min cache
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode via Open-Meteo timezone API (includes city-like timezone)
      // For simplicity, use coordinates as city label — reverse geocoding requires extra API
      const city = await reverseGeocode(latitude, longitude);

      return fetchWeather(latitude, longitude, city);
    } catch {
      // Permission denied or timeout — fall through to Hanoi
    }
  }

  return fetchWeather(FALLBACK.lat, FALLBACK.lon, FALLBACK.city);
}

/** Lightweight reverse geocode using Open-Meteo timezone API (free, no key). */
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto`
    );
    const data = await res.json();
    // timezone gives us something like "Asia/Ho_Chi_Minh" — extract city
    const tz = data.timezone as string | undefined;
    if (tz) {
      const parts = tz.split("/");
      if (parts.length > 1) {
        return parts[1].replace(/_/g, " ");
      }
    }
  } catch { /* ignore */ }
  return "your area";
}

/** Vietnamese cat facts — curated local set for when English fact would be out of place. */
const VI_CAT_FACTS: string[] = [
  "Mèo ngủ trung bình 16 tiếng mỗi ngày. Chúng là những nhà vô địch về giấc ngủ trong thế giới động vật.",
  "Mèo có thể xoay tai 180 độ nhờ 32 cơ bắp ở mỗi bên tai.",
  "Mèo không thể nếm được vị ngọt. Đây là loài động vật duy nhất không thích đồ ngọt.",
  "Mèo có thể nhảy cao gấp 6 lần chiều dài cơ thể chúng.",
  "Mèo dành 30 phần trăm cuộc đời để tự chải chuốt bản thân.",
  "Mèo có thể phát ra hơn 100 âm thanh khác nhau, trong khi chó chỉ có khoảng 10.",
  "Mèo đã sống cùng con người hơn 4000 năm. Người Ai Cập cổ đại coi mèo là linh thiêng.",
  "Mèo có thể chạy nhanh tới 48 kilomet mỗi giờ, nhanh hơn cả vận động viên chạy nhanh nhất thế giới.",
];

/** Fetch cat fact — returns Vietnamese fact for vi, English for en. */
export async function fetchCatFact(lang: "vi" | "en" = "en"): Promise<string> {
  if (lang === "vi") {
    // Return curated Vietnamese fact — no external dependency needed
    return VI_CAT_FACTS[Math.floor(Math.random() * VI_CAT_FACTS.length)];
  }

  // English: try external API, fallback to generic
  try {
    const res = await fetch("https://catfact.ninja/fact");
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.fact as string;
  } catch {
    return "Cats sleep for an average of 16 hours a day and are the champions of sleep in the animal kingdom.";
  }
}

/** Curated fallback tech headlines for when Hacker News API fails. */
const FALLBACK_TECH_HEADLINES: string[] = [
  "AI tạo sinh tiếp tục phá vỡ giới hạn trong năm 2025",
  "Công nghệ WebAssembly đang thay đổi cách phát triển web",
  "Rust chính thức trở thành ngôn ngữ phổ biến thứ 10 thế giới",
  "Next.js 15 ra mắt với cải thiện hiệu suất đáng kinh ngạc",
  "Apple giới thiệu chip M5 với sức mạnh AI chưa từng có",
];

/** Fetch Hacker News top titles with fallback. */
export async function fetchHackerNewsTopTitles(count = 3): Promise<string[]> {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("HN API error");
    const ids: number[] = await res.json();
    const top = ids.slice(0, count);
    const stories = await Promise.all(
      top.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw new Error(`Item ${id} error`);
        const s = await r.json();
        return (s.title as string) || "";
      })
    );
    const valid = stories.filter(Boolean);
    if (valid.length > 0) return valid;
  } catch (err) {
    logger.warn("[PetNews] Hacker News fetch failed, using fallback:", err);
  }

  // Fallback: return curated headlines
  return FALLBACK_TECH_HEADLINES.slice(0, count);
}
