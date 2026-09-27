"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import AvatarToggle from "@/components/avatar/AvatarToggle";
import PitchControl from "@/components/avatar/PitchControl";
import type { AvatarHandle } from "@/components/avatar/AvatarContainer";
import { setPitch as setAudioPitch } from "@/lib/audio-pipeline";
import { readNdjsonAudioStream, type NdjsonMessage } from "@/lib/ndjson-audio-stream";
import { planScript, STYLE_IDS, type ScriptLang } from "@/lib/speech/planner";
import { applyLexicon, sanitizeLexicon, type LexiconEntry } from "@/lib/speech/lexicon";
import { mapPauseTags } from "@/lib/speech/segmenter";
import { toSrt, toVtt, type TimedCue } from "@/lib/speech/subtitles";
import { LEGACY_MAX_CHARS, TTS_MAX_CHARS } from "@/lib/speech/limits";
import StylePanel, { DEFAULT_SETTINGS, type StudioSettings } from "@/components/studio/StylePanel";
import LexiconEditor, { MAX_LEXICON_ENTRIES } from "@/components/studio/LexiconEditor";
import ReadingPreview from "@/components/studio/ReadingPreview";
import Transcript from "@/components/studio/Transcript";
import { SAMPLE_SCRIPTS } from "@/components/studio/samples";
import { LOCALE_NAMES, RECOMMENDED_VOICES } from "@/components/studio/locales";
import { usePersistentState } from "@/components/studio/usePersistentState";
import { useTr } from "@/components/studio/i18n";

const AvatarContainer = dynamic(() => import("@/components/avatar/AvatarContainer"), { ssr: false });

// ─── Types ──────────────────────────────────────────────────────────────────

type VoiceType = "onnx" | "country" | "character" | "makevoice" | "gemini";

interface VoiceEntry {
  id: number;
  voice_id: string;
  locale: string;
  display_name: string;
  gender: string;
  type: VoiceType | string;
  description?: string;
}

interface GeminiStatus {
  enabled: boolean;
  voices: Array<{ name: string; gender: string; trait: string }>;
}

interface RenderResult {
  url: string;
  format: "mp3" | "wav";
  cues: TimedCue[];
  voiceName: string;
}

const GEMINI_LOCALES = new Set(["vi-VN", "en-US", "en-GB"]);
const isEdge = (v: VoiceEntry | null) => !!v && (v.type === "country" || v.type === "character");

function voiceRank(v: VoiceEntry): number {
  if (v.type === "gemini") return 0;
  if (RECOMMENDED_VOICES.has(v.voice_id)) return 1;
  if (v.type === "country" || v.type === "character") return 2;
  if (v.type === "makevoice") return 3;
  return 4; // onnx needs local model files
}

function downloadText(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Home() {
  const tr = useTr();

  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [gemini, setGemini] = useState<GeminiStatus>({ enabled: false, voices: [] });
  const [selectedCountry, setSelectedCountry] = useState("vi-VN");
  const [selectedVoice, setSelectedVoice] = useState<VoiceEntry | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [voiceSearch, setVoiceSearch] = useState("");

  const [text, setText] = usePersistentState("studio.draft", "");
  const [storedSettings, setSettings] = usePersistentState<StudioSettings>("studio.settings", DEFAULT_SETTINGS);
  const [storedLexicon, setLexicon] = usePersistentState<LexiconEntry[]>("studio.lexicon", []);
  // localStorage may hold values from an older build; never send the API
  // something its schema rejects.
  const settings = useMemo<StudioSettings>(() => {
    const clamp = (v: unknown, lo: number, hi: number, d: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
    const s = { ...DEFAULT_SETTINGS, ...storedSettings };
    return {
      style: STYLE_IDS.includes(s.style) ? s.style : DEFAULT_SETTINGS.style,
      rate: clamp(s.rate, -50, 100, 0),
      pitch: clamp(s.pitch, -50, 50, 0),
      pauseScale: clamp(s.pauseScale, 0.3, 3, 1),
      phrasing: typeof s.phrasing === "boolean" ? s.phrasing : true,
    };
  }, [storedSettings]);
  const lexicon = useMemo(() => sanitizeLexicon(storedLexicon, MAX_LEXICON_ENTRIES), [storedLexicon]);
  const [panel, setPanel] = useState<"style" | "lexicon" | "preview">("style");

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState<string | null>(null);

  const avatarRef = useRef<AvatarHandle>(null);
  const [avatarEnabled, setAvatarEnabled] = useState(false);
  const [pitchSemitones, setPitchSemitones] = useState(0);

  useEffect(() => {
    setAvatarEnabled(localStorage.getItem("avatarEnabled") === "true");
  }, []);

  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 10000);
  }, []);

  // ─── Voices ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data: VoiceEntry[]) => setVoices(data))
      .catch(() => showError("Không tải được danh sách giọng đọc / Failed to load voices"));
    fetch("/api/gemini-tts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GeminiStatus | null) => data && setGemini(data))
      .catch(() => undefined);
  }, [showError]);

  const countries = useMemo(() => {
    const locales = [...new Set(voices.map((v) => v.locale))];
    const pinned = ["vi-VN", "en-US", "en-GB"];
    return locales.sort((a, b) => {
      const pa = pinned.indexOf(a);
      const pb = pinned.indexOf(b);
      if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      return (LOCALE_NAMES[a] || a).localeCompare(LOCALE_NAMES[b] || b);
    });
  }, [voices]);

  const countryVoices = useMemo(() => {
    const list: VoiceEntry[] = voices.filter((v) => v.locale === selectedCountry);
    if (gemini.enabled && GEMINI_LOCALES.has(selectedCountry)) {
      gemini.voices.forEach((g, i) =>
        list.push({
          id: -(i + 1),
          voice_id: g.name,
          locale: selectedCountry,
          display_name: g.name,
          gender: g.gender,
          type: "gemini",
          description: g.trait,
        }),
      );
    }
    return list.sort((a, b) => voiceRank(a) - voiceRank(b));
  }, [voices, gemini, selectedCountry]);

  // Default: best free voice for the country (never an ONNX model that may be missing).
  useEffect(() => {
    if (!countryVoices.length) return;
    if (selectedVoice && selectedVoice.locale === selectedCountry && countryVoices.some((v) => v.id === selectedVoice.id)) return;
    setSelectedVoice(countryVoices.find((v) => v.type !== "gemini" && voiceRank(v) <= 2) ?? countryVoices[0]);
  }, [countryVoices, selectedCountry, selectedVoice]);

  const filteredCountries = countrySearch
    ? countries.filter((c) => (LOCALE_NAMES[c] || c).toLowerCase().includes(countrySearch.toLowerCase()))
    : countries;
  const filteredVoices = voiceSearch
    ? countryVoices.filter((v) => v.display_name.toLowerCase().includes(voiceSearch.toLowerCase()))
    : countryVoices;

  // ─── Plan preview (client-side, same planner as the server) ────────────────

  const forcedLang: ScriptLang | undefined = selectedVoice?.locale === "vi-VN" && isEdge(selectedVoice) ? "vi" : undefined;
  const deferredText = useDeferredValue(text);
  const plan = useMemo(
    () =>
      planScript(deferredText, {
        ...settings,
        lexicon,
        lang: forcedLang,
        normalize: selectedVoice?.type !== "gemini",
        phrasing: isEdge(selectedVoice) ? settings.phrasing : false,
      }),
    [deferredText, settings, lexicon, forcedLang, selectedVoice],
  );
  const estimatedMs = useMemo(() => {
    // ~4 syllables/s for Vietnamese (≈ words), ~2.7 words/s for English, plus planned pauses.
    const words = plan.segments.reduce((n, s) => n + s.spoken.split(/\s+/).length, 0);
    const pauses = plan.segments.reduce((n, s) => n + s.pauseBeforeMs, 0);
    return (words / (plan.lang === "vi" ? 4 : 2.7)) * 1000 + pauses;
  }, [plan]);

  const maxChars = selectedVoice && (selectedVoice.type === "makevoice" || selectedVoice.type === "onnx") ? LEGACY_MAX_CHARS : TTS_MAX_CHARS;

  // ─── ONNX worker (client-side Vietnamese) ─────────────────────────────────

  const initOnnxWorker = useCallback(
    async (modelName: string, signal: AbortSignal) => {
      if (modelLoaded === modelName && workerRef.current) return;
      setModelLoading(true);
      workerRef.current?.terminate();
      workerRef.current = null;

      return new Promise<void>((resolve, reject) => {
        const worker = new Worker("/workers/vi-tts-worker.js", { type: "module" });
        workerRef.current = worker;
        const cleanup = () => {
          worker.removeEventListener("message", onReady);
          worker.removeEventListener("error", onError);
          signal.removeEventListener("abort", onAbort);
          setModelLoading(false);
        };
        const fail = (err: Error) => {
          cleanup();
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          setModelLoaded(null);
          reject(err);
        };
        const onReady = (e: MessageEvent) => {
          if (e.data.status === "ready") {
            cleanup();
            setModelLoaded(modelName);
            resolve();
          } else if (e.data.status === "error") {
            fail(new Error(e.data.data || "Failed to load model"));
          }
        };
        const onError = (err: ErrorEvent) => fail(new Error(err.message || "Failed to load model"));
        // Stop while the model downloads: abandon the load immediately.
        const onAbort = () => fail(new DOMException("Stopped", "AbortError"));
        worker.addEventListener("message", onReady);
        worker.addEventListener("error", onError);
        signal.addEventListener("abort", onAbort, { once: true });
        worker.postMessage({ type: "init", model: modelName });
      });
    },
    [modelLoaded],
  );

  // ─── Playback ─────────────────────────────────────────────────────────────

  const playAudio = useCallback(
    async (blob: Blob, url: string) => {
      if (avatarEnabled && avatarRef.current) {
        await avatarRef.current.playAudio(blob);
      } else {
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play().catch(() => {});
          }
        }, 50);
      }
    },
    [avatarEnabled],
  );

  // Cancel an in-flight render if the page unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const handlePitchChange = useCallback((val: number) => {
    setPitchSemitones(val);
    setAudioPitch(val);
  }, []);

  // ─── Generate ─────────────────────────────────────────────────────────────

  const streamRender = useCallback(async (url: string, body: unknown, signal: AbortSignal) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const cues: TimedCue[] = [];
    let format = "mp3" as "mp3" | "wav";
    let finished = false;
    const { audioChunks } = await readNdjsonAudioStream(res, {
      onMessage: (msg: NdjsonMessage) => {
        if (msg.status === "progress") setProgress({ done: Number(msg.done), total: Number(msg.total) });
        if (msg.status === "cue" && msg.cue) cues.push(msg.cue as TimedCue);
        if (msg.status === "done") {
          finished = true;
          if (msg.format === "wav") format = "wav";
        }
      },
      onError: (msg) => {
        throw new Error(msg.message || "Generation failed");
      },
    });
    // A stream cut off before "done" (server timeout, dropped connection)
    // would otherwise play partial audio as if it were complete.
    if (!finished) throw new Error(tr("Kết nối bị ngắt giữa chừng, vui lòng thử lại.", "The connection was cut off, please try again."));
    return { audioChunks, cues, format };
  }, [tr]);

  const generateSpeech = useCallback(async () => {
    if (!text.trim() || !selectedVoice || isGenerating) return;
    if (text.length > maxChars) {
      showError(tr(`Văn bản vượt quá ${maxChars.toLocaleString()} ký tự cho giọng này.`, `Text exceeds ${maxChars} characters for this voice.`));
      return;
    }

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setIsGenerating(true);
    setProgress(null);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);

    try {
      let blob: Blob;
      let cues: TimedCue[] = [];
      let format: "mp3" | "wav" = "mp3";

      if (selectedVoice.type === "onnx") {
        await initOnnxWorker(selectedVoice.voice_id, abort.signal);
        abort.signal.throwIfAborted(); // Stop pressed before the load started
        const worker = workerRef.current;
        if (!worker) throw new Error("Worker not initialized");
        const prepared = mapPauseTags(applyLexicon(text.trim(), lexicon), () => ", ");
        blob = await new Promise<Blob>((resolve, reject) => {
          const chunks: Blob[] = [];
          // The worker can't be interrupted mid-inference: stop = terminate it.
          // The listener is removed once this generation settles, so a later
          // Generate (which aborts the previous controller) can't kill the
          // cached worker.
          const onAbort = () => {
            worker.removeEventListener("message", onMessage);
            worker.terminate();
            workerRef.current = null;
            setModelLoaded(null);
            reject(new DOMException("Stopped", "AbortError"));
          };
          const onCrash = (e: ErrorEvent) => {
            worker.removeEventListener("message", onMessage);
            settle();
            worker.terminate();
            workerRef.current = null;
            setModelLoaded(null);
            reject(new Error(e.message || "Voice model crashed"));
          };
          const settle = () => {
            abort.signal.removeEventListener("abort", onAbort);
            worker.removeEventListener("error", onCrash);
          };
          const onMessage = (e: MessageEvent) => {
            const { status } = e.data;
            if (status === "stream") chunks.push(e.data.chunk.audio);
            else if (status === "complete") {
              worker.removeEventListener("message", onMessage);
              settle();
              resolve(e.data.audio || new Blob(chunks, { type: "audio/wav" }));
            } else if (status === "error") {
              worker.removeEventListener("message", onMessage);
              settle();
              reject(new Error(e.data.data || "Generation failed"));
            }
          };
          abort.signal.addEventListener("abort", onAbort, { once: true });
          worker.addEventListener("error", onCrash);
          worker.addEventListener("message", onMessage);
          worker.postMessage({ type: "generate", text: prepared, voice: 0, speed: 1 + settings.rate / 100 });
        });
        format = "wav";
      } else {
        let out: Awaited<ReturnType<typeof streamRender>>;
        if (selectedVoice.type === "makevoice") {
          // Model is chosen server-side (Multilingual v2 does not support Vietnamese).
          out = await streamRender("/api/makevoice-tts", { voice_id: selectedVoice.voice_id, text: text.trim(), lexicon }, abort.signal);
        } else if (selectedVoice.type === "gemini") {
          out = await streamRender(
            "/api/gemini-tts",
            { text: text.trim(), voice: selectedVoice.voice_id, style: settings.style, pauseScale: settings.pauseScale, lexicon },
            abort.signal,
          );
        } else {
          out = await streamRender(
            "/api/tts",
            {
              text: text.trim(),
              id: selectedVoice.id,
              style: settings.style,
              rate: settings.rate,
              pitch: settings.pitch,
              pauseScale: settings.pauseScale,
              phrasing: settings.phrasing,
              lexicon,
            },
            abort.signal,
          );
        }
        if (!out.audioChunks.length) throw new Error(tr("Không nhận được âm thanh", "No audio received"));
        format = out.format;
        cues = out.cues;
        blob = new Blob(out.audioChunks, { type: format === "wav" ? "audio/wav" : "audio/mpeg" });
      }

      const url = URL.createObjectURL(blob);
      setResult({ url, format, cues, voiceName: selectedVoice.display_name });
      await playAudio(blob, url);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        showError(err instanceof Error ? err.message : tr("Tạo giọng đọc thất bại", "Failed to generate speech"));
      }
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  }, [text, selectedVoice, isGenerating, maxChars, result, settings, lexicon, initOnnxWorker, playAudio, streamRender, showError, tr]);

  // ─── Editor helpers ───────────────────────────────────────────────────────

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + snippet);
      return;
    }
    const { selectionStart: s, selectionEnd: e } = el;
    const next = text.slice(0, s) + snippet + text.slice(e);
    setText(next.slice(0, maxChars));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = s + snippet.length;
    });
  };

  const loadSample = (id: string) => {
    const sample = SAMPLE_SCRIPTS.find((s) => s.id === id);
    if (!sample) return;
    setText(sample.text);
    setSettings({ ...settings, style: sample.style });
    const wantCountry = sample.lang === "vi" ? "vi-VN" : "en-US";
    if (selectedCountry !== wantCountry) {
      setSelectedCountry(wantCountry);
      setSelectedVoice(null);
    }
  };

  const baseName = `tts-${(result?.voiceName || "audio").replace(/[^\p{L}\p{N}]+/gu, "-")}`;

  // ─── Render ───────────────────────────────────────────────────────────────

  const chip = (active: boolean) =>
    `px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
      active
        ? "bg-brand text-white shadow-sm"
        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
    }`;
  const sectionTitle = "text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3";

  return (
    <div className="flex-grow max-w-5xl mx-auto w-full px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
          {tr("Giọng đọc AI", "AI Voice")} <span className="text-brand">Studio</span>
        </h2>
        <p className="text-gray-500 dark:text-gray-400 font-bold">
          {tr(
            "Đọc bản tin, sách nói, quảng cáo tự nhiên như người thật — ngắt nghỉ chuẩn, xuất phụ đề SRT.",
            "Human-like narration for news, audiobooks and ads — broadcast pauses, SRT subtitles.",
          )}
        </p>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-3xl p-5 md:p-8 shadow-xl border border-gray-200 dark:border-dark-border">
        {errorMessage && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-300">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* 1. Language */}
        <div className="mb-6">
          <h3 className={sectionTitle}>1. {tr("Ngôn ngữ / quốc gia", "Language / country")}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {countries.slice(0, 3).map((locale) => (
              <button
                key={locale}
                onClick={() => {
                  setSelectedCountry(locale);
                  setVoiceSearch("");
                }}
                className={chip(selectedCountry === locale)}
              >
                {LOCALE_NAMES[locale] || locale}
              </button>
            ))}
            <select
              value={countries.slice(0, 3).includes(selectedCountry) ? "" : selectedCountry}
              onChange={(e) => e.target.value && setSelectedCountry(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 outline-none"
            >
              <option value="">{tr(`+ ${Math.max(0, countries.length - 3)} ngôn ngữ khác…`, `+ ${Math.max(0, countries.length - 3)} more…`)}</option>
              {filteredCountries.slice(3).map((locale) => (
                <option key={locale} value={locale}>
                  {LOCALE_NAMES[locale] || locale} ({locale})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={tr("Lọc…", "Filter…")}
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="w-24 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:border-brand"
            />
          </div>
        </div>

        {/* 2. Voice */}
        <div className="mb-6">
          <h3 className={sectionTitle}>
            2. {tr("Giọng đọc", "Voice")}
            <span className="ml-2 text-brand font-mono text-xs">{countryVoices.length}</span>
          </h3>
          {countryVoices.length > 8 && (
            <input
              type="text"
              placeholder={tr("Tìm giọng…", "Search voice…")}
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
              className="w-full mb-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-brand"
            />
          )}
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
            {filteredVoices.map((voice) => (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice)}
                title={voice.description}
                className={chip(selectedVoice?.id === voice.id)}
              >
                <span className="opacity-60">{voice.gender.toLowerCase() === "male" ? "♂" : "♀"}</span>
                {voice.display_name}
                {RECOMMENDED_VOICES.has(voice.voice_id) && (
                  <span className="ml-1 px-1 py-0.5 text-[9px] font-black rounded bg-emerald-500 text-white leading-none">
                    ★ {tr("KHUYÊN DÙNG", "BEST")}
                  </span>
                )}
                {voice.type === "gemini" && (
                  <span className="ml-1 px-1 py-0.5 text-[9px] font-black rounded bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white leading-none">
                    PREMIUM AI
                  </span>
                )}
                {voice.type === "onnx" && (
                  <span className="ml-1 px-1 py-0.5 text-[9px] font-black rounded bg-green-600 text-white leading-none">LOCAL</span>
                )}
                {voice.type === "character" && (
                  <span className="ml-1 px-1 py-0.5 text-[9px] font-black rounded bg-amber-500 text-white leading-none">MULTI</span>
                )}
                {voice.type === "makevoice" && (
                  <span className="ml-1 px-1 py-0.5 text-[9px] font-black rounded bg-blue-500 text-white leading-none">ELEVENLABS</span>
                )}
              </button>
            ))}
            {filteredVoices.length === 0 && <p className="text-sm text-gray-400 py-2">{tr("Không có giọng phù hợp", "No voices found")}</p>}
          </div>
          {selectedVoice?.type === "onnx" && (
            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
              {tr(
                "Giọng LOCAL chạy trong trình duyệt và cần file model tải riêng (public/models/vi). Ngắt nghỉ nâng cao chỉ áp dụng cho giọng Microsoft/Gemini.",
                "LOCAL voices run in-browser and need separately downloaded model files. Advanced pauses apply to Microsoft/Gemini voices only.",
              )}
            </p>
          )}
        </div>

        {/* 3. Script */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className={sectionTitle + " mb-0"}>3. {tr("Kịch bản", "Script")}</h3>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_SCRIPTS.map((s) => (
                <button key={s.id} onClick={() => loadSample(s.id)} className="px-2.5 py-1 text-[11px] font-bold rounded-full border border-gray-200 dark:border-gray-700 hover:border-brand hover:text-brand transition">
                  {tr("Mẫu", "Try")}: {tr(s.label.vi, s.label.en)}
                </button>
              ))}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxChars))}
            placeholder={tr(
              "Nhập hoặc dán văn bản… Xuống dòng để tách đoạn. Dòng ngắn không dấu chấm ở đầu sẽ được đọc như tiêu đề.",
              "Type or paste your script… Blank lines separate paragraphs. A short first line without a period is read as a headline.",
            )}
            className="w-full h-56 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl resize-y outline-none text-sm leading-relaxed focus:border-brand"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                generateSpeech();
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-400">{tr("Chèn ngắt:", "Insert pause:")}</span>
              {["0.5s", "1s", "2s"].map((d) => (
                <button key={d} onClick={() => insertAtCursor(` [ngắt ${d}] `)} className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:opacity-80">
                  ⏸ {d}
                </button>
              ))}
              {text && (
                <button onClick={() => setText("")} className="ml-2 text-[11px] font-bold text-gray-400 hover:text-red-500">
                  {tr("Xoá", "Clear")}
                </button>
              )}
            </div>
            <span className={`text-xs font-bold ${text.length > maxChars * 0.9 ? "text-red-500" : "text-gray-400"}`}>
              {plan.segments.length} {tr("câu", "sentences")} · ~{formatDuration(estimatedMs)} · {text.length.toLocaleString()}/{maxChars.toLocaleString()} · Ctrl+Enter
            </span>
          </div>
        </div>

        {/* 4. Direction */}
        <div className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700 text-xs font-black">
            {(
              [
                ["style", tr("🎚️ Phong cách đọc", "🎚️ Delivery")],
                ["preview", tr("👁️ Xem trước cách đọc", "👁️ Reading preview")],
                ["lexicon", tr(`📖 Từ điển phát âm${lexicon.length ? ` (${lexicon.length})` : ""}`, `📖 Pronunciations${lexicon.length ? ` (${lexicon.length})` : ""}`)],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPanel(id)}
                className={`flex-1 px-3 py-2.5 transition ${panel === id ? "bg-brand/10 text-brand" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {panel === "style" && (
              <StylePanel value={settings} onChange={setSettings} fineControls={isEdge(selectedVoice)} />
            )}
            {panel === "preview" && <ReadingPreview plan={plan} />}
            {panel === "lexicon" && <LexiconEditor entries={lexicon} onChange={setLexicon} />}
          </div>
        </div>

        {/* Generate */}
        <button
          onClick={generateSpeech}
          disabled={!text.trim() || !selectedVoice || isGenerating || modelLoading}
          className="relative w-full py-4 rounded-xl font-black text-white text-lg bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg overflow-hidden"
        >
          {progress && (
            <span
              className="absolute inset-y-0 left-0 bg-white/20 transition-all"
              style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
            />
          )}
          <span className="relative">
            {modelLoading
              ? tr("Đang tải model giọng…", "Loading voice model…")
              : isGenerating
                ? progress
                  ? tr(`Đang thu âm ${progress.done}/${progress.total}…`, `Recording ${progress.done}/${progress.total}…`)
                  : tr("Đang chuẩn bị…", "Preparing…")
                : tr("🎙️ Tạo giọng đọc", "🎙️ Generate voice")}
          </span>
        </button>

        {isGenerating && (
          <button
            onClick={() => abortRef.current?.abort()}
            className="mt-2 w-full text-xs font-bold text-gray-500 hover:text-red-500"
          >
            ■ {tr("Dừng", "Stop")}
          </button>
        )}

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

        {/* Result */}
        {result && (
          <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <audio ref={audioRef} controls className="w-full" src={result.url} />
            {result.cues.length > 0 && !avatarEnabled && (
              <Transcript cues={result.cues} audioRef={audioRef} />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-400">
                {result.voiceName} · {LOCALE_NAMES[selectedVoice?.locale || ""] || selectedVoice?.locale}
              </span>
              <div className="flex gap-3">
                <a href={result.url} download={`${baseName}.${result.format}`} className="text-xs font-bold text-brand hover:underline">
                  ⬇ {result.format.toUpperCase()}
                </a>
                {result.cues.length > 0 && (
                  <>
                    <button onClick={() => downloadText(toSrt(result.cues), `${baseName}.srt`, "application/x-subrip")} className="text-xs font-bold text-brand hover:underline">
                      ⬇ SRT
                    </button>
                    <button onClick={() => downloadText(toVtt(result.cues), `${baseName}.vtt`, "text/vtt")} className="text-xs font-bold text-brand hover:underline">
                      ⬇ VTT
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
