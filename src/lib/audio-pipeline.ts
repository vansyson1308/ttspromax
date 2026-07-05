/**
 * Web Audio pipeline for lip-sync and voice morphing.
 *
 * Audio flow:
 *   AudioBufferSourceNode
 *     ├→ headAudioNode (set by AvatarContainer — viseme analysis, no audio output)
 *     └→ SoundTouch worklet (pitch shift) → GainNode → destination (speakers)
 *
 * Pipeline only manages: AudioContext, SoundTouch, GainNode.
 * HeadAudio node is injected externally by AvatarContainer.
 */

import { AVATAR_CONFIG } from "./avatar-config";

export interface AudioPipeline {
  ctx: AudioContext;
  gainNode: GainNode;
  headAudioNode: AudioNode | null;
  soundTouchNode: AudioWorkletNode | null;
  currentSource: AudioBufferSourceNode | null;
  isPlaying: boolean;
}

let _pipeline: AudioPipeline | null = null;

export async function getOrCreatePipeline(): Promise<AudioPipeline> {
  if (_pipeline) return _pipeline;

  const ctx = new AudioContext();
  await ctx.resume();

  // Register SoundTouch worklet only — HeadAudio is managed by AvatarContainer
  await ctx.audioWorklet.addModule(AVATAR_CONFIG.soundTouchWorkletUrl);

  // SoundTouch node: pitch shifting
  const soundTouchNode = new AudioWorkletNode(ctx, "soundtouch-processor");

  // Gain node → speakers
  const gainNode = ctx.createGain();
  soundTouchNode.connect(gainNode);
  gainNode.connect(ctx.destination);

  _pipeline = {
    ctx,
    gainNode,
    headAudioNode: null, // Set by AvatarContainer when avatar is ready
    soundTouchNode,
    currentSource: null,
    isPlaying: false,
  };

  return _pipeline;
}

export async function playAudioBlob(blob: Blob): Promise<void> {
  const pipeline = await getOrCreatePipeline();

  // Stop previous playback
  if (pipeline.currentSource) {
    try { pipeline.currentSource.stop(); } catch { /* already stopped */ }
    pipeline.currentSource.disconnect();
  }

  await pipeline.ctx.resume();

  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await pipeline.ctx.decodeAudioData(arrayBuffer);

  const source = pipeline.ctx.createBufferSource();
  source.buffer = audioBuffer;

  // Connect to HeadAudio if avatar is active (analysis only, no audio output)
  if (pipeline.headAudioNode) {
    source.connect(pipeline.headAudioNode);
  }

  // Connect to SoundTouch → speakers (audio output path)
  if (pipeline.soundTouchNode) {
    source.connect(pipeline.soundTouchNode);
  }

  pipeline.currentSource = source;
  pipeline.isPlaying = true;

  return new Promise<void>((resolve) => {
    source.onended = () => {
      pipeline.isPlaying = false;
      pipeline.currentSource = null;
      resolve();
    };
    source.start(0);
  });
}

export function setPitch(semitones: number) {
  if (!_pipeline?.soundTouchNode) return;
  const param = _pipeline.soundTouchNode.parameters.get("pitchSemitones");
  if (param) {
    param.value = semitones;
  }
}

export function stopPlayback() {
  if (!_pipeline?.currentSource) return;
  try { _pipeline.currentSource.stop(); } catch { /* already stopped */ }
  _pipeline.currentSource.disconnect();
  _pipeline.currentSource = null;
  _pipeline.isPlaying = false;
}

export function destroyPipeline() {
  if (!_pipeline) return;
  stopPlayback();
  _pipeline.ctx.close();
  _pipeline = null;
}
