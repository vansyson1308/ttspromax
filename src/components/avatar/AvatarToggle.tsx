"use client";

import { useLang } from "@/lib/i18n";

interface AvatarToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export default function AvatarToggle({ enabled, onChange }: AvatarToggleProps) {
  const { t } = useLang();

  const toggle = () => {
    const next = !enabled;
    onChange(next);
    localStorage.setItem("avatarEnabled", String(next));
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <div className={`w-8 h-4 rounded-full relative transition-colors ${enabled ? "bg-brand" : "bg-gray-300 dark:bg-gray-600"}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-gray-600 dark:text-gray-400">{t("avatar_toggle")}</span>
    </button>
  );
}
