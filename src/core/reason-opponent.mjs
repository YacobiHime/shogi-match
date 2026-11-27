// 自由対局の相手としての将棋AI（論理）(docs/disciple-mode-design.mdの41章)。
// 強さは、師匠の1年の棋士と同じ4つの能力値(読み・作戦・安定・詰み)のLvで選び、4つをそろえて指す。
// 選択肢の言葉に、そのLvがエンジンのCPUのどのLvくらいかを添える(自己対局で測った対応。41-3)。画面・保存の仕組みに依存しない。

import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

/** 選べる能力値のLv(4つをそろえる)。 */
export const REASON_LEVELS = Object.freeze([12, 16, 20, 25, 30, 35, 40, 45, 49]);
/** はじめに選ぶLv。 */
export const DEFAULT_REASON_LEVEL = 25;

/**
 * 能力値のLv(4つとも)と、およそ同じ強さのエンジンのCPUのLv(自己対局で測った点。41-3)。
 * 間は線でつなぐ。
 */
export const REASON_EQUIVALENT = Object.freeze([
  [12, 8], [20, 13], [30, 20], [40, 24], [49, 26],
]);

/** 能力値のLvを、選べる範囲に丸める。 */
export function normalizeReasonLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return DEFAULT_REASON_LEVEL;
  return REASON_LEVELS.reduce((best, lv) => (Math.abs(lv - n) < Math.abs(best - n) ? lv : best), REASON_LEVELS[0]);
}

/**
 * 能力値のLvが、およそどのLvのCPUと同じ強さか(小数)。
 * @param {number} level
 */
export function reasonEquivalentLevel(level) {
  const lv = Number(level);
  const table = REASON_EQUIVALENT;
  if (lv <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i += 1) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (lv <= x1) return y0 + ((y1 - y0) * (lv - x0)) / (x1 - x0);
  }
  return table.at(-1)[1];
}

/** CPUのLvの段級位の名前(強さの表の名前)。 */
function gradeOf(cpuLevel) {
  const level = Math.round(cpuLevel);
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)?.label ?? `Lv.${level}`;
}

/**
 * 強さの選択肢(選択シートの1行ずつ)。
 * @returns {{ value: number, label: string, description: string }[]}
 */
export function reasonStrengthOptions() {
  return REASON_LEVELS.map((level) => ({
    value: level,
    label: `能力Lv.${level}`,
    description: `CPUの${gradeOf(reasonEquivalentLevel(level))}`,
  }));
}

/** 対局で使う4つの能力値(そろえる)。 */
export function reasonLevels(level) {
  const lv = normalizeReasonLevel(level);
  return { reading: lv, plan: lv, steady: lv, mate: lv };
}

/** 画面の言葉(対局相手の行・名前・強さの行)。 */
export const REASON_OPPONENT_TEXT = Object.freeze({
  name: '将棋AI（論理）',
  pick: '将棋AI（論理）と対局',
  pickNote: '理由を考えて指すAI。師匠の1年の棋士と同じ考え方',
  row: '将棋AI（論理）',
  strength: '強さ（能力値）',
  note: '駒の損得と形を数手先まで読み、人がよく指す手を選ぶAIだよ。レーティングには数えないよ。',
});
