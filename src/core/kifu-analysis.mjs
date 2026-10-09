import { GRAPH_MATE_VALUE } from './evaluation-graph-selection.mjs';

/** USIエンジンの手番側評価を、評価値グラフ用の先手視点へ揃える。 */
export function scoreForBlack(score, sideToMove) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return undefined;
  }
  const value = sideToMove === 'black' ? score.value : -score.value;
  return { type: score.type, value };
}

/** 詰みを含む評価値をグラフ値へ変換する。評価値は丸めず、詰みはグラフの端を表す値にする。 */
export function scoreToGraphValue(score) {
  if (!score || !['cp', 'mate'].includes(score.type) || !Number.isFinite(score.value)) {
    return undefined;
  }
  if (score.type === 'mate') {
    if (score.value === 0) return 0;
    return Math.sign(score.value) * GRAPH_MATE_VALUE;
  }
  return score.value;
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
 * 着手前の最善評価と実着手後の評価から、指した側の評価値の損と、着手前の形勢(指した側から見た評価値)を返す。
 * 評価値が読めなければnull。棋力診断が、指し手の損の平均を取るために使う。
 * @param {{
 *   mover: 'black' | 'white',
 *   beforeBestScore?: { type: string, value: number },
 *   afterScore?: { type: string, value: number },
 * }} options
 */
export function analyzedMoveLoss({ mover, beforeBestScore, afterScore }) {
  const before = comparableScore(beforeBestScore);
  const after = comparableScore(afterScore);
  if (before === undefined || after === undefined) return null;
  const sign = mover === 'black' ? 1 : -1;
  return { loss: Math.max(0, sign * (before - after)), standing: sign * before };
}

/**
 * 着手前の最善評価と実着手後の評価を着手者目線で比較する。
 * 好手は「最善手だった」だけでは付けず、次善手との差が大きい局面に限定する。
 * 神の一手は、god-move.mjsのjudgeGodMoveで候補と判定された手（godMove）にだけ付ける。
 * 1局で表示する上限（上位3手）は、解析を終えた点の列にcapGodMovesを掛けて絞る。
 * moverは指した側。省くと平手として手数の偶奇で決める（駒落ちは上手が先に指すので渡す）。
 * @param {{
 *   ply?: number,
 *   mover?: 'black' | 'white',
 *   playedMove?: string,
 *   bestMove?: string,
 *   beforeBestScore?: { type: string, value: number },
 *   beforeSecondScore?: { type: string, value: number },
 *   afterScore?: { type: string, value: number },
 *   godMove?: { strength: number } | null,
 * }} [options]
 */
export function classifyAnalyzedMove({
  ply,
  mover = ply % 2 === 1 ? 'black' : 'white',
  playedMove,
  bestMove,
  beforeBestScore,
  beforeSecondScore,
  afterScore,
  godMove = null,
} = {}) {
  if (!Number.isInteger(ply) || ply < 1 || typeof playedMove !== 'string') return null;
  const before = comparableScore(beforeBestScore);
  const after = comparableScore(afterScore);
  if (before === undefined || after === undefined) return null;
  const loss = Math.max(0, mover === 'black' ? before - after : after - before);

  if (loss >= 1800) return { kind: 'blunder', label: '大悪手', mover, loss };
  if (loss >= 800) return { kind: 'mistake', label: '悪手', mover, loss };
  if (loss >= 300) return { kind: 'dubious', label: '疑問手', mover, loss };

  if (playedMove !== bestMove) return null;
  if (godMove) {
    return { kind: 'brilliant', label: '神の一手', mover, loss, strength: godMove.strength };
  }
  const second = comparableScore(beforeSecondScore);
  if (second === undefined) return null;
  const bestGap = Math.max(0, mover === 'black' ? before - second : second - before);
  if (bestGap >= 350) {
    return { kind: 'good', label: '好手', mover, loss, bestGap };
  }
  return null;
}
