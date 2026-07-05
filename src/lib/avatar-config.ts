/** Avatar and audio pipeline configuration paths */

export const AVATAR_CONFIG = {
  avatarUrl: "/avatars/default-avatar.glb",
  headAudioModelUrl: "/models/model-en-mixed.bin",
  headWorkletUrl: "/worklets/headworklet.mjs",
  soundTouchWorkletUrl: "/worklets/soundtouch-processor.js",
  defaultPitchSemitones: 0,
  minPitch: -12,
  maxPitch: 12,
} as const;
