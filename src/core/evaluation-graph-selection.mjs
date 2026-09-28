/** 詰みを表すグラフ値。評価値の最大値に関係なく、縦軸の端に置く。 */
export const GRAPH_MATE_VALUE = 100000;
/** 互角に近い棋譜でも変化が見えるよう、縦軸の上限はこれより狭めない。 */
export const GRAPH_MIN_AXIS_LIMIT = 1000;
/** この値付近までは評価値に比例させ、それより大きい差はゆるやかに縮める。 */
export const GRAPH_SOFTNESS = 800;
const NICE_AXIS_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];

/** 詰みのグラフ値か。 */
export function isMateGraphValue(value) {
  return Math.abs(value) >= GRAPH_MATE_VALUE;
}

/**
 * 棋譜の評価値に合わせた縦軸の上限を返す。固定の上限は設けず、最大の評価値をキリの良い値へ切り上げる。
 * 詰みは上限の計算に含めない。
 */
export function graphAxisLimit(values = []) {
  const largest = values
    .filter((value) => Number.isFinite(value) && !isMateGraphValue(value))
    .reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (largest <= GRAPH_MIN_AXIS_LIMIT) return GRAPH_MIN_AXIS_LIMIT;
  const magnitude = 10 ** Math.floor(Math.log10(largest));
  const step = NICE_AXIS_STEPS.find((candidate) => candidate * magnitude >= largest) ?? 10;
  return step * magnitude;
}

/**
 * 評価値を、グラフの縦位置に使う-1〜1の値へ変換する。
 * 上限はgraphAxisLimitで棋譜ごとに決め、0付近は比例、大差ほどゆるやかに縮める(asinh)。
 * 上限を超える値と詰みは端に置く。
 */
export function graphScoreRatio(score, limit = GRAPH_MIN_AXIS_LIMIT, softness = GRAPH_SOFTNESS) {
  if (!Number.isFinite(score)) throw new Error('評価値は有限の数値にしてください');
  if (!(limit > 0) || !(softness > 0)) throw new Error('縦軸の上限と尺度は0より大きくしてください');
  const clamped = Math.max(-limit, Math.min(limit, score));
  return Math.asinh(clamped / softness) / Math.asinh(limit / softness);
}

/**
 * 縦軸の目盛りの候補を、表示を優先する順に返す。0と上限を先に置き、画面上で重なる候補は呼び出し側で省く。
 */
export function graphTickValues(limit) {
  const inner = [1000, 3000, 500, 2000, 5000, 10000, 20000, 50000]
    .filter((value) => value < limit);
  return [0, limit, -limit, ...inner.flatMap((value) => [value, -value])];
}

/**
 * 画面上に描画された評価値グラフのプロット領域から、最寄りの手数を返す。
 * SVG全体ではなくプロット領域の実寸を使い、伸縮や余白の影響を受けないようにする。
 */
export function nearestPlyFromPlotPoint(clientX, plotLeft, plotWidth, totalPly) {
  if (![clientX, plotLeft, plotWidth, totalPly].every(Number.isFinite)) {
    throw new Error('グラフ座標は有限の数値にしてください');
  }
  if (plotWidth <= 0) throw new Error('グラフ幅は0より大きくしてください');
  if (!Number.isInteger(totalPly) || totalPly < 0) {
    throw new Error('総手数は0以上の整数にしてください');
  }

  const ratio = Math.max(0, Math.min(1, (clientX - plotLeft) / plotWidth));
  return Math.round(ratio * totalPly);
}
