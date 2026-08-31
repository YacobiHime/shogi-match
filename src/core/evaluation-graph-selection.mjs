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
