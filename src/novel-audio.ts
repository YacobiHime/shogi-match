// ノベルの場面の文字の音とクリックの音を、その場で作って鳴らす(docs/novel-scene-design.mdの11章)。
// 音のファイルを使わない(読み込みを待たない・版権の心配がない・話す人ごとに高さを変えられる)。どの音を鳴らすかはcore/novel-sound.mjs。
// 効果音のオン/オフ(対局画面のメニューの「効果音」。core/move-sound.tsのSOUND_ENABLED_KEY)がOFFなら鳴らさない。

import { loadSoundEnabled } from "./core/move-sound";

type BlipPlan = { kind: "signal" | "type"; freq: number; ms: number; gain: number };
type ClickPlan = { from: number; to: number; ms: number; gain: number };

export type NovelAudio = {
  blip: (plan: BlipPlan) => void;
  click: (plan: ClickPlan) => void;
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
export function createNovelAudio(): NovelAudio {
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

  /** 立ち上がりを速く、余韻を短く(G:3-3)。 */
  const envelope = (ctx: AudioContext, gain: number, ms: number) => {
    const node = ctx.createGain();
    const start = ctx.currentTime;
    const end = start + ms / 1000;
    node.gain.setValueAtTime(0.0001, start);
    node.gain.exponentialRampToValueAtTime(gain, start + 0.004);
    node.gain.exponentialRampToValueAtTime(0.0001, end);
    node.connect(ctx.destination);
    return { node, start, end };
  };

  const noiseBuffer = (ctx: AudioContext) => {
    if (noise && noise.sampleRate === ctx.sampleRate) return noise;
    const length = Math.floor(ctx.sampleRate * 0.05);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return noise;
  };

  const blip = (plan: BlipPlan) => {
    const ctx = ready();
    if (!ctx) return;
    try {
      const { node, start, end } = envelope(ctx, plan.gain, plan.ms);
      if (plan.kind === "signal") {
        // 信号: 柔らかい正弦波の「ピッ」(モールス信号の音)。
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(plan.freq, start);
        osc.connect(node);
        osc.start(start);
        osc.stop(end + 0.01);
        return;
      }
      // タイプ: 雑音を帯域で絞った短い「カタ」と、低い打鍵の芯。
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(plan.freq, start);
      filter.Q.setValueAtTime(1.4, start);
      source.connect(filter);
      filter.connect(node);
      source.start(start);
      source.stop(end + 0.01);
      const thunk = ctx.createOscillator();
      const thunkGain = envelope(ctx, plan.gain * 0.6, plan.ms * 0.8);
      thunk.type = "triangle";
      thunk.frequency.setValueAtTime(190, start);
      thunk.connect(thunkGain.node);
      thunk.start(start);
      thunk.stop(thunkGain.end + 0.01);
    } catch {
      // 鳴らせなくても読むのは止めない。
    }
  };

  const click = (plan: ClickPlan) => {
    const ctx = ready();
    if (!ctx) return;
    try {
      // 柔らかい「ポッ」: 高い音から少し下がる正弦波。
      const { node, start, end } = envelope(ctx, plan.gain, plan.ms);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(plan.from, start);
      osc.frequency.exponentialRampToValueAtTime(plan.to, end);
      osc.connect(node);
      osc.start(start);
      osc.stop(end + 0.01);
    } catch {
      // 鳴らせなくても操作は止めない。
    }
  };

  /** 閉じる。最後に押した音(「おわり」「戻る」)を切らないよう、少し待ってから閉じる。 */
  const close = () => {
    const ctx = context;
    context = null;
    if (ctx) setTimeout(() => void ctx.close().catch(() => undefined), 300);
  };

  return { blip, click, close };
}
