// 脳トレ道場の音の中身(docs/brain-training-design.mdの14-8)。高さ・長さ・音の形だけを決め、鳴らすのはsrc/brain-audio.ts。
// 音のファイルは使わない(ノベルの場面の音と同じく、その場で作る)。立ち上がりを強く、余韻は短く(G:3-3)。
// 演出は楽しく続ける助けとして作り、効果の根拠にはしない(14-3のB31)。

/** 正解の音の高さ。五音音階(ド・レ・ミ・ソ・ラ・高いド・レ・ミ)。続けて正解するたびに1段上がり、8段で止まる。 */
export const BRAIN_SCALE = Object.freeze([523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]);
/** 音の段の数。 */
export const BRAIN_SCALE_STEPS = BRAIN_SCALE.length;
/** どの音も、この長さより短くする(演出は1.5秒以内。U:6)。 */
export const BRAIN_SOUND_MAX_MS = 1500;

/**
 * 続けて正解した数(1から)を、音の段(0から)にする。0以下は最初の段。
 * @param {number} combo
 */
export function comboStep(combo) {
  const count = Number.isFinite(combo) ? Math.floor(combo) : 0;
  return Math.max(0, Math.min(BRAIN_SCALE_STEPS - 1, count - 1));
}

/**
 * @typedef {{ wave: 'sine' | 'triangle' | 'noise', freq: number, to?: number, at: number, ms: number, gain: number }} BrainTone
 * waveは音の形(noiseは帯域で絞った雑音)、freqは高さ(Hz。noiseでは絞る帯域の中心)、toは終わりの高さ、atは鳴り始め(ms)、msは長さ、gainは大きさ。
 */

/** 澄んだ短い音(正解・灯籠)。基の音と、ごく小さな倍音。 */
function bell(freq, ms, gain, at = 0) {
  return [
    { wave: 'sine', freq, at, ms, gain },
    { wave: 'sine', freq: freq * 2, at, ms: Math.round(ms * 0.6), gain: gain * 0.25 },
  ];
}

/**
 * 出来事ごとの音。stepは正解・灯籠の段(0から)。知らない出来事は鳴らさない(空の並び)。
 * @param {string} kind
 * @param {number} [step]
 * @returns {BrainTone[]}
 */
export function brainSoundPlan(kind, step = 0) {
  const at = Math.max(0, Math.min(BRAIN_SCALE_STEPS - 1, Number.isFinite(step) ? Math.floor(step) : 0));
  switch (kind) {
    // 数字キーを押した: ごく小さな「コッ」(重なりすぎないよう短く、小さく。U:5)。
    case 'tick': return [{ wave: 'triangle', freq: 1500, to: 1100, at: 0, ms: 16, gain: 0.035 }];
    // 札を置いた(思い出す・宮殿づくり): 柔らかい「ポッ」。
    case 'place': return [{ wave: 'sine', freq: 700, to: 560, at: 0, ms: 60, gain: 0.07 }];
    // よーい: 短い「ピッ」。
    case 'ready': return [{ wave: 'sine', freq: 880, at: 0, ms: 70, gain: 0.1 }];
    // はじめ: 高い「ピーン」。
    case 'go': return [{ wave: 'sine', freq: 1318.51, at: 0, ms: 170, gain: 0.12 }, { wave: 'sine', freq: 1760, at: 0, ms: 120, gain: 0.03 }];
    // 正解: 続けて正解するほど高くなる澄んだ音。
    case 'correct': return bell(BRAIN_SCALE[at], 130, 0.12);
    // まちがい: 低く柔らかい「ポフ」(責めない)。
    case 'miss': return [{ wave: 'triangle', freq: 233, to: 175, at: 0, ms: 150, gain: 0.09 }];
    // そこまで: 3つの音の短い上り。
    case 'finish': return [...bell(523.25, 110, 0.1, 0), ...bell(659.25, 110, 0.1, 90), ...bell(783.99, 220, 0.11, 180)];
    // 判子: 低い「トン」と紙の音。
    case 'stamp': return [
      { wave: 'triangle', freq: 130, to: 70, at: 0, ms: 190, gain: 0.3 },
      { wave: 'noise', freq: 1400, at: 0, ms: 70, gain: 0.12 },
    ];
    // 自己ベスト: きらっとした上りの3音。
    case 'best': return [...bell(1046.5, 120, 0.1, 0), ...bell(1318.51, 120, 0.1, 80), ...bell(1567.98, 280, 0.11, 160)];
    // 灯籠が灯る: 鈴の音が1段ずつ上がる。
    case 'lantern': return bell(BRAIN_SCALE[at], 220, 0.08);
    default: return [];
  }
}

/** 音の長さ(いちばん遅く鳴り終わる時刻、ms)。 */
export function brainSoundLength(plan) {
  return plan.reduce((end, tone) => Math.max(end, tone.at + tone.ms), 0);
}
