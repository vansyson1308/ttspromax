/** Funny bilingual script generator for Pet News Network. */

import { getWeatherDescription, type WeatherData } from "./pet-apis";

type PetType = "dog" | "cat";
type Lang = "vi" | "en";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const OPENINGS = {
  vi: [
    "Xin chào quý vị khán giả! Đây là bản tin nóng hổi từ Pet News Network.",
    "Breaking news! Đây là phóng viên số một thế giới.",
    "Chào buổi tối! Đây là chương trình thời sự do tôi dẫn. Tôi rất quan trọng.",
    "Khẩn cấp! Tôi vừa ngừng ngủ để đọc tin cho các bạn.",
  ],
  en: [
    "Good evening! This is Pet News Network, the most trusted name in news.",
    "Breaking news! I interrupted my nap to bring you this report.",
    "Welcome back! I'm your award-winning reporter. I won the award for cutest face.",
    "Alert! This is urgent news. Well, kind of. I'm a pet, everything feels urgent.",
  ],
};

const CLOSINGS = {
  vi: [
    "Tôi đi ngủ đây. Hẹn gặp lại lần sau!",
    "Đó là toàn bộ bản tin. Giờ cho tôi ăn đi.",
    "Pet News Network, tin tức bạn cần, do thú cưng bạn yêu dẫn dắt!",
    "Xin chào và tạm biệt! Nhớ cho tôi ăn nhé!",
  ],
  en: [
    "That's all for today. Now feed me. Goodbye!",
    "This has been Pet News Network. I'm going back to sleep.",
    "Remember: always trust a pet with your news. We never lie. Mostly.",
    "Reporting live, signing off. Where's my treat?",
  ],
};

const DOG_REACTIONS = {
  vi: [
    "Woof! Tin này làm tôi muốn đuổi theo đuôi mình!",
    "Tôi đã đánh hơi được tin này từ sáng rồi!",
    "Thông tin này quan trọng hơn cả việc đi dạo!",
    "Gâu gâu! Chủ nhân ơi nghe tin này chưa!",
  ],
  en: [
    "Woof! This news makes me want to chase my tail!",
    "I could smell this story from a mile away!",
    "This is more important than walkies! Well... almost.",
    "Bark bark! Did you hear that, human?",
  ],
};

const CAT_REACTIONS = {
  vi: [
    "Meow. Tôi không quan tâm lắm, nhưng vẫn đọc cho các bạn.",
    "Tin này chán hơn cả việc nhìn ra cửa sổ. Mà nhìn ra cửa sổ cũng chán.",
    "Tôi sẽ ngủ sau khi đọc xong. Thật ra tôi đang ngủ rồi.",
    "Meo meo. Đừng quên mở lon cá cho tôi sau bản tin.",
  ],
  en: [
    "Meow. I don't really care, but I'll read it anyway.",
    "This news is less interesting than a cardboard box. And that's saying something.",
    "I'll sleep after this. Actually, I'm already half asleep.",
    "Meow. Don't forget to open my tuna after the news.",
  ],
};

export function generateWeatherScript(
  weather: WeatherData,
  pet: PetType,
  lang: Lang
): string {
  const desc = getWeatherDescription(weather.weatherCode, lang);
  const c = weather.city || (lang === "vi" ? "Hà Nội" : "your city");
  const reaction = pick(pet === "dog" ? DOG_REACTIONS[lang] : CAT_REACTIONS[lang]);

  if (lang === "vi") {
    return `${pick(OPENINGS.vi)} Dự báo thời tiết hôm nay tại ${c}: nhiệt độ ${weather.temperature} độ C, ${desc}. Gió ${weather.windSpeed} ki lô mét trên giờ. ${reaction} ${pick(CLOSINGS.vi)}`;
  }
  return `${pick(OPENINGS.en)} Weather report for ${c}: ${weather.temperature} degrees, ${desc}. Wind speed ${weather.windSpeed} kilometers per hour. ${reaction} ${pick(CLOSINGS.en)}`;
}

export function generateTechScript(
  titles: string[],
  pet: PetType,
  lang: Lang
): string {
  const reaction = pick(pet === "dog" ? DOG_REACTIONS[lang] : CAT_REACTIONS[lang]);

  if (lang === "vi") {
    const news = titles.map((t, i) => `Tin số ${i + 1}: ${t}.`).join(" ");
    return `${pick(OPENINGS.vi)} Tin công nghệ nóng hổi! ${news} ${reaction} ${pick(CLOSINGS.vi)}`;
  }
  const news = titles.map((t, i) => `Number ${i + 1}: ${t}.`).join(" ");
  return `${pick(OPENINGS.en)} Top tech headlines! ${news} ${reaction} ${pick(CLOSINGS.en)}`;
}

export function generateCatFactsScript(
  fact: string,
  pet: PetType,
  lang: Lang
): string {
  const reaction = pick(pet === "dog" ? DOG_REACTIONS[lang] : CAT_REACTIONS[lang]);

  if (lang === "vi") {
    return `${pick(OPENINGS.vi)} Chuyên mục kiến thức hôm nay: ${fact}. ${reaction} ${pick(CLOSINGS.vi)}`;
  }
  return `${pick(OPENINGS.en)} Today's fun fact: ${fact}. ${reaction} ${pick(CLOSINGS.en)}`;
}
