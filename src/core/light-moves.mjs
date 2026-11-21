// 軽い局面(logic-position.mjsのstateFromSfen・playLight)の合法手の生成(docs/disciple-mode-design.mdの34章。段階E1)。
// tsshogiの合法手の生成は1秒に約3,000局面と遅く、数手先を読む「理由で指す」探索に使えない。
// 盤の写し(Map)のまま、動かす手・成る手・打つ手を作り、自分の玉に王手が残る手・二歩・行き所のない駒・打ち歩詰めを除く。

import { attackedSquares, isKingAttacked, opponentOf, relativeRank, squareXY, xySquare, findKing } from "./piece-movement.mjs";
import { HAND_KINDS, playLight } from "./logic-position.mjs";

const PROMOTABLE = new Set(["P", "L", "N", "S", "B", "R"]);
const ALL_SQUARES = Object.freeze(Array.from({ length: 81 }, (_, index) => xySquare(9 - (index % 9), Math.floor(index / 9) + 1)));

/** その升に置いた駒が、もう動けないか(歩・香は1段目、桂は1・2段目)。 */
function deadEnd(kind, square, color) {
  const rank = relativeRank(square, color);
  if (kind === "P" || kind === "L") return rank <= 1;
  if (kind === "N") return rank <= 2;
  return false;
}

/**
 * 王手を外しているかを確かめない手(自玉に王手が残る手を含む)。
 * @param {{ board: Map<string, { color: string, kind: string }>, hands: Record<string, Record<string, number>>, turn: 'black' | 'white' }} state
 * @returns {string[]}
 */
export function pseudoMoves(state) {
  const me = state.turn;
  const moves = [];
  for (const [from, piece] of state.board) {
    if (piece.color !== me) continue;
    for (const to of attackedSquares(state.board, from, piece)) {
      const target = state.board.get(to);
      if (target?.color === me) continue;
      const canPromote = PROMOTABLE.has(piece.kind) && (relativeRank(from, me) <= 3 || relativeRank(to, me) <= 3);
      if (canPromote) moves.push(`${from}${to}+`);
      if (!deadEnd(piece.kind, to, me)) moves.push(`${from}${to}`);
    }
  }
  const hand = state.hands[me] ?? {};
  const kinds = HAND_KINDS.filter((kind) => (hand[kind] ?? 0) > 0);
  if (kinds.length) {
    const pawnFiles = new Set();
    for (const [square, piece] of state.board) {
      if (piece.color === me && piece.kind === "P") pawnFiles.add(square[0]);
    }
    for (const square of ALL_SQUARES) {
      if (state.board.has(square)) continue;
      for (const kind of kinds) {
        if (deadEnd(kind, square, me)) continue;
        if (kind === "P" && pawnFiles.has(square[0])) continue;
        moves.push(`${kind}*${square}`);
      }
    }
  }
  return moves;
}

/** 歩を打って王手しているか(打ち歩詰めの確かめが要るか)。 */
function pawnDropCheck(state, usi) {
  if (!usi.startsWith("P*")) return false;
  const opp = opponentOf(state.turn);
  const king = findKing(state.board, opp);
  if (!king) return false;
  const { x, y } = squareXY(usi.slice(2));
  return xySquare(x, y + (state.turn === "black" ? -1 : 1)) === king;
}

/**
 * 合法手(USI)。順はtsshogiと違う。
 * @param {{ board: Map<string, any>, hands: Record<string, Record<string, number>>, turn: 'black' | 'white' }} state
 * @returns {string[]}
 */
export function legalMoves(state) {
  const me = state.turn;
  const result = [];
  for (const usi of pseudoMoves(state)) {
    const child = playLight(state, usi);
    if (!child || isKingAttacked(child.board, me)) continue;
    // 打ち歩詰め: 歩を打って王手し、相手に合法手がない。
    if (pawnDropCheck(state, usi) && !hasLegalMove(child)) continue;
    result.push(usi);
  }
  return result;
}

/** 合法手が1つでもあるか(全部を作らずに止める)。 */
export function hasLegalMove(state) {
  const me = state.turn;
  for (const usi of pseudoMoves(state)) {
    const child = playLight(state, usi);
    if (!child || isKingAttacked(child.board, me)) continue;
    if (pawnDropCheck(state, usi) && !hasLegalMove(child)) continue;
    return true;
  }
  return false;
}

/** 手番の側が詰んでいるか(王手されていて合法手がない)。 */
export function isCheckmated(state) {
  return isKingAttacked(state.board, state.turn) && !hasLegalMove(state);
}
