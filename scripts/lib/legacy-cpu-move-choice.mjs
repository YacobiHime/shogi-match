// 2026-10-19時点の旧CPU。新方式との開発用比較だけに使い、配布コードからは読まない。
import { comparableScore, selectMoveByRank } from "../../src/core/move-selection.mjs";
import { createNaturalnessEvaluator, PIECE_SACRIFICE_TAG } from "../../src/core/move-naturalness.mjs";
import { BLUNDER_LOSS, OVERSIGHT_MIN_DEEP_LOSS, SACRIFICE_CANDIDATE_MAX_LOSS, chooseMatingMove, chooseNaturalMove, chooseRiskAwareMove, moveLeaning, pickWeighted, tryOversight } from "../../src/core/cpu-move-choice.mjs";
const VISION_MIN_NODES = 1000;

function drawRandom(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("randomは0以上1未満の数値を返してください");
  }
  return value;
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
  weight.leaning = (usi) => moveLeaning(evaluation(usi));
  return weight;
}

function scoreMap(result) {
  return new Map((result?.candidates ?? [])
    .map(({ move, score }) => [move, comparableScore(score)])
    .filter(([, value]) => value !== undefined));
}

export function chooseStyledMove({ search, candidates, style, naturalness, random = Math.random, lossCap = Infinity }) {
  if (!style || !Number.isFinite(style.attack) || style.attack === 0) return null;
  if (drawRandom(random) >= Math.abs(style.attack) * (style.rate ?? 1)) return null;
  const want = Math.sign(style.attack);
  const bestScore = comparableScore(candidates.find(({ move }) => move === search.move)?.score);
  if (bestScore === undefined) return null;
  if (naturalness.leaning(search.move) === want) return null;
  const limit = Math.min(style.margin ?? 0, lossCap);
  const fitting = candidates
    .map((candidate) => ({ ...candidate, value: comparableScore(candidate.score) }))
    .filter(({ move, value }) => move !== search.move && value !== undefined && bestScore - value <= limit
      && !naturalness.isSacrifice(move) && naturalness.leaning(move) === want);
  if (!fitting.length) return null;
  // 最善手に近いほど選びやすい。
  const picked = pickWeighted(fitting.map((entry) => ({ ...entry, weight: 1 + limit - (bestScore - entry.value) })), random);
  return {
    move: picked.move, rank: picked.rank, kind: "style",
    naturalness: naturalness(picked.move), loss: Math.max(0, bestScore - picked.value),
  };
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
 * 探索済みなら、見落とし → 危険への態度(riskAttitudeがある場合) → 棋風 → 視野の狭さ(visionWidthがある場合)
 * → 探索候補からの抽選の順に試す。
 * verify(searchMoves, nodes)は、見落とし判定(浅い読み直しと深い検証の2回)と、目に付いた手の読み直しに使う
 * 追加探索で、呼び出し側が直列に実行する。probe(moves, { nodes, multiPv })は、候補手の先の局面を読む追加探索
 * (chooseRiskAwareMove)で、これも呼び出し側が直列に実行する。
 * @param {{
 *   strength: ReturnType<typeof import('../../src/core/strength-settings.mjs').getStrengthSearchSettings>,
 *   sfen: string,
 *   legalMoves: string[],
 *   moveHistory?: string[],
 *   search?: { move: string, candidates?: { rank: number, move: string, score?: any, pv?: string[] }[] },
 *   verify?: (searchMoves: string[], nodes: number) => Promise<any>,
 *   probe?: (moves: string[], options: { nodes: number, multiPv: number }) => Promise<any>,
 *   random?: () => number,
 *   blunderAllowed?: boolean,
 * }} options
 * blunderAllowedがfalseなら、最善手との差がBLUNDER_LOSS以上の手を選ばない(canBlunderで判定する)。
 * 戻り値のlossは最善手との差(分かる場合)で、isBlunderChoiceで大きな悪手かを判定できる。
 */
export async function chooseLegacyCpuMove({
  strength,
  sfen,
  legalMoves,
  moveHistory = [],
  search,
  verify,
  probe,
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

  // 探索で詰みが見えたら、強さと特徴に応じた確率で詰ます。
  const mating = chooseMatingMove({ candidates, strength, random });
  if (mating) return { ...mating, naturalness: naturalness(mating.move) };

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

  // 危険への態度。優勢・互角では道の細い最善手を避けて無難な手を、劣勢では相手が間違えやすい勝負手を選ぶ。
  const risky = await chooseRiskAwareMove({ sfen, search, candidates, strength, naturalness, probe, lossCap });
  if (risky) return risky;

  // 棋風。最善手に近い候補の中で、攻めの手か受けの手を選びやすくする。
  const styled = chooseStyledMove({ search, candidates, style: strength.style, naturalness, random, lossCap });
  if (styled) return styled;

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
