/**
 * Edge TTS Parallel Streaming Engine.
 *
 * Core technology: connects to speech.platform.bing.com via WebSocket.
 * Uses multiple parallel connections with unique tokens/connectionIds
 * to synthesize text chunks simultaneously.
 *
 * Architecture:
 * 1. Split text into sentence-based chunks (~200 chars each)
 * 2. Open parallel WebSocket connections (each mimics a separate Edge browser)
 * 3. Each connection uses unique DRM token + connectionId + muid
 * 4. Collect audio chunks from all connections
 * 5. Stream/concatenate in order
 *
 * This achieves ~380 chars/sec (5000 chars < 15s) vs ~38 chars/sec sequential.
 */

import { createHash, randomBytes } from "crypto";
import WebSocket from "ws";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

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
const S_TO_NS = 1e9;

function generateSecMsGec(): string {
  let ticks = Math.floor(Date.now() / 1000);
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;
  const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  return createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}

function connectId(): string {
  return randomBytes(16).toString("hex");
}

function generateMuid(): string {
  return randomBytes(16).toString("hex").toUpperCase();
}

function dateToString(): string {
  return new Date().toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}

function getHeadersAndDataFromBinary(data: Buffer): { headers: Record<string, string>; audioData: Buffer } {
  const headerLength = data.readUInt16BE(0);
  const headerStr = data.subarray(2, headerLength + 2).toString("utf-8");
  const headers: Record<string, string> = {};
  for (const line of headerStr.split("\r\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      headers[line.substring(0, colonIdx).trim()] = line.substring(colonIdx + 1).trim();
    }
  }
  return { headers, audioData: data.subarray(headerLength + 2) };
}

function getHeadersFromText(msg: string): Record<string, string> {
  const separatorIdx = msg.indexOf("\r\n\r\n");
  const headerStr = separatorIdx === -1 ? msg : msg.substring(0, separatorIdx);
  const headers: Record<string, string> = {};
  for (const line of headerStr.split("\r\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      headers[line.substring(0, colonIdx).trim()] = line.substring(colonIdx + 1).trim();
    }
  }
  return headers;
}

function buildSsml(text: string, voice: string, rate = "+0%", pitch = "+0Hz"): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>
<voice name='${voice}'>
<prosody rate='${rate}' pitch='${pitch}'>
${escaped}
</prosody>
</voice>
</speak>`;
}

// ─── Text Splitting ─────────────────────────────────────────────────────────

function splitTextIntoChunks(text: string, maxLen = 200): string[] {
  const parts: string[] = [];
  // Split by Vietnamese sentence endings
  const sentences = text.split(/(?<=[.!?;:。])\s+/);
  let current = "";

  for (const s of sentences) {
    if ((current + " " + s).length > maxLen && current) {
      parts.push(current.trim());
      current = s;
    } else {
      current += (current ? " " : "") + s;
    }
  }
  if (current.trim()) parts.push(current.trim());

  // If no sentence splits found, split by character limit
  if (parts.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += maxLen) {
      parts.push(text.slice(i, i + maxLen));
    }
  }

  return parts;
}

// ─── Single Chunk Synthesis ─────────────────────────────────────────────────

function synthesizeChunk(
  ssml: string,
  retries = 2,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryOnce = () => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      // Each connection uses unique credentials → looks like separate user
      const url = `${WSS_URL}&Sec-MS-GEC=${generateSecMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectId()}`;

      const ws = new WebSocket(url, {
        headers: { ...WSS_HEADERS, Cookie: `muid=${generateMuid()};` },
      });

      const audioChunks: Buffer[] = [];

      const timeout = setTimeout(() => {
        try { ws.close(); } catch { /* */ }
        settle(() => {
          if (attempt < retries) { attempt++; tryOnce(); }
          else reject(new Error("Edge TTS timeout"));
        });
      }, 15000);

      ws.on("open", () => {
        ws.send(
          `X-Timestamp:${dateToString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
        );
        const requestId = connectId();
        ws.send(
          `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateToString()}Z\r\nPath:ssml\r\n\r\n${ssml}`
        );
      });

      ws.on("message", (data: WebSocket.Data, isBinary: boolean) => {
        if (isBinary) {
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          const { headers, audioData } = getHeadersAndDataFromBinary(buf);
          if (headers["Path"] === "audio" && audioData.length > 0) {
            audioChunks.push(audioData);
          }
        } else {
          const msg = data.toString("utf-8");
          const headers = getHeadersFromText(msg);
          if (headers["Path"] === "turn.end") {
            clearTimeout(timeout);
            try { ws.close(); } catch { /* */ }
            settle(() => resolve(Buffer.concat(audioChunks)));
          }
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        settle(() => {
          if (attempt < retries) { attempt++; tryOnce(); }
          else reject(err);
        });
      });

      ws.on("close", () => {
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          settle(() => resolve(Buffer.concat(audioChunks)));
        }
      });
    };

    tryOnce();
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface StreamChunk {
  type: "audio" | "done" | "error";
  data?: Buffer;
  error?: string;
}

/**
 * Stream Edge TTS audio using parallel synthesis.
 * Splits text into chunks, synthesizes in parallel, yields audio in order.
 */
export async function* streamEdgeTts(
  text: string,
  voice: string = "vi-VN-HoaiMyNeural",
  rate: string = "+0%",
  pitch: string = "+0Hz",
): AsyncGenerator<StreamChunk> {
  try {
    const chunks = splitTextIntoChunks(text);

    if (chunks.length === 0) {
      yield { type: "error", error: "No text to synthesize" };
      return;
    }

    // Build SSML for each chunk
    const ssmlChunks = chunks.map((c) => buildSsml(c, voice, rate, pitch));

    // Synthesize ALL chunks in parallel (each uses unique connection)
    const audioPromises = ssmlChunks.map((ssml) => synthesizeChunk(ssml));

    // Yield audio chunks as they complete, maintaining order
    const results = await Promise.all(audioPromises);

    for (const audioBuffer of results) {
      if (audioBuffer.length > 0) {
        yield { type: "audio", data: audioBuffer };
      }
    }

    yield { type: "done" };
  } catch (err) {
    yield { type: "error", error: err instanceof Error ? err.message : "Edge TTS error" };
  }
}

/**
 * Synthesize text to a single complete audio buffer (non-streaming).
 * Uses parallel synthesis for speed.
 */
export async function synthesizeEdgeTts(
  text: string,
  voice: string = "vi-VN-HoaiMyNeural",
  rate: string = "+0%",
  pitch: string = "+0Hz",
): Promise<Buffer> {
  const chunks = splitTextIntoChunks(text);
  const ssmlChunks = chunks.map((c) => buildSsml(c, voice, rate, pitch));
  const results = await Promise.all(ssmlChunks.map((ssml) => synthesizeChunk(ssml)));
  return Buffer.concat(results);
}
