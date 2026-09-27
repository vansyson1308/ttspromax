/**
 * Minimal MPEG audio (Layer III) frame toolkit.
 *
 * Edge TTS returns constant-bitrate MP3 without Xing/ID3 headers, which means
 * the stream is just a sequence of self-describing frames. Working at frame
 * level lets us — without decoding a single sample —
 *   - measure exact duration,
 *   - trim the long trailing silence Edge appends to every request,
 *   - splice precise pauses by inserting digitally silent frames.
 *
 * Frame granularity for Edge's `audio-24khz-48kbitrate-mono-mp3` is 24 ms,
 * which is well below the ~50 ms threshold listeners notice in pause timing.
 *
 * Pure module: runs in Node and the browser (Uint8Array only).
 */

export interface Mp3Frame {
  offset: number;
  size: number;
  /** PCM samples decoded from this frame (576 or 1152). */
  samples: number;
  sampleRate: number;
}

export interface Mp3Stream {
  frames: Mp3Frame[];
  /** First frame header (4 bytes) — used as template for silent frames. */
  header: Uint8Array | null;
  sampleRate: number;
  samplesPerFrame: number;
  durationMs: number;
}

// Bitrates (kbps) indexed by [isMpeg1][bitrateIndex] for Layer III.
const BITRATES_L3: Record<"v1" | "v2", number[]> = {
  v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};

const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

interface HeaderInfo {
  size: number;
  samples: number;
  sampleRate: number;
  mono: boolean;
  mpeg1: boolean;
}

function readHeader(buf: Uint8Array, off: number): HeaderInfo | null {
  if (off + 4 > buf.length) return null;
  const b1 = buf[off + 1];
  const b2 = buf[off + 2];
  const b3 = buf[off + 3];
  if (buf[off] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const version = (b1 >> 3) & 0x03; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5, 1 = reserved
  const layer = (b1 >> 1) & 0x03; // 1 = Layer III
  if (version === 1 || layer !== 1) return null;

  const bitrateIdx = (b2 >> 4) & 0x0f;
  const srIdx = (b2 >> 2) & 0x03;
  if (bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) return null;

  const mpeg1 = version === 3;
  const bitrate = BITRATES_L3[mpeg1 ? "v1" : "v2"][bitrateIdx] * 1000;
  const sampleRate = SAMPLE_RATES[version][srIdx];
  const padding = (b2 >> 1) & 0x01;
  const samples = mpeg1 ? 1152 : 576;
  const size = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
  const mono = ((b3 >> 6) & 0x03) === 3;
  return { size, samples, sampleRate, mono, mpeg1 };
}

function skipId3(buf: Uint8Array): number {
  if (buf.length >= 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    return 10 + size;
  }
  return 0;
}

/** Parse all Layer III frames. Garbage between frames is skipped (resync). */
export function parseMp3(buf: Uint8Array): Mp3Stream {
  const frames: Mp3Frame[] = [];
  let off = skipId3(buf);
  let header: Uint8Array | null = null;
  let totalSamples = 0;
  let sampleRate = 0;
  let samplesPerFrame = 0;

  while (off + 4 <= buf.length) {
    const h = readHeader(buf, off);
    if (!h || off + h.size > buf.length) {
      off++;
      continue;
    }
    if (!header) {
      header = buf.slice(off, off + 4);
      sampleRate = h.sampleRate;
      samplesPerFrame = h.samples;
    }
    frames.push({ offset: off, size: h.size, samples: h.samples, sampleRate: h.sampleRate });
    totalSamples += h.samples;
    off += h.size;
  }

  return {
    frames,
    header,
    sampleRate,
    samplesPerFrame,
    durationMs: sampleRate ? (totalSamples / sampleRate) * 1000 : 0,
  };
}

/** Duration of one frame in ms for a given stream (24 ms for Edge output). */
export function frameMs(stream: Pick<Mp3Stream, "sampleRate" | "samplesPerFrame">): number {
  return stream.sampleRate ? (stream.samplesPerFrame / stream.sampleRate) * 1000 : 0;
}

/**
 * Build one digitally silent frame matching `header`.
 * An all-zero side-info block means part2_3_length = 0 and global_gain = 0,
 * i.e. every granule decodes to zeros. main_data_begin = 0 keeps the bit
 * reservoir independent, so silent frames can be spliced anywhere.
 */
export function silentFrame(header: Uint8Array): Uint8Array {
  const h = new Uint8Array(header);
  h[2] &= ~0x02; // clear padding bit
  h[1] |= 0x01; // protection bit = 1 → no CRC
  const info = readHeader(h, 0);
  if (!info) throw new Error("Invalid MP3 header template");
  const frame = new Uint8Array(info.size);
  frame.set(h, 0);
  return frame;
}

/** Concatenate `count` silent frames. */
export function silence(header: Uint8Array, ms: number): Uint8Array {
  const info = readHeader(header, 0);
  if (!info || ms <= 0) return new Uint8Array(0);
  const perFrame = (info.samples / info.sampleRate) * 1000;
  const count = Math.round(ms / perFrame);
  if (count <= 0) return new Uint8Array(0);
  const frame = silentFrame(header);
  const out = new Uint8Array(frame.length * count);
  for (let i = 0; i < count; i++) out.set(frame, i * frame.length);
  return out;
}

/**
 * Keep only frames whose start lies before `endMs`.
 * Trailing trims are safe with the bit reservoir: frames only borrow bits
 * from *earlier* frames, never later ones.
 */
export function sliceMp3(buf: Uint8Array, stream: Mp3Stream, endMs: number): Uint8Array {
  const perFrame = frameMs(stream);
  if (!perFrame || !stream.frames.length) return buf;
  const keep = Math.min(stream.frames.length, Math.max(1, Math.ceil(endMs / perFrame)));
  if (keep >= stream.frames.length) {
    const last = stream.frames[stream.frames.length - 1];
    return buf.subarray(stream.frames[0].offset, last.offset + last.size);
  }
  const lastKept = stream.frames[keep - 1];
  return buf.subarray(stream.frames[0].offset, lastKept.offset + lastKept.size);
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
