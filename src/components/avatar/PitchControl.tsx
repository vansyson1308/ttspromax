"use client";

import { useLang } from "@/lib/i18n";
import { AVATAR_CONFIG } from "@/lib/avatar-config";

interface PitchControlProps {
  value: number;
  onChange: (semitones: number) => void;
}

export default function PitchControl({ value, onChange }: PitchControlProps) {
  const { t } = useLang();

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {t("pitch_label")}
      </span>
      <input
        type="range"
        min={AVATAR_CONFIG.minPitch}
        max={AVATAR_CONFIG.maxPitch}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 accent-brand cursor-pointer"
      />
      <span className="text-xs font-mono font-bold text-brand w-10 text-right">
        {value > 0 ? `+${value}` : value}
      </span>
      {value !== 0 && (
        <button
          onClick={() => onChange(0)}
          className="text-xs text-gray-400 hover:text-brand transition-colors"
        >
          {t("pitch_reset")}
        </button>
      )}
    </div>
  );
}
