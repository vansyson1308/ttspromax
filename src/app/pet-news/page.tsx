"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLang } from "@/lib/i18n";
import toast from "react-hot-toast";
import { fetchDogPhoto, fetchCatPhoto, fetchWeatherWithLocation, fetchCatFact, fetchHackerNewsTopTitles } from "@/lib/pet-apis";
import { generateWeatherScript, generateTechScript, generateCatFactsScript } from "@/lib/script-generator";
import { petNewsTTS, VI_VOICES, type PetVoice } from "@/lib/tiktok-tts";
import { normalizeVietnameseText } from "@/lib/vi-normalizer";
import { downloadBlob, detectRecordingFormat, isWebMOnly, recordingFilename, assessRecordingCapability } from "@/lib/video-recorder";
import { trackPetNewsEvent } from "@/lib/pet-news-analytics";
import { MAX_SCRIPT_CHARS } from "./components/ScriptPreview";
import type { MouthRegion } from "@/lib/mouth-renderer";
import type { DetectionResult } from "@/lib/pet-detector";
import TopicSelector, { type Topic } from "./components/TopicSelector";
import VoiceSelector from "./components/VoiceSelector";
import VideoControls from "./components/VideoControls";
import ScriptPreview from "./components/ScriptPreview";
import PetCanvas, { type PetCanvasHandle } from "./components/PetCanvas";
import { buildTicker, channelName, liveStrap } from "@/lib/news-headlines";
import { defaultOverlayState, type NewsOverlayState } from "@/lib/news-overlay-renderer";

type PetType = "dog" | "cat";

// ─── Toggle chip ───────────────────────────────────────────────────────────

function ToggleChip({ active, label, onToggle }: { active: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
        active
          ? "bg-brand text-white border-brand shadow-sm"
          : "bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-border hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

// ─── localStorage persistence (client-only, lazy) ──────────────────────────

const STORAGE_KEY = "pet-news-state";

interface PersistedState {
  voiceCode?: string;
  topic?: Topic;
  customScript?: string;
  locationCity?: string;
  locationLat?: number;
  locationLon?: number;
  autoFrame?: boolean;
  newsOverlay?: boolean;
  particles?: boolean;
}

function loadPersistedState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // Validate topic
    if (parsed.topic && !["weather", "tech", "catfacts", "custom"].includes(parsed.topic)) {
      parsed.topic = undefined;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedState(state: Partial<PersistedState>): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: PersistedState = raw ? JSON.parse(raw) : {};
    const merged = { ...existing, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* storage full or blocked — silently ignore */
  }
}

// ─── Script generation ─────────────────────────────────────────────────────

async function generateScript(
  topic: Topic,
  petType: PetType,
  scriptLang: "vi" | "en",
): Promise<string> {
  if (topic === "weather") {
    const weather = await fetchWeatherWithLocation();
    return generateWeatherScript(weather, petType, scriptLang);
  }
  if (topic === "tech") {
    const titles = await fetchHackerNewsTopTitles(3);
    return generateTechScript(titles, petType, scriptLang);
  }
  if (topic === "catfacts") {
    const fact = await fetchCatFact(scriptLang);
    return generateCatFactsScript(fact, petType, scriptLang);
  }
  // custom — returns empty string so user can write their own
  return "";
}

export default function PetNewsPage() {
  const { t, lang } = useLang();
  const canvasRef = useRef<PetCanvasHandle>(null);

  // Load persisted state on mount
  const persisted = useRef(loadPersistedState());

  const [petType, setPetType] = useState<PetType>("cat");
  const [petImageUrl, setPetImageUrl] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic>(persisted.current?.topic ?? "weather");
  const [selectedVoice, setSelectedVoice] = useState<PetVoice>(() => {
    // Restore persisted voice by code
    const savedCode = persisted.current?.voiceCode;
    if (savedCode) {
      const all = [...VI_VOICES];
      const found = all.find((v) => v.code === savedCode);
      if (found) return found;
    }
    return VI_VOICES[0];
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoFormat, setVideoFormat] = useState<string>("");
  const [status, setStatus] = useState("");
  const [mouthRegion, setMouthRegion] = useState<MouthRegion>({ x: 0.5, y: 0.5, w: 0.16, h: 0.1 });
  const [detection, setDetection] = useState<DetectionResult | null>(null);

  // Visual effect toggles (persisted)
  const [autoFrame, setAutoFrame] = useState<boolean>(() => persisted.current?.autoFrame ?? true);
  const [newsOverlay, setNewsOverlay] = useState<boolean>(() => persisted.current?.newsOverlay ?? true);
  const [particles, setParticles] = useState<boolean>(() => persisted.current?.particles ?? true);

  // News overlay state — derived from topic + lang.
  const overlayState: Partial<NewsOverlayState> = {
    ...defaultOverlayState(),
    channelName: channelName(lang as "vi" | "en"),
    liveStrap: liveStrap(lang as "vi" | "en"),
    tickerText: buildTicker(topic, lang as "vi" | "en"),
    showLowerThird: newsOverlay,
    showTicker: newsOverlay,
    showLogo: newsOverlay,
    logoEmoji: petType === "cat" ? "🐱" : "🐶",
  };

  // Script state
  const [script, setScript] = useState<string>(() => {
    // Pre-fill if persisted topic was custom
    if (persisted.current?.topic === "custom") {
      return persisted.current.customScript || "";
    }
    return "";
  });
  const [hasScript, setHasScript] = useState(() => {
    return persisted.current?.topic === "custom";
  });

  // Image fetch state
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Weather location state
  const [weatherCity, setWeatherCity] = useState<string>(persisted.current?.locationCity ?? "");
  const [locationDetecting, setLocationDetecting] = useState(false);

  // Export compatibility notice
  const exportIsWebM = isWebMOnly();

  // Recording capability — assessed once on mount
  const recordingCap = useRef(assessRecordingCapability());
  const recordingNotSupported = !recordingCap.current.supported;
  const recordingRisky = recordingCap.current.risky;

  // Script length validation
  const scriptTooLong = script.length >= MAX_SCRIPT_CHARS;

  // Custom topic: show editor immediately without generating
  const isCustomTopic = topic === "custom";

  // ─── Weather location resolution ─────────────────────────────────────────

  const resolveLocation = useCallback(async () => {
    setLocationDetecting(true);
    try {
      const weather = await fetchWeatherWithLocation();
      setWeatherCity(weather.city);
      savePersistedState({ locationCity: weather.city, locationLat: undefined, locationLon: undefined });
    } catch {
      setWeatherCity(t("location_default"));
      toast.error(t("location_denied"));
    } finally {
      setLocationDetecting(false);
    }
  }, [t]);

  // Fetch weather city on mount (async, non-blocking)
  useEffect(() => {
    if (!weatherCity) {
      resolveLocation();
    }
  }, [resolveLocation, weatherCity]);

  // ─── Pet image fetch ─────────────────────────────────────────────────────

  const fetchPet = useCallback(async (type: PetType) => {
    setPetType(type);
    setPetImageUrl(null);
    setDetection(null);
    setVideoBlob(null);
    setVideoFormat("");
    setScript("");
    setHasScript(false);
    setImageLoading(true);
    setImageError(null);

    trackPetNewsEvent("pet_news_pet_fetch_started", { properties: { pet_type: type } });

    try {
      const externalUrl = type === "dog" ? await fetchDogPhoto() : await fetchCatPhoto();
      const proxyUrl = `/api/pet-image?url=${encodeURIComponent(externalUrl)}`;

      // Verify the proxied image loads before setting state
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Proxy returned invalid image"));
        img.src = proxyUrl;
        setTimeout(() => reject(new Error("Image load timed out")), 10_000);
      });

      setPetImageUrl(proxyUrl);
    } catch (err) {
      trackPetNewsEvent("pet_news_pet_fetch_failed");
      const msg = err instanceof Error ? err.message : "Unknown error";
      setImageError(`Failed to load ${type} photo: ${msg}`);
      toast.error(t("error"));
    } finally {
      setImageLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchPet("cat"); }, [fetchPet]);

  // ─── Persist state changes ───────────────────────────────────────────────

  const handleTopicChange = useCallback((newTopic: Topic) => {
    setTopic(newTopic);
    savePersistedState({ topic: newTopic });
    trackPetNewsEvent("pet_news_topic_selected", { properties: { topic: newTopic } });

    // If switching away from custom, clear script; if switching to custom, show editor
    if (newTopic !== "custom") {
      setScript("");
      setHasScript(false);
    } else {
      // For custom topic: show editor with starter template
      setHasScript(true);
      const savedCustom = persisted.current?.customScript;
      setScript(savedCustom || (lang === "vi"
        ? "Xin chào! Tôi là phóng viên thú cưng. Hôm nay là một ngày tuyệt vời."
        : "Hello! I'm a pet news reporter. Today is a beautiful day."));
    }
  }, [lang]);

  const handleVoiceChange = useCallback((voice: PetVoice) => {
    setSelectedVoice(voice);
    savePersistedState({ voiceCode: voice.code });
    trackPetNewsEvent("pet_news_voice_selected", { properties: { voice_code: voice.code, engine: voice.engine, lang: voice.lang } });
  }, []);

  const handleScriptChange = useCallback((text: string) => {
    setScript(text);
    // Persist custom script if in custom topic mode
    if (topic === "custom") {
      savePersistedState({ customScript: text });
    }
  }, [topic]);

  const toggleAutoFrame = useCallback(() => {
    setAutoFrame((v) => {
      const next = !v;
      savePersistedState({ autoFrame: next });
      return next;
    });
  }, []);

  const toggleNewsOverlay = useCallback(() => {
    setNewsOverlay((v) => {
      const next = !v;
      savePersistedState({ newsOverlay: next });
      return next;
    });
  }, []);

  const toggleParticles = useCallback(() => {
    setParticles((v) => {
      const next = !v;
      savePersistedState({ particles: next });
      return next;
    });
  }, []);

  // ─── Handle detection result from PetCanvas ──────────────────────────────

  const handleDetection = useCallback((result: DetectionResult) => {
    setDetection(result);
    trackPetNewsEvent(
      result.detected ? "pet_news_detection_succeeded" : "pet_news_detection_failed",
      { properties: { pet_class: result.petClass ?? "none", confidence: Math.round((result.confidence || 0) * 100) } }
    );
  }, []);

  // ─── Generate script (non-custom topics) ─────────────────────────────────

  const handleGenerateScript = useCallback(async () => {
    if (!petImageUrl) return toast.error("Load a pet photo first!");
    if (isCustomTopic) {
      // For custom: "generate" means accept the current script
      return;
    }

    setIsGenerating(true);
    setStatus(t("generating_script"));
    setVideoBlob(null);
    setVideoFormat("");

    try {
      const scriptLang = selectedVoice.lang;
      const generatedScript = await generateScript(topic, petType, scriptLang);

      const finalScript = scriptLang === "vi"
        ? normalizeVietnameseText(generatedScript)
        : generatedScript;

      setScript(finalScript);
      setHasScript(true);
      setStatus("");

      trackPetNewsEvent("pet_news_script_generated", {
        properties: { topic, lang: scriptLang, char_count: finalScript.length },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
      setStatus("");
    } finally {
      setIsGenerating(false);
    }
  }, [petImageUrl, topic, petType, selectedVoice, isCustomTopic, t]);

  // ─── Playback ────────────────────────────────────────────────────────────

  const handlePlay = useCallback(async () => {
    if (!petImageUrl || !script.trim() || scriptTooLong) return;

    setIsPlaying(true);
    setStatus(t("synthesizing"));

    trackPetNewsEvent("pet_news_tts_started", { properties: { voice_code: selectedVoice.code } });

    try {
      const textToSpeak = selectedVoice.lang === "vi"
        ? normalizeVietnameseText(script)
        : script;

      const audioBlob = await petNewsTTS(textToSpeak, selectedVoice);

      setStatus(t("playing"));
      await canvasRef.current?.playWithLipSync(audioBlob);

      setStatus("");
    } catch (err) {
      trackPetNewsEvent("pet_news_tts_failed");
      toast.error(err instanceof Error ? err.message : t("error"));
      setStatus("");
    } finally {
      setIsPlaying(false);
    }
  }, [petImageUrl, script, selectedVoice, scriptTooLong, t]);

  // ─── Recording ───────────────────────────────────────────────────────────

  const handleRecord = useCallback(async () => {
    if (!petImageUrl || !script.trim() || scriptTooLong) return;

    setIsRecording(true);
    setVideoBlob(null);
    setVideoFormat("");

    trackPetNewsEvent("pet_news_record_started");

    try {
      const textToSpeak = selectedVoice.lang === "vi"
        ? normalizeVietnameseText(script)
        : script;

      setStatus(t("synthesizing"));
      const audioBlob = await petNewsTTS(textToSpeak, selectedVoice);

      setStatus(t("recording"));
      const video = await canvasRef.current?.playAndRecord(audioBlob);

      if (video) {
        setVideoBlob(video);
        // Detect actual format for display
        const fmt = detectRecordingFormat();
        setVideoFormat(fmt.extension.toUpperCase());
        trackPetNewsEvent("pet_news_record_completed", {
          properties: { format: fmt.extension, size_kb: Math.round(video.size / 1024) },
        });
      }
      setStatus("");
    } catch (err) {
      trackPetNewsEvent("pet_news_record_failed");
      toast.error(err instanceof Error ? err.message : t("error"));
      setStatus("");
    } finally {
      setIsRecording(false);
      setIsPlaying(false);
    }
  }, [petImageUrl, script, selectedVoice, scriptTooLong, t]);

  const handleDownload = useCallback(() => {
    if (!videoBlob) return;
    const fmt = detectRecordingFormat();
    const fname = recordingFilename(`pet-news-${petType}-${Date.now()}`, fmt);
    downloadBlob(videoBlob, fname);
  }, [videoBlob, petType]);

  const busy = isGenerating || isPlaying || isRecording;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
          {"\uD83D\uDCFA"} Pet News Network
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">
          {t("pet_news_subtitle")}
        </p>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-3xl p-6 md:p-8 shadow-xl border border-gray-200 dark:border-dark-border space-y-6">

        {/* Step 1: Pet Selection */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => fetchPet("cat")}
            disabled={busy || imageLoading}
            aria-label={`Select cat pet photo`}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${
              petType === "cat" ? "bg-brand text-white" : "bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400"
            } disabled:opacity-50`}
          >
            {"\uD83D\uDC31"} {t("pet_type_cat")}
          </button>
          <button
            onClick={() => fetchPet("dog")}
            disabled={busy || imageLoading}
            aria-label={`Select dog pet photo`}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${
              petType === "dog" ? "bg-brand text-white" : "bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400"
            } disabled:opacity-50`}
          >
            {"\uD83D\uDC36"} {t("pet_type_dog")}
          </button>
          <button
            onClick={() => fetchPet(petType)}
            disabled={busy || imageLoading}
            aria-label={`Load random ${petType} photo`}
            className="px-4 py-2 rounded-xl font-bold bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
          >
            {imageLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              <>{"\uD83C\uDFB2"} {t("btn_random")}</>
            )}
          </button>
          {detection?.detected && (
            <span className="ml-auto text-xs font-bold text-green-600 dark:text-green-400">
              {detection.petClass} detected ({Math.round(detection.confidence * 100)}%)
            </span>
          )}
        </div>

        {/* Image error state with retry */}
        {imageError && (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700" role="alert">
            <div className="text-4xl mb-3">{"\uD83D\uDE3F"}</div>
            <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-3">{imageError}</p>
            <button
              onClick={() => fetchPet(petType)}
              className="px-4 py-2 rounded-lg font-bold text-sm bg-brand text-white hover:bg-brand/90 transition-all"
            >
              {"\uD83D\uDD04"} Retry
            </button>
          </div>
        )}

        {/* Canvas */}
        {!imageError && (
          <div className="w-full max-w-2xl mx-auto">
            {imageLoading && (
              <div className="relative bg-gray-900 rounded-xl overflow-hidden" style={{ paddingBottom: "75%" }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="mt-3 text-sm font-bold text-gray-400">Loading pet photo...</p>
                </div>
              </div>
            )}
            {!imageLoading && (
              <PetCanvas
                ref={canvasRef}
                imageUrl={petImageUrl}
                mouthRegion={mouthRegion}
                onMouthRegionChange={setMouthRegion}
                onDetection={handleDetection}
                autoFrame={autoFrame}
                showNewsOverlay={newsOverlay}
                showParticles={particles}
                overlay={overlayState}
              />
            )}

            {/* Visual toggles */}
            {!imageLoading && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <ToggleChip
                  active={autoFrame}
                  label={`🎯 ${t("autoframe_label")}`}
                  onToggle={toggleAutoFrame}
                />
                <ToggleChip
                  active={newsOverlay}
                  label={`📺 ${t("news_overlay_label")}`}
                  onToggle={toggleNewsOverlay}
                />
                <ToggleChip
                  active={particles}
                  label={`✨ ${t(particles ? "effects_toggle_on" : "effects_toggle_off")}`}
                  onToggle={toggleParticles}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Topic + Voice (side by side on desktop) */}
        <div className="grid md:grid-cols-2 gap-6">
          <TopicSelector selected={topic} onChange={handleTopicChange} />
          <VoiceSelector selected={selectedVoice} onChange={handleVoiceChange} scriptText={script} />
        </div>

        {/* Weather location indicator */}
        {topic === "weather" && (
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {"\uD83D\uDCCD"} {t("location_label")}{" "}
            {locationDetecting ? (
              <span className="text-brand animate-pulse">{t("location_detecting")}</span>
            ) : weatherCity ? (
              <span>{weatherCity}</span>
            ) : (
              <span>{t("location_default")}</span>
            )}
          </div>
        )}

        {/* Generate Script Button / Custom topic info */}
        {isCustomTopic ? (
          <div className="text-center py-2 px-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-sm text-purple-700 dark:text-purple-300 font-medium">
            {"\u270F\uFE0F"} {lang === "vi"
              ? "Viết kịch bản của bạn trong khung bên dưới, sau đó nhấn Xem Trước hoặc Quay Video."
              : "Write your script in the editor below, then hit Preview or Record Video."
            }
          </div>
        ) : (
          <button
            onClick={handleGenerateScript}
            disabled={busy || !petImageUrl}
            className="w-full py-3.5 rounded-xl font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isGenerating ? t("generating_script") : t("btn_generate_news")}
          </button>
        )}

        {/* Step 3: Script Preview (editable) */}
        {(hasScript || isCustomTopic) && (
          <ScriptPreview
            script={script}
            onChange={handleScriptChange}
            onRegenerate={isCustomTopic ? undefined : handleGenerateScript}
            isLoading={isGenerating}
          />
        )}

        {/* Export compatibility notice */}
        {exportIsWebM && videoBlob && (
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
            {"\u2139\uFE0F"} {lang === "vi"
              ? `Video được xuất ở định dạng WebM. Hầu hết trình duyệt đều phát được. Nếu cần tải lên mạng xã hội, bạn có thể cần chuyển đổi sang MP4 bằng công cụ trực tuyến.`
              : `Video is exported in WebM format. Most browsers can play it. If you need to upload to social media, you may need to convert to MP4 using an online tool.`
            }
          </div>
        )}

        {/* Step 4: Play / Record / Download */}
        {(hasScript || isCustomTopic) && (
          <VideoControls
            isGenerating={false}
            isPlaying={isPlaying}
            isRecording={isRecording}
            hasScript={hasScript || script.trim().length > 0}
            hasVideo={!!videoBlob}
            videoFormat={videoFormat || detectRecordingFormat().extension.toUpperCase()}
            scriptTooLong={scriptTooLong}
            recordingNotSupported={recordingNotSupported}
            recordingRisky={recordingRisky}
            onGenerate={handlePlay}
            onPlay={handlePlay}
            onRecord={handleRecord}
            onDownload={handleDownload}
            status={status}
          />
        )}
      </div>
    </div>
  );
}
