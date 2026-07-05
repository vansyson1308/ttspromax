# TTS Pro

Browser-based text-to-speech, AI Pet News, and a repo-local Codex workflow for authorized voice-over production.

- 350+ voices across 80+ languages through Microsoft Edge TTS and Vietnamese ONNX voices.
- Pet News turns a cat or dog photo into a lip-synced news video.
- A Codex skill creates authorized cloned narration with Fish Audio or local VoxCPM2 and can integrate it into Remotion.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. For production:

```bash
npm run build
npm start
```

A multi-stage `Dockerfile` is included for container deployments.

## Codex voice-over skill

Codex discovers `.agents/skills/clone-voice-over` when opened at the repository root. Ask it to create an authorized cloned voice-over from a reference clip and optionally wire the output into a Remotion composition.

Prepare its isolated Python environment on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .agents\skills\clone-voice-over\scripts\setup-windows.ps1
# Add -WithLocal to install VoxCPM2. Model weights download on first local use.
```

Fish Audio is preferred when `FISH_API_KEY` is set. Generated audio, reference clips, model weights, and local environment files are intentionally ignored by Git.

## Features

### Main TTS page (`/`)

- Search voices by country and language.
- Vietnamese ONNX voices run client-side when their optional local model files are present.
- Other voices stream through Edge TTS or the optional MakeVoice integration.
- A 3D avatar can lip-sync generated audio with pitch shifting.

### Pet News (`/pet-news`)

- Load a cat or dog photo through a CORS-safe proxy.
- Generate Weather, Tech, Cat Facts, or custom scripts.
- Preview or record a downloadable video.
- COCO-SSD auto-framing, body animation, overlays, particles, and lip-sync are built in.

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript 5 |
| Styling | Tailwind v4 |
| TTS | Edge TTS, optional ONNX, MakeVoice, TikTok TTS |
| Voice clone | Fish Audio SDK or local VoxCPM2 through the Codex skill |
| Animation | TalkingHead, HeadAudio, Canvas 2D |
| Detection | TensorFlow.js and COCO-SSD |
| Recording | MediaRecorder and `fix-webm-duration` |

See `AGENTS.md` for the source map and repository conventions.

## Configuration

Copy `.env.example` to `.env.local`. Do not commit real credentials.

```text
MAKEVOICE_API_KEY       # ElevenLabs voices via MakeVoice (optional)
TIKTOK_TTS_PROXY        # TikTok proxy override (optional)
FISH_API_KEY            # Codex cloud voice cloning (optional)
NEXT_TELEMETRY_DISABLED # Disable Next.js telemetry
```

The base web experience works without environment variables. Fish Audio requires each user to supply their own key.

## Project history

The web application was audited and slimmed down in April 2026. Broken browser and server voice-clone backends were removed. Historical reports remain under `docs/archive/2026-04-pre-audit/`; the current supported cloning path is the repo-local Codex skill.
