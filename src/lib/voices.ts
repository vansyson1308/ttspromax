export interface Voice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName: string;
  ContentCategories?: string[];
  VoicePersonalities?: string[];
}

export interface VoiceGroup {
  locale: string;
  language: string;
  flag: string;
  voices: Voice[];
}

// Map locale codes to language names and flags
const LOCALE_MAP: Record<string, { name: string; flag: string }> = {
  "vi-VN": { name: "Tiếng Việt", flag: "🇻🇳" },
  "en-US": { name: "English (US)", flag: "🇺🇸" },
  "en-GB": { name: "English (UK)", flag: "🇬🇧" },
  "en-AU": { name: "English (AU)", flag: "🇦🇺" },
  "en-IN": { name: "English (India)", flag: "🇮🇳" },
  "zh-CN": { name: "中文 (简体)", flag: "🇨🇳" },
  "zh-TW": { name: "中文 (繁體)", flag: "🇹🇼" },
  "ja-JP": { name: "日本語", flag: "🇯🇵" },
  "ko-KR": { name: "한국어", flag: "🇰🇷" },
  "fr-FR": { name: "Français", flag: "🇫🇷" },
  "de-DE": { name: "Deutsch", flag: "🇩🇪" },
  "es-ES": { name: "Español (Spain)", flag: "🇪🇸" },
  "es-MX": { name: "Español (Mexico)", flag: "🇲🇽" },
  "pt-BR": { name: "Português (BR)", flag: "🇧🇷" },
  "it-IT": { name: "Italiano", flag: "🇮🇹" },
  "ru-RU": { name: "Русский", flag: "🇷🇺" },
  "th-TH": { name: "ไทย", flag: "🇹🇭" },
  "id-ID": { name: "Bahasa Indonesia", flag: "🇮🇩" },
  "hi-IN": { name: "हिन्दी", flag: "🇮🇳" },
  "ar-SA": { name: "العربية", flag: "🇸🇦" },
  "nl-NL": { name: "Nederlands", flag: "🇳🇱" },
  "pl-PL": { name: "Polski", flag: "🇵🇱" },
  "sv-SE": { name: "Svenska", flag: "🇸🇪" },
  "da-DK": { name: "Dansk", flag: "🇩🇰" },
  "nb-NO": { name: "Norsk", flag: "🇳🇴" },
  "fi-FI": { name: "Suomi", flag: "🇫🇮" },
  "tr-TR": { name: "Türkçe", flag: "🇹🇷" },
  "uk-UA": { name: "Українська", flag: "🇺🇦" },
  "cs-CZ": { name: "Čeština", flag: "🇨🇿" },
  "el-GR": { name: "Ελληνικά", flag: "🇬🇷" },
  "he-IL": { name: "עברית", flag: "🇮🇱" },
  "ro-RO": { name: "Română", flag: "🇷🇴" },
  "hu-HU": { name: "Magyar", flag: "🇭🇺" },
  "ms-MY": { name: "Bahasa Melayu", flag: "🇲🇾" },
  "fil-PH": { name: "Filipino", flag: "🇵🇭" },
};

// Multilingual voices that can speak Vietnamese (and many other languages)
const MULTILINGUAL_VOICE_IDS = [
  "en-US-AndrewMultilingualNeural",
  "en-US-AvaMultilingualNeural",
  "en-US-BrianMultilingualNeural",
  "en-US-EmmaMultilingualNeural",
  "en-AU-WilliamMultilingualNeural",
  "fr-FR-VivienneMultilingualNeural",
  "fr-FR-RemyMultilingualNeural",
  "de-DE-SeraphinaMultilingualNeural",
  "de-DE-FlorianMultilingualNeural",
  "it-IT-GiuseppeMultilingualNeural",
  "ko-KR-HyunsuMultilingualNeural",
  "pt-BR-ThalitaMultilingualNeural",
];

export function isMultilingualVoice(shortName: string): boolean {
  return MULTILINGUAL_VOICE_IDS.includes(shortName);
}

// Priority locales shown first
const PRIORITY_LOCALES = ["vi-VN", "vi-VN-multi", "en-US", "en-GB", "ja-JP", "ko-KR", "zh-CN", "fr-FR", "de-DE", "es-ES"];

export function getLocaleInfo(locale: string) {
  return LOCALE_MAP[locale] || { name: locale, flag: "🌐" };
}

export function groupVoicesByLocale(voices: Voice[]): VoiceGroup[] {
  const groups: Record<string, Voice[]> = {};
  const multilingualVoices: Voice[] = [];

  for (const voice of voices) {
    const locale = voice.Locale;
    if (!groups[locale]) groups[locale] = [];
    groups[locale].push(voice);

    // Also collect multilingual voices for the special Vietnamese group
    if (isMultilingualVoice(voice.ShortName)) {
      multilingualVoices.push(voice);
    }
  }

  const result: VoiceGroup[] = Object.entries(groups).map(([locale, voices]) => {
    const info = getLocaleInfo(locale);
    return {
      locale,
      language: info.name,
      flag: info.flag,
      voices: voices.sort((a, b) => a.ShortName.localeCompare(b.ShortName)),
    };
  });

  // Add special "Vietnamese Multilingual" group
  if (multilingualVoices.length > 0) {
    result.push({
      locale: "vi-VN-multi",
      language: "Tiếng Việt (Đa ngôn ngữ)",
      flag: "🇻🇳",
      voices: multilingualVoices.sort((a, b) => a.ShortName.localeCompare(b.ShortName)),
    });
  }

  // Sort: priority locales first, then alphabetically
  result.sort((a, b) => {
    const aIdx = PRIORITY_LOCALES.indexOf(a.locale);
    const bIdx = PRIORITY_LOCALES.indexOf(b.locale);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.language.localeCompare(b.language);
  });

  return result;
}

export function extractVoiceName(shortName: string): string {
  // "vi-VN-HoaiMyNeural" -> "Hoai My"
  const parts = shortName.split("-");
  if (parts.length < 3) return shortName;
  let name = parts.slice(2).join("-").replace("Neural", "").replace("Multilingual", "");
  // Add spaces before uppercase letters: "HoaiMy" -> "Hoai My"
  name = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return name;
}
