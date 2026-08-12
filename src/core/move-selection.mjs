/**
 * 敵の手のランク範囲へ難易度補正を適用する。
 * @param {{ min: number, max: number }} moveRank
 * @param {number} maxBonus
 */
export function calculateEffectiveMoveRank(moveRank, maxBonus) {
  if (!moveRank || !Number.isInteger(moveRank.min) || !Number.isInteger(moveRank.max)
    || moveRank.min < 1 || moveRank.max < moveRank.min) {
    throw new Error('moveRankは1以上かつmin <= maxの整数範囲にしてください');
  }
  if (!Number.isInteger(maxBonus) || maxBonus < 0) {
    throw new Error('maxBonusは0以上の整数にしてください');
  }

  return {
    min: moveRank.min,
    max: moveRank.max + maxBonus,
  };
}

/**
 * MultiPV候補から指定ランク範囲の手をランダムに選ぶ。
 * 候補不足時は、存在する最大ランクまで選択範囲を縮める。
 * @param {{ move: string, candidates?: { rank: number, move: string }[] }} searchResult
 * @param {{ min: number, max: number }} moveRank
 * @param {() => number} [random]
 * @returns {{ move: string, rank: number }}
 */
export function selectMoveByRank(
  searchResult,
  moveRank,
  random = Math.random,
  { maxScoreLoss = Infinity, preferredMove } = {},
) {
  calculateEffectiveMoveRank(moveRank, 0);
  if (!searchResult || typeof searchResult.move !== 'string' || searchResult.move === '') {
    throw new Error('searchResult.moveは空でない文字列にしてください');
  }

  if (!(maxScoreLoss === Infinity || (Number.isFinite(maxScoreLoss) && maxScoreLoss >= 0))) {
    throw new Error('maxScoreLossは0以上の数値にしてください');
  }
  const byRank = new Map();
  for (const candidate of searchResult.candidates || []) {
    if (Number.isInteger(candidate?.rank) && candidate.rank >= 1
      && typeof candidate.move === 'string' && candidate.move !== '') {
      byRank.set(candidate.rank, candidate);
    }
  }
  // bestmoveはエンジンの最終回答なので、info行が欠けても第1候補として必ず使える。
  const existingBest = byRank.get(1);
  byRank.set(1, { ...(existingBest || {}), rank: 1, move: searchResult.move });

  const highestAvailableRank = Math.max(...byRank.keys());
  const availableMin = Math.min(moveRank.min, highestAvailableRank);
  const availableMax = Math.min(moveRank.max, highestAvailableRank);
  const rankedCandidates = [...byRank.entries()]
    .filter(([rank]) => rank >= availableMin && rank <= availableMax)
    .sort(([left], [right]) => left - right);
  const comparable = (score) => {
    if (score?.type === 'cp' && Number.isFinite(score.value)) return score.value;
    if (score?.type === 'mate' && Number.isFinite(score.value)) {
      if (score.value > 0) return 100000 - score.value;
      if (score.value < 0) return -100000 + Math.abs(score.value);
      return 100000;
    }
    return undefined;
  };
  const bestValue = comparable(byRank.get(1)?.score);
  const candidates = rankedCandidates.filter(([rank, candidate]) => {
    if (rank === 1 || maxScoreLoss === Infinity) return true;
    const value = comparable(candidate.score);
    return bestValue !== undefined && value !== undefined && bestValue - value <= maxScoreLoss;
  });

  if (candidates.length === 0) return { move: searchResult.move, rank: 1 };
  const preferred = candidates.find(([, candidate]) => candidate.move === preferredMove);
  if (preferred) return { move: preferred[1].move, rank: preferred[0] };

  const randomValue = random();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error('randomは0以上1未満の数値を返してください');
  }
  const [rank, candidate] = candidates[Math.floor(randomValue * candidates.length)];
  return { move: candidate.move, rank };
}
