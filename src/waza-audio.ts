// 技の演出の音(docs/move-waza-design.mdの4-4)。段階ごとの上がる音を、その場で作って鳴らす。
// どの高さを鳴らすかは core/move-waza.mjs の wazaChime。音のファイルを使わない(読み込みを待たない)。
// 効果音のオン/オフ(対局画面のメニューの「効果音」。core/move-sound.tsのSOUND_ENABLED_KEY)がOFFなら鳴らさない。

import { loadSoundEnabled } from "./core/move-sound";

export type WazaNote = { freq: number; at: number; ms: number; gain: number; wave: "sine" | "triangle" };
export type WazaAudio = { play: (plan: WazaNote[], delayMs?: number) => void; close: () => void };

function soundOn() {
  try {
    return loadSoundEnabled(typeof localStorage === "undefined" ? null : localStorage);
  } catch {
    return true;
  }
}

/** AudioContextは最初に鳴らすときに作る(人が画面を押したあとでないと音は出ない)。鳴らせない環境では何もしない。 */
export function createWazaAudio(): WazaAudio {
  let context: AudioContext | null = null;
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
  return {
    play(plan, delayMs = 0) {
      const ctx = ready();
      if (!ctx) return;
      try {
        for (const note of plan) {
          // 立ち上がりを速く、余韻を短く(G:3-3)。
          const start = ctx.currentTime + (delayMs + note.at) / 1000;
          const end = start + note.ms / 1000;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.006);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          gain.connect(ctx.destination);
          const osc = ctx.createOscillator();
          osc.type = note.wave;
          osc.frequency.setValueAtTime(note.freq, start);
          osc.connect(gain);
          osc.start(start);
          osc.stop(end + 0.02);
        }
      } catch {
        // 鳴らせなくても演出は続ける(音だけで意味を伝えない)。
      }
    },
    close() {
      void context?.close().catch(() => undefined);
      context = null;
    },
  };
}
