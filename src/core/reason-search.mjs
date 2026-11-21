// 「理由で指す」棋士の数手先の読み(docs/disciple-mode-design.mdの34章。段階E2)。
// 局面を1つの数で測る評価関数は使わず、駒の損得(将棋AIで使われる駒の価値。成り駒の値も含む)と詰みだけで比べる。
// 読むのは強い手だけ: 駒を取る・成る・王手・両取り(2つ以上の駒に当たる)・大駒への当たり。相手の手番では、
// 当たりになっている駒を逃がす手も読む。末端は取る手と成る手だけの静止探索。
// 「何もしなければ取られる駒がある」局面では、その損を差し引いて数える(当たり・両取りの得を、取る前から見えるようにする)。

import { AI_PIECE_POINTS } from "./piece-points.mjs";
import { attackedSquares, attackersOf, findKing, isKingAttacked, opponentOf, relativeRank } from "./piece-movement.mjs";
import { HAND_KINDS, playLight } from "./logic-position.mjs";
import { legalMoves, pseudoMoves } from "./light-moves.mjs";

/** 駒の価値(将棋AIで使われる値。piece-points.mjsのAI_PIECE_POINTS)。玉は0、取ると勝ち。 */
export const REASON_VALUES = Object.freeze({ ...AI_PIECE_POINTS, K: 0 });
/** 詰みの値(手数で少しずつ小さくする)。 */
export const MATE_SCORE = 30000;
const PROMOTABLE = new Set(["P", "L", "N", "S", "B", "R"]);
const BIG = new Set(["R", "B", "+R", "+B"]);
const val = (kind) => REASON_VALUES[kind] ?? 0;

/** sideから見た駒の損得(盤上と持ち駒。持ち駒は元の駒の価値)。 */
export function materialOf(state, side) {
  let total = 0;
  for (const piece of state.board.values()) total += piece.color === side ? val(piece.kind) : -val(piece.kind);
  const opp = opponentOf(side);
  for (const kind of HAND_KINDS) total += ((state.hands[side][kind] ?? 0) - (state.hands[opp][kind] ?? 0)) * val(kind);
  return total;
}

/** 自玉に王手が残らない手なら、指したあとの局面。 */
function legalChild(state, usi) {
  const child = playLight(state, usi);
  if (!child || isKingAttacked(child.board, state.turn)) return null;
  return child;
}

/** 取る手と成る手(盤上の駒の、成れるなら成る手)。得の大きい順。 */
function noisyMoves(state) {
  const me = state.turn;
  const list = [];
  for (const [from, piece] of state.board) {
    if (piece.color !== me) continue;
    for (const to of attackedSquares(state.board, from, piece)) {
      const target = state.board.get(to);
      if (target?.color === me) continue;
      const promote = PROMOTABLE.has(piece.kind) && (relativeRank(from, me) <= 3 || relativeRank(to, me) <= 3);
      if (!target && !promote) continue;
      const gain = (target ? val(target.kind) : 0) + (promote ? val(`+${piece.kind}`) - val(piece.kind) : 0);
      list.push({ usi: `${from}${to}${promote ? "+" : ""}`, gain: gain - val(piece.kind) / 100, king: target?.kind === "K" });
    }
  }
  return list.sort((a, b) => b.gain - a.gain);
}

/** 取る手・成る手だけの静止探索。手番の側から見た駒の損得。 */
function quiesce(state, depth, alpha, beta, ctx) {
  ctx.nodes += 1;
  const side = state.turn;
  const stand = materialOf(state, side);
  if (depth <= 0 || ctx.nodes > ctx.maxNodes) return stand;
  let best = stand;
  if (best >= beta) return best;
  if (best > alpha) alpha = best;
  for (const move of noisyMoves(state)) {
    if (move.king) return MATE_SCORE;
    const child = legalChild(state, move.usi);
    if (!child) continue;
    const score = -quiesce(child, depth - 1, -beta, -alpha, ctx);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** 何もしなければ相手が取り合いで得をする量(手番の側の損)と、いちばん高い当たりの駒の升。 */
function idleLoss(state, ctx) {
  const opp = opponentOf(state.turn);
  const flipped = { ...state, turn: opp, captured: null };
  const gain = quiesce(flipped, ctx.qdepth, -Infinity, Infinity, ctx) - materialOf(state, opp);
  return Math.max(0, gain);
}

/** 何もしなければ取られる損(手番の側から見た量)。 */
export function idleLossOf(state, qdepth) {
  return idleLoss(state, { nodes: 0, maxNodes: 20000, qdepth, deadline: Infinity });
}

/** 当たりになっている自分の駒の升(価値の高い順)。 */
function attackedOwn(state) {
  const me = state.turn;
  const opp = opponentOf(me);
  const list = [];
  for (const [square, piece] of state.board) {
    if (piece.color !== me || piece.kind === "K") continue;
    if (attackersOf(state.board, square, opp).length) list.push({ square, value: val(piece.kind) });
  }
  return list.sort((a, b) => b.value - a.value).map((item) => item.square);
}

/**
 * 強い手(取る・成る・王手・両取り・大駒への当たり)。王手は動いた駒が玉に利く直接の王手だけ(開き王手は数えない)。
 * @returns {string[]}
 */
function forcingMoves(state, { threats }) {
  const me = state.turn;
  const opp = opponentOf(me);
  const king = findKing(state.board, opp);
  const result = [];
  for (const usi of pseudoMoves(state)) {
    const dest = usi.endsWith("+") ? usi.slice(2, 4) : usi.slice(-2);
    const target = state.board.get(dest);
    if (target && target.color === opp) {
      result.push(usi);
      continue;
    }
    if (usi.endsWith("+")) {
      result.push(usi);
      continue;
    }
    const child = playLight(state, usi);
    if (!child) continue;
    const moved = child.board.get(dest);
    const hits = attackedSquares(child.board, dest, moved);
    if (king && hits.includes(king)) {
      result.push(usi);
      continue;
    }
    if (!threats) continue;
    // 両取り(価値のある駒2つ以上に当たる)と、自分より高い大駒への当たり。
    const mine = val(moved.kind);
    let targets = 0;
    let bigHit = false;
    for (const square of hits) {
      const piece = child.board.get(square);
      if (piece?.color !== opp || piece.kind === "K") continue;
      const defended = attackersOf(child.board, square, opp).length > 0;
      if (val(piece.kind) > mine || !defended) targets += 1;
      if (BIG.has(piece.kind) && val(piece.kind) > mine) bigHit = true;
    }
    if (targets >= 2 || bigHit) result.push(usi);
  }
  return result;
}

/**
 * 数手先の読み(負けない最大を返すネガマックス)。手番の側から見た駒の損得。
 * @param {{ nodes: number, maxNodes: number, qdepth: number, deadline: number }} ctx
 * @returns {{ score: number, line: string[] }}
 */
function search(state, depth, alpha, beta, ply, ctx) {
  ctx.nodes += 1;
  const me = state.turn;
  const inCheck = isKingAttacked(state.board, me);
  if (inCheck) {
    // 王手されたら、すべての逃げ方を読む(読みの手数を使わない)。
    const evasions = legalMoves(state);
    if (!evasions.length) return { score: -MATE_SCORE + ply, line: [] };
    let best = { score: -Infinity, line: [] };
    for (const usi of evasions) {
      const child = playLight(state, usi);
      const next = search(child, depth - 1, -beta, -alpha, ply + 1, ctx);
      const score = -next.score;
      if (score > best.score) best = { score, line: [usi, ...next.line] };
      if (score > alpha) alpha = score;
      if (alpha >= beta || ctx.nodes > ctx.maxNodes || Date.now() > ctx.deadline) break;
    }
    return best;
  }
  if (depth <= 0 || ctx.nodes > ctx.maxNodes || Date.now() > ctx.deadline) {
    return { score: quiesce(state, ctx.qdepth, alpha, beta, ctx), line: [] };
  }
  // 何もしない(静かな手を指す)なら取られる損を差し引いた値を、下限にする。
  let best = { score: materialOf(state, me) - idleLoss(state, ctx), line: [] };
  if (best.score >= beta) return best;
  if (best.score > alpha) alpha = best.score;
  const moves = forcingMoves(state, { threats: depth >= 2 });
  // 当たりになっている駒があれば、その駒を動かす手も読む(逃げる)。
  const threatened = attackedOwn(state).slice(0, 2);
  if (threatened.length) {
    for (const usi of pseudoMoves(state)) if (threatened.some((square) => usi.startsWith(square)) && !moves.includes(usi)) moves.push(usi);
  }
  for (const usi of moves) {
    const child = legalChild(state, usi);
    if (!child) continue;
    if (child.captured?.kind === "K") return { score: MATE_SCORE - ply, line: [usi] };
    const next = search(child, depth - 1, -beta, -alpha, ply + 1, ctx);
    const score = -next.score;
    if (score > best.score) best = { score, line: [usi, ...next.line] };
    if (score > alpha) alpha = score;
    if (alpha >= beta || ctx.nodes > ctx.maxNodes || Date.now() > ctx.deadline) break;
  }
  return best;
}

/**
 * 根の各手を読む。指したあと相手から読み、手番の側(根)から見た駒の損得の変化と読み筋を返す。
 * @param {{ board: Map<string, any>, hands: any, turn: 'black' | 'white' }} state
 * @param {string[]} moves 根の合法手
 * @param {{ depth: number, qdepth: number, maxNodes?: number, deadline?: number }} options depthは根の手のあとに読む強い手の手数
 * @returns {Map<string, { delta: number, line: string[], mate: boolean }>}
 */
export function readMoves(state, moves, { depth, qdepth, maxNodes = 60000, deadline = Infinity }) {
  const me = state.turn;
  const base = materialOf(state, me);
  const children = [];
  for (const usi of moves) {
    const child = legalChild(state, usi);
    if (child) children.push({ usi, child });
  }
  // 1手ずつ深く読む。どの手も読み切れた、いちばん深い手数の結果を使う(途中で打ち切った読みは、値がゆがむので使わない)。
  let result = new Map();
  let used = 0;
  for (let d = 0; d <= depth; d += 1) {
    const next = new Map();
    let complete = true;
    for (const { usi, child } of children) {
      const ctx = { nodes: 0, maxNodes: Infinity, qdepth, deadline };
      const read = child.captured?.kind === "K" ? { score: -MATE_SCORE, line: [] } : search(child, d, -Infinity, Infinity, 1, ctx);
      used += ctx.nodes;
      if (used > maxNodes || Date.now() > deadline) {
        complete = false;
        break;
      }
      const score = -read.score;
      next.set(usi, { delta: score - base, line: [usi, ...read.line], mate: score >= MATE_SCORE - 100, depth: d });
    }
    if (!complete) break;
    result = next;
  }
  return result;
}
