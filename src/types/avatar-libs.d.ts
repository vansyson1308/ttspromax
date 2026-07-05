declare module "@met4citizen/talkinghead" {
  export class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    showAvatar(avatar: { url: string; body?: string; lipsyncLang?: string; [key: string]: unknown }, onprogress?: ((e: ProgressEvent) => void) | null): Promise<void>;
    setValue(mt: string, val: number, ms?: number | null): void;
    setMood(s: string): void;
    setView(view: string, opt?: Record<string, unknown> | null): void;
    stop(): void;
    start(): void;
  }
}

declare module "@met4citizen/headaudio" {
  export class HeadAudio extends AudioWorkletNode {
    constructor(ctx: AudioContext, opt?: Record<string, unknown> | null);
    loadModel(url: string, reset?: boolean): Promise<void>;
    update(deltaTimeMs: number): void;
    start(): void;
    stop(): void;
    onvalue: ((key: string, value: number) => void) | null;
    onstarted: ((data: unknown) => void) | null;
    onended: ((data: unknown) => void) | null;
  }
}
