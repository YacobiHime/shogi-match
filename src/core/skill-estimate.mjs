// 棋譜解析の結果から、対局で指した手の評価値の損(平均損失)を見て、棋力(レーティングと級・段)を推定する。
// 平均損失とCPUのレベルの対応は、docs/difficulty-calibration.mdの1手当たりの評価損の測定値
// (Lv1〜25)を基準点にし、その先は目安として延ばした仮の対応である。
// 解析の探索量や対局の内容で値が動くため、結果は目安として扱う。

import { levelRating } from './player-rating.mjs';
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

/** 1手の損失の上限。1手の大悪手で平均が崩れすぎないようにする。 */
const LOSS_CAP = 1000;
/** 着手前の形勢がこれ以上(どちら向きでも)の局面は、差が付いていて評価値の損が測りにくいので除く。 */
const DECIDED_STANDING = 1500;
/** 診断に必要な、測れる手の数の下限。 */
export const MIN_MEASURED_MOVES = 10;

/** [平均損失, Lv]。平均損失が小さいほど強い。Lv1〜25は測定値、Lv32以上は仮の延長。 */
const LOSS_ANCHORS = [
  [1140, 0], [405, 1], [212, 5], [168, 10], [134, 15], [102, 20], [86, 25], [60, 32], [40, 36], [25, 40],
];

/** 平均損失を、Lv(小数)へ変換する。損失の対数で折れ線補間し、範囲外は端のLvにそろえる。 */
export function levelForAverageLoss(loss) {
  const first = LOSS_ANCHORS[0];
  const last = LOSS_ANCHORS.at(-1);
  if (loss >= first[0]) return first[1];
  if (loss <= last[0]) return last[1];
  for (let index = 1; index < LOSS_ANCHORS.length; index += 1) {
    const [lowLoss, highLevel] = LOSS_ANCHORS[index];
    const [highLoss, lowLevel] = LOSS_ANCHORS[index - 1];
    if (loss >= lowLoss) {
      const t = (Math.log(highLoss) - Math.log(loss)) / (Math.log(highLoss) - Math.log(lowLoss));
      return lowLevel + (highLevel - lowLevel) * t;
    }
  }
  return last[1];
}

const presetForLevel = (level) => {
  const rounded = Math.min(40, Math.max(0, Math.round(level)));
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === rounded);
};

/**
 * @param {any[]} points 棋譜解析の点。moveMeasure({ mover, loss, standing })を持つ点だけを使う
 * @param {'black' | 'white'} color 診断する側
 * @returns {{
 *   insufficient: boolean, count: number, averageLoss?: number, level?: number,
 *   rating?: number, ratingLow?: number, ratingHigh?: number, label?: string,
 *   reliability?: 'reference' | 'estimate' | 'stable',
 * }} insufficientが真のときは、countだけを持つ(測れる手が足りない)。
 */
export function estimateSkill(points, color) {
  const losses = (points ?? [])
    .map((point) => point.moveMeasure)
    .filter((measure) => measure && measure.mover === color && Math.abs(measure.standing) < DECIDED_STANDING)
    .map(({ loss }) => Math.min(LOSS_CAP, loss));
  const count = losses.length;
  if (count < MIN_MEASURED_MOVES) return { insufficient: true, count };
  const mean = losses.reduce((sum, loss) => sum + loss, 0) / count;
  const variance = losses.reduce((sum, loss) => sum + (loss - mean) ** 2, 0) / (count - 1);
  const error = Math.sqrt(variance / count);
  const level = levelForAverageLoss(mean);
  const ratingOf = (loss) => Math.round(levelForAverageLoss(Math.max(1, loss)) * 80);
  return {
    insufficient: false,
    count,
    averageLoss: Math.round(mean),
    level,
    rating: Math.round(level * 80),
    // 平均損失の標準誤差ぶんだけ動かした範囲。損が小さいほど強いので、上下が逆になる。
    ratingLow: ratingOf(mean + error),
    ratingHigh: ratingOf(mean - error),
    label: presetForLevel(level).label,
    reliability: count < 20 ? 'reference' : count < 40 ? 'estimate' : 'stable',
  };
}

/** 診断した棋力に近い、CPUのLvのレーティング(おすすめの強さの目安に使う)。 */
export function estimatedLevelRating(estimate) {
  return levelRating(presetForLevel(estimate.level).level);
}

/** 序盤・中盤・終盤を分ける手数。 */
const PHASES = [
  { key: 'opening', label: '序盤', until: 30 },
  { key: 'middle', label: '中盤', until: 80 },
  { key: 'ending', label: '終盤', until: Infinity },
];

/**
 * 棋力測定の結果に添える統計。診断と同じ手(形勢に大差が付いた局面を除く)から、局面ごとの平均損失と、
 * 悪手・好手の数、最も損をした手を数える。悪手・好手の数は、解析が付けた評価(classifyAnalyzedMove)を数える。
 * @param {any[]} points 棋譜解析の点
 * @param {'black' | 'white'} color 測定する側
 */
export function measureStatistics(points, color) {
  const own = (points ?? []).filter((point) => point.moveMeasure?.mover === color);
  const measured = own.filter((point) => Math.abs(point.moveMeasure.standing) < DECIDED_STANDING);
  const phases = PHASES.map(({ key, label, until }, index) => {
    const from = index === 0 ? 0 : PHASES[index - 1].until;
    const losses = measured
      .filter((point) => point.ply > from && point.ply <= until)
      .map((point) => Math.min(LOSS_CAP, point.moveMeasure.loss));
    return {
      key, label, count: losses.length,
      averageLoss: losses.length ? Math.round(losses.reduce((sum, loss) => sum + loss, 0) / losses.length) : null,
    };
  });
  const kinds = { blunder: 0, mistake: 0, dubious: 0, good: 0, brilliant: 0 };
  for (const point of own) {
    const kind = point.annotation?.kind;
    if (kind && kind in kinds) kinds[kind] += 1;
  }
  const worst = measured.reduce((max, point) => (!max || point.moveMeasure.loss > max.moveMeasure.loss ? point : max), null);
  return {
    moves: own.length,
    measuredMoves: measured.length,
    phases,
    kinds,
    worst: worst && worst.moveMeasure.loss >= 300
      ? { ply: worst.ply, label: worst.label ?? `${worst.ply}手目`, loss: Math.round(worst.moveMeasure.loss) }
      : null,
  };
}
