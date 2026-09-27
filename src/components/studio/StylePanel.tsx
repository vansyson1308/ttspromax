"use client";

import { STYLE_IDS, STYLE_PRESETS, type StyleId } from "@/lib/speech/planner";
import { useLang } from "@/lib/i18n";
import { useTr } from "./i18n";

export interface StudioSettings {
  style: StyleId;
  rate: number;
  pitch: number;
  pauseScale: number;
  phrasing: boolean;
}

export const DEFAULT_SETTINGS: StudioSettings = {
  style: "natural",
  rate: 0,
  pitch: 0,
  pauseScale: 1,
  phrasing: true,
};

const STYLE_ICONS: Record<StyleId, string> = {
  natural: "💬",
  news: "📺",
  story: "📖",
  podcast: "🎙️",
  ads: "📣",
};

interface Props {
  value: StudioSettings;
  onChange: (next: StudioSettings) => void;
  /** Rate/pitch/phrasing only apply to Microsoft Neural voices. */
  fineControls: boolean;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-mono text-brand">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(min < 0 ? 0 : 1)}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 accent-brand cursor-pointer disabled:cursor-not-allowed"
      />
    </label>
  );
}

export default function StylePanel({ value, onChange, fineControls }: Props) {
  const { lang } = useLang();
  const tr = useTr();
  const set = (patch: Partial<StudioSettings>) => onChange({ ...value, ...patch });
  const l = lang === "en" ? "en" : "vi";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STYLE_IDS.map((id) => {
          const p = STYLE_PRESETS[id];
          const active = value.style === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => set({ style: id })}
              title={p.hint[l]}
              className={`text-left rounded-xl border px-3 py-2 transition ${
                active
                  ? "border-brand bg-brand/10 ring-2 ring-brand/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-brand/50"
              }`}
            >
              <div className="text-lg leading-none mb-1">{STYLE_ICONS[id]}</div>
              <div className="text-xs font-black text-gray-800 dark:text-gray-100">{p.label[l]}</div>
              <div className="text-[10px] leading-tight text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                {p.hint[l]}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Slider
          label={tr("Tốc độ", "Speed")}
          value={value.rate}
          min={-30}
          max={30}
          step={1}
          format={(v) => `${v > 0 ? "+" : ""}${v}%`}
          onChange={(rate) => set({ rate })}
          disabled={!fineControls}
        />
        <Slider
          label={tr("Cao độ", "Pitch")}
          value={value.pitch}
          min={-10}
          max={10}
          step={1}
          format={(v) => `${v > 0 ? "+" : ""}${v} Hz`}
          onChange={(pitch) => set({ pitch })}
          disabled={!fineControls}
        />
        <Slider
          label={tr("Độ dài ngắt nghỉ", "Pause length")}
          value={value.pauseScale}
          min={0.5}
          max={2}
          step={0.1}
          format={(v) => `×${v.toFixed(1)}`}
          onChange={(pauseScale) => set({ pauseScale })}
        />
      </div>

      <label className={`flex items-start gap-2 text-xs ${fineControls ? "" : "opacity-40"}`}>
        <input
          type="checkbox"
          checked={value.phrasing}
          disabled={!fineControls}
          onChange={(e) => set({ phrasing: e.target.checked })}
          className="mt-0.5 accent-brand"
        />
        <span>
          <span className="font-bold text-gray-700 dark:text-gray-200">
            {tr("Ngắt hơi thông minh", "Smart breathing")}
          </span>{" "}
          <span className="text-gray-500 dark:text-gray-400">
            {tr(
              "— tự thêm nhịp lấy hơi trước “nhưng, tuy nhiên, trong khi…” ở câu dài, như phát thanh viên thật.",
              "— adds a breath before “but, however, while…” in long clauses, like a real anchor.",
            )}
          </span>
        </span>
      </label>
      {!fineControls && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {tr(
            "Giọng này tự điều khiển tốc độ/cao độ; phong cách & ngắt nghỉ vẫn được áp dụng.",
            "This voice controls its own speed/pitch; style & pauses still apply.",
          )}
        </p>
      )}
    </div>
  );
}
