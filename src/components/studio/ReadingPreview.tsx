"use client";

import type { ScriptPlan } from "@/lib/speech/planner";
import { useTr } from "./i18n";

/**
 * Shows exactly how the text will be read: expanded numbers/abbreviations,
 * inserted breath commas, and every pause with its length.
 */
export default function ReadingPreview({ plan }: { plan: ScriptPlan }) {
  const tr = useTr();
  if (!plan.segments.length) {
    return <p className="text-sm text-gray-400">{tr("Chưa có nội dung.", "Nothing to read yet.")}</p>;
  }
  return (
    <div className="text-sm leading-relaxed space-y-1 max-h-72 overflow-y-auto pr-1">
      {plan.segments.map((s) => (
        <div key={s.index}>
          {s.index > 0 && s.pauseBeforeMs > 0 && (
            <span
              className={`inline-block mr-1 px-1.5 py-0.5 rounded text-[10px] font-black align-middle ${
                s.manualPause
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-brand/10 text-brand"
              }`}
              title={tr("Khoảng lặng trước câu", "Silence before sentence")}
            >
              ⏸ {(s.pauseBeforeMs / 1000).toFixed(2)}s
            </span>
          )}
          {s.type === "heading" && (
            <span className="mr-1 text-[10px] font-black uppercase text-pink-600">{tr("Tiêu đề", "Headline")}</span>
          )}
          <span className={s.type === "heading" ? "font-bold" : ""}>{s.spoken}</span>
        </div>
      ))}
      {plan.trailingPauseMs > 0 && (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700">
          ⏸ {(plan.trailingPauseMs / 1000).toFixed(2)}s
        </span>
      )}
    </div>
  );
}
