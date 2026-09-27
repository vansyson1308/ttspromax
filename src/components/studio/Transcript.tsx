"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { TimedCue } from "@/lib/speech/subtitles";

interface Props {
  cues: TimedCue[];
  /** The player this transcript follows. */
  audioRef: RefObject<HTMLAudioElement | null>;
}

/**
 * Karaoke-style transcript: highlights the sentence being spoken; click to
 * seek. Owns its playback clock so only this component re-renders per frame.
 */
export default function Transcript({ cues, audioRef }: Props) {
  const [currentMs, setCurrentMs] = useState(0);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    let raf = 0;
    const read = () => setCurrentMs(el.currentTime * 1000);
    const tick = () => {
      read();
      if (!el.paused) raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("seeked", read);
    el.addEventListener("pause", read);
    if (!el.paused) onPlay();
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("seeked", read);
      el.removeEventListener("pause", read);
    };
  }, [audioRef, cues]);

  const active = cues.findIndex((c, i) => {
    const next = cues[i + 1];
    return currentMs >= c.startMs - 80 && (next ? currentMs < next.startMs - 80 : currentMs <= c.endMs + 400);
  });

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  const seek = (ms: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    el.play().catch(() => {});
  };

  return (
    <div className="max-h-56 overflow-y-auto leading-relaxed text-sm pr-1">
      {cues.map((c, i) => (
        <span key={`${c.index}-${c.startMs}`}>
          {i > 0 && c.paragraph !== undefined && c.paragraph !== cues[i - 1].paragraph && <span className="block h-2" />}
          <button
            ref={i === active ? activeRef : undefined}
            type="button"
            onClick={() => seek(c.startMs)}
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
