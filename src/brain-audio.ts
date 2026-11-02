// 脳トレ道場の音を、その場で作って鳴らす(docs/brain-training-design.mdの14-8)。どの音を鳴らすかはcore/brain-sound.mjs。
// ノベルの場面の音(novel-audio.ts)と同じ作り方。効果音のオン/オフ(core/move-sound.tsのloadSoundEnabled)がOFFなら鳴らさない。

import { loadSoundEnabled } from "./core/move-sound";
import { brainSoundPlan } from "./core/brain-sound.mjs";

export type BrainSoundKind = "tick" | "place" | "ready" | "go" | "correct" | "miss" | "finish" | "stamp" | "best" | "lantern";
type Tone = { wave: "sine" | "triangle" | "noise"; freq: number; to?: number; at: number; ms: number; gain: number };

export type BrainAudio = {
  play: (kind: BrainSoundKind, step?: number) => void;
  close: () => void;
};

function soundOn() {
  try {
    return loadSoundEnabled(typeof localStorage === "undefined" ? null : localStorage);
  } catch {
    return true;
  }
}

/**
 * 音を鳴らす道具。AudioContextは最初に鳴らすときに作る(ブラウザは、人が画面を押したあとでないと音を出さない)。
 * 鳴らせない環境(AudioContextがない・止められている)では、何もしない。
 */
export function createBrainAudio(): BrainAudio {
  let context: AudioContext | null = null;
  let noise: AudioBuffer | null = null;

  const ready = () => {
    if (!soundOn()) return null;
    try {
      if (!context) {
        const Ctor = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
        if (!Ctor) return null;
        context = new Ctor();
      }
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      return context;
    } catch {
      return null;
    }
  };

  const noiseBuffer = (ctx: AudioContext) => {
    if (noise && noise.sampleRate === ctx.sampleRate) return noise;
    const length = Math.floor(ctx.sampleRate * 0.08);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return noise;
  };

  /** 1つの音。立ち上がりを速く(4ms)、余韻は指数で短く消す(G:3-3)。 */
  const tone = (ctx: AudioContext, plan: Tone) => {
    const start = ctx.currentTime + plan.at / 1000;
    const end = start + plan.ms / 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, plan.gain), start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(ctx.destination);
    if (plan.wave === "noise") {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(plan.freq, start);
      filter.Q.setValueAtTime(1.2, start);
      source.connect(filter);
      filter.connect(gain);
      source.start(start);
      source.stop(end + 0.01);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = plan.wave;
    osc.frequency.setValueAtTime(plan.freq, start);
    if (plan.to) osc.frequency.exponentialRampToValueAtTime(plan.to, end);
    osc.connect(gain);
    osc.start(start);
    osc.stop(end + 0.01);
  };

  const play = (kind: BrainSoundKind, step = 0) => {
    const ctx = ready();
    if (!ctx) return;
    try {
      for (const plan of brainSoundPlan(kind, step) as Tone[]) tone(ctx, plan);
    } catch {
      // 鳴らせなくても遊びは止めない。
    }
  };

  /** 閉じる。最後の音を切らないよう、少し待ってから閉じる。 */
  const close = () => {
    const ctx = context;
    context = null;
    if (ctx) setTimeout(() => void ctx.close().catch(() => undefined), 400);
  };

  return { play, close };
}

let shared: BrainAudio | null = null;

/** 道場のどの部品からも同じ音の道具を使う(AudioContextを1つにする)。 */
export function brainAudio(): BrainAudio {
  if (!shared) shared = createBrainAudio();
  return shared;
}

/** 道場を閉じたとき。次に鳴らすときに作り直す。 */
export function closeBrainAudio() {
  shared?.close();
  shared = null;
}
