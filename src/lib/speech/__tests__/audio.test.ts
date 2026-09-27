import { describe, expect, it } from "vitest";
import { concatBytes, parseMp3, silence, silentFrame, sliceMp3 } from "../mp3";
import { encodeWav, parseWav, speechBounds } from "../wav";
import { chunkText, splitCue, toSrt, toVtt, wrapLines } from "../subtitles";
import { groupBlocks } from "../render-gemini";
import { planScript } from "../planner";

// Edge TTS header: MPEG-2 Layer III, 48 kbps, 24 kHz, mono.
const EDGE_HEADER = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]);

describe("mp3", () => {
  it("builds 144-byte silent frames of 24 ms for Edge output", () => {
    expect(silentFrame(EDGE_HEADER).length).toBe(144);
    const s = silence(EDGE_HEADER, 500);
    const parsed = parseMp3(s);
    expect(parsed.frames.length).toBe(21); // round(500/24)
    expect(parsed.durationMs).toBeCloseTo(504, 0);
    expect(parsed.sampleRate).toBe(24000);
  });
  it("slices trailing frames and skips garbage/ID3", () => {
    const id3 = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 2, 0xaa, 0xbb]);
    const buf = concatBytes([id3, silence(EDGE_HEADER, 240)]);
    const parsed = parseMp3(buf);
    expect(parsed.frames.length).toBe(10);
    const cut = sliceMp3(buf, parsed, 100);
    expect(parseMp3(cut).frames.length).toBe(5); // ceil(100/24)
  });
});

describe("wav", () => {
  it("round-trips PCM and finds speech bounds", () => {
    const sr = 24000;
    const quiet = new Int16Array(sr / 10);
    const loud = new Int16Array(sr / 5).map((_, i) => Math.round(Math.sin(i / 5) * 8000));
    const wav = encodeWav([quiet, loud, quiet], sr);
    const pcm = parseWav(wav);
    expect(pcm.sampleRate).toBe(sr);
    expect(pcm.samples.length).toBe(quiet.length * 2 + loud.length);
    const { start, end } = speechBounds(pcm);
    expect(start).toBe(quiet.length);
    expect(end).toBe(quiet.length + loud.length);
  });
});

describe("subtitles", () => {
  it("chunks long sentences and wraps into two lines", () => {
    const text =
      "Giá vàng trong nước sáng nay tăng thêm năm trăm nghìn đồng mỗi lượng, lên mức cao nhất trong lịch sử từ trước tới nay.";
    const chunks = chunkText(text);
    expect(chunks.every((c) => c.length <= 84)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
    expect(wrapLines(chunks[0]).split("\n").every((l) => l.length <= 42)).toBe(true);
  });
  it("times split cues from word marks", () => {
    const words = "một hai ba bốn năm sáu bảy tám chín mười".split(" ").map((w, i) => ({
      text: w,
      startMs: i * 1000,
      endMs: i * 1000 + 800,
    }));
    const cues = splitCue({ index: 0, text: "a ".repeat(60).trim(), startMs: 0, endMs: 9800, words }, 40);
    expect(cues.length).toBe(3);
    expect(cues[0].startMs).toBe(0);
    expect(cues[cues.length - 1].endMs).toBe(9800);
    for (let i = 1; i < cues.length; i++) expect(cues[i].startMs).toBeGreaterThanOrEqual(cues[i - 1].endMs);
  });
  it("formats SRT and VTT", () => {
    const cues = [{ index: 0, text: "Xin chào.", startMs: 120, endMs: 1500 }];
    expect(toSrt(cues)).toBe("1\n00:00:00,120 --> 00:00:01,500\nXin chào.\n");
    expect(toVtt(cues)).toBe("WEBVTT\n\n00:00:00.120 --> 00:00:01.500\nXin chào.\n");
  });
});

describe("gemini blocks", () => {
  it("groups sentences per paragraph and splits on manual pauses", () => {
    const plan = planScript("Tiêu đề bản tin\nCâu một. Câu hai.\n[pause 1s]\nCâu ba.\n\nĐoạn hai.", {
      lang: "vi",
      normalize: false,
    });
    const blocks = groupBlocks(plan.segments);
    expect(blocks.map((b) => b.text)).toEqual(["Tiêu đề bản tin", "Câu một. Câu hai.", "Câu ba.", "Đoạn hai."]);
    expect(blocks[2].pauseBeforeMs).toBe(1000);
  });
});

describe("subtitle chunk balance", () => {
  it("does not leave one-word orphans", () => {
    const text =
      "In other news, scientists say this year's Arctic summer ice was among the lowest on record.";
    const chunks = chunkText(text);
    expect(chunks.length).toBe(2);
    expect(Math.min(...chunks.map((c) => c.length))).toBeGreaterThan(25);
  });
});
