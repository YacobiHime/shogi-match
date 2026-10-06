import { comparableScore, selectMoveByRank } from "./move-selection.mjs";
import { createNaturalnessEvaluator, PIECE_SACRIFICE_TAG } from "./move-naturalness.mjs";

/** 深い読みで判明する損失がこれ以上なら「見落とし」とみなす。 */
export const OVERSIGHT_MIN_DEEP_LOSS = 300;
/** 強さ設定に指定がない場合の、浅い読みで「良く見える」とみなす最善手との差。 */
export const OVERSIGHT_DEFAULT_SHALLOW_LOSS = 300;
/** 見落としでも不自然な手は選ばない。 */
export const OVERSIGHT_MIN_NATURALNESS = 0.5;
export const OVERSIGHT_MAX_TRAPS = 5;
/** 探索候補に加えて、浅く読み直す「目に付く自然な手」の数。 */
export const OVERSIGHT_NATURAL_MOVES = 8;
/**
 * 探索の2番手以下にある駒捨て(駒をただで渡す手)は、最善手との差がこれ以下の場合だけ選ぶ。
 * 浅い読みで悪く見えない駒捨ても、多くは深く読むと大損で、人間には意味の無い手に見える。
 */
export const SACRIFICE_CANDIDATE_MAX_LOSS = 150;
/** 最善手との差がこれ以上の着手を「大きな悪手」として、1局の回数と間隔を数える。見落としの下限と同じ。 */
export const BLUNDER_LOSS = OVERSIGHT_MIN_DEEP_LOSS;
/** 目に付いた手を読む探索量の下限。駒のただ取られを確実に見つけられる量にする。 */
export const VISION_MIN_NODES = 1000;

/**
 * 大きな悪手をまだ指してよいか。blunderPliesは、これまでに大きな悪手を指した手数(0始まり)。
 * 待ったで戻した手は、plyより後の記録として数えない。
 */
export function canBlunder(strength, blunderPlies, ply) {
  const past = blunderPlies.filter((value) => value < ply);
  if (Number.isFinite(strength.blunderLimit) && past.length >= strength.blunderLimit) return false;
  // 間隔はCPUの手数で数える。1手ごとに相手の手が挟まるため、手数では2倍になる。
  const last = past.length ? Math.max(...past) : undefined;
  return !(last !== undefined && Number.isFinite(strength.blunderCooldown)
    && ply - last < strength.blunderCooldown * 2);
}

/** 選んだ手が大きな悪手として数えるものか。 */
export function isBlunderChoice(choice) {
  return Number.isFinite(choice?.loss) && choice.loss >= BLUNDER_LOSS;
}

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

function evaluationMemo(sfen, moveHistory, options = {}) {
  const evaluate = createNaturalnessEvaluator(sfen, { moveHistory, ...options });
  const cache = new Map();
  return (usi) => {
    if (!cache.has(usi)) cache.set(usi, evaluate(usi));
    return cache.get(usi);
  };
}

function naturalnessMemo(sfen, moveHistory, options = {}, evaluation = evaluationMemo(sfen, moveHistory, options)) {
  const weight = (usi) => evaluation(usi).weight;
  // 自分から駒をただで渡す手(歩の突き捨てを含む)。
  weight.isSacrifice = (usi) => {
    const { tags } = evaluation(usi);
    return tags.includes(PIECE_SACRIFICE_TAG) || tags.includes("sacrifice");
  };
  return weight;
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

async function tryOversight({ search, candidates, legalMoves, strength, naturalness, verify, random, lossCap }) {
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
      deepLoss >= OVERSIGHT_MIN_DEEP_LOSS && deepLoss <= Math.min(strength.oversightMaxLoss, lossCap)
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
    loss: picked.deepLoss,
  } : null;
}

/** 目に付く手。自然さの上位visionWidth手(駒をただで渡す手を除く)と、探索上位engineVision手。 */
export function visibleMoves({ search, candidates, legalMoves, strength, naturalness }) {
  const natural = legalMoves
    .filter((move) => !naturalness.isSacrifice(move))
    .sort((left, right) => naturalness(right) - naturalness(left))
    .slice(0, strength.visionWidth);
  const engine = [search.move, ...candidates
    .filter(({ rank }) => rank > 1)
    .sort((left, right) => left.rank - right.rank)
    .map(({ move }) => move)]
    .slice(0, strength.engineVision ?? 0);
  const visible = [...new Set([...natural, ...engine])];
  return visible.length ? visible : legalMoves.slice(0, 1);
}

/**
 * 目に付いた手だけを、最善手と並べてそのレベルで読み直し、評価差と自然さの重みで選ぶ。
 * 人間の弱さは、良い手を読み違えることより、目に付かないことから出る。最善手は目に付いた場合だけ選ぶ。
 * 上限以内の手が無ければnullを返し、探索候補からの抽選に戻す。
 */
async function chooseWithinVision({ search, candidates, legalMoves, strength, naturalness, verify, random, lossCap, alpha }) {
  const visible = visibleMoves({ search, candidates, legalMoves, strength, naturalness });
  const values = scoreMap(await verify(
    [search.move, ...visible.filter((move) => move !== search.move)],
    Math.max(strength.nodes, VISION_MIN_NODES),
  ));
  if (!values.size) return null;
  const reference = Math.max(...values.values());
  const pool = visible
    .filter((move) => values.has(move))
    .map((move) => ({ move, value: values.get(move), loss: reference - values.get(move) }))
    .filter(({ loss }) => loss <= lossCap);
  if (!pool.length) return null;
  const poolBest = Math.max(...pool.map(({ value }) => value));
  const temperature = strength.scoreTemperature ?? 1000;
  const picked = pickWeighted(pool.map((entry) => ({
    ...entry,
    weight: Math.exp(-(poolBest - entry.value) / temperature) * naturalness(entry.move) ** alpha,
  })), random);
  return {
    move: picked.move,
    rank: candidates.find(({ move }) => move === picked.move)?.rank ?? 0,
    kind: picked.move === search.move ? "best" : "vision",
    naturalness: naturalness(picked.move),
    loss: Math.max(0, picked.loss),
  };
}

/**
 * CPUの着手を選ぶ共通処理。
 * search未指定(Lv0・エンジンなし)なら自然さだけで選ぶ。
 * 探索済みなら、見落とし → 視野の狭さ(visionWidthがある場合) → 探索候補からの抽選の順に試す。
 * verify(searchMoves, nodes)は、見落とし判定(浅い読み直しと深い検証の2回)と、目に付いた手の読み直しに使う
 * 追加探索で、呼び出し側が直列に実行する。
 * @param {{
 *   strength: ReturnType<typeof import('./strength-settings.mjs').getStrengthSearchSettings>,
 *   sfen: string,
 *   legalMoves: string[],
 *   moveHistory?: string[],
 *   search?: { move: string, candidates?: { rank: number, move: string, score?: any }[] },
 *   verify?: (searchMoves: string[], nodes: number) => Promise<any>,
 *   random?: () => number,
 *   blunderAllowed?: boolean,
 * }} options
 * blunderAllowedがfalseなら、最善手との差がBLUNDER_LOSS以上の手を選ばない(canBlunderで判定する)。
 * 戻り値のlossは最善手との差(分かる場合)で、isBlunderChoiceで大きな悪手かを判定できる。
 */
export async function chooseCpuMove({
  strength,
  sfen,
  legalMoves,
  moveHistory = [],
  search,
  verify,
  random = Math.random,
  blunderAllowed = true,
}) {
  if (!legalMoves.length) return null;
  const bestScore = comparableScore(search?.candidates?.find(({ move }) => move === search.move)?.score);
  const naturalness = naturalnessMemo(sfen, moveHistory, {
    simplicity: strength.simplicity ?? 0,
    advantage: bestScore,
  });
  const alpha = strength.naturalnessAlpha ?? 1;
  const allowed = new Set(legalMoves);
  if (!search?.move || !allowed.has(search.move)) {
    return chooseNaturalMove({ sfen, legalMoves, moveHistory, alpha, random, naturalness });
  }
  // 1手で失ってよい上限。大きな悪手を使い切ったら、悪手と数えない範囲まで下げる。
  // 最も弱いレベルでは、上限を守る手の割合(carefulRate)を下げ、読まないLv0から段差なくつなぐ。
  const careful = !(strength.carefulRate < 1) || drawRandom(random) < strength.carefulRate;
  const lossCap = careful
    ? Math.min(strength.moveLossCap ?? Infinity, blunderAllowed ? Infinity : BLUNDER_LOSS - 1)
    : Infinity;
  // 最善手との差が大きい駒捨ては、2番手以下の候補から外す。
  const candidates = (search.candidates ?? []).filter(({ move, score }) => {
    if (!allowed.has(move)) return false;
    if (move === search.move || !naturalness.isSacrifice(move)) return true;
    const value = comparableScore(score);
    return bestScore !== undefined && value !== undefined && bestScore - value <= SACRIFICE_CANDIDATE_MAX_LOSS;
  });

  // Lv0とのつなぎの区間では、読まずに見た目だけで指す手を混ぜる。自分から駒をただで渡す手は選ばない。
  if (strength.naturalMoveRate > 0 && drawRandom(random) < strength.naturalMoveRate) {
    const unread = legalMoves.filter((move) => !naturalness.isSacrifice(move));
    return chooseNaturalMove({
      sfen, legalMoves: unread.length ? unread : legalMoves, moveHistory, alpha, random, naturalness,
    });
  }

  if (lossCap >= OVERSIGHT_MIN_DEEP_LOSS && strength.oversightRate > 0 && verify
    && drawRandom(random) < strength.oversightRate) {
    const oversight = await tryOversight({
      search, candidates, legalMoves, strength, naturalness, verify, random, lossCap,
    });
    if (oversight) return oversight;
  }

  // 視野の狭さで弱くする。目に付く手だけを読み、その中から選ぶ。
  if (strength.visionWidth > 0 && verify) {
    if (drawRandom(random) < strength.bestMoveRate) {
      return { move: search.move, rank: 1, kind: "best", naturalness: naturalness(search.move), loss: 0 };
    }
    const vision = await chooseWithinVision({
      search, candidates, legalMoves, strength, naturalness, verify, random, lossCap, alpha,
    });
    if (vision) return vision;
  }

  const selection = selectMoveByRank(
    { move: search.move, candidates },
    strength.moveRank,
    random,
    {
      maxScoreLoss: Math.min(strength.maxScoreLoss, lossCap),
      scoreTemperature: strength.scoreTemperature,
      bestMoveRate: strength.bestMoveRate,
      candidateWeight: alpha > 0 ? ({ move }) => naturalness(move) ** alpha : undefined,
    },
  );
  const selectedScore = comparableScore(candidates.find(({ move }) => move === selection.move)?.score);
  return {
    move: selection.move,
    rank: selection.rank,
    kind: selection.rank === 1 ? "best" : "weighted",
    naturalness: naturalness(selection.move),
    loss: selection.rank === 1 ? 0
      : bestScore !== undefined && selectedScore !== undefined ? Math.max(0, bestScore - selectedScore) : undefined,
  };
}
