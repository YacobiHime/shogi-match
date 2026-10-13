// ロジックAI。Lv1〜10のCPUを、エンジンの探索を使わず、ルールだけで指させる。
// 強さは「何に気づけるか」で分ける。気づかなかった項目は点数に入らず、その手は見えていないのと同じになる。
// - 序盤: 決めた戦法・囲いの定跡手を指す。タダの駒や、取られそうな自分の駒に気づいたら、そちらを優先する。
// - 中盤: 駒得を狙う。取り合いは、駒を取る手だけを数手先まで読む(取る手の読み)。
// - 終盤: 王手と玉の周りへの利きを高く見る。詰み(1手・3手)に気づけば詰ます。相手の1手詰めに気づけば防ぐ。
// 設計は docs/logic-ai-design.md。数値は仮の値で、自己対局で合わせる。

import { Position } from "tsshogi";
import {
  applyUsiToBoard,
  attackedSquares,
  attackersOf,
  findKing,
  isKingAttacked,
  opponentOf,
  parseSfenState,
  relativeRank,
  squareXY,
  xySquare,
} from "./piece-movement.mjs";
import { createNaturalnessEvaluator } from "./move-naturalness.mjs";
import { findMateLine } from "./problem-solver";

export const LOGIC_AI_MIN_LEVEL = 1;
export const LOGIC_AI_MAX_LEVEL = 10;

/** ロジックAIで指すレベルか。Lv0(読まずに自然さだけで指す)と、Lv11以上(エンジン)は使わない。 */
export function usesLogicAi(level) {
  return Number.isInteger(level) && level >= LOGIC_AI_MIN_LEVEL && level <= LOGIC_AI_MAX_LEVEL;
}

/** 駒の価値(歩=100)。成り駒は、取られると元の駒として相手の持ち駒になる。 */
export const LOGIC_PIECE_VALUES = Object.freeze({
  P: 100, L: 300, N: 400, S: 500, G: 600, B: 800, R: 1000, K: 0,
  "+P": 500, "+L": 500, "+N": 500, "+S": 550, "+B": 1100, "+R": 1300,
});
const KING_CAPTURE = 20000;
const UNPROMOTE = Object.freeze({ "+P": "P", "+L": "L", "+N": "N", "+S": "S", "+B": "B", "+R": "R" });
const PROMOTABLE = new Set(["P", "L", "N", "S", "B", "R"]);
const HAND_KINDS = ["R", "B", "G", "S", "N", "L", "P"];

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
  exchange: [0, 0, 0.3, 0.6, 0.75],
  threat: [0, 0, 0.2, 0.4, 0.55],
  mate1: [0, 0, 0.3, 0.7, 0.9],
  mate3: [0, 0, 0, 0, 0.3],
  defendMate: [0, 0, 0.2, 0.6, 0.8],
  followPlan: [0.6, 0.7, 0.8, 0.9, 0.95],
  temperature: [220, 170, 130, 90, 70],
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

function parseHands(sfen) {
  const field = String(sfen ?? "").replace(/^sfen\s+/, "").trim().split(/\s+/)[2] ?? "-";
  const hands = { black: {}, white: {} };
  if (field === "-") return hands;
  let count = "";
  for (const char of field) {
    if (/[0-9]/.test(char)) {
      count += char;
      continue;
    }
    const color = char === char.toUpperCase() ? "black" : "white";
    const kind = char.toUpperCase();
    hands[color][kind] = (hands[color][kind] ?? 0) + (count ? Number(count) : 1);
    count = "";
  }
  return hands;
}

function stateFromSfen(sfen) {
  const { board, turn } = parseSfenState(sfen);
  return { board, hands: parseHands(sfen), turn };
}

function copyHands(hands) {
  return { black: { ...hands.black }, white: { ...hands.white } };
}

/** 軽い局面にUSIの手を指す。合法性は呼び出し側で保証する。 */
function playLight(state, usi) {
  const color = state.turn;
  const applied = applyUsiToBoard(state.board, usi, color);
  if (!applied) return null;
  const hands = copyHands(state.hands);
  if (applied.moved.drop) hands[color][applied.moved.drop] = Math.max(0, (hands[color][applied.moved.drop] ?? 0) - 1);
  if (applied.captured && applied.captured.kind !== "K") {
    hands[color][applied.captured.handKind] = (hands[color][applied.captured.handKind] ?? 0) + 1;
  }
  return { board: applied.board, hands, turn: opponentOf(color), captured: applied.captured };
}

const value = (kind) => LOGIC_PIECE_VALUES[kind] ?? 0;

/** 手番に関係なく、sideから見た駒の損得(盤上と持ち駒)。 */
function material(state, side) {
  let total = 0;
  for (const piece of state.board.values()) {
    total += piece.color === side ? value(piece.kind) : -value(piece.kind);
  }
  for (const kind of HAND_KINDS) {
    total += (state.hands[side][kind] ?? 0) * value(kind) - (state.hands[opponentOf(side)][kind] ?? 0) * value(kind);
  }
  return total;
}

function inPromotionZone(square, color) {
  return relativeRank(square, color) <= 3;
}

/** sideが盤上の駒で取れる手(取る駒の高い順、取る側の安い順)。成れるなら成る。 */
function captureMoves(board, side) {
  const moves = [];
  for (const [from, piece] of board) {
    if (piece.color !== side) continue;
    for (const to of attackedSquares(board, from, piece)) {
      const target = board.get(to);
      if (!target || target.color === side) continue;
      const promote = PROMOTABLE.has(piece.kind) && (inPromotionZone(from, side) || inPromotionZone(to, side));
      moves.push({ usi: `${from}${to}${promote ? "+" : ""}`, gain: value(target.kind), cost: value(piece.kind), king: target.kind === "K" });
    }
  }
  return moves.sort((a, b) => b.gain - a.gain || a.cost - b.cost);
}

/**
 * 取る手だけの読み(静止探索)。手番側から見た駒の損得を返す。取らずに止めることもできる(取ると損なら取らない)。
 * depthは読む手数。玉を取れる局面は、大きな値にする(王手を放っておいた手)。
 */
function captureSearch(state, depth, alpha = -Infinity, beta = Infinity) {
  const side = state.turn;
  const standPat = material(state, side);
  if (depth <= 0) return standPat;
  let best = standPat;
  if (best >= beta) return best;
  if (best > alpha) alpha = best;
  for (const move of captureMoves(state.board, side)) {
    if (move.king) return KING_CAPTURE;
    const child = playLight(state, move.usi);
    if (!child) continue;
    const score = -captureSearch(child, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** 玉と8近傍のうち、相手の利きがある升の数。 */
function kingZonePressure(board, kingColor) {
  const king = findKing(board, kingColor);
  if (!king) return 0;
  const { x, y } = squareXY(king);
  const attacker = opponentOf(kingColor);
  let count = 0;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const square = xySquare(x + dx, y + dy);
      if (square && attackersOf(board, square, attacker).length) count += 1;
    }
  }
  return count;
}

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
  const parts = { capture: 0, promotion: promotionGain, reply: 0, threat: 0, check: 0, pressure: 0, king: 0, natural: 0, plan: 0 };
  if (captureGain && noticed.freeCapture) parts.capture = captureGain;
  // 指したあと、相手が駒を取ってくる損。取り返しまで読めれば、取り合いの損得で見る。
  if (noticed.hanging) {
    const depth = noticed.exchange ? 4 : 1;
    parts.reply = -Math.max(0, captureSearch(child, depth) - material(child, opponentOf(me)));
  }
  // 次に駒を取れる狙い(当たり・両取り)。相手の応手は考えない分、割り引く。
  if (noticed.threat) {
    const again = { ...child, turn: me };
    parts.threat = Math.max(0, captureSearch(again, 2) - material(again, me)) * THREAT_SHARE;
  }
  const check = isKingAttacked(child.board, opponentOf(me));
  if (check) parts.check = CHECK_BONUS[phase];
  parts.pressure = kingZonePressure(child.board, opponentOf(me)) * KING_PRESSURE_BONUS[phase];
  parts.king = -Math.max(0, kingZonePressure(child.board, me) - ownPressureBefore) * OWN_KING_PENALTY;
  parts.natural = Math.log(Math.max(0.02, naturalness(usi))) * NATURALNESS_SCALE;
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
 * @returns {{ move: string, kind: 'logic', reason: string, missed: string[], phase: string } | null}
 */
export function chooseLogicMove({ sfen, legalMoves, level, moveHistory = [], planMove = null, random = Math.random, maxTimeMs = 600 }) {
  if (!legalMoves?.length) return null;
  const deadline = Date.now() + maxTimeMs;
  const perception = logicPerception(level);
  const noticed = rollPerception(perception, random);
  const state = stateFromSfen(sfen);
  const me = state.turn;
  const ply = moveHistory.length;
  const plan = planMove && legalMoves.includes(planMove) ? planMove : null;
  const phase = logicPhase({ state, ply, planMove: plan });
  const result = (move, reason, extra = {}) => ({ move, kind: "logic", reason, missed: [], phase, ...extra });

  // 詰みに気づけば詰ます。
  const mateLine = (plies) => {
    const line = findMateLine(sfen, plies, { nodeLimit: plies > 1 ? 15000 : 4000, maxTimeMs: plies > 1 ? 200 : 80 });
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

  const evaluate = createNaturalnessEvaluator(sfen, { moveHistory, simplicity: 0.6 });
  const naturalness = (usi) => evaluate(usi).weight;
  const context = {
    state, me, phase, planMove: plan, naturalness,
    ownPressureBefore: kingZonePressure(state.board, me),
  };
  const entries = [];
  for (const usi of legalMoves) {
    const entry = scoreMove(context, usi, noticed);
    if (entry) entries.push(entry);
  }
  if (!entries.length) return result(legalMoves[0], "natural");

  // 相手の1手詰めに気づけば、点数の高い候補から順に、詰まされない手かを確かめる。
  if (noticed.defendMate) {
    const ranked = [...entries].sort((a, b) => b.score - a.score);
    for (const entry of ranked.slice(0, 6)) {
      if (Date.now() > deadline) break;
      const next = childSfen(sfen, entry.usi);
      if (next && findMateLine(next, 1, { nodeLimit: 3000, maxTimeMs: 60 })) entry.score -= MATED_PENALTY;
    }
  }

  // 序盤に定跡を守ると決めた局面では、気づいた得が定跡の手より大きくない限り、定跡の手を指す。
  const tactic = ({ parts }) => parts.capture + parts.reply + parts.threat + parts.promotion + parts.check;
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
  return { ...result(picked.usi, reasonOf(picked, plan)), missed, score: Math.round(picked.score) };
}
