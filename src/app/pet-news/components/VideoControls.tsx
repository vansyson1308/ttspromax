"use client";

import { useLang } from "@/lib/i18n";

interface Props {
  isGenerating: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  hasScript: boolean;
  hasVideo: boolean;
  videoFormat: string;
  scriptTooLong: boolean;
  recordingNotSupported: boolean;
  recordingRisky: boolean;
  onGenerate: () => void;
  onPlay: () => void;
  onRecord: () => void;
  onDownload: () => void;
  status: string;
}

export default function VideoControls({
  isPlaying, isRecording, hasScript, hasVideo, videoFormat, scriptTooLong, recordingNotSupported, recordingRisky,
  onPlay, onRecord, onDownload, status,
}: Props) {
  const { t } = useLang();
  const busy = isPlaying || isRecording;
  // Block playback/recording when script exceeds length limit
  const blocked = scriptTooLong;

  return (
    <div className="space-y-3">
      {status && (
        <div role="status" aria-live="polite" className="text-sm font-bold text-brand animate-pulse text-center">{status}</div>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Play Preview */}
        {hasScript && (
          <button
            onClick={onPlay}
            disabled={busy || blocked}
            aria-label={`Preview video playback${blocked ? " — blocked: script too long" : ""}`}
            title={blocked ? t("script_too_long") : ""}
            className="flex-1 min-w-[140px] py-3 rounded-xl font-black text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isPlaying ? t("playing") : t("btn_play_preview")}
          </button>
        )}

        {/* Recording risky warning */}
        {hasScript && recordingRisky && !recordingNotSupported && (
          <div className="w-full text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {"⚠️"} Your browser may have limited recording support. The video might not play on all devices.
          </div>
        )}

        {/* Record */}
        {hasScript && (
          <button
            onClick={onRecord}
            disabled={busy || blocked || recordingNotSupported}
            aria-label={`Record video${isRecording ? " in progress" : ""}${blocked ? " — blocked: script too long" : ""}${recordingNotSupported ? " — not supported in this browser" : ""}`}
            aria-busy={isRecording}
            title={blocked ? t("script_too_long") : recordingNotSupported ? "Recording is not supported in this browser" : ""}
            className="flex-1 min-w-[140px] py-3 rounded-xl font-black text-white bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isRecording ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
                {t("recording")}
              </span>
            ) : t("btn_record")}
          </button>
        )}

        {/* Download */}
        {hasVideo && (
          <button
            onClick={onDownload}
            aria-label={`Download ${videoFormat} video`}
            className="flex-1 min-w-[140px] py-3 rounded-xl font-black text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
          >
            {t("btn_download")} ({videoFormat})
          </button>
        )}
      </div>
    </div>
  );
}
