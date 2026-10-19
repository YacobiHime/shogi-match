import { Position } from "tsshogi";
import { comparableScore, selectMoveByRank, winRate } from "./move-selection.mjs";
import { createNaturalnessEvaluator, PIECE_SACRIFICE_TAG } from "./move-naturalness.mjs";
import { mateFindProbability } from "./player-character.mjs";

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
/** 危険度で選び直す候補の、最善手との勝率差(ポイント)の上限と、読み直す候補の数。 */
export const RISK_MARGIN = 6;
/** 劣勢で勝負手を選ぶときの、最善手との勝率差の上限。勝負手の損は、相手が間違えなければそのまま負けに近づくので狭くする。 */
export const RISK_SWINDLE_MARGIN = 3;
export const RISK_MAX_CANDIDATES = 3;
/** 選び直す候補の、最善手との評価値の差の上限。大差の局面では勝率の差が小さく見えるため、評価値でも抑える。 */
export const RISK_MAX_SCORE_LOSS = 150;
/** 候補手の先の局面を読むときのMultiPV。この数の手で「正解の道の広さ」を見る。 */
export const RISK_PROBE_MULTIPV = 4;
/**
 * 形勢(最善手の勝率)による危険への態度。SAFE_FROM以上では危険な手を避け、FULLで最も強く避ける。
 * SWINDLE_BELOW未満では、相手が間違えやすい手を好み、SWINDLE_FULLで最も強く好む。
 */
export const RISK_SAFE_FROM = 40;
export const RISK_SAFE_FULL = 50;
export const RISK_SWINDLE_BELOW = 40;
export const RISK_SWINDLE_FULL = 20;

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
  weight.leaning = (usi) => moveLeaning(evaluation(usi));
  return weight;
}

/** 攻めの手のタグ。王手も攻めの手に数える。 */
export const ATTACK_TAGS = new Set(["threaten", "open-line", "rook-pawn-push", "pawn-tension", "promote", "winning-capture", "free-capture"]);
/** 受けの手のタグ。 */
export const DEFENSE_TAGS = new Set(["king-escape", "drop-block", "move-block", "escape", "castle-build", "capture-checker", "recapture", "simple-recapture", "guard"]);

/** 手が攻め(1)か受け(-1)か、どちらでもない(0)か。両方の性格を持つ手は、攻めに数える。 */
export function moveLeaning({ tags = [], check = false } = {}) {
  if (check || tags.some((tag) => ATTACK_TAGS.has(tag))) return 1;
  if (tags.some((tag) => DEFENSE_TAGS.has(tag))) return -1;
  return 0;
}

/**
 * 棋風で手を選ぶ。最善手との差がmargin以内の候補のうち、棋風に合う手(攻めなら攻めの手)を、
 * |attack|×rateの割合で選ぶ。最善手が棋風に合うなら、最善手のまま。合う手がなければnull。
 */
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

/**
 * 探索で詰みが見えていれば、strength.mateFindingの確率で詰ます手を返す(最も短い詰みの手数で判定する)。
 * 見つけられなかったときは、ふだんの手の選び方に任せる(たまたま詰ますこともある)。
 * mateFindingが無い設定(竜王戦以外の対局)では、何もしない。
 */
export function chooseMatingMove({ candidates, strength, random = Math.random }) {
  if (!strength.mateFinding) return null;
  const mates = candidates
    .filter(({ score }) => score?.type === "mate" && Number.isInteger(score.value) && score.value > 0)
    .sort((a, b) => a.score.value - b.score.value || a.rank - b.rank);
  const best = mates[0];
  if (!best) return null;
  const probability = mateFindProbability(strength.mateFinding, best.score.value);
  if (drawRandom(random) >= probability) return null;
  return { move: best.move, rank: best.rank, kind: "mate", loss: 0, mate: best.score.value };
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

/**
 * 手番の側が、この局面からその棋力で指したときに失う勝率の見込み(ポイント)。
 * MultiPVの候補を、評価差に応じた重み(温度temperature)と目に付きやすさ(weightOf)で選ぶとして、
 * 最善の勝率との差を返す。正解が1手しかなく、目に付きにくい局面ほど大きい。
 * 正解が取る・取り返すといった目に付く手なら、道が細くても小さい。
 * @param {{ move?: string, score?: any }[]} [candidates]
 * @param {number} [temperature]
 * @param {(usi: string) => number} [weightOf]
 */
export function expectedWinRateLoss(candidates = [], temperature = 1000, weightOf = () => 1) {
  const rows = candidates
    .map(({ move, score }) => ({ move, value: comparableScore(score), rate: winRate(score) }))
    .filter(({ value, rate }) => value !== undefined && rate !== undefined);
  if (rows.length < 2) return 0;
  const bestValue = Math.max(...rows.map(({ value }) => value));
  const bestRate = Math.max(...rows.map(({ rate }) => rate));
  let total = 0;
  let expected = 0;
  for (const { move, value, rate } of rows) {
    const weight = Math.exp(-(bestValue - value) / temperature) * (move ? weightOf(move) : 1);
    total += weight;
    expected += weight * rate;
  }
  return total > 0 ? Math.max(0, bestRate - expected / total) : 0;
}

/**
 * sfenからmovesを指した局面での、手の目に付きやすさ(自然さ^alpha)。局面を作れなければ、どの手も1とする。
 * @returns {(usi: string) => number}
 */
export function naturalnessAfter(sfen, moves, alpha = 1) {
  try {
    const position = sfen ? Position.newBySFEN(sfen) : null;
    if (!position) return () => 1;
    for (const usi of moves) {
      const move = position.createMoveByUSI(usi);
      if (!move || !position.doMove(move)) return () => 1;
    }
    const evaluate = createNaturalnessEvaluator(position.sfen, { moveHistory: moves });
    return (usi) => {
      try {
        return evaluate(usi).weight ** alpha;
      } catch {
        return 1;
      }
    };
  } catch {
    return () => 1;
  }
}

/**
 * 形勢に応じた危険への態度。safeは自分の道が細い手を避ける強さ、swindleは相手が間違えやすい手を好む強さ。
 * 優勢ほど手堅く、劣勢ほど勝負手を選ぶ。
 */
export function riskStance(bestRate, riskAttitude) {
  if (!(riskAttitude > 0) || !Number.isFinite(bestRate)) return { safe: 0, swindle: 0 };
  if (bestRate >= RISK_SAFE_FROM) {
    const ramp = Math.min(1, (bestRate - RISK_SAFE_FROM) / (RISK_SAFE_FULL - RISK_SAFE_FROM));
    // 勝勢に近いほど、逆転される手をさらに嫌う(勝率100%で2倍)。
    const winning = 1 + Math.max(0, bestRate - RISK_SAFE_FULL) / (100 - RISK_SAFE_FULL);
    return { safe: riskAttitude * ramp * winning, swindle: 0 };
  }
  const ramp = Math.min(1, (RISK_SWINDLE_BELOW - bestRate) / (RISK_SWINDLE_BELOW - RISK_SWINDLE_FULL));
  return { safe: 0, swindle: riskAttitude * ramp };
}

/**
 * 人間らしい危険の見積もりで、最善手に近い候補から選び直す。
 * 互角〜優勢では、最善手を指した後に正解の道が細い手(間違えると崩れる手)を避け、無難な手を選ぶ。
 * 劣勢では、指した後に相手の正解の道が細い手(相手が間違えやすい勝負手)を選ぶ。
 * 危険を見積もるには、候補手の先の局面を読む。probe(moves, { nodes, multiPv })は、
 * 現在の局面からmovesを指した局面を読む追加探索で、呼び出し側が直列に実行する。
 * 候補の重みには、CPUがふだん手を選ぶときと同じく、評価差と目に付きやすさ(自然さ)を使う。
 * 選び直した手が最善手のままなら、nullを返してふだんの選び方に任せる。
 * @param {{
 *   sfen?: string,
 *   search: { move: string },
 *   candidates: { rank: number, move: string, score?: any, pv?: string[] }[],
 *   strength: {
 *     riskAttitude?: number, riskProbeNodes?: number, nodes: number, scoreTemperature?: number, naturalnessAlpha?: number,
 *   },
 *   naturalness: ((usi: string) => number) & { isSacrifice: (usi: string) => boolean },
 *   probe?: (moves: string[], options: { nodes: number, multiPv: number }) => Promise<any>,
 *   lossCap?: number,
 * }} options
 */
export async function chooseRiskAwareMove({ sfen, search, candidates, strength, naturalness, probe, lossCap = Infinity }) {
  if (!probe || !(strength.riskAttitude > 0)) return null;
  const root = candidates
    .map((candidate) => ({ ...candidate, value: comparableScore(candidate.score), rate: winRate(candidate.score) }))
    .filter(({ value, rate, score }) => value !== undefined && rate !== undefined && score?.type === "cp");
  const best = root.find(({ move }) => move === search.move);
  if (!best) return null;
  const stance = riskStance(best.rate, strength.riskAttitude);
  if (!stance.safe && !stance.swindle) return null;
  const pool = [best, ...root
    .filter(({ move, rate, value }) => move !== search.move && best.rate - rate <= (stance.safe ? RISK_MARGIN : RISK_SWINDLE_MARGIN)
      && best.value - value <= Math.min(lossCap, RISK_MAX_SCORE_LOSS) && !naturalness.isSacrifice(move))
    .sort((left, right) => right.value - left.value)]
    .slice(0, RISK_MAX_CANDIDATES);
  if (pool.length < 2) return null;

  const nodes = Math.max(strength.riskProbeNodes ?? strength.nodes, 1);
  const temperature = strength.scoreTemperature ?? 1000;
  const alpha = strength.naturalnessAlpha ?? 1;
  const risk = (moves, result) => expectedWinRateLoss(result.candidates, temperature, naturalnessAfter(sfen, moves, alpha));
  const scored = [];
  for (const candidate of pool) {
    let adjusted;
    if (stance.safe) {
      // 相手の最善の応手の後、自分がこの棋力で指したときに失う勝率。
      const reply = candidate.pv?.[1];
      if (!reply) {
        if (candidate === best) return null;
        continue;
      }
      const moves = [candidate.move, reply];
      const result = await probe(moves, { nodes, multiPv: RISK_PROBE_MULTIPV });
      if (!result) return null;
      adjusted = candidate.rate - stance.safe * risk(moves, result);
    } else {
      // 指した後、相手が同じくらいの棋力で指したときに失う勝率(こちらの逆転の見込み)。
      const moves = [candidate.move];
      const result = await probe(moves, { nodes, multiPv: RISK_PROBE_MULTIPV });
      if (!result) return null;
      adjusted = candidate.rate + stance.swindle * risk(moves, result);
    }
    scored.push({ ...candidate, adjusted });
  }
  const picked = scored.reduce((top, entry) => (entry.adjusted > top.adjusted ? entry : top), scored[0]);
  if (!picked || picked.move === search.move) return null;
  return {
    move: picked.move,
    rank: picked.rank,
    kind: stance.safe ? "safe" : "swindle",
    naturalness: naturalness(picked.move),
    loss: Math.max(0, best.value - picked.value),
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
 *   strength: ReturnType<typeof import('./strength-settings.mjs').getStrengthSearchSettings>,
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
export async function chooseCpuMove({
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
