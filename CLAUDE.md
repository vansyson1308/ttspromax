# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**TTS Pro** is a Next.js 15 web app that converts text to speech and generates AI Pet News videos. Vietnamese is the primary language focus.

Two main features:

1. **Main TTS page (`/`)** — 350+ voices across 80+ languages with three synthesis paths:
   - **ONNX Vietnamese** (client-side via Web Worker, native quality)
   - **Edge TTS** (Microsoft Neural, server-side streaming) — default for non-Vietnamese
   - **MakeVoice / ElevenLabs** (premium voices, optional)

2. **Pet News (`/pet-news`)** — generates news-style videos where a dog or cat lip-syncs an AI-generated script. Uses TikTok TTS / Edge TTS, COCO-SSD pet detection, HeadAudio + Canvas 2D for mouth animation, and MediaRecorder for video export.

There is also a **3D avatar mode** on the main page that lip-syncs synthesised audio using TalkingHead + HeadAudio (loaded from CDN).

## Commands

```bash
npm install          # First-time setup
npm run dev          # Dev server with Turbopack
npm run build        # Production build
npm start            # Start production server
```

No test suite or linter is configured yet.

## Architecture

**Framework:** Next.js 15 (App Router), TypeScript, Tailwind v4, React 19. All API routes use `runtime = "nodejs"`.

### TTS API routes (5 active)

| Route | Engine | Used by |
|-------|--------|---------|
| `GET /api/voices` | (data lookup) | Main page voice list |
| `POST /api/tts` | Edge TTS (Microsoft Neural) | Main page non-ONNX voices |
| `POST /api/makevoice-tts` | ElevenLabs via MakeVoice proxy | Main page `type === "makevoice"` voices |
| `POST /api/tiktok-tts` | TikTok proxy | Pet News English voices |
| `GET /api/pet-image` | external proxy | Pet News dog/cat photo loader |

### Key libraries (`src/lib/`)

- `edge-tts-stream.ts` — Edge TTS NDJSON streaming
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

- `src/app/page.tsx` — Main TTS UI (single client component)
- `src/app/pet-news/page.tsx` + `pet-news/components/*` — Pet News UI (PetCanvas, TopicSelector, VoiceSelector, VideoControls, ScriptPreview, NewsOverlay)
- `src/components/avatar/*` — Avatar toggle + 3D container + pitch control

### Data flow

All TTS API routes stream NDJSON audio chunks server-side and the client assembles them into a Blob. The client either plays the Blob through the avatar pipeline (for lip-sync + pitch shift) or via a native `<audio>` element. Pet News additionally records the canvas + audio via MediaRecorder for download.

## Environment variables

All optional — base experience works with no env vars.

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

## Removed in 2026-04 audit

The following abandoned backends and features were removed to keep the codebase lean:
Fish Audio, Modal F5-TTS, Azure TTS, SSML editor, Voice Clone (MOSS-TTS), Whisper engine, Model manager. See git history for details.
