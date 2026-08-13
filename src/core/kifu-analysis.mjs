const GRAPH_SCORE_LIMIT = 6000;
const MATE_GRAPH_SCORE = GRAPH_SCORE_LIMIT;

/** USIエンジンの手番側評価を、評価値グラフ用の先手視点へ揃える。 */
export function scoreForBlack(score, sideToMove) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return undefined;
  }
  const value = sideToMove === 'black' ? score.value : -score.value;
  return { type: score.type, value };
}

/** 詰みを含む評価値を、±6000のグラフ座標へ変換する。 */
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

function comparableScore(score) {
  if (score?.type === 'cp' && Number.isFinite(score.value)) return score.value;
  if (score?.type === 'mate' && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - Math.min(999, Math.abs(score.value));
    if (score.value < 0) return -100000 + Math.min(999, Math.abs(score.value));
    return 0;
  }
  return undefined;
}

/**
 * 着手前の最善評価と実着手後の評価を着手者目線で比較する。
 * 好手系は「最善手だった」だけでは付けず、次善手との差が大きい局面に限定する。
 */
export function classifyAnalyzedMove({
  ply,
  playedMove,
  bestMove,
  beforeBestScore,
  beforeSecondScore,
  afterScore,
} = {}) {
  if (!Number.isInteger(ply) || ply < 1 || typeof playedMove !== 'string') return null;
  const before = comparableScore(beforeBestScore);
  const after = comparableScore(afterScore);
  if (before === undefined || after === undefined) return null;
  const mover = ply % 2 === 1 ? 'black' : 'white';
  const loss = Math.max(0, mover === 'black' ? before - after : after - before);

  if (loss >= 1800) return { kind: 'blunder', label: '大悪手', mover, loss };
  if (loss >= 800) return { kind: 'mistake', label: '悪手', mover, loss };
  if (loss >= 300) return { kind: 'dubious', label: '疑問手', mover, loss };

  if (playedMove !== bestMove) return null;
  const second = comparableScore(beforeSecondScore);
  if (second === undefined) return null;
  const bestGap = Math.max(0, mover === 'black' ? before - second : second - before);
  if (bestGap >= 1200) {
    return { kind: 'brilliant', label: '神の一手', mover, loss, bestGap };
  }
  if (bestGap >= 350) {
    return { kind: 'good', label: '好手', mover, loss, bestGap };
  }
  return null;
}

export const KIFU_ANALYSIS_GRAPH_LIMIT = GRAPH_SCORE_LIMIT;
