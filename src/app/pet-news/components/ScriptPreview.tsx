"use client";

import { useLang } from "@/lib/i18n";

export const MAX_SCRIPT_CHARS = 1000;
const WARNING_THRESHOLD = 800; // Start showing warning at 800 chars

interface Props {
  script: string;
  onChange: (text: string) => void;
  onRegenerate?: () => void;
  isLoading: boolean;
}

export default function ScriptPreview({ script, onChange, onRegenerate, isLoading }: Props) {
  const { t } = useLang();
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.round((words / 150) * 60);
  const charCount = script.length;
  const isNearLimit = charCount >= WARNING_THRESHOLD && charCount < MAX_SCRIPT_CHARS;
  const isOverLimit = charCount >= MAX_SCRIPT_CHARS;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-bold text-gray-600 dark:text-gray-400">
          {t("script_label")}
        </label>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${
            isOverLimit
              ? "text-red-600 dark:text-red-400"
              : isNearLimit
                ? "text-amber-600 dark:text-amber-400"
                : "text-gray-400"
          }`}>
            {charCount}/{MAX_SCRIPT_CHARS} {t("chars")} · {words} {t("words")} (~{estimatedSeconds}s)
          </span>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isLoading}
              className="text-xs font-bold text-brand hover:underline disabled:opacity-50"
            >
              {t("btn_regenerate")}
            </button>
          )}
        </div>
      </div>
      <textarea
        value={script}
        onChange={(e) => {
          const val = e.target.value;
          // Allow typing past limit so user can trim, but validation will block TTS
          onChange(val);
        }}
        rows={5}
        className={`w-full p-4 bg-gray-50 dark:bg-gray-800 border rounded-xl resize-none outline-none text-sm leading-relaxed transition-colors ${
          isOverLimit
            ? "border-red-400 dark:border-red-500 focus:border-red-500"
            : isNearLimit
              ? "border-amber-400 dark:border-amber-500 focus:border-amber-500"
              : "border-gray-200 dark:border-gray-700 focus:border-brand"
        }`}
        placeholder={t("script_placeholder")}
      />
      {isOverLimit && (
        <p className="mt-1.5 text-xs font-bold text-red-600 dark:text-red-400">
          {"⚠️"} {t("script_too_long")}
        </p>
      )}
      {isNearLimit && (
        <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          {"⚠️"} {t("script_near_limit")}
        </p>
      )}
    </div>
  );
}
