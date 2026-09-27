/** 評価値を勝率に近い曲線へ変換する尺度。600は評価値と勝率の対応でよく使われる値。 */
export const GRAPH_WIN_RATE_SCALE = 600;

/**
 * 評価値を、グラフの縦位置に使う-1〜1の値へ変換する。
 * 実戦で多い±2000程度の差を広く、大差の局面を端へ寄せて表示する。
 */
export function graphScoreRatio(score, scale = GRAPH_WIN_RATE_SCALE) {
  if (!Number.isFinite(score)) throw new Error('評価値は有限の数値にしてください');
  if (!(scale > 0)) throw new Error('尺度は0より大きくしてください');
  return Math.tanh(score / (scale * 2));
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
