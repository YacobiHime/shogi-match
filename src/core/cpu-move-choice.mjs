import { comparableScore, selectMoveByRank } from "./move-selection.mjs";
import { createNaturalnessEvaluator } from "./move-naturalness.mjs";

/** 深い読みで判明する損失がこれ以上なら「見落とし」とみなす。 */
export const OVERSIGHT_MIN_DEEP_LOSS = 300;
/** 強さ設定に指定がない場合の、浅い読みで「良く見える」とみなす最善手との差。 */
export const OVERSIGHT_DEFAULT_SHALLOW_LOSS = 300;
/** 見落としでも不自然な手は選ばない。 */
export const OVERSIGHT_MIN_NATURALNESS = 0.5;
export const OVERSIGHT_MAX_TRAPS = 5;
/** 探索候補に加えて、浅く読み直す「目に付く自然な手」の数。 */
export const OVERSIGHT_NATURAL_MOVES = 8;

function drawRandom(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("randomは0以上1未満の数値を返してください");
  }
  return value;
}

/** 重み付き抽選。重みの合計が0なら先頭を返す。 */
export function pickWeighted(entries, random = Math.random) {
  if (!entries.length) return null;
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) return entries[0];
  let target = drawRandom(random) * total;
  for (const entry of entries) {
    target -= entry.weight;
    if (target <= 0) return entry;
  }
  return entries.at(-1);
}

function naturalnessMemo(sfen, moveHistory) {
  const evaluate = createNaturalnessEvaluator(sfen, { moveHistory });
  const cache = new Map();
  return (usi) => {
    if (!cache.has(usi)) cache.set(usi, evaluate(usi).weight);
    return cache.get(usi);
  };
}

/** エンジンを使わず、合法手を自然さ^alphaで重み付けして選ぶ。 */
export function chooseNaturalMove({
  sfen,
  legalMoves,
  moveHistory = [],
  alpha = 1,
  random = Math.random,
  naturalness = naturalnessMemo(sfen, moveHistory),
}) {
  const entries = legalMoves.map((move) => {
    const value = naturalness(move);
    return { move, naturalness: value, weight: value ** alpha };
  });
  const picked = pickWeighted(entries, random);
  return picked ? { move: picked.move, kind: "natural", naturalness: picked.naturalness } : null;
}

function scoreMap(result) {
  return new Map((result?.candidates ?? [])
    .map(({ move, score }) => [move, comparableScore(score)])
    .filter(([, value]) => value !== undefined));
}

async function tryOversight({ search, candidates, legalMoves, strength, naturalness, verify, random }) {
  const alpha = strength.naturalnessAlpha ?? 1;
  const shallowLimit = Math.min(
    strength.maxScoreLoss,
    strength.oversightShallowLoss || OVERSIGHT_DEFAULT_SHALLOW_LOSS,
  );
  // 人間の目に付くのは、探索上位の手と、取る・逃げる・成るといった自然な手。
  const natural = legalMoves
    .filter((move) => move !== search.move && naturalness(move) >= OVERSIGHT_MIN_NATURALNESS)
    .sort((left, right) => naturalness(right) - naturalness(left))
    .slice(0, OVERSIGHT_NATURAL_MOVES);
  const considered = [...new Set([
    ...candidates
      .filter(({ rank, move }) => rank > 1 && move !== search.move
        && naturalness(move) >= OVERSIGHT_MIN_NATURALNESS)
      .map(({ move }) => move),
    ...natural,
  ])];
  if (!considered.length) return null;

  // エンジンは呼び出し側で直列に使う。まず目に付いた手をそのレベルの浅い読みで比べる。
  const shallowValues = scoreMap(await verify([search.move, ...considered], strength.nodes));
  if (!shallowValues.size) return null;
  const shallowBest = Math.max(...shallowValues.values());
  const pool = considered
    .filter((move) => shallowValues.has(move))
    .map((move) => ({
      move,
      rank: candidates.find((candidate) => candidate.move === move)?.rank ?? 0,
      shallowLoss: shallowBest - shallowValues.get(move),
      naturalness: naturalness(move),
    }))
    .filter(({ shallowLoss }) => shallowLoss <= shallowLimit)
    .sort((left, right) => left.shallowLoss - right.shallowLoss)
    .slice(0, OVERSIGHT_MAX_TRAPS);
  if (!pool.length) return null;

  // 良く見えた手だけを深く読み直し、実は悪い手を「見落とし」として選ぶ。
  const deep = await verify([search.move, ...pool.map(({ move }) => move)], strength.oversightNodes);
  const deepValues = scoreMap(deep);
  if (!deepValues.size) return null;
  const deepBest = Math.max(...deepValues.values());
  const traps = pool
    .filter(({ move }) => deepValues.has(move))
    .map((candidate) => ({ ...candidate, deepLoss: deepBest - deepValues.get(candidate.move) }))
    .filter(({ deepLoss }) => (
      deepLoss >= OVERSIGHT_MIN_DEEP_LOSS && deepLoss <= strength.oversightMaxLoss
    ))
    .map((candidate) => ({
      ...candidate,
      weight: candidate.naturalness ** alpha
        * Math.exp(-candidate.shallowLoss / (strength.scoreTemperature ?? 1000)),
    }));
  const picked = pickWeighted(traps, random);
  return picked ? {
    move: picked.move,
    rank: picked.rank,
    kind: "oversight",
    naturalness: picked.naturalness,
    shallowLoss: picked.shallowLoss,
    deepLoss: picked.deepLoss,
  } : null;
}

/**
 * CPUの着手を選ぶ共通処理。
 * search未指定(Lv0・エンジンなし)なら自然さだけで選ぶ。
 * verify(searchMoves, nodes)は見落とし判定用の追加探索(浅い読み直しと深い検証の2回)で、
 * 呼び出し側が直列に実行する。
 * @param {{
 *   strength: ReturnType<typeof import('./strength-settings.mjs').getStrengthSearchSettings>,
 *   sfen: string,
 *   legalMoves: string[],
 *   moveHistory?: string[],
 *   search?: { move: string, candidates?: { rank: number, move: string, score?: any }[] },
 *   verify?: (searchMoves: string[], nodes: number) => Promise<any>,
 *   random?: () => number,
 * }} options
 */
export async function chooseCpuMove({
  strength,
  sfen,
  legalMoves,
  moveHistory = [],
  search,
  verify,
  random = Math.random,
}) {
  if (!legalMoves.length) return null;
  const naturalness = naturalnessMemo(sfen, moveHistory);
  const alpha = strength.naturalnessAlpha ?? 1;
  const allowed = new Set(legalMoves);
  if (!search?.move || !allowed.has(search.move)) {
    return chooseNaturalMove({ sfen, legalMoves, moveHistory, alpha, random, naturalness });
  }
  const candidates = (search.candidates ?? []).filter(({ move }) => allowed.has(move));

  if (strength.oversightRate > 0 && verify && drawRandom(random) < strength.oversightRate) {
    const oversight = await tryOversight({
      search, candidates, legalMoves, strength, naturalness, verify, random,
    });
    if (oversight) return oversight;
  }

  const selection = selectMoveByRank(
    { move: search.move, candidates },
    strength.moveRank,
    random,
    {
      maxScoreLoss: strength.maxScoreLoss,
      scoreTemperature: strength.scoreTemperature,
      bestMoveRate: strength.bestMoveRate,
      candidateWeight: alpha > 0 ? ({ move }) => naturalness(move) ** alpha : undefined,
    },
  );
  return {
    move: selection.move,
    rank: selection.rank,
    kind: selection.rank === 1 ? "best" : "weighted",
    naturalness: naturalness(selection.move),
  };
}
