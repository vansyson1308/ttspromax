"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import AvatarToggle from "@/components/avatar/AvatarToggle";
import PitchControl from "@/components/avatar/PitchControl";
import type { AvatarHandle } from "@/components/avatar/AvatarContainer";
import { setPitch as setAudioPitch } from "@/lib/audio-pipeline";
import { readNdjsonAudioStream } from "@/lib/ndjson-audio-stream";

const AvatarContainer = dynamic(() => import("@/components/avatar/AvatarContainer"), { ssr: false });

// ─── Types ──────────────────────────────────────────────────────────────────

interface VoiceEntry {
  id: number;
  voice_id: string;
  locale: string;
  display_name: string;
  gender: string;
  type: string;
}

// Country locale → display name mapping
const LOCALE_NAMES: Record<string, string> = {
  "vi-VN": "Vietnam", "en-US": "United States", "en-GB": "United Kingdom",
  "en-AU": "Australia", "ja-JP": "Japan", "ko-KR": "South Korea",
  "zh-CN": "China", "zh-TW": "Taiwan", "fr-FR": "France", "de-DE": "Germany",
  "es-ES": "Spain", "it-IT": "Italy", "pt-BR": "Brazil", "ru-RU": "Russia",
  "hi-IN": "India", "ar-SA": "Saudi Arabia", "th-TH": "Thailand",
  "id-ID": "Indonesia", "ms-MY": "Malaysia", "tr-TR": "Turkey",
  "nl-NL": "Netherlands", "pl-PL": "Poland", "sv-SE": "Sweden",
  "da-DK": "Denmark", "nb-NO": "Norway", "fi-FI": "Finland",
  "el-GR": "Greece", "he-IL": "Israel", "ro-RO": "Romania",
  "hu-HU": "Hungary", "cs-CZ": "Czech Republic", "uk-UA": "Ukraine",
  "bg-BG": "Bulgaria", "hr-HR": "Croatia", "sk-SK": "Slovakia",
  "lt-LT": "Lithuania", "lv-LV": "Latvia", "et-EE": "Estonia",
  "ka-GE": "Georgia", "fa-IR": "Iran", "ar-EG": "Egypt",
  "ar-IQ": "Iraq", "ar-JO": "Jordan", "ar-KW": "Kuwait",
  "ar-BH": "Bahrain", "ar-QA": "Qatar", "ar-AE": "United Arab Emirates",
  "ar-YE": "Yemen", "ar-SY": "Syria", "ar-LB": "Lebanon",
  "ar-LY": "Libya", "ar-MA": "Morocco", "ar-DZ": "Algeria",
  "ar-TN": "Tunisia", "bn-BD": "Bangladesh", "ne-NP": "Nepal",
  "si-LK": "Sri Lanka", "fil-PH": "Philippines", "ur-PK": "Pakistan",
  "es-MX": "Mexico", "es-AR": "Argentina", "es-CO": "Colombia",
  "es-CL": "Chile", "es-PE": "Peru", "es-VE": "Venezuela",
  "es-BO": "Bolivia", "es-UY": "Uruguay", "es-GT": "Guatemala",
  "es-SV": "El Salvador", "pt-PT": "Portugal", "fr-CA": "Canada",
  "fr-BE": "Belgium", "de-AT": "Austria", "de-CH": "Switzerland",
  "en-SG": "Singapore", "en-HK": "Hong Kong", "en-NG": "Nigeria",
  "en-KE": "Kenya", "en-ZA": "South Africa", "en-GH": "Ghana",
  "en-TZ": "Tanzania", "en-NZ": "New Zealand",
  "multi": "Multilingual", "null": "Other",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function Home() {
  // State
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("vi-VN");
  const [countryVoices, setCountryVoices] = useState<VoiceEntry[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceEntry | null>(null);
  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [voiceSearch, setVoiceSearch] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState<string | null>(null);

  // Avatar state
  const avatarRef = useRef<AvatarHandle>(null);
  const [avatarEnabled, setAvatarEnabled] = useState(false);
  const [pitchSemitones, setPitchSemitones] = useState(0);

  // Load avatar preference from localStorage
  useEffect(() => {
    setAvatarEnabled(localStorage.getItem("avatarEnabled") === "true");
  }, []);

  // Show error with auto-dismiss
  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 8000);
  }, []);

  // Load voices
  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data: VoiceEntry[]) => {
        setVoices(data);
        // Extract unique countries, prioritize vi-VN
        const locales = [...new Set(data.map((v) => v.locale))];
        const sorted = locales.sort((a, b) => {
          if (a === "vi-VN") return -1;
          if (b === "vi-VN") return 1;
          return (LOCALE_NAMES[a] || a).localeCompare(LOCALE_NAMES[b] || b);
        });
        setCountries(sorted);
      })
      .catch(() => showError("Failed to load voices"));
  }, [showError]);

  // Filter voices by country
  useEffect(() => {
    const filtered = voices.filter((v) => v.locale === selectedCountry);
    setCountryVoices(filtered);
    // Auto-select first voice
    if (filtered.length > 0 && (!selectedVoice || selectedVoice.locale !== selectedCountry)) {
      setSelectedVoice(filtered[0]);
    }
  }, [selectedCountry, voices, selectedVoice]);


  // Initialize ONNX Worker for Vietnamese voice
  const initOnnxWorker = useCallback(async (modelName: string) => {
    if (modelLoaded === modelName) return; // Already loaded

    setModelLoading(true);

    // Terminate previous worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    return new Promise<void>((resolve, reject) => {
      const worker = new Worker("/workers/vi-tts-worker.js", { type: "module" });
      workerRef.current = worker;

      const onReady = (e: MessageEvent) => {
        if (e.data.status === "ready") {
          worker.removeEventListener("message", onReady);
          setModelLoaded(modelName);
          setModelLoading(false);
          resolve();
        } else if (e.data.status === "error") {
          worker.removeEventListener("message", onReady);
          setModelLoading(false);
          reject(new Error(e.data.data || "Failed to load model"));
        }
      };

      worker.addEventListener("message", onReady);
      worker.addEventListener("error", (err) => {
        setModelLoading(false);
        reject(new Error(err.message));
      });

      worker.postMessage({ type: "init", model: modelName });
    });
  }, [modelLoaded]);

  // Play audio through avatar pipeline or native element
  const playAudio = useCallback(async (blob: Blob, fallbackUrl?: string) => {
    if (avatarEnabled && avatarRef.current) {
      await avatarRef.current.playAudio(blob);
    } else {
      const url = fallbackUrl || URL.createObjectURL(blob);
      setAudioUrl(url);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
        }
      }, 100);
    }
  }, [avatarEnabled]);

  const handlePitchChange = useCallback((val: number) => {
    setPitchSemitones(val);
    setAudioPitch(val);
  }, []);

  // Generate TTS — Vietnamese ONNX (client-side), MakeVoice/ElevenLabs (premium), or Edge TTS (default)
  const generateSpeech = useCallback(async () => {
    if (!text.trim() || !selectedVoice || isGenerating) return;

    const isOnnxVoice = selectedVoice.type === "onnx";

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      if (isOnnxVoice) {
        // Vietnamese: client-side ONNX inference
        await initOnnxWorker(selectedVoice.voice_id);

        const worker = workerRef.current;
        if (!worker) throw new Error("Worker not initialized");

        const audioBlob = await new Promise<Blob>((resolve, reject) => {
          const chunks: Blob[] = [];

          const onMessage = (e: MessageEvent) => {
            const { status } = e.data;
            if (status === "stream") {
              chunks.push(e.data.chunk.audio);
            } else if (status === "complete") {
              worker.removeEventListener("message", onMessage);
              resolve(e.data.audio || new Blob(chunks, { type: "audio/wav" }));
            } else if (status === "error") {
              worker.removeEventListener("message", onMessage);
              reject(new Error(e.data.data || "Generation failed"));
            }
          };

          worker.addEventListener("message", onMessage);
          worker.postMessage({
            type: "generate",
            text: text.trim(),
            voice: 0,
            speed: 1.0,
          });
        });

        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        await playAudio(audioBlob, url);
      } else if (selectedVoice.type === "makevoice") {
        // MakeVoice.io ElevenLabs integration
        const res = await fetch("/api/makevoice-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            voice_id: selectedVoice.voice_id, 
            text: text.trim(),
            model_id: "eleven_multilingual_v2"
          }),
        });

        const { audioChunks, finalMessage } = await readNdjsonAudioStream(res, {
          onError: (msg) => { throw new Error(msg.message || "MakeVoice generation failed"); },
        });

        if (audioChunks.length > 0) {
          const blob = new Blob(audioChunks, { type: "audio/mpeg" });
          const blobUrl = URL.createObjectURL(blob);
          setAudioUrl(blobUrl);
          playAudio(blob, blobUrl);
        } else if (finalMessage?.url) {
          setAudioUrl(finalMessage.url as string);
          if (audioRef.current) {
            audioRef.current.src = finalMessage.url as string;
            audioRef.current.play().catch(() => {});
          }
        }
      } else {
        // Edge TTS (Microsoft Neural) — handles streaming NDJSON audio chunks
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), id: selectedVoice.id }),
        });

        const { audioChunks, finalMessage } = await readNdjsonAudioStream(res, {
          onError: (msg) => { throw new Error(msg.message || "Generation failed"); },
        });

        if (audioChunks.length > 0) {
          const blob = new Blob(audioChunks, { type: "audio/mpeg" });
          const blobUrl = URL.createObjectURL(blob);
          setAudioUrl(blobUrl);
          playAudio(blob, blobUrl);
        } else if (finalMessage?.url) {
          setAudioUrl(finalMessage.url as string);
          if (audioRef.current) {
            audioRef.current.src = finalMessage.url as string;
            audioRef.current.play().catch(() => {});
          }
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to generate speech");
    } finally {
      setIsGenerating(false);
    }
  }, [text, selectedVoice, isGenerating, showError, initOnnxWorker, playAudio]);

  // Filter countries by search
  const filteredCountries = countrySearch
    ? countries.filter((c) => {
        const name = LOCALE_NAMES[c] || c;
        return name.toLowerCase().includes(countrySearch.toLowerCase());
      })
    : countries;

  // Filter voices by search
  const filteredVoices = voiceSearch
    ? countryVoices.filter((v) =>
        v.display_name.toLowerCase().includes(voiceSearch.toLowerCase())
      )
    : countryVoices;

  return (
    <div className="flex-grow max-w-4xl mx-auto w-full px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
          Text to Speech <span className="text-brand">Premium</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 font-bold">
          350+ voices · 80+ languages · 19 Vietnamese ONNX voices that run in your browser.
        </p>
      </div>

        <div className="bg-white dark:bg-dark-card rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200 dark:border-dark-border">
          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-red-700 dark:text-red-300">{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 font-bold">x</button>
            </div>
          )}

          {/* Step 1: Choose Country */}
          <div className="mb-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              1. Choose Country
            </h3>
            <input
              type="text"
              placeholder="Search country..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="w-full mb-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-purple-400"
            />
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredCountries.map((locale) => (
                <button
                  key={locale}
                  onClick={() => { setSelectedCountry(locale); setVoiceSearch(""); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    selectedCountry === locale
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {LOCALE_NAMES[locale] || locale}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Choose Voice */}
          <div className="mb-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              2. Choose Voice
              <span className="ml-2 text-purple-500 font-mono text-xs">{countryVoices.length} voices</span>
            </h3>
            {countryVoices.length > 8 && (
              <input
                type="text"
                placeholder="Search voice..."
                value={voiceSearch}
                onChange={(e) => setVoiceSearch(e.target.value)}
                className="w-full mb-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-purple-400"
              />
            )}
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {filteredVoices.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                    selectedVoice?.id === voice.id
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="opacity-60">{voice.gender === "male" || voice.gender === "Male" ? "\u2642" : "\u2640"}</span>
                  {voice.display_name}
                  {voice.type === "onnx" && (
                    <span className="ml-1 px-1 py-0.5 text-[9px] font-black rounded bg-green-500 text-white leading-none">LOCAL</span>
                  )}
                  {voice.type === "character" && (
                    <span className="ml-1 px-1 py-0.5 text-[9px] font-black rounded bg-amber-500 text-white leading-none">MULTI</span>
                  )}
                  {voice.type === "makevoice" && (
                    <span className="ml-1 px-1 py-0.5 text-[9px] font-black rounded bg-blue-500 text-white leading-none">PREMIUM</span>
                  )}
                </button>
              ))}
              {filteredVoices.length === 0 && (
                <p className="text-sm text-gray-400 py-2">No voices found</p>
              )}
            </div>
          </div>

          {/* Step 3: Enter Text */}
          <div className="mb-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              3. Enter Text
            </h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              placeholder="Enter text to convert to speech..."
              className="w-full h-36 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl resize-none outline-none text-sm leading-relaxed focus:border-purple-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  generateSpeech();
                }
              }}
            />
            <div className="flex justify-between mt-1 px-1">
              <span className={`text-xs font-bold ${text.length > 900 ? "text-red-500" : "text-gray-400"}`}>
                {text.length}/1000
              </span>
              <span className="text-xs text-gray-400">Ctrl+Enter</span>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateSpeech}
            disabled={!text.trim() || !selectedVoice || isGenerating || modelLoading}
            className="w-full py-4 rounded-xl font-black text-white text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {modelLoading ? (
              <span>Loading voice model...</span>
            ) : isGenerating ? (
              <span>Generating...</span>
            ) : (
              <span>Generate Speech</span>
            )}
          </button>

          {/* Avatar + Pitch Control */}
          <div className="mt-4 flex items-center justify-between">
            <AvatarToggle enabled={avatarEnabled} onChange={setAvatarEnabled} />
            {avatarEnabled && (
              <div className="flex-1 ml-4">
                <PitchControl value={pitchSemitones} onChange={handlePitchChange} />
              </div>
            )}
          </div>

          {avatarEnabled && (
            <div className="mt-4">
              <AvatarContainer ref={avatarRef} />
            </div>
          )}

          {/* Audio Player */}
          {audioUrl && (
            <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <audio ref={audioRef} controls className="w-full" src={audioUrl} />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {selectedVoice?.display_name} ({LOCALE_NAMES[selectedVoice?.locale || ""] || selectedVoice?.locale})
                </span>
                <a
                  href={audioUrl}
                  download={`tts-${selectedVoice?.display_name || "audio"}.mp3`}
                  className="text-xs font-bold text-purple-600 hover:underline"
                >
                  Download MP3
                </a>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
