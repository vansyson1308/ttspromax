"use client";

import { useEffect, useRef } from "react";
import type { TimedCue } from "@/lib/speech/subtitles";

interface Props {
  cues: TimedCue[];
  currentMs: number;
  onSeek: (ms: number) => void;
}

/** Karaoke-style transcript: highlights the sentence being spoken; click to seek. */
export default function Transcript({ cues, currentMs, onSeek }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const active = cues.findIndex((c, i) => {
    const next = cues[i + 1];
    return currentMs >= c.startMs - 80 && (next ? currentMs < next.startMs - 80 : currentMs <= c.endMs + 400);
  });

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div className="max-h-56 overflow-y-auto leading-relaxed text-sm pr-1">
      {cues.map((c, i) => (
        <span key={`${c.index}-${c.startMs}`}>
          {i > 0 && c.paragraph !== undefined && c.paragraph !== cues[i - 1].paragraph && <span className="block h-2" />}
          <button
            ref={i === active ? activeRef : undefined}
            type="button"
            onClick={() => onSeek(c.startMs)}
            className={`inline text-left rounded px-0.5 transition-colors ${
              i === active
                ? "bg-brand text-white"
                : i < active
                  ? "text-gray-400 dark:text-gray-500"
                  : "text-gray-700 dark:text-gray-200 hover:bg-brand/10"
            }`}
          >
            {c.text}{" "}
          </button>
        </span>
      ))}
    </div>
  );
}
