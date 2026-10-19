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
  const own = new Set();
  const enemy = new Map();
  for (const [from, piece] of board) {
    for (const to of attackedSquares(board, from)) {
      if (piece.color === color) own.add(to);
      else enemy.set(to, Math.min(enemy.get(to) ?? Infinity, pieceValue(piece.kind)));
    }
  }
  let count = 0;
  for (const [square, piece] of board) {
    if (piece.color === color && piece.kind !== "K" && enemy.has(square)
      && (!own.has(square) || enemy.get(square) < pieceValue(piece.kind))) count += 1;
  }
  return count;
}

/** 自陣へ次の一手で侵入でき、相手の利きが上回るマス。持ち駒の打ちは含めない。 */
export function breakthroughSquares(board, color) {
  const own = new Map();
  const enemy = new Map();
  const entries = new Set();
  for (const [from, piece] of board) {
    const counts = piece.color === color ? own : enemy;
    for (const to of attackedSquares(board, from)) {
      counts.set(to, (counts.get(to) ?? 0) + 1);
      if (piece.color !== color && piece.kind !== "K" && relativeRank(to, color) >= 7
        && board.get(to)?.color !== piece.color) entries.add(to);
    }
  }
  return [...entries].filter((to) => (enemy.get(to) ?? 0) > (own.get(to) ?? 0));
}

/** 特定の味方の駒への当たりを弱めるか、その駒に取り返しの支えを増やす受け。 */
export function guardsSquare(board, after, square, color) {
  if (after.get(square)?.color !== color || board.get(square)?.color !== color) return false;
  const opp = opponentOf(color);
  return attackersOf(after, square, opp).length < attackersOf(board, square, opp).length
    || attackersOf(after, square, color).length > attackersOf(board, square, color).length;
}

/**
 * 変更しない盤の写しを繰り返し調べる処理用。同じ盤の利きを一度だけ集計する。
 * キャッシュは呼び出し元の処理内に閉じ、外部で変更されるMapへは適用しない。
 */
export function createBoardQueries() {
  const cache = new WeakMap();
  const attacksFor = (board) => {
    if (cache.has(board)) return cache.get(board);
    const colors = { black: new Map(), white: new Map() };
    const targets = new Map();
    for (const [from, piece] of board) {
      const squares = attackedSquares(board, from);
      targets.set(from, squares);
      for (const to of squares) {
        const list = colors[piece.color].get(to) ?? [];
        list.push({ square: from, kind: piece.kind });
        colors[piece.color].set(to, list);
      }
    }
    const value = { colors, targets };
    cache.set(board, value);
    return value;
  };
  const attackers = (board, square, color) => cache.has(board)
    ? cache.get(board).colors[color].get(square) ?? [] : attackersOf(board, square, color);
  const hanging = (board, square) => {
    const piece = board.get(square);
    if (!piece || piece.kind === "K") return false;
    const enemy = attackers(board, square, opponentOf(piece.color));
    return enemy.length > 0 && (attackers(board, square, piece.color).length === 0
      || enemy.some(({ kind }) => pieceValue(kind) < pieceValue(piece.kind)));
  };
  return {
    prepare: (board) => { attacksFor(board); },
    attackersOf: attackers,
    isHanging: hanging,
    isKingAttacked: (board, color) => {
      const king = findKing(board, color);
      return Boolean(king && attackers(board, king, opponentOf(color)).length);
    },
    countHanging: (board, color) => {
      attacksFor(board);
      return [...board].filter(([square, piece]) => piece.color === color && hanging(board, square)).length;
    },
    breakthroughSquares: (board, color) => {
      const { colors, targets } = attacksFor(board);
      const opp = opponentOf(color);
      const entries = new Set();
      for (const [from, piece] of board) {
        if (piece.color !== opp || piece.kind === "K") continue;
        for (const to of targets.get(from)) {
          if (relativeRank(to, color) >= 7 && board.get(to)?.color !== opp
            && (colors[opp].get(to)?.length ?? 0) > (colors[color].get(to)?.length ?? 0)) entries.add(to);
        }
      }
      return [...entries];
    },
  };
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
