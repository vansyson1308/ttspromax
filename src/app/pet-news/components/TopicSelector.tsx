"use client";

import { useLang } from "@/lib/i18n";

export type Topic = "weather" | "tech" | "catfacts" | "custom";

const TOPICS: { id: Topic; icon: string; color: string }[] = [
  { id: "weather", icon: "\u2600\uFE0F", color: "from-amber-400 to-orange-500" },
  { id: "tech", icon: "\uD83D\uDCBB", color: "from-blue-400 to-cyan-500" },
  { id: "catfacts", icon: "\uD83D\uDC3E", color: "from-pink-400 to-rose-500" },
  { id: "custom", icon: "\u270F\uFE0F", color: "from-purple-400 to-indigo-500" },
];

interface Props {
  selected: Topic;
  onChange: (topic: Topic) => void;
}

export default function TopicSelector({ selected, onChange }: Props) {
  const { t } = useLang();

  return (
    <div className="grid grid-cols-2 gap-3">
      {TOPICS.map(({ id, icon, color }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-pressed={selected === id}
          aria-label={`Topic: ${t(`topic_${id}`)}`}
          className={`p-4 rounded-xl font-bold text-left transition-all border-2 ${
            selected === id
              ? "border-brand ring-2 ring-brand/30 bg-white dark:bg-dark-card shadow-lg scale-[1.02]"
              : "border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg hover:border-gray-300"
          }`}
        >
          <div className={`text-2xl mb-1 w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${color} text-white`}>
            {icon}
          </div>
          <span className="text-sm">{t(`topic_${id}`)}</span>
        </button>
      ))}
    </div>
  );
}
