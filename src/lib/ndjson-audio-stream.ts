/**
 * Shared NDJSON audio stream parser.
 *
 * Reads an NDJSON response stream and calls handlers for each message type:
 * - audio_chunk: base64 audio data → decoded ArrayBuffer
 * - done: generation complete (optional url)
 * - error: error message
 * - processing: status update
 */

export interface NdjsonMessage {
  status: string;
  chunk?: string;
  url?: string;
  message?: string;
  model?: string;
  [key: string]: unknown;
}

export interface NdjsonHandlers {
  onAudioChunk?: (buffer: ArrayBuffer) => void;
  onDone?: (msg: NdjsonMessage) => void;
  onError?: (msg: NdjsonMessage) => void;
  onMessage?: (msg: NdjsonMessage) => void;
}

/** Decode a base64 string to ArrayBuffer */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

/**
 * Read an NDJSON audio stream from a fetch Response.
 * Collects all audio chunks and returns them along with the final message.
 */
export async function readNdjsonAudioStream(
  response: Response,
  handlers?: NdjsonHandlers,
): Promise<{ audioChunks: ArrayBuffer[]; finalMessage?: NdjsonMessage }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  const audioChunks: ArrayBuffer[] = [];
  let finalMessage: NdjsonMessage | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg: NdjsonMessage = JSON.parse(line);
        handlers?.onMessage?.(msg);

        if (msg.status === "audio_chunk" && msg.chunk) {
          const ab = base64ToArrayBuffer(msg.chunk);
          audioChunks.push(ab);
          handlers?.onAudioChunk?.(ab);
        } else if (msg.status === "done") {
          finalMessage = msg;
          handlers?.onDone?.(msg);
        } else if (msg.status === "error") {
          handlers?.onError?.(msg);
        }
      } catch (parseErr) {
        if (parseErr instanceof SyntaxError) continue;
        throw parseErr;
      }
    }
  }

  return { audioChunks, finalMessage };
}
