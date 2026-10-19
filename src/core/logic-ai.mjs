// ロジックAI。Lv1〜10のCPUを、エンジンの探索を使わず、ルールだけで指させる。
// 強さは「何に気づけるか」で分ける。気づかなかった項目は点数に入らず、その手は見えていないのと同じになる。
// - 序盤: 決めた戦法・囲いの定跡手を指す。タダの駒や、取られそうな自分の駒に気づいたら、そちらを優先する。
// - 中盤: 駒得を狙う。取り合いは、駒を取る手だけを数手先まで読む(取る手の読み)。
// - 終盤: 王手と玉の周りへの利きを高く見る。詰み(1手・3手)に気づけば詰ます。相手の1手詰めに気づけば防ぐ。
// 設計は docs/logic-ai-design.md。数値は仮の値で、自己対局で合わせる。

import { Position } from "tsshogi";
import { attackersOf, isKingAttacked, opponentOf } from "./piece-movement.mjs";
import { createNaturalnessEvaluator } from "./move-naturalness.mjs";
import { findMateLine } from "./problem-solver";
import { analyzePosition, perceptionForPosition } from "./position-awareness.mjs";

export const LOGIC_AI_MIN_LEVEL = 1;
export const LOGIC_AI_MAX_LEVEL = 10;

/** ロジックAIで指すレベルか。Lv0(読まずに自然さだけで指す)と、Lv11以上(エンジン)は使わない。 */
export function usesLogicAi(level) {
  return Number.isInteger(level) && level >= LOGIC_AI_MIN_LEVEL && level <= LOGIC_AI_MAX_LEVEL;
}

export { LOGIC_PIECE_VALUES } from "./logic-position.mjs";
import { HAND_KINDS, value, stateFromSfen, playLight, material, captureSearch, kingZonePressure, replyLoss } from "./logic-position.mjs";

/**
 * レベルごとの気づき。表の点(Lv1・3・5・8・10)の間は直線で補う。どれも「その局面で気づく確率」。
 * - freeCapture: 駒を取る手の得に気づく
 * - hanging: 指したあと、相手に駒を取られることに気づく(取られそうな自分の駒を逃がすのも、これで決まる)
 * - exchange: 取り合いの損得(取り返し)まで読む
 * - threat: 次に駒を取れる狙い(当たり・両取り)を作ることに気づく
 * - mate1・mate3: 1手詰め・3手詰めに気づく
 * - defendMate: 相手の1手詰めに気づいて防ぐ
 * - followPlan: 序盤に、決めた定跡を守る
 * - temperature: 手の選び方のばらつき(点数の差がこれくらいなら、選ばれやすさが約2.7倍違う)
 */
const PERCEPTION_TABLE = Object.freeze({
  freeCapture: [0.4, 0.6, 0.75, 0.9, 0.95],
  hanging: [0.1, 0.3, 0.5, 0.75, 0.85],
  hangingLastMoveMajor: [0.7, 0.8, 0.9, 0.95, 0.98],
  hangingLastMoveMinor: [0.4, 0.55, 0.7, 0.85, 0.92],
  exchange: [0, 0, 0.3, 0.6, 0.75],
  threat: [0, 0, 0.2, 0.4, 0.55],
  mate1: [0, 0, 0.3, 0.7, 0.9],
  mate3: [0, 0, 0, 0, 0.3],
  defendMate: [0, 0, 0.2, 0.6, 0.8],
  followPlan: [0.6, 0.7, 0.8, 0.9, 0.95],
  temperature: [280, 190, 130, 90, 70],
});
const PERCEPTION_LEVELS = [1, 3, 5, 8, 10];

/** レベルの気づきの確率と、ばらつき。 */
export function logicPerception(level) {
  const lv = Math.min(LOGIC_AI_MAX_LEVEL, Math.max(LOGIC_AI_MIN_LEVEL, Number(level) || LOGIC_AI_MIN_LEVEL));
  let upper = PERCEPTION_LEVELS.findIndex((anchor) => anchor >= lv);
  if (upper <= 0) upper = Math.max(1, upper);
  const lower = upper - 1;
  const span = PERCEPTION_LEVELS[upper] - PERCEPTION_LEVELS[lower];
  const t = span ? (lv - PERCEPTION_LEVELS[lower]) / span : 0;
  const result = {};
  for (const [key, values] of Object.entries(PERCEPTION_TABLE)) {
    result[key] = Math.round((values[lower] + (values[upper] - values[lower]) * t) * 1000) / 1000;
  }
  return result;
}

/** この局面で、どの項目に気づくかを決める(くじ)。 */
export function rollPerception(perception, random = Math.random) {
  const noticed = {};
  for (const key of ["freeCapture", "hanging", "exchange", "threat", "mate1", "mate3", "defendMate", "followPlan"]) {
    noticed[key] = random() < perception[key];
  }
  // 取り合いの読みは、取られることに気づいたときだけ働く。
  noticed.exchange = noticed.exchange && noticed.hanging;
  return noticed;
}

// ---- 軽い局面(盤と持ち駒)

function handValue(hands, side) {
  return HAND_KINDS.reduce((sum, kind) => sum + (hands[side][kind] ?? 0) * value(kind), 0);
}

/** 局面の段階。序盤は定跡の手があるうち、終盤は相手玉に迫れるか、持ち駒が多いか、手数が進んだとき。 */
export function logicPhase({ state, ply, planMove }) {
  const me = state.turn;
  if (kingZonePressure(state.board, opponentOf(me)) >= 2 || handValue(state.hands, me) >= 1000 || ply >= 100) return "ending";
  if (planMove && ply < 40) return "opening";
  return "middle";
}

// ---- 点数付け

const PLAN_BONUS = 260;
const CHECK_BONUS = { opening: 20, middle: 40, ending: 120 };
const KING_PRESSURE_BONUS = { opening: 0, middle: 8, ending: 25 };
const OWN_KING_PENALTY = 18;
const NATURALNESS_SCALE = 80;
/** 定跡を外れるのは、ほかの手に、これ以上の具体的な得(駒得・狙い・王手)があるときだけ。 */
const PLAN_TACTIC_MARGIN = 200;
const THREAT_SHARE = 0.35;
const MATE_BONUS = 100000;
const MATED_PENALTY = 50000;

function childSfen(sfen, usi) {
  const position = Position.newBySFEN(sfen);
  const move = position?.createMoveByUSI(usi);
  if (!position || !move || !position.doMove(move)) return null;
  return position.sfen;
}

/**
 * 1つの候補の点数。noticedで気づいた項目だけを数える。fullは、気づきに関係なく本当の損得を見る(見落としの記録用)。
 */
function scoreMove(context, usi, noticed) {
  const { state, me, phase, planMove, naturalness, ownPressureBefore } = context;
  const child = playLight(state, usi);
  if (!child) return null;
  const before = material(state, me);
  const after = material(child, me);
  const captureGain = child.captured ? value(child.captured.kind) + value(child.captured.handKind) : 0;
  const promotionGain = after - before - captureGain;
  const parts = { capture: 0, promotion: promotionGain, reply: 0, threat: 0, check: 0, pressure: 0, king: 0, natural: 0, plan: 0, response: 0 };
  if (captureGain && noticed.freeCapture) parts.capture = captureGain;
  // 指したあと、相手が駒を取ってくる損。取り返しまで読めれば、取り合いの損得で見る。
  if (noticed.hanging) {
    const depth = noticed.exchange ? 4 : 1;
    parts.reply = -replyLoss(child, depth, context.deadline);
  }
  // 次に駒を取れる狙い(当たり・両取り)。相手の応手は考えない分、割り引く。
  if (noticed.threat) {
    const again = { ...child, turn: me };
    parts.threat = Math.max(0, captureSearch(again, 2, -Infinity, Infinity, context.deadline) - material(again, me)) * THREAT_SHARE;
  }
  const check = isKingAttacked(child.board, opponentOf(me));
  if (check) parts.check = CHECK_BONUS[phase];
  parts.pressure = kingZonePressure(child.board, opponentOf(me)) * KING_PRESSURE_BONUS[phase];
  parts.king = -Math.max(0, kingZonePressure(child.board, me) - ownPressureBefore) * OWN_KING_PENALTY;
  parts.natural = Math.log(Math.max(0.02, naturalness(usi))) * NATURALNESS_SCALE;
  if (noticed.hanging && context.responseMoves?.has(usi)) parts.response = 180;
  if (planMove === usi && noticed.followPlan) parts.plan = PLAN_BONUS;
  const score = Object.values(parts).reduce((sum, part) => sum + part, 0);
  return { usi, score, parts, check, captureGain };
}

function softmaxPick(entries, temperature, random) {
  const top = Math.max(...entries.map(({ score }) => score));
  const weights = entries.map(({ score }) => Math.exp((score - top) / Math.max(1, temperature)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = random() * total;
  for (let index = 0; index < entries.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return entries[index];
  }
  return entries.at(-1);
}

function reasonOf(entry, planMove) {
  const { parts } = entry;
  if (planMove === entry.usi && parts.plan > 0) return "plan";
  if (parts.capture >= 200) return "capture";
  if (parts.check > 0 && parts.pressure > 0) return "attack";
  if (parts.threat >= 100) return "threat";
  if (parts.check > 0) return "check";
  if (parts.promotion > 0) return "promote";
  return "natural";
}

const FULL = Object.freeze({ freeCapture: true, hanging: true, exchange: true, threat: false, followPlan: false });

/**
 * ロジックAIで1手を選ぶ。
 * @param {{
 *   sfen: string, legalMoves: string[], level: number, moveHistory?: string[], planMove?: string | null,
 *   random?: () => number, maxTimeMs?: number,
 * }} options planMoveは、序盤の定跡の次の1手(なければnull)。
 * @returns {{ move: string, kind: 'logic', reason: string, missed: string[], phase: string, policy: 'take' | 'attack' | null, [key: string]: any } | null}
 */
export function chooseLogicMove({ sfen, legalMoves, level, moveHistory = [], planMove = null, random = Math.random, maxTimeMs = 600 }) {
  if (!legalMoves?.length) return null;
  const deadline = Date.now() + maxTimeMs;
  const perception = logicPerception(level);
  const awareness = analyzePosition(sfen, { moveHistory, legalMoves, maxTimeMs: Math.min(120, Math.max(0, deadline - Date.now())) });
  const noticed = rollPerception(perceptionForPosition(perception, awareness), random);
  const state = stateFromSfen(sfen);
  const me = state.turn;
  const ply = moveHistory.length;
  const plan = planMove && legalMoves.includes(planMove) ? planMove : null;
  const phase = logicPhase({ state, ply, planMove: plan });
  const result = (move, reason, extra = {}) => ({ move, kind: "logic", reason, missed: [], phase, policy: null, noticed, ...extra });

  // 詰みに気づけば詰ます。
  const mateLine = (plies) => {
    if (Date.now() >= deadline) return null;
    const line = findMateLine(sfen, plies, { nodeLimit: plies > 1 ? 15000 : 4000, maxTimeMs: Math.min(plies > 1 ? 200 : 80, deadline - Date.now()) });
    return line && legalMoves.includes(line[0]) ? line : null;
  };
  if (noticed.mate1) {
    const line = mateLine(1);
    if (line) return result(line[0], "mate", { mate: 1 });
  }
  if (noticed.mate3) {
    const line = mateLine(3);
    if (line) return result(line[0], "mate", { mate: line.length });
  }

  const evaluator = createNaturalnessEvaluator(sfen, { moveHistory, simplicity: 0.6, planMoves: plan ? [plan] : [] });
  const memo = new Map();
  const evaluate = (usi) => {
    if (!memo.has(usi)) memo.set(usi, evaluator(usi));
    return memo.get(usi);
  };
  const naturalness = (usi) => evaluate(usi).weight;
  const responseMoves = new Set();
  const salient = awareness.threats.filter(({ kind, salience }) => kind === "capture" && salience !== "other");
  if (salient.length) {
    for (const usi of legalMoves) {
      const tags = evaluate(usi).tags;
      const child = playLight(state, usi);
      if (tags.includes("escape") || tags.includes("guard") || salient.some((threat) => threat.attackers.some((square) =>
        attackersOf(child.board, square, me).length > attackersOf(state.board, square, me).length))) responseMoves.add(usi);
    }
  }
  const context = {
    state, me, phase, planMove: plan, naturalness, deadline, responseMoves,
    ownPressureBefore: kingZonePressure(state.board, me),
  };
  let entries = [];
  // 締切に達しても、先頭に並んだ無目的な手だけを評価して返さない。
  const purposefulMoves = legalMoves.filter((usi) => evaluate(usi).purposeful || usi === plan);
  for (const usi of purposefulMoves.length ? purposefulMoves : legalMoves) {
    if (entries.length && Date.now() >= deadline) break;
    const entry = scoreMove(context, usi, noticed);
    if (entry) entries.push(entry);
  }
  if (!entries.length) return result(legalMoves[0], "natural");

  let policy = null;
  if (noticed.hanging && entries.every(({ parts }) => parts.reply <= -600)) {
    policy = random() < takePolicyRateForLevel(level) ? "take" : "attack";
    for (const entry of entries) {
      const bonus = policy === "take" ? (entry.captureGain > 0 ? 250 : 0)
        : entry.parts.check + entry.parts.pressure + entry.parts.threat;
      entry.score += bonus;
    }
  }

  // 相手の1手詰めに気づけば、点数の高い候補から順に、詰まされない手かを確かめる。
  if (noticed.defendMate) {
    const ranked = [...entries].sort((a, b) => b.score - a.score);
    for (const entry of ranked.slice(0, 6)) {
      if (Date.now() > deadline) break;
      const next = childSfen(sfen, entry.usi);
      if (next && findMateLine(next, 1, { nodeLimit: 3000, maxTimeMs: Math.min(60, Math.max(0, deadline - Date.now())) })) entry.score -= MATED_PENALTY;
    }
  }

  // 序盤に定跡を守ると決めた局面では、気づいた得が定跡の手より大きくない限り、定跡の手を指す。
  const tactic = ({ parts }) => parts.capture + parts.reply + parts.threat + parts.promotion + parts.check + parts.response;
  const planEntry = plan && noticed.followPlan ? entries.find(({ usi }) => usi === plan) : null;
  const tempting = planEntry
    ? entries.some((entry) => entry !== planEntry && entry.score > -MATED_PENALTY / 2 && tactic(entry) - tactic(planEntry) >= PLAN_TACTIC_MARGIN)
    : true;
  const picked = planEntry && !tempting && planEntry.score > -MATED_PENALTY / 2
    ? planEntry
    : softmaxPick(entries, perception.temperature, random);
  // 見落としの記録。気づいていれば避けられた損や、取れたのに見逃した駒。
  const missed = [];
  const truth = scoreMove(context, picked.usi, FULL);
  if (!noticed.hanging && truth && truth.parts.reply <= -200) missed.push("hanging");
  if (!noticed.freeCapture) {
    const best = entries.reduce((most, entry) => Math.max(most, entry.captureGain), 0);
    if (best >= 400 && picked.captureGain < best) missed.push("free-capture");
  }
  const naturalReason = evaluate(picked.usi).tags.find((tag) => ["escape", "guard", "develop", "castle-build"].includes(tag));
  const reason = reasonOf(picked, plan);
  return { ...result(picked.usi, reason === "natural" && naturalReason ? naturalReason : reason), missed, policy, score: Math.round(picked.score) };
}

/** 受からない局面で取りに行く割合。Lv間は直線で補う。 */
export function takePolicyRateForLevel(level) {
  const anchors = [[1, 0.9], [5, 0.7], [10, 0.5], [11, 0.48], [20, 0.3], [30, 0.1], [35, 0], [39, 0]];
  const lv = Math.max(1, Math.min(39, level));
  const upper = Math.max(1, anchors.findIndex(([l]) => l >= lv));
  const [lo, rate] = anchors[upper - 1];
  const [hi, next] = anchors[upper];
  return rate + (next - rate) * (lv - lo) / (hi - lo);
}
