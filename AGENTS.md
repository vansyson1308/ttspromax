# AGENTS.md

Guidance for Codex (Codex.ai/code) when working with this repository.

## Project Overview

**TTS Pro** is a Next.js 15 web app that converts text to speech and generates AI Pet News videos. Vietnamese is the primary language focus.

Two main features:

1. **Voice Studio (`/`)** — 350+ voices across 80+ languages with four synthesis paths:
   - **Edge TTS** (Microsoft Neural, server-side) — default, rendered through the Voice Studio pipeline (below)
   - **Gemini TTS** (premium, optional `GEMINI_API_KEY`) — LLM-based, context-aware Vietnamese/English
   - **MakeVoice / ElevenLabs** (premium voices, optional)
   - **ONNX Vietnamese** (client-side via Web Worker; model files are not in the repo)

2. **Pet News (`/pet-news`)** — generates news-style videos where a dog or cat lip-syncs an AI-generated script. Uses TikTok TTS / Edge TTS, COCO-SSD pet detection, HeadAudio + Canvas 2D for mouth animation, and MediaRecorder for video export.

There is also a **3D avatar mode** on the main page that lip-syncs synthesised audio using TalkingHead + HeadAudio (loaded from CDN).

## Commands

```bash
npm install          # First-time setup
npm run dev          # Dev server with Turbopack
npm run build        # Production build
npm start            # Start production server
npm test             # Vitest unit tests (src/**/*.test.ts)
npm run typecheck    # tsc --noEmit
```

No linter is configured yet.

## Architecture

**Framework:** Next.js 15 (App Router), TypeScript, Tailwind v4, React 19. All API routes use `runtime = "nodejs"`.

### Voice Studio pipeline (`src/lib/speech/`)

The core quality work. Edge TTS rejects SSML `<break>`/styles, so pauses are made by
synthesising **one sentence per request** and splicing audio ourselves:

1. `segmenter.ts` — sentences/paragraphs/headlines, abbreviation-aware splitting, manual
   pause tags (`[ngắt 1s]`, `[pause 500ms]`, `<break time="1s"/>`)
2. `lexicon.ts` — pronunciation dictionary (user entries override built-in VN news abbreviations)
3. `vi-normalizer.ts` (in `src/lib`) — numbers, dates, ranges, money, Roman numerals → words
4. `phrasing.ts` — breath commas before connectives in long clauses ("nhưng", "tuy nhiên"…)
5. `planner.ts` — style presets (natural/news/story/podcast/ads): per-sentence rate/pitch and
   boundary-aware pause lengths. Pure; also runs client-side for the "reading preview".
6. `render-edge.ts` + `mp3.ts` — parallel synthesis, trims Edge's 0.4–0.85 s trailing silence
   using word-boundary timestamps, inserts digitally silent MP3 frames (24 ms granularity),
   emits sentence/word cues. `render-gemini.ts` + `wav.ts` do the same for Gemini (PCM).
7. `subtitles.ts` — SRT/VTT export from cues.

`edge-tts-stream.ts` is the low-level Edge client (word boundaries, global concurrency cap,
LRU cache, retries, clock-skew fix). `ws` must stay in `serverExternalPackages` (next.config.ts)
or bundling breaks it.

### TTS API routes (6 active)

| Route | Engine | Used by |
|-------|--------|---------|
| `GET /api/voices` | (data lookup) | Main page voice list |
| `POST /api/tts` | Edge TTS via Voice Studio pipeline | Main page Microsoft voices |
| `GET/POST /api/gemini-tts` | Gemini TTS (optional key) | Main page "PREMIUM AI" voices |
| `POST /api/makevoice-tts` | ElevenLabs via MakeVoice proxy | Main page `type === "makevoice"` voices |
| `POST /api/tiktok-tts` | TikTok proxy | Pet News English voices |
| `GET /api/pet-image` | external proxy | Pet News dog/cat photo loader |

### Key libraries (`src/lib/`)

- `speech/*` — Voice Studio pipeline (see above)
- `edge-tts-stream.ts` — Edge TTS WebSocket client
- `tiktok-tts.ts` + `pet-news-analytics.ts` — TikTok voices + Pet News analytics
- `vi-normalizer.ts` — Vietnamese text normalisation (numbers, dates, currency → words)
- `voices.ts` — Voice grouping by locale
- `audio-pipeline.ts` — AudioContext + SoundTouch pitch worklet for avatar
- `avatar-config.ts` — Avatar URLs + worklet endpoints
- `pet-detector.ts` + `pet-detector-warmup.ts` — COCO-SSD pet detection
- `mouth-renderer.ts` — Canvas 2D mouth shape from visemes
- `video-recorder.ts` — Codec detection + WebM duration fix
- `pet-apis.ts` — Dog/cat photo APIs, weather, Hacker News, cat facts
- `script-generator.ts` + `script-lang-detect.ts` — Pet News script generation
- `error-service.ts` — Centralised error logging
- `i18n.tsx` — Vietnamese / English translations
- `ndjson-audio-stream.ts` — NDJSON audio chunk parser
- `logger.ts` — Wrapper around `console`/`error-service` (silent in production)

### Frontend pages

- `src/app/page.tsx` + `src/components/studio/*` — Voice Studio UI (style panel, pronunciation dictionary, reading preview, karaoke transcript, SRT/VTT export)
- `src/app/pet-news/page.tsx` + `pet-news/components/*` — Pet News UI (PetCanvas, TopicSelector, VoiceSelector, VideoControls, ScriptPreview, NewsOverlay)
- `src/components/avatar/*` — Avatar toggle + 3D container + pitch control

### Data flow

All TTS API routes stream NDJSON (`plan`, `audio_chunk`, `cue`, `progress`, `done`, `error`) and the client assembles the audio chunks into a Blob. The client either plays the Blob through the avatar pipeline (for lip-sync + pitch shift) or via a native `<audio>` element. Pet News additionally records the canvas + audio via MediaRecorder for download.

## Environment variables

All optional — base experience works with no env vars.

- `GEMINI_API_KEY` / `GEMINI_TTS_MODEL` — Enables premium Gemini voices
- `EDGE_TTS_CONCURRENCY` / `EDGE_TTS_CACHE_MB` — Edge client tuning
- `MAKEVOICE_API_KEY` — Required only for MakeVoice / ElevenLabs voices
- `TIKTOK_TTS_PROXY` — Override the default TikTok TTS proxy URL
- `NEXT_TELEMETRY_DISABLED=1`

See `.env.example` for the canonical list.

## Path alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Conventions

- All API routes return either NDJSON (streaming audio) or JSON (errors / metadata)
- Errors are surfaced to the user via `react-hot-toast` with friendly Vietnamese / English microcopy
- Heavy client modules (Avatar, PetCanvas) are dynamically imported with `ssr: false`
- HeadAudio + TalkingHead are loaded from jsdelivr CDN at runtime (intentional — avoids bundler issues with their dynamic imports). Both have **8s timeout + graceful fallback** if the CDN is unreachable.
- API routes validate request bodies with `zod` schemas (see `src/lib/api-validators.ts`).

## Repo-local Codex skill

- `.agents/skills/clone-voice-over` handles authorized voice cloning and Remotion narration.
- Run its `scripts/setup-windows.ps1` before first use.
- Never commit reference voices, generated narration, API keys, virtual environments, or model weights.
- Prefer Fish Audio when `FISH_API_KEY` is configured; otherwise use VoxCPM2 only on a suitable local NVIDIA GPU.

## Removed in 2026-04 audit

The following abandoned backends and features were removed to keep the codebase lean:
Fish Audio, Modal F5-TTS, Azure TTS, SSML editor, Voice Clone (MOSS-TTS), Whisper engine, Model manager. See git history for details.
