---
name: clone-voice-over
description: Create authorized AI voice-cloned narration from reference audio, normalize it for video, and integrate it into a Remotion composition. Use when the user asks to clone a voice, make voice-over or narration from a voice sample, generate Vietnamese cloned speech, add generated speech to a Remotion video, or update a composition's audio and duration.
---

# Clone Voice Over

Create narration only when the user confirms they own the voice or have the speaker's permission. Never impersonate a person deceptively. Keep reference audio, generated audio, API keys, and downloaded models out of Git.

## Workflow

1. Inspect the reference audio, narration text, transcript, and target Remotion project.
2. Obtain explicit confirmation that the voice is authorized before synthesis. Do not infer consent from possession of a file.
3. Require an exact transcript of the reference clip. Ask for it when absent; do not invent one.
4. Run the doctor command:

   ```powershell
   .\.voiceover-venv\Scripts\python.exe .agents\skills\clone-voice-over\scripts\voiceover.py doctor
   ```

5. Select the engine:
   - Use `auto` normally. It prefers Fish Audio when `FISH_API_KEY` exists.
   - Use `fish` when cloud quality is preferred and uploading the reference is acceptable.
   - Use `voxcpm` when the user requests local processing or no Fish key exists. VoxCPM2 downloads its model lazily on first use.
6. Synthesize into the Remotion project:

   ```powershell
   .\.voiceover-venv\Scripts\python.exe .agents\skills\clone-voice-over\scripts\voiceover.py synthesize `
     --reference-audio "C:\path\voice.wav" `
     --reference-text-file "C:\path\reference.txt" `
     --text-file "C:\path\narration.txt" `
     --engine auto `
     --remotion-project "C:\path\video" `
     --composition "NewsVideo" `
     --confirm-authorized-voice
   ```

7. Read the emitted JSON metadata. QC the complete audio before editing video code. Regenerate clipped, garbled, or wrong-language output.
8. Read [references/remotion-integration.md](references/remotion-integration.md), then wire the audio into the requested composition.
9. Run the Remotion project's existing typecheck/build command and inspect the diff. Never overwrite unrelated composition changes.

## Rules

- Default output is `public/audio/voiceover.wav` in the Remotion project and a sibling `.json` metadata file.
- If several compositions exist and the user did not identify one, list their IDs and ask which one to change.
- Compute `durationInFrames` from metadata using `Math.ceil(durationInSeconds * fps)`.
- Prefer a composition prop for the audio path when the project already uses props; otherwise use a constant path with `staticFile()`.
- Preserve intentional intro/outro padding. Do not shorten a composition below its existing non-audio content.
- Report the engine, duration, output path, composition changed, verification run, and any cloud upload.
- Never commit `voice-inputs/`, `voice-outputs/`, generated `public/audio/`, model caches, or `.env*`.

## Setup

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .agents\skills\clone-voice-over\scripts\setup-windows.ps1
```

Pass `-WithLocal` to install VoxCPM2 support. Fish requires a personal `FISH_API_KEY` in the process environment. See [references/engines.md](references/engines.md) only when setup or engine troubleshooting is needed.
