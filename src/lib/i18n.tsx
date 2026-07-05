"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

// ─── Translations ───────────────────────────────────────────────────────────

const translations: Record<string, Record<string, string>> = {
  vi: {
    // General
    error: "Có lỗi xảy ra!",
    success: "Thành công rồi sếp!",
    loading_data: "Đang tải dữ liệu...",

    // Main page
    main_subtitle: "Xài chùa 100% nhưng sếp gõ ít ít thôi nha \u{1F606} Dự án FREE nên gõ nhiều quá là em sập server đó ạ \u{1F62D}",
    enter_text_label: "Lời dặn dò của sếp:",
    enter_text: "Sếp nhập văn bản vào đây nhé...",
    generate: "BẮT ĐẦU RẶN CHỮ",
    generating: "Đang ép máy rặn chữ...",
    delete_text_tooltip: "Xóa văn bản",

    // Errors
    err_empty_text: "Đùa em à Sếp? Nhập chữ vào ô trắng trắng kìa! \u{1F92C}",
    err_no_voice: "Chọn giọng đọc đi Sếp!",
    err_too_long: "Sếp ơi \u{1F606} Dự án FREE mà nhập quá 1000 ký tự là em sập server đó!",

    // Avatar
    avatar_toggle: "3D Avatar",
    pitch_label: "Cao độ giọng",
    pitch_reset: "Reset",

    // Pet News
    pet_news_nav: "Tin Thú Cưng",
    pet_news_subtitle: "Để thú cưng đọc tin cho bạn nghe!",
    pet_type_cat: "Mèo",
    pet_type_dog: "Chó",
    btn_random: "Ngẫu nhiên",
    position_mouth: "Đặt miệng",
    topic_weather: "Thời tiết",
    topic_tech: "Công nghệ",
    topic_catfacts: "Mèo học",
    topic_custom: "Tự viết",
    voice_label: "Chọn giọng đọc:",
    script_label: "Kịch bản:",
    script_placeholder: "Kịch bản sẽ được tạo tự động...",
    words: "từ",
    btn_regenerate: "Tạo lại",
    btn_generate_news: "TẠO TIN TỨC",
    btn_play_preview: "XEM TRƯỚC",
    btn_record: "QUAY VIDEO",
    btn_download: "TẢI XUỐNG",
    generating_script: "Đang tạo kịch bản...",
    synthesizing: "Đang tổng hợp giọng nói...",
    playing: "Đang phát...",
    recording: "Đang quay...",
    chars: "ký tự",
    script_too_long: "Kịch bản vượt quá 1000 ký tự. Hãy rút gọn trước khi phát.",
    script_near_limit: "Sắp đạt giới hạn 1000 ký tự.",
    location_label: "Vị trí:",
    location_detecting: "Đang xác định vị trí...",
    location_denied: "Không thể xác định vị trí. Dùng Hà Nội.",
    location_default: "Hà Nội",
    custom_script_placeholder_vi: "Viết kịch bản cho thú cưng của bạn ở đây...\n\nVí dụ: Xin chào! Tôi là phóng viên thú cưng. Hôm nay trời đẹp, tôi muốn đi chơi.",
    effects_toggle_on: "Hiệu ứng",
    effects_toggle_off: "Hiệu ứng",
    autoframe_label: "Tự động căn khung",
    news_overlay_label: "Phong cách bản tin",

    // Nav
    leaderboard: "Cúng Dường",
  },
  en: {
    // General
    error: "An error occurred!",
    success: "Success!",
    loading_data: "Loading data...",

    // Main page
    main_subtitle: "100% free, but please keep text short \u{1F606} This is a FREE project, too much text may crash the server \u{1F62D}",
    enter_text_label: "Boss's instructions:",
    enter_text: "Enter text here...",
    generate: "GENERATE VOICE",
    generating: "Generating voice...",
    delete_text_tooltip: "Clear text",

    // Errors
    err_empty_text: "Are you kidding me Boss? Enter text in the white box! \u{1F92C}",
    err_no_voice: "Choose a voice!",
    err_too_long: "Boss \u{1F606} This is a FREE project, max 1000 characters!",

    // Avatar
    avatar_toggle: "3D Avatar",
    pitch_label: "Voice Pitch",
    pitch_reset: "Reset",

    // Pet News
    pet_news_nav: "Pet News",
    pet_news_subtitle: "Let your pet read the news for you!",
    pet_type_cat: "Cat",
    pet_type_dog: "Dog",
    btn_random: "Random",
    position_mouth: "Position mouth",
    topic_weather: "Weather",
    topic_tech: "Tech News",
    topic_catfacts: "Cat Facts",
    topic_custom: "Custom",
    voice_label: "Choose voice:",
    script_label: "Script:",
    script_placeholder: "Script will be auto-generated...",
    words: "words",
    btn_regenerate: "Regenerate",
    btn_generate_news: "GENERATE NEWS",
    btn_play_preview: "PREVIEW",
    btn_record: "RECORD VIDEO",
    btn_download: "DOWNLOAD",
    generating_script: "Generating script...",
    synthesizing: "Synthesizing voice...",
    playing: "Playing...",
    recording: "Recording...",
    chars: "chars",
    script_too_long: "Script exceeds 1000 character limit. Please shorten it before playing.",
    script_near_limit: "Approaching 1000 character limit.",
    location_label: "Location:",
    location_detecting: "Detecting location...",
    location_denied: "Could not detect location. Using Hanoi.",
    location_default: "Hanoi",
    custom_script_placeholder_en: "Write your pet's script here...\n\nExample: Hello! I'm a pet news reporter. Today is a beautiful day!",
    effects_toggle_on: "Effects",
    effects_toggle_off: "Effects",
    autoframe_label: "Auto-frame",
    news_overlay_label: "News studio look",

    // Nav
    leaderboard: "Donations",
  },
};

// ─── Context ────────────────────────────────────────────────────────────────

interface LangContextType {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "vi",
  setLang: () => {},
  t: (key: string) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("vi");

  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved && translations[saved]) {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((newLang: string) => {
    setLangState(newLang);
    localStorage.setItem("lang", newLang);
  }, []);

  const t = useCallback(
    (key: string) => translations[lang]?.[key] || translations.vi?.[key] || key,
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
