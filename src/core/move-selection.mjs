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
  {
    maxScoreLoss = Infinity,
    preferredMove,
    fallbackMove,
    scoreTemperature = Infinity,
    bestMoveRate = 0,
  } = {},
) {
  calculateEffectiveMoveRank(moveRank, 0);
  if (!searchResult || typeof searchResult.move !== 'string' || searchResult.move === '') {
    throw new Error('searchResult.moveは空でない文字列にしてください');
  }

  if (!(maxScoreLoss === Infinity || (Number.isFinite(maxScoreLoss) && maxScoreLoss >= 0))) {
    throw new Error('maxScoreLossは0以上の数値にしてください');
  }
  if (!(scoreTemperature === Infinity
    || (Number.isFinite(scoreTemperature) && scoreTemperature > 0))) {
    throw new Error('scoreTemperatureは0より大きい数値にしてください');
  }
  if (!Number.isFinite(bestMoveRate) || bestMoveRate < 0 || bestMoveRate > 1) {
    throw new Error('bestMoveRateは0以上1以下の数値にしてください');
  }
  if (fallbackMove !== undefined && (typeof fallbackMove !== 'string' || fallbackMove === '')) {
    throw new Error('fallbackMoveは空でない文字列にしてください');
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

  if (candidates.length === 0) {
    return fallbackMove === undefined
      ? { move: searchResult.move, rank: 1 }
      : { move: fallbackMove, rank: 0 };
  }
  const preferred = candidates.find(([, candidate]) => candidate.move === preferredMove);
  if (preferred) return { move: preferred[1].move, rank: preferred[0] };

  const randomValue = random();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error('randomは0以上1未満の数値を返してください');
  }
  // 難易度ごとの割合で最善手を明示的に選ぶ。残りの確率は0〜1へ
  // 再正規化し、候補順位と評価差による従来の抽選へ渡す。
  if (randomValue < bestMoveRate || bestMoveRate === 1) {
    return { move: searchResult.move, rank: 1 };
  }
  const selectionRandom = (randomValue - bestMoveRate) / (1 - bestMoveRate);
  if (scoreTemperature !== Infinity && bestValue !== undefined) {
    const weighted = candidates.map(([rank, candidate]) => {
      const value = comparable(candidate.score);
      const loss = value === undefined ? maxScoreLoss : Math.max(0, bestValue - value);
      return { rank, candidate, weight: Math.exp(-loss / scoreTemperature) };
    });
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let target = selectionRandom * totalWeight;
    for (const entry of weighted) {
      target -= entry.weight;
      if (target <= 0) return { move: entry.candidate.move, rank: entry.rank };
    }
    const fallback = weighted.at(-1);
    return { move: fallback.candidate.move, rank: fallback.rank };
  }
  const [rank, candidate] = candidates[Math.floor(selectionRandom * candidates.length)];
  return { move: candidate.move, rank };
}
