# Engine notes

## Fish Audio

- Install `fish-audio-sdk>=1.0.0`.
- Set `FISH_API_KEY` locally; never put the value in source control.
- Instant cloning uploads the reference clip and exact transcript to Fish Audio.
- The CLI requests WAV with the current `s2-pro` model, then normalizes locally with FFmpeg.

## VoxCPM2

- Install `voxcpm`; supported Python range is 3.10–3.12.
- The default model is `openbmb/VoxCPM2`.
- First synthesis downloads model weights to the user's Hugging Face cache.
- VoxCPM2 needs roughly 8 GB NVIDIA VRAM. Run `voiceover.py doctor` before selecting it.
- Supplying both prompt audio and its exact transcript gives the strongest cloning mode.

## Engine selection

`auto` selects Fish when `FISH_API_KEY` is present. Otherwise it selects VoxCPM only when the package and NVIDIA runtime are available. It never falls back to an unrelated stock voice.

All output is post-processed to mono 48 kHz PCM WAV at approximately -16 LUFS and no more than -1.5 dB true peak.
