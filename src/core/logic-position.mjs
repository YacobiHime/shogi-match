import { applyUsiToBoard, attackedSquares, attackersOf, findKing, isKingAttacked, opponentOf, parseSfenState, relativeRank, squareXY, xySquare } from "./piece-movement.mjs";
/** 駒の価値(歩=100)。成り駒は、取られると元の駒として相手の持ち駒になる。 */
export const LOGIC_PIECE_VALUES = Object.freeze({
  P: 100, L: 300, N: 400, S: 500, G: 600, B: 800, R: 1000, K: 0,
  "+P": 500, "+L": 500, "+N": 500, "+S": 550, "+B": 1100, "+R": 1300,
});
const KING_CAPTURE = 20000;
const UNPROMOTE = Object.freeze({ "+P": "P", "+L": "L", "+N": "N", "+S": "S", "+B": "B", "+R": "R" });
const PROMOTABLE = new Set(["P", "L", "N", "S", "B", "R"]);
export const HAND_KINDS = ["R", "B", "G", "S", "N", "L", "P"];

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

export function stateFromSfen(sfen) {
  const { board, turn } = parseSfenState(sfen);
  return { board, hands: parseHands(sfen), turn };
}

function copyHands(hands) {
  return { black: { ...hands.black }, white: { ...hands.white } };
}

/** 軽い局面にUSIの手を指す。合法性は呼び出し側で保証する。 */
export function playLight(state, usi) {
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

export const value = (kind) => LOGIC_PIECE_VALUES[kind] ?? 0;

/** 手番に関係なく、sideから見た駒の損得(盤上と持ち駒)。 */
export function material(state, side) {
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
export function captureMoves(board, side, includePromotions = true) {
  const moves = [];
  for (const [from, piece] of board) {
    if (piece.color !== side) continue;
    for (const to of attackedSquares(board, from, piece)) {
      const target = board.get(to);
      if (target?.color === side) continue;
      const promote = PROMOTABLE.has(piece.kind) && (inPromotionZone(from, side) || inPromotionZone(to, side));
      if (!target && (!includePromotions || !promote)) continue;
      moves.push({ usi: `${from}${to}${promote ? "+" : ""}`, gain: target ? value(target.kind) : 0, cost: value(piece.kind), king: target?.kind === "K" });
    }
  }
  return moves.sort((a, b) => b.gain - a.gain || a.cost - b.cost);
}

/**
 * 取る手だけの読み(静止探索)。手番側から見た駒の損得を返す。取らずに止めることもできる(取ると損なら取らない)。
 * depthは読む手数。玉を取れる局面は、大きな値にする(王手を放っておいた手)。
 */
export function captureSearch(state, depth, alpha = -Infinity, beta = Infinity, deadline = Infinity) {
  const side = state.turn;
  const standPat = material(state, side);
  if (depth <= 0 || Date.now() >= deadline) return standPat;
  let best = standPat;
  if (best >= beta) return best;
  if (best > alpha) alpha = best;
  for (const move of captureMoves(state.board, side)) {
    if (Date.now() >= deadline) break;
    if (move.king) return KING_CAPTURE;
    const child = playLight(state, move.usi);
    if (!child || isKingAttacked(child.board, side)) continue;
    const score = -captureSearch(child, depth - 1, -beta, -alpha, deadline);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * 持ち歩を大駒の頭へ打たれる圧力。取りと成りだけの読みでは見えない突破の種を、
 * 盤上の利きで見積もる（打つ手を静止探索には追加しない）。二歩・行き所なしも除く。
 */
export function handPressureLoss(state, defender) {
  const attacker = opponentOf(defender);
  if (!(state.hands[attacker].P > 0)) return 0;
  let loss = 0;
  for (const [square, piece] of state.board) {
    if (piece.color !== defender || !["R", "B", "+R", "+B"].includes(piece.kind)) continue;
    const { x, y } = squareXY(square);
    const drop = xySquare(x, y + (attacker === "black" ? 1 : -1));
    if (!drop || state.board.has(drop) || relativeRank(drop, attacker) <= 1) continue;
    if ([...state.board].some(([s, p]) => s[0] === square[0] && p.color === attacker && p.kind === "P")) continue;
    const defenders = attackersOf(state.board, drop, defender);
    const attackers = attackersOf(state.board, drop, attacker);
    if (defenders.length > attackers.length) continue;
    // 持ち歩による当たりは次の手の狙いなので、確定した取りの損より割り引く。
    loss = Math.max(loss, (value(piece.kind) - value("P")) * 0.7);
  }
  return loss;
}

/** 取り・成り込みの読みと、手駒からの突破の圧力による損。 */
export function replyLoss(state, depth, deadline = Infinity) {
  return Math.max(0, captureSearch(state, depth, -Infinity, Infinity, deadline) - material(state, state.turn))
    + handPressureLoss(state, opponentOf(state.turn));
}

/** 玉と8近傍のうち、相手の利きがある升の数。 */
export function kingZonePressure(board, kingColor) {
  const king = findKing(board, kingColor);
  if (!king) return 0;
  const { x, y } = squareXY(king);
  const attacker = opponentOf(kingColor);
  const zone = new Set();
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const square = xySquare(x + dx, y + dy);
      if (square) zone.add(square);
    }
  }
  const covered = new Set();
  for (const [from, piece] of board) {
    if (piece.color !== attacker) continue;
    for (const square of attackedSquares(board, from)) if (zone.has(square)) covered.add(square);
  }
  return covered.size;
}

