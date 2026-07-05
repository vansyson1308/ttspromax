"use client";

import { useLang } from "@/lib/i18n";
import { VI_VOICES, EN_VOICES, type PetVoice } from "@/lib/tiktok-tts";
import { detectScriptLang } from "@/lib/script-lang-detect";

interface Props {
  selected: PetVoice;
  onChange: (voice: PetVoice) => void;
  scriptText: string;
}

const tiktokViVoices = VI_VOICES.filter((v) => v.engine === "tiktok");
const vieneuVoices = VI_VOICES.filter((v) => v.engine === "vieneu");
const edgeVoices = VI_VOICES.filter((v) => v.engine === "edge");

export default function VoiceSelector({ selected, onChange, scriptText }: Props) {
  const { t } = useLang();

  // Detect script language for mismatch warning
  const detectedLang = scriptText.trim().length > 0 ? detectScriptLang(scriptText) : null;
  const isMismatch = detectedLang !== null && selected.lang !== detectedLang;

  return (
    <div>
      <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2 block">
        {t("voice_label")}
      </label>

      {/* Mismatch warning */}
      {isMismatch && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
          {"⚠️"} {detectedLang === "vi"
            ? "Kịch bản có vẻ là tiếng Việt. Giọng tiếng Anh có thể phát âm sai."
            : "Script appears to be English. A Vietnamese voice may pronounce it incorrectly."
          }
        </div>
      )}

      {/* Vietnamese voices — shown only when script is Vietnamese or empty/short */}
      {(detectedLang === "vi" || detectedLang === null) && (
        <>
          {/* TikTok Vietnamese voices (fast, reliable) */}
          <div className="mb-2">
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1" title="Usually available" />
              {"\uD83C\uDDFB\uD83C\uDDF3"} Ti{"\u1EBF"}ng Vi{"\u1EC7"}t (TikTok)
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tiktokViVoices.map((v) => (
                <VoiceButton key={v.code} voice={v} selected={selected} onChange={onChange} />
              ))}
            </div>
          </div>

          {/* VieNeu AI voices (natural, slower, often down) */}
          <div className="mb-2">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1" title="Often unavailable" />
              {"\uD83E\uDDE0"} Ti{"\u1EBF"}ng Vi{"\u1EC7"}t (AI)
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {vieneuVoices.map((v) => (
                <VoiceButton key={v.code} voice={v} selected={selected} onChange={onChange} />
              ))}
            </div>
          </div>

          {/* Edge TTS Vietnamese voices (fast, always available) */}
          <div className="mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" title="Always available" />
              {"\uD83D\uDD0A"} Ti{"\u1EBF"}ng Vi{"\u1EC7"}t (Edge)
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {edgeVoices.map((v) => (
                <VoiceButton key={v.code} voice={v} selected={selected} onChange={onChange} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* English funny voices — always shown, but with warning if script is Vietnamese */}
      <div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {"\uD83C\uDDFA\uD83C\uDDF8"} English (Funny)
        </span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {EN_VOICES.map((v) => (
            <VoiceButton key={v.code} voice={v} selected={selected} onChange={onChange} />
          ))}
        </div>
      </div>

      {/* "Show all voices" toggle when Vietnamese voices are hidden */}
      {detectedLang === "en" && (
        <details className="mt-2">
          <summary className="text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-500">
            {"\uD83C\uDDFB\uD83C\uDDF3"} Show Vietnamese voices anyway
          </summary>
          <div className="mt-2 space-y-2">
            {/* TikTok Vietnamese voices */}
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                TikTok
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tiktokViVoices.map((v) => (
                  <VoiceButton key={v.code} voice={v} selected={selected} onChange={onChange} />
                ))}
              </div>
            </div>
            {/* VieNeu AI voices */}
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                AI
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {vieneuVoices.map((v) => (
                  <VoiceButton key={v.code} voice={v} selected={selected} onChange={onChange} />
                ))}
              </div>
            </div>
            {/* Edge TTS */}
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Edge
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {edgeVoices.map((v) => (
                  <VoiceButton key={v.code} voice={v} selected={selected} onChange={onChange} />
                ))}
              </div>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function VoiceButton({ voice, selected, onChange }: { voice: PetVoice; selected: PetVoice; onChange: (v: PetVoice) => void }) {
  const isActive = selected.code === voice.code;
  return (
    <button
      onClick={() => onChange(voice)}
      aria-pressed={isActive}
      aria-label={`${voice.name} — ${voice.lang === "vi" ? "Vietnamese" : "English"} voice${isActive ? ", currently selected" : ""}`}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border relative group ${
        isActive
          ? "border-brand bg-brand/10 text-brand scale-105 shadow-md"
          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand/50"
      }`}
    >
      <span className="mr-1">{voice.emoji}</span>
      {voice.name}
      {/* Language badge — always visible on hover */}
      <span className="absolute -top-1 -right-1 text-[8px] font-black px-1 rounded-full bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity">
        {voice.lang.toUpperCase()}
      </span>
    </button>
  );
}
