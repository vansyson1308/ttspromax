"use client";

import { useState } from "react";
import type { LexiconEntry } from "@/lib/speech/lexicon";
import { VI_BUILTIN_LEXICON } from "@/lib/speech/lexicon";
import { useTr } from "./i18n";

/** Matches the API limit (api-validators.ts). */
export const MAX_LEXICON_ENTRIES = 500;

interface Props {
  entries: LexiconEntry[];
  onChange: (entries: LexiconEntry[]) => void;
}

/** "Từ điển phát âm" — user pronunciation overrides, stored in localStorage. */
export default function LexiconEditor({ entries, onChange }: Props) {
  const tr = useTr();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showBuiltin, setShowBuiltin] = useState(false);

  const add = () => {
    const f = from.trim();
    const t = to.trim();
    if (!f || !t) return;
    if (entries.length >= MAX_LEXICON_ENTRIES && !entries.some((e) => e.from === f)) return;
    onChange([...entries.filter((e) => e.from !== f), { from: f, to: t }]);
    setFrom("");
    setTo("");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {tr(
          "Dạy AI đọc đúng tên riêng, thương hiệu, từ viết tắt. Ưu tiên cao hơn từ điển có sẵn.",
          "Teach the AI brand names, acronyms and names. Overrides the built-in dictionary.",
        )}
      </p>
      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder={tr("Chữ viết (vd: VinFast)", "Written (e.g. SQL)")}
          maxLength={80}
          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:border-brand"
        />
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={tr("Cách đọc (vd: Vin Phát)", "Spoken (e.g. sequel)")}
          maxLength={200}
          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={!from.trim() || !to.trim() || entries.length >= MAX_LEXICON_ENTRIES}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold disabled:opacity-40"
        >
          {tr("Thêm", "Add")}
        </button>
      </form>

      {entries.length >= MAX_LEXICON_ENTRIES && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {tr(`Đã đạt tối đa ${MAX_LEXICON_ENTRIES} mục.`, `Maximum of ${MAX_LEXICON_ENTRIES} entries reached.`)}
        </p>
      )}
      {entries.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-48 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
          {entries.map((e) => (
            <li key={e.from} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="font-mono font-bold">{e.from}</span>
              <span className="text-gray-400">→</span>
              <span className="flex-1 truncate">{e.to}</span>
              <button
                type="button"
                onClick={() => onChange(entries.filter((x) => x.from !== e.from))}
                className="text-gray-400 hover:text-red-500 text-xs font-bold"
                aria-label={tr("Xoá", "Remove")}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowBuiltin((s) => !s)}
        className="text-xs font-bold text-brand hover:underline"
      >
        {showBuiltin
          ? tr("Ẩn từ điển có sẵn", "Hide built-in dictionary")
          : tr(`Xem ${VI_BUILTIN_LEXICON.length} mục có sẵn (UBND, TP.HCM, GS.TS…)`, `Show ${VI_BUILTIN_LEXICON.length} built-in entries`)}
      </button>
      {showBuiltin && (
        <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
          {VI_BUILTIN_LEXICON.map((e) => (
            <span
              key={e.from}
              className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              <b>{e.from}</b> → {e.to}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
