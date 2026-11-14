// 脳トレ道場の音を、その場で作って鳴らす(docs/brain-training-design.mdの14-8)。どの音を鳴らすかはcore/brain-sound.mjs。
// ノベルの場面の音(novel-audio.ts)と同じ作り方。効果音のオン/オフ(core/move-sound.tsのloadSoundEnabled)がOFFなら鳴らさない。

import { loadSoundEnabled } from "./core/move-sound";
import { brainSoundPlan } from "./core/brain-sound.mjs";
import { MORSE_UNIT_MS, morseTimeline } from "./core/palace-morse.mjs";

export type BrainSoundKind = "tick" | "place" | "ready" | "go" | "correct" | "miss" | "finish" | "stamp" | "best" | "lantern";
type Tone = { wave: "sine" | "triangle" | "noise"; freq: number; to?: number; at: number; ms: number; gain: number };

export type BrainAudio = {
  play: (kind: BrainSoundKind, step?: number) => void;
  /** モールス信号の符号を鳴らす(docs/brain-training-design.mdの17-4)。鳴らす長さ(ミリ秒)を返す(音を消していても返す)。 */
  morse: (code: string, unitMs?: number) => number;
  /** 相手のモールス信号を鳴らす(18-3。自分の音より少し高い)。stopSignalで途中で止められる。 */
  signal: (marks: readonly { at: number; ms: number }[]) => void;
  stopSignal: () => void;
  /** 電鍵を押しているあいだ鳴らす音(18-1)。 */
  keyOn: () => void;
  keyOff: () => void;
  close: () => void;
};
/** モールス信号の音の高さと大きさ。やわらかいピー(正弦波)。 */
const MORSE_FREQ = 700;
const MORSE_GAIN = 0.16;
/** 相手の信号の高さ(自分の音と聞き分けられるよう、少し高く)。 */
const SIGNAL_FREQ = 780;

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

  /** 符号の1つの音。立ち上がりと終わりを5msでならして、プツッという音を消す。 */
  const beep = (ctx: AudioContext, atMs: number, ms: number, freq = MORSE_FREQ) => {
    const start = ctx.currentTime + 0.03 + atMs / 1000;
    const end = start + ms / 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(MORSE_GAIN, start + 0.005);
    gain.gain.setValueAtTime(MORSE_GAIN, Math.max(start + 0.005, end - 0.005));
    gain.gain.linearRampToValueAtTime(0, end);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(gain);
    osc.start(start);
    osc.stop(end + 0.01);
    return osc;
  };

  const morse = (code: string, unitMs = MORSE_UNIT_MS) => {
    const timeline = morseTimeline(code, unitMs);
    const ctx = ready();
    if (ctx) {
      try {
        for (const mark of timeline.marks) beep(ctx, mark.at, mark.ms);
      } catch {
        // 鳴らせなくても遊びは止めない。
      }
    }
    return timeline.total;
  };

  let signalOscs: OscillatorNode[] = [];
  const stopSignal = () => {
    for (const osc of signalOscs) {
      try {
        osc.stop();
      } catch {
        // もう止まっている。
      }
    }
    signalOscs = [];
  };
  const signal = (marks: readonly { at: number; ms: number }[]) => {
    stopSignal();
    const ctx = ready();
    if (!ctx) return;
    try {
      signalOscs = marks.map((mark) => beep(ctx, mark.at, mark.ms, SIGNAL_FREQ));
    } catch {
      // 鳴らせなくても遊びは止めない。
    }
  };

  /** 押しているあいだの音。立ち上がりと終わりを5msでならす。 */
  let held: { osc: OscillatorNode; gain: GainNode } | null = null;
  const keyOn = () => {
    if (held) return;
    const ctx = ready();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(MORSE_GAIN, now + 0.005);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(MORSE_FREQ, now);
      osc.connect(gain);
      osc.start(now);
      held = { osc, gain };
    } catch {
      held = null;
    }
  };
  const keyOff = () => {
    const current = held;
    held = null;
    if (!current || !context) return;
    try {
      const now = context.currentTime;
      current.gain.gain.cancelScheduledValues(now);
      current.gain.gain.setValueAtTime(current.gain.gain.value, now);
      current.gain.gain.linearRampToValueAtTime(0, now + 0.006);
      current.osc.stop(now + 0.02);
    } catch {
      // もう止まっている。
    }
  };

  /** 閉じる。最後の音を切らないよう、少し待ってから閉じる。 */
  const close = () => {
    const ctx = context;
    context = null;
    if (ctx) setTimeout(() => void ctx.close().catch(() => undefined), 400);
  };

  return { play, morse, signal, stopSignal, keyOn, keyOff, close };
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
