/**
 * Edge TTS client (Microsoft Neural voices via the Edge "Read Aloud" endpoint).
 *
 * One call = one WebSocket = one sentence. Besides MP3 audio, every call
 * returns word-boundary timestamps, which the render pipeline uses to trim
 * Edge's ~0.4–0.85 s trailing silence and splice exact pauses, and to build
 * word-accurate subtitles.
 *
 * Production concerns handled here:
 *   - global concurrency cap (don't open 50 sockets for one request)
 *   - LRU cache (editing one sentence only re-synthesises that sentence)
 *   - retries with backoff; SSML rejections (close 1007) fail fast
 *   - Sec-MS-GEC clock-skew correction on HTTP 403
 *
 * Note: this endpoint accepts exactly one <voice> with one <prosody>.
 * <break>, <emphasis> and mstts:express-as are rejected ("SSML is invalid").
 */

import { createHash, randomBytes } from "crypto";
import WebSocket from "ws";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
export const EDGE_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

const WSS_HEADERS: Record<string, string> = {
  "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9",
  Pragma: "no-cache",
  "Cache-Control": "no-cache",
  Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
  "Sec-WebSocket-Version": "13",
};

const WIN_EPOCH = 11644473600;
const TIMEOUT_MS = 20_000;
const MAX_CONCURRENCY = Number(process.env.EDGE_TTS_CONCURRENCY) || 6;
const CACHE_BYTES = (Number(process.env.EDGE_TTS_CACHE_MB) || 64) * 1024 * 1024;

/** Seconds to add to the local clock (learned from server Date on 403). */
let clockSkewSec = 0;

function generateSecMsGec(): string {
  let ticks = Math.floor(Date.now() / 1000 + clockSkewSec);
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  const strToHash = `${ticks}0000000${TRUSTED_CLIENT_TOKEN}`;
  return createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}

const randomHex = () => randomBytes(16).toString("hex");

function dateToString(): string {
  return new Date().toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}

function parseHeaders(block: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of block.split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function escapeXml(text: string): string {
  return text
    // XML 1.0 forbids most C0 control chars; one pasted \x01 would make Edge
    // reject the whole request as invalid SSML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Locale for xml:lang, taken from the voice ShortName ("en-US-AvaNeural"). */
function voiceLocale(voice: string): string {
  const m = voice.match(/^([a-z]{2,3}-[A-Z]{2})/);
  return m ? m[1] : "en-US";
}

export function buildSsml(text: string, voice: string, rate = "+0%", pitch = "+0Hz", volume = "+0%"): string {
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voiceLocale(voice)}'>` +
    `<voice name='${escapeXml(voice)}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
    `${escapeXml(text)}</prosody></voice></speak>`
  );
}

// ─── Public types ───────────────────────────────────────────────────────────

export interface WordMark {
  text: string;
  /** Offset from start of this clip, ms. */
  startMs: number;
  endMs: number;
}

export interface EdgeClip {
  audio: Buffer;
  words: WordMark[];
  /** False when the socket closed before turn.end (audio may be truncated). */
  complete: boolean;
}

export interface EdgeRequest {
  text: string;
  voice: string;
  rate?: string;
  pitch?: string;
  volume?: string;
}

export class EdgeTtsError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "EdgeTtsError";
  }
}

// ─── Concurrency limiter (process-wide) ─────────────────────────────────────

let active = 0;
const waiters: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENCY) {
    // The releasing caller hands its slot over directly (see finally), so a
    // newcomer can't grab it between release and wake-up.
    await new Promise<void>((resolve) => waiters.push(resolve));
  } else {
    active++;
  }
  try {
    return await fn();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else active--;
  }
}

// ─── LRU cache ──────────────────────────────────────────────────────────────

const cache = new Map<string, EdgeClip>();
let cacheBytes = 0;

function cacheKey(r: EdgeRequest): string {
  return createHash("sha1")
    .update(`${r.voice}|${r.rate}|${r.pitch}|${r.volume}|${r.text}`)
    .digest("hex");
}

function cacheGet(key: string): EdgeClip | undefined {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function cachePut(key: string, clip: EdgeClip) {
  if (!clip.complete || clip.audio.length > CACHE_BYTES / 8) return;
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cacheBytes -= existing.audio.length;
  }
  cache.set(key, clip);
  cacheBytes += clip.audio.length;
  while (cacheBytes > CACHE_BYTES && cache.size) {
    const [oldKey, old] = cache.entries().next().value as [string, EdgeClip];
    cache.delete(oldKey);
    cacheBytes -= old.audio.length;
  }
}

// ─── Single request ─────────────────────────────────────────────────────────

function requestOnce(ssml: string): Promise<EdgeClip> {
  return new Promise((resolve, reject) => {
    const url = `${WSS_URL}&Sec-MS-GEC=${generateSecMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${randomHex()}`;
    const ws = new WebSocket(url, {
      headers: { ...WSS_HEADERS, Cookie: `muid=${randomHex().toUpperCase()};` },
    });

    const audio: Buffer[] = [];
    const words: WordMark[] = [];
    let settled = false;

    const finish = (err: EdgeTtsError | null, complete = true) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.terminate();
      } catch {
        /* already closed */
      }
      if (err) reject(err);
      else resolve({ audio: Buffer.concat(audio), words, complete });
    };

    const timer = setTimeout(() => finish(new EdgeTtsError("Edge TTS timeout", true)), TIMEOUT_MS);

    ws.on("unexpected-response", (_req, res) => {
      const serverDate = res.headers.date ? Date.parse(res.headers.date) : NaN;
      if (res.statusCode === 403 && Number.isFinite(serverDate)) {
        clockSkewSec = (serverDate - Date.now()) / 1000;
      }
      finish(new EdgeTtsError(`Edge TTS handshake failed (HTTP ${res.statusCode})`, true));
    });

    ws.on("open", () => {
      try {
        ws.send(
          `X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
            `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"${EDGE_OUTPUT_FORMAT}"}}}}`,
        );
        ws.send(
          `X-RequestId:${randomHex()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`,
        );
      } catch (err) {
        finish(new EdgeTtsError(err instanceof Error ? err.message : "Edge TTS send failed", false));
      }
    });

    ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        if (buf.length < 2) return;
        const headerLength = buf.readUInt16BE(0);
        const headers = parseHeaders(buf.subarray(2, headerLength + 2).toString("utf-8"));
        const payload = buf.subarray(headerLength + 2);
        if (headers["Path"] === "audio" && payload.length > 0) audio.push(payload);
        return;
      }
      const msg = data.toString();
      const sep = msg.indexOf("\r\n\r\n");
      const headers = parseHeaders(sep === -1 ? msg : msg.slice(0, sep));
      if (headers["Path"] === "audio.metadata" && sep !== -1) {
        try {
          const meta = JSON.parse(msg.slice(sep + 4)) as {
            Metadata?: Array<{ Type: string; Data: { Offset: number; Duration: number; text: { Text: string } } }>;
          };
          for (const m of meta.Metadata ?? []) {
            if (m.Type !== "WordBoundary") continue;
            // Offsets are in 100-ns ticks.
            const startMs = m.Data.Offset / 10_000;
            words.push({ text: m.Data.text.Text, startMs, endMs: startMs + m.Data.Duration / 10_000 });
          }
        } catch {
          /* ignore malformed metadata */
        }
      } else if (headers["Path"] === "turn.end") {
        finish(audio.length ? null : new EdgeTtsError("Edge TTS returned no audio", true));
      }
    });

    ws.on("close", (code: number, reason: Buffer) => {
      if (settled) return;
      if (code === 1007) {
        finish(new EdgeTtsError(`Edge TTS rejected the request: ${reason.toString() || "invalid SSML"}`, false));
      } else if (audio.length) {
        finish(null, false); // usable, but never cached
      } else {
        finish(new EdgeTtsError(`Edge TTS connection closed (${code})`, true));
      }
    });

    ws.on("error", (err: Error) => finish(new EdgeTtsError(err.message, true)));
  });
}

const inflight = new Map<string, Promise<EdgeClip>>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Synthesize one short text (ideally one sentence) with retries and caching.
 */
export async function synthesizeClip(req: EdgeRequest, retries = 3): Promise<EdgeClip> {
  const full: Required<EdgeRequest> = {
    text: req.text,
    voice: req.voice,
    rate: req.rate ?? "+0%",
    pitch: req.pitch ?? "+0Hz",
    volume: req.volume ?? "+0%",
  };
  const key = cacheKey(full);
  const hit = cacheGet(key);
  if (hit) return hit;
  // Identical sentences requested concurrently share one socket.
  const running = inflight.get(key);
  if (running) return running;
  const job = synthesizeUncached(full, key, retries).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function synthesizeUncached(full: Required<EdgeRequest>, key: string, retries: number): Promise<EdgeClip> {
  const ssml = buildSsml(full.text, full.voice, full.rate, full.pitch, full.volume);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const clip = await withSlot(() => requestOnce(ssml));
      cachePut(key, clip);
      return clip;
    } catch (err) {
      lastErr = err;
      if (err instanceof EdgeTtsError && !err.retryable) break;
      if (attempt < retries) await sleep(300 * 2 ** attempt + Math.random() * 200);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Edge TTS failed");
}
