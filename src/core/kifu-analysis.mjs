const GRAPH_SCORE_LIMIT = 2000;
const MATE_GRAPH_SCORE = GRAPH_SCORE_LIMIT;

/** USIエンジンの手番側評価を、評価値グラフ用の先手視点へ揃える。 */
export function scoreForBlack(score, sideToMove) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return undefined;
  }
  const value = sideToMove === 'black' ? score.value : -score.value;
  return { type: score.type, value };
}

/** 詰みを含む評価値を、±2000のグラフ座標へ変換する。 */
export function scoreToGraphValue(score) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return undefined;
  }
  if (score.type === 'mate') {
    if (score.value === 0) return 0;
    return Math.sign(score.value) * MATE_GRAPH_SCORE;
  }
  return Math.max(-GRAPH_SCORE_LIMIT, Math.min(GRAPH_SCORE_LIMIT, score.value));
}

export function formatAnalysisScore(score) {
  if (!score) return '評価値なし';
  if (score.type === 'mate') {
    if (score.value === 0) return '詰み';
    return score.value > 0
      ? `先手に${Math.abs(score.value)}手詰め`
      : `後手に${Math.abs(score.value)}手詰め`;
  }
  const value = Math.trunc(score.value);
  return `評価値 ${value >= 0 ? '+' : ''}${value}`;
}

export const KIFU_ANALYSIS_GRAPH_LIMIT = GRAPH_SCORE_LIMIT;
