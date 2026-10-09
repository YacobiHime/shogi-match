// 棋譜解析の結果から、対局で指した手の評価値の損(平均損失)を見て、棋力(レーティングと級・段)を推定する。
// 平均損失とCPUのレベルの対応は、現在のレベル表でCPUの着手を測った値から作る(下のlevelForAverageLoss)。
// 解析の探索量や対局の内容で値が動くため、結果は目安として扱う。

import { levelRating } from './player-rating.mjs';
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

/** 1手の損失の上限。1手の大悪手で平均が崩れすぎないようにする。 */
const LOSS_CAP = 1000;
/** 着手前の形勢がこれ以上(どちら向きでも)の局面は、差が付いていて評価値の損が測りにくいので除く。 */
const DECIDED_STANDING = 1500;
/** 診断に必要な、測れる手の数の下限。 */
export const MIN_MEASURED_MOVES = 10;

/**
 * 平均損失(1手1000で打ち切り)からLv(小数)への対応。CPUの着手を同じ基準(30,000nodes)で採点した
 * 平均損失を、Lv12〜35で測り、Lvが損失の対数にほぼ直線で並ぶことから回帰した(2026-10-09、
 * scripts/cpu-humanlike-report.mjs、36局面×3回、Lvごとに108手。残差はおおむね±3Lv)。
 * Lv0〜11は損失の差が小さく、Lv36〜40は損失が35前後で頭打ちになるため、診断はLv0〜36の範囲にする。
 */
const LEVEL_AT_LOSS_1 = 94.59;
const LEVEL_PER_LN_LOSS = -14.41;
const MAX_DIAGNOSED_LEVEL = 36;

/** 平均損失を、Lv(小数)へ変換する。範囲外は両端のLvにそろえる。 */
export function levelForAverageLoss(loss) {
  const level = LEVEL_AT_LOSS_1 + LEVEL_PER_LN_LOSS * Math.log(Math.max(1, loss));
  return Math.min(MAX_DIAGNOSED_LEVEL, Math.max(0, level));
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
