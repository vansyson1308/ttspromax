/**
 * Video recorder: captures canvas + audio into downloadable video.
 *
 * Supports:
 * - Native browser codec detection (vp9, vp8, h264, mp4)
 * - Correct file extension matching actual container
 * - fix-webm-duration for WebM metadata correction
 * - MP4 fallback when browser supports it natively
 */

import fixWebmDuration from "fix-webm-duration";

export interface RecordingCapability {
  supported: boolean;
  risky: boolean;
  reason: string;
}

/**
 * Assess whether the current browser can actually record video.
 * Checks MediaRecorder, canvas.captureStream, and AudioContext availability.
 */
export function assessRecordingCapability(): RecordingCapability {
  // SSR guard — capabilities are browser-only.
  if (typeof window === "undefined") {
    return { supported: false, risky: false, reason: "Server-side rendering." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  const AudioCtx = win.AudioContext || win.webkitAudioContext;

  if (typeof MediaRecorder === "undefined") {
    return { supported: false, risky: false, reason: "MediaRecorder API not available in this browser." };
  }
  // canvas.captureStream is the mechanism to capture video from canvas
  const canvas = document.createElement("canvas");
  if (typeof canvas.captureStream !== "function") {
    return { supported: false, risky: false, reason: "Canvas captureStream not available." };
  }
  if (!AudioCtx) {
    return { supported: false, risky: false, reason: "AudioContext not available." };
  }

  // All APIs present — check codec support
  const hasCodec = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=h264,aac",
  ].some((m) => MediaRecorder.isTypeSupported(m));

  if (!hasCodec) {
    return { supported: true, risky: true, reason: "No guaranteed codec supported. Recording may fail or produce unplayable files." };
  }

  return { supported: true, risky: false, reason: "" };
}

export interface RecordingFormat {
  mimeType: string;
  extension: string;
  /** Whether this browser supports the codec natively */
  isNative: boolean;
}

export interface RecordingSession {
  mediaRecorder: MediaRecorder;
  chunks: Blob[];
  startTime: number;
  format: RecordingFormat;
}

/**
 * Detect the best supported MediaRecorder mime type for video recording.
 * Returns format info including the correct file extension.
 */
export function detectRecordingFormat(): RecordingFormat {
  // Try MP4/H264 first (best compatibility for social platforms)
  const mp4Candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];

  for (const mime of mp4Candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return { mimeType: mime, extension: "mp4", isNative: true };
    }
  }

  // Fall back to WebM with various codecs
  const webmCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  for (const mime of webmCandidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return { mimeType: mime, extension: "webm", isNative: true };
    }
  }

  // Last resort: no codec hint
  if (typeof MediaRecorder !== "undefined") {
    return { mimeType: "video/webm", extension: "webm", isNative: true };
  }

  // MediaRecorder not supported at all
  return { mimeType: "video/webm", extension: "webm", isNative: false };
}

/**
 * Check if the current browser has limited export compatibility.
 * Returns true when ONLY WebM is available (Safari, some mobile browsers).
 */
export function isWebMOnly(): boolean {
  const fmt = detectRecordingFormat();
  return fmt.extension === "webm";
}

export function startRecording(
  canvas: HTMLCanvasElement,
  audioCtx: AudioContext,
  audioSource: AudioNode,
  format?: RecordingFormat,
): RecordingSession {
  const chosen = format ?? detectRecordingFormat();

  // Video track from canvas
  const videoStream = canvas.captureStream(30);

  // Audio track from Web Audio
  const audioDest = audioCtx.createMediaStreamDestination();
  audioSource.connect(audioDest);

  // Merge tracks
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const mediaRecorder = new MediaRecorder(combined, { mimeType: chosen.mimeType });
  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start(100); // Chunk every 100ms

  return { mediaRecorder, chunks, startTime: Date.now(), format: chosen };
}

export async function stopRecording(session: RecordingSession): Promise<Blob> {
  return new Promise((resolve) => {
    session.mediaRecorder.onstop = async () => {
      const duration = Date.now() - session.startTime;
      const rawBlob = new Blob(session.chunks, { type: session.format.mimeType });

      // Fix duration metadata only for WebM
      if (session.format.extension === "webm") {
        try {
          const fixedBlob = await fixWebmDuration(rawBlob, duration, { logger: false });
          resolve(fixedBlob);
        } catch {
          // If fix-webm fails, return raw blob
          resolve(rawBlob);
        }
      } else {
        // MP4 doesn't need fix-webm
        resolve(rawBlob);
      }
    };
    session.mediaRecorder.stop();
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a download filename with the correct extension for the recording format.
 */
export function recordingFilename(baseName: string, format: RecordingFormat): string {
  return `${baseName}.${format.extension}`;
}
