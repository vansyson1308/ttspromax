/**
 * 16-bit PCM / WAV helpers for engines that return raw audio (Gemini).
 * With PCM we can trim silence sample-accurately and splice exact pauses.
 */

export interface Pcm16 {
  /** Mono little-endian 16-bit samples. */
  samples: Int16Array;
  sampleRate: number;
}

/** Parse a RIFF/WAVE buffer; falls back to treating input as raw PCM. */
export function parseWav(buf: Uint8Array, fallbackRate = 24_000): Pcm16 {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
  if (buf.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    return { samples: toInt16(buf), sampleRate: fallbackRate };
  }
  let sampleRate = fallbackRate;
  let channels = 1;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = tag(off);
    const size = view.getUint32(off + 4, true);
    const body = off + 8;
    if (id === "fmt ") {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
    } else if (id === "data") {
      const end = Math.min(buf.length, body + (size || buf.length - body));
      let samples = toInt16(buf.subarray(body, end));
      if (channels > 1) samples = downmix(samples, channels);
      return { samples, sampleRate };
    }
    off = body + size + (size % 2);
  }
  return { samples: new Int16Array(0), sampleRate };
}

function toInt16(bytes: Uint8Array): Int16Array {
  const n = Math.floor(bytes.length / 2);
  const out = new Int16Array(n);
  const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true);
  return out;
}

function downmix(interleaved: Int16Array, channels: number): Int16Array {
  const frames = Math.floor(interleaved.length / channels);
  const out = new Int16Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += interleaved[f * channels + c];
    out[f] = Math.round(sum / channels);
  }
  return out;
}

/**
 * Find where speech starts/ends: first/last 10 ms window whose peak exceeds
 * `threshold` (≈ -40 dBFS by default). Returns sample indices.
 */
export function speechBounds(pcm: Pcm16, threshold = 330): { start: number; end: number } {
  const win = Math.max(1, Math.round(pcm.sampleRate / 100));
  const s = pcm.samples;
  const loud = (i: number) => {
    for (let j = i; j < Math.min(i + win, s.length); j++) if (Math.abs(s[j]) > threshold) return true;
    return false;
  };
  let start = 0;
  while (start < s.length && !loud(start)) start += win;
  let end = s.length;
  while (end > start && !loud(Math.max(0, end - win))) end -= win;
  return { start: Math.min(start, s.length), end: Math.max(start, end) };
}

export function silenceSamples(ms: number, sampleRate: number): Int16Array {
  return new Int16Array(Math.max(0, Math.round((ms / 1000) * sampleRate)));
}

/** Short linear fades to avoid clicks at cut points. */
export function fadeEdges(samples: Int16Array, sampleRate: number, ms = 8): Int16Array {
  const n = Math.min(Math.round((ms / 1000) * sampleRate), Math.floor(samples.length / 2));
  const out = samples.slice();
  for (let i = 0; i < n; i++) {
    const g = i / n;
    out[i] = Math.round(out[i] * g);
    out[out.length - 1 - i] = Math.round(out[out.length - 1 - i] * g);
  }
  return out;
}

export function encodeWav(chunks: Int16Array[], sampleRate: number): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new Uint8Array(44 + total * 2);
  const view = new DataView(buf.buffer);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => (buf[o + i] = ch.charCodeAt(0)));
  w(0, "RIFF");
  view.setUint32(4, 36 + total * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, total * 2, true);
  let off = 44;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++, off += 2) view.setInt16(off, c[i], true);
  }
  return buf;
}
