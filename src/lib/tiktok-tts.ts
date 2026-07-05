/**
 * TikTok TTS client.
 *
 * Splits long text into ≤300 char chunks at sentence boundaries,
 * fetches each chunk in parallel via /api/tiktok-tts proxy,
 * concatenates base64 MP3 → single Blob.
 */

export interface PetVoice {
  code: string;
  name: string;
  emoji: string;
  engine: "tiktok" | "edge" | "vieneu";
  lang: "vi" | "en";  // Language the voice speaks
  edgeVoiceId?: number;
  vieneuVoice?: string;  // VieNeu preset voice name
}

// Vietnamese voices — TikTok (fast, same API as English) + VieNeu (AI natural) + Edge (fallback)
export const VI_VOICES: PetVoice[] = [
  // TikTok Vietnamese — same reliable API as English voices
  { code: "BV074_streaming", name: "Chi Vi (TikTok)", emoji: "\uD83C\uDDFB\uD83C\uDDF3", engine: "tiktok", lang: "vi" },
  { code: "BV075_streaming", name: "Anh Vi (TikTok)", emoji: "\uD83C\uDDFB\uD83C\uDDF3", engine: "tiktok", lang: "vi" },
  // VieNeu-TTS — AI natural voices (may be slow, HuggingFace GPU queue)
  { code: "vieneu-bichngoc", name: "Bích Ngọc (AI)", emoji: "\uD83E\uDDE0", engine: "vieneu", lang: "vi", vieneuVoice: "Bích Ngọc (Nữ - Miền Bắc)" },
  { code: "vieneu-phamtuyen", name: "Phạm Tuyên (AI)", emoji: "\uD83E\uDDE0", engine: "vieneu", lang: "vi", vieneuVoice: "Phạm Tuyên (Nam - Miền Bắc)" },
  { code: "vieneu-thucdoan", name: "Thục Đoan (AI)", emoji: "\uD83E\uDDE0", engine: "vieneu", lang: "vi", vieneuVoice: "Thục Đoan (Nữ - Miền Nam)" },
  { code: "vieneu-xuanvinh", name: "Xuân Vĩnh (AI)", emoji: "\uD83E\uDDE0", engine: "vieneu", lang: "vi", vieneuVoice: "Xuân Vĩnh (Nam - Miền Nam)" },
  // Edge TTS — fast, always available, IDs hardcoded from voices.json
  { code: "vi-VN-HoaiMyNeural", name: "Hoài My (Edge)", emoji: "\uD83D\uDD0A", engine: "edge", lang: "vi", edgeVoiceId: 336 },
  { code: "vi-VN-NamMinhNeural", name: "Nam Minh (Edge)", emoji: "\uD83D\uDD0A", engine: "edge", lang: "vi", edgeVoiceId: 337 },
];

// English voices (TikTok TTS) — funny/meme characters
export const EN_VOICES: PetVoice[] = [
  { code: "en_us_ghostface", name: "Ghostface", emoji: "\uD83D\uDC7B", engine: "tiktok", lang: "en" },
  { code: "en_us_rocket", name: "Rocket", emoji: "\uD83D\uDE80", engine: "tiktok", lang: "en" },
  { code: "en_us_stitch", name: "Stitch", emoji: "\uD83D\uDC7E", engine: "tiktok", lang: "en" },
  { code: "en_us_stormtrooper", name: "Stormtrooper", emoji: "\u2694\uFE0F", engine: "tiktok", lang: "en" },
  { code: "en_us_c3po", name: "C-3PO", emoji: "\uD83E\uDD16", engine: "tiktok", lang: "en" },
  { code: "en_male_pirate", name: "Pirate", emoji: "\uD83C\uDFF4\u200D\u2620\uFE0F", engine: "tiktok", lang: "en" },
  { code: "en_male_funny", name: "Wacky", emoji: "\uD83E\uDD2A", engine: "tiktok", lang: "en" },
  { code: "en_male_wizard", name: "Wizard", emoji: "\uD83E\uDDD9", engine: "tiktok", lang: "en" },
  { code: "en_female_grandma", name: "Grandma", emoji: "\uD83D\uDC75", engine: "tiktok", lang: "en" },
  { code: "en_male_grinch", name: "Grinch", emoji: "\uD83D\uDE08", engine: "tiktok", lang: "en" },
  { code: "en_male_narration", name: "Narrator", emoji: "\uD83C\uDFA4", engine: "tiktok", lang: "en" },
  { code: "en_male_deadpool", name: "Deadpool", emoji: "\uD83D\uDDE1\uFE0F", engine: "tiktok", lang: "en" },
  { code: "en_male_jarvis", name: "Jarvis", emoji: "\uD83D\uDDA5\uFE0F", engine: "tiktok", lang: "en" },
];

export const ALL_VOICES: PetVoice[] = [...VI_VOICES, ...EN_VOICES];

const MAX_CHUNK_SIZE = 280;

/** Split text into chunks ≤ MAX_CHUNK_SIZE at sentence/phrase boundaries. */
function splitText(text: string): string[] {
  if (text.length <= MAX_CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_CHUNK_SIZE) {
    // Find last sentence break within limit
    let splitIdx = -1;
    for (const sep of [". ", "! ", "? ", ", ", "; ", " "]) {
      const idx = remaining.lastIndexOf(sep, MAX_CHUNK_SIZE);
      if (idx > 50) { // Don't split too early
        splitIdx = idx + sep.length;
        break;
      }
    }
    if (splitIdx === -1) splitIdx = MAX_CHUNK_SIZE;

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

/** Fetch TTS for a single chunk. Returns base64 MP3 string. */
async function fetchChunk(text: string, voice: string): Promise<string> {
  const res = await fetch("/api/tiktok-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  const data = await res.json();
  if (!data.success || !data.data) {
    throw new Error(data.error || "TikTok TTS failed");
  }
  return data.data; // base64 MP3
}

/** Convert base64 string to ArrayBuffer. */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

/**
 * Generate TTS audio from text using TikTok voices.
 * Handles text splitting, parallel fetching, and MP3 concatenation.
 */
export async function tiktokTTS(text: string, voice: string): Promise<Blob> {
  const chunks = splitText(text);

  // Fetch all chunks (sequential to maintain order — parallel can cause ordering issues)
  const base64Parts: string[] = [];
  for (const chunk of chunks) {
    const b64 = await fetchChunk(chunk, voice);
    base64Parts.push(b64);
  }

  // Concatenate MP3 buffers
  const buffers = base64Parts.map(base64ToArrayBuffer);
  const totalSize = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const buf of buffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  return new Blob([combined], { type: "audio/mpeg" });
}

/**
 * Edge TTS fetch for Vietnamese voices.
 * Uses existing /api/tts endpoint with NDJSON streaming.
 */
async function edgeTTS(text: string, voiceId: number): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, id: voiceId }),
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buf = "";
  const audioChunks: ArrayBuffer[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.status === "audio_chunk" && msg.chunk) {
          const bin = atob(msg.chunk);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          audioChunks.push(bytes.buffer as ArrayBuffer);
        }
      } catch { /* skip */ }
    }
  }

  if (audioChunks.length === 0) throw new Error("No audio from Edge TTS");
  return new Blob(audioChunks, { type: "audio/mpeg" });
}

/**
 * Fetch TTS via VieNeu-TTS (HuggingFace Gradio API).
 * Returns audio Blob with natural Vietnamese voice.
 */
async function vieneuTTS(text: string, vieneuVoice: string): Promise<Blob> {
  const res = await fetch("/api/vieneu-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: vieneuVoice }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "VieNeu TTS failed" }));
    throw new Error(err.error || `VieNeu TTS error: ${res.status}`);
  }

  return res.blob();
}

/**
 * Unified TTS for Pet News — auto-selects engine based on voice.
 * VieNeu → natural Vietnamese, Edge → fast fallback (hardcoded ID), TikTok → English funny.
 */
export async function petNewsTTS(text: string, voice: PetVoice): Promise<Blob> {
  if (voice.engine === "vieneu" && voice.vieneuVoice) {
    return vieneuTTS(text, voice.vieneuVoice);
  }
  if (voice.engine === "edge") {
    if (!voice.edgeVoiceId) {
      throw new Error(`Vietnamese voice ${voice.code} has no configured Edge TTS ID`);
    }
    return edgeTTS(text, voice.edgeVoiceId);
  }
  return tiktokTTS(text, voice.code);
}
