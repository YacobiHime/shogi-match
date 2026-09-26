import { parseSfenBoard } from "./sfen-board.mjs";

/** 自然さ・駒得判定用の簡易駒価値。 */
export const PIECE_VALUES = Object.freeze({
  P: 1, L: 3, N: 3, S: 4, G: 5, B: 7, R: 8, K: 100,
  "+P": 5, "+L": 5, "+N": 5, "+S": 5, "+B": 9, "+R": 10,
});

const GOLD_STEPS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
const KING_STEPS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const DIAGONALS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const ORTHOGONALS = [[0, -1], [-1, 0], [1, 0], [0, 1]];

// 先手基準の[dx, dy]。dyが負なら前進。
const BLACK_VECTORS = {
  P: { steps: [[0, -1]], slides: [] },
  L: { steps: [], slides: [[0, -1]] },
  N: { steps: [[-1, -2], [1, -2]], slides: [] },
  S: { steps: [[-1, -1], [0, -1], [1, -1], [-1, 1], [1, 1]], slides: [] },
  G: { steps: GOLD_STEPS, slides: [] },
  "+P": { steps: GOLD_STEPS, slides: [] },
  "+L": { steps: GOLD_STEPS, slides: [] },
  "+N": { steps: GOLD_STEPS, slides: [] },
  "+S": { steps: GOLD_STEPS, slides: [] },
  K: { steps: KING_STEPS, slides: [] },
  B: { steps: [], slides: DIAGONALS },
  R: { steps: [], slides: ORTHOGONALS },
  "+B": { steps: ORTHOGONALS, slides: DIAGONALS },
  "+R": { steps: DIAGONALS, slides: ORTHOGONALS },
};

const vectorCache = new Map();

export function pieceVectors(kind, color) {
  const key = `${color}:${kind}`;
  if (!vectorCache.has(key)) {
    const base = BLACK_VECTORS[kind] ?? { steps: [], slides: [] };
    const flip = color === "white" ? -1 : 1;
    vectorCache.set(key, {
      steps: base.steps.map(([dx, dy]) => [dx * flip, dy * flip]),
      slides: base.slides.map(([dx, dy]) => [dx * flip, dy * flip]),
    });
  }
  return vectorCache.get(key);
}

export function squareXY(square) {
  return { x: Number(square[0]), y: square.charCodeAt(1) - 96 };
}

export function xySquare(x, y) {
  return x >= 1 && x <= 9 && y >= 1 && y <= 9 ? `${x}${String.fromCharCode(96 + y)}` : null;
}

export function opponentOf(color) {
  return color === "black" ? "white" : "black";
}

/** 手番側から見た段(1が敵陣奥、9が自陣奥)。 */
export function relativeRank(square, color) {
  const { y } = squareXY(square);
  return color === "white" ? 10 - y : y;
}

/** 手番側から見た筋(先手の筋番号へ揃える)。 */
export function relativeFile(square, color) {
  const { x } = squareXY(square);
  return color === "white" ? 10 - x : x;
}

export function pieceValue(kind) {
  return PIECE_VALUES[kind] ?? 0;
}

/** 盤上の駒が利いている升を列挙する。 */
export function attackedSquares(board, from, piece = board.get(from)) {
  if (!piece) return [];
  const { x, y } = squareXY(from);
  const { steps, slides } = pieceVectors(piece.kind, piece.color);
  const result = [];
  for (const [dx, dy] of steps) {
    const square = xySquare(x + dx, y + dy);
    if (square) result.push(square);
  }
  for (const [dx, dy] of slides) {
    let cx = x + dx;
    let cy = y + dy;
    let square = xySquare(cx, cy);
    while (square) {
      result.push(square);
      if (board.has(square)) break;
      cx += dx;
      cy += dy;
      square = xySquare(cx, cy);
    }
  }
  return result;
}

function attacks(board, from, piece, to) {
  const a = squareXY(from);
  const b = squareXY(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return false;
  const { steps, slides } = pieceVectors(piece.kind, piece.color);
  if (steps.some(([sx, sy]) => sx === dx && sy === dy)) return true;
  for (const [sx, sy] of slides) {
    const n = sx !== 0 ? dx / sx : dy / sy;
    if (!Number.isInteger(n) || n < 1 || sx * n !== dx || sy * n !== dy) continue;
    let clear = true;
    for (let i = 1; i < n; i += 1) {
      if (board.has(xySquare(a.x + sx * i, a.y + sy * i))) {
        clear = false;
        break;
      }
    }
    if (clear) return true;
  }
  return false;
}

/** 指定升へ利いている、指定色の駒を返す。 */
export function attackersOf(board, square, color) {
  const result = [];
  for (const [from, piece] of board) {
    if (piece.color === color && attacks(board, from, piece, square)) {
      result.push({ square: from, kind: piece.kind });
    }
  }
  return result;
}

export function findKing(board, color) {
  for (const [square, piece] of board) {
    if (piece.color === color && piece.kind === "K") return square;
  }
  return null;
}

export function isKingAttacked(board, color) {
  const king = findKing(board, color);
  return Boolean(king && attackersOf(board, king, opponentOf(color)).length);
}

/**
 * 相手に取られると損をする駒か。無防備か、自分より安い駒に狙われていれば真。
 */
export function isHanging(board, square) {
  const piece = board.get(square);
  if (!piece || piece.kind === "K") return false;
  const attackers = attackersOf(board, square, opponentOf(piece.color));
  if (!attackers.length) return false;
  if (!attackersOf(board, square, piece.color).length) return true;
  return Math.min(...attackers.map(({ kind }) => pieceValue(kind))) < pieceValue(piece.kind);
}

export function countHanging(board, color) {
  let count = 0;
  for (const [square, piece] of board) {
    if (piece.color === color && isHanging(board, square)) count += 1;
  }
  return count;
}

const UNPROMOTE = { "+P": "P", "+L": "L", "+N": "N", "+S": "S", "+B": "B", "+R": "R" };

export function parseUsiMove(usi) {
  const drop = /^([PLNSGBR])\*([1-9][a-i])$/.exec(usi);
  if (drop) return { drop: drop[1], from: null, to: drop[2], promote: false };
  const move = /^([1-9][a-i])([1-9][a-i])(\+?)$/.exec(usi);
  if (!move) return null;
  return { drop: null, from: move[1], to: move[2], promote: move[3] === "+" };
}

/** 盤面の写しへUSIの手を適用する。合法性は呼び出し側で保証する。 */
export function applyUsiToBoard(board, usi, color) {
  const parsed = parseUsiMove(usi);
  if (!parsed) return null;
  const next = new Map(board);
  const captured = next.get(parsed.to) ?? null;
  let kind;
  if (parsed.drop) {
    kind = parsed.drop;
  } else {
    const piece = next.get(parsed.from);
    if (!piece) return null;
    kind = parsed.promote && !piece.kind.startsWith("+") ? `+${piece.kind}` : piece.kind;
    next.delete(parsed.from);
  }
  next.set(parsed.to, { color, kind });
  return {
    board: next,
    captured: captured ? { ...captured, handKind: UNPROMOTE[captured.kind] ?? captured.kind } : null,
    moved: { ...parsed, kind },
  };
}

/** SFENから盤面と手番を読む。 */
export function parseSfenState(sfen) {
  const fields = String(sfen ?? "").replace(/^sfen\s+/, "").trim().split(/\s+/);
  return {
    board: parseSfenBoard(fields.join(" ")),
    turn: fields[1] === "w" ? "white" : "black",
    moveNumber: Number(fields[3]) || 1,
  };
}
