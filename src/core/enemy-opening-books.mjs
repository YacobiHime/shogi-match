import shogiLib from './vendor/shogi.esm.js';
import { isLegalDrop, isLegalMove } from './legal-moves.mjs';

const { Shogi, Color, Piece } = shogiLib;

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const SQUARE_PATTERN = /^[1-9][a-i]$/;
const USI_MOVE_PATTERN = /^(?:[1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/;
const PIECE_KINDS = Object.freeze({
  P: 'FU',
  L: 'KY',
  N: 'KE',
  S: 'GI',
  G: 'KI',
  B: 'KA',
  R: 'HI',
  K: 'OU',
});
const KIND_TO_USI = Object.freeze({
  FU: 'P',
  KY: 'L',
  KE: 'N',
  GI: 'S',
  KI: 'G',
  KA: 'B',
  HI: 'R',
});

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}は空でない文字列にしてください`);
  }
}

function parseSquare(square) {
  return {
    x: Number(square[0]),
    y: square.charCodeAt(1) - 'a'.charCodeAt(0) + 1,
  };
}

function squareToUsi(x, y) {
  return `${x}${String.fromCharCode('a'.charCodeAt(0) + y - 1)}`;
}

function parseUsiMove(move) {
  const boardMove = /^([1-9][a-i])([1-9][a-i])(\+)?$/.exec(move);
  if (boardMove) {
    return {
      from: parseSquare(boardMove[1]),
      to: parseSquare(boardMove[2]),
      promote: Boolean(boardMove[3]),
      piece: null,
    };
  }
  const drop = /^([PLNSGBR])\*([1-9][a-i])$/.exec(move);
  if (drop) {
    return {
      from: null,
      to: parseSquare(drop[2]),
      promote: false,
      piece: PIECE_KINDS[drop[1]],
    };
  }
  throw new Error(`不正なUSI指し手です: ${move}`);
}

function positionFromSfen(sfen) {
  const shogi = new Shogi();
  shogi.initializeFromSFENString(sfen);
  return shogi;
}

function colorForSide(side) {
  return side === 'white' ? Color.White : Color.Black;
}

function matchesCompletion(shogi, book) {
  const color = colorForSide(book.side);
  return book.completion.every((target) => {
    const square = parseSquare(target.square);
    const piece = shogi.get(square.x, square.y);
    return piece?.color === color && piece.kind === PIECE_KINDS[target.piece];
  });
}

function isLegalBookMove(shogi, move, color) {
  const parsed = parseUsiMove(move);
  if (parsed.piece) {
    return isLegalDrop(shogi, Shogi, parsed.to.x, parsed.to.y, parsed.piece, color);
  }
  return isLegalMove(
    shogi,
    Shogi,
    parsed.from.x,
    parsed.from.y,
    parsed.to.x,
    parsed.to.y,
    parsed.promote,
    color,
  );
}

function canPromoteOnMove(piece, fromY, toY) {
  if (!Piece.canPromote(piece.kind)) return false;
  const isPromotionZone = piece.color === Color.White
    ? (y) => y >= 7
    : (y) => y <= 3;
  return isPromotionZone(fromY) || isPromotionZone(toY);
}

function mustPromoteOnMove(piece, toY) {
  return Shogi.getIllegalUnpromotedRow(piece.kind)
    >= Shogi.getRowToOppositeEnd(toY, piece.color);
}

function moveAllowedByConstraints(piece, toX, constraints) {
  if (!constraints?.rook_files || (piece.kind !== 'HI' && piece.kind !== 'RY')) return true;
  return constraints.rook_files.includes(toX);
}

/**
 * searchmovesで通常探索を保ったまま、戦法を壊す飛車移動だけを除外する。
 * 王手への応手を含め、現在局面の合法手をすべて列挙する。
 */
function constrainedLegalMoves(shogi, color, constraints) {
  const moves = [];
  for (let fromX = 1; fromX <= 9; fromX += 1) {
    for (let fromY = 1; fromY <= 9; fromY += 1) {
      const piece = shogi.get(fromX, fromY);
      if (!piece || piece.color !== color) continue;

      for (const candidate of shogi.getMovesFrom(fromX, fromY)) {
        const { x: toX, y: toY } = candidate.to;
        if (!moveAllowedByConstraints(piece, toX, constraints)) continue;
        const base = `${squareToUsi(fromX, fromY)}${squareToUsi(toX, toY)}`;
        const mustPromote = mustPromoteOnMove(piece, toY);
        if (!mustPromote
          && isLegalMove(shogi, Shogi, fromX, fromY, toX, toY, false, color)) {
          moves.push(base);
        }
        if ((mustPromote || canPromoteOnMove(piece, fromY, toY))
          && isLegalMove(shogi, Shogi, fromX, fromY, toX, toY, true, color)) {
          moves.push(`${base}+`);
        }
      }
    }
  }

  for (const drop of shogi.getDropsBy(color)) {
    if (drop.kind === 'HI' && constraints?.rook_files
      && !constraints.rook_files.includes(drop.to.x)) continue;
    if (!isLegalDrop(shogi, Shogi, drop.to.x, drop.to.y, drop.kind, color)) continue;
    moves.push(`${KIND_TO_USI[drop.kind]}*${squareToUsi(drop.to.x, drop.to.y)}`);
  }
  return [...new Set(moves)];
}

function constraintIsActive(book, enemyMoves) {
  if (!book.constraints) return false;
  return enemyMoves.has(book.constraints.activate_after_move);
}

function constrainedDecision(shogi, color, book, enemyMoves, reason) {
  if (!constraintIsActive(book, enemyMoves)) return null;
  const moves = constrainedLegalMoves(shogi, color, book.constraints);
  if (moves.length === 0) return null;
  return { status: 'constrained', moves, reason };
}

function openingProgress(book, moveHistory) {
  const enemyMoveList = moveHistory.filter((_, index) => index % 2 === 1);
  let stepIndex = 0;
  for (const move of enemyMoveList) {
    const step = book.steps[stepIndex];
    if (step?.moves.includes(move)) stepIndex += 1;
  }
  return {
    enemyMoves: new Set(enemyMoveList),
    nextStep: book.steps[stepIndex] || null,
  };
}

/** 敵用の小規模定跡マスタを検証する。 */
export function validateEnemyOpeningBooks(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.books) || value.books.length === 0) {
    throw new Error('enemy_openings.jsonの基本情報が不正です');
  }

  const ids = new Set();
  for (const [bookIndex, book] of value.books.entries()) {
    if (!book || typeof book !== 'object' || Array.isArray(book)) {
      throw new Error(`books[${bookIndex}]が不正です`);
    }
    requireText(book.book_id, `books[${bookIndex}].book_id`);
    requireText(book.name, `books[${bookIndex}].name`);
    if (!ID_PATTERN.test(book.book_id)) {
      throw new Error(`定跡IDが不正です: ${book.book_id}`);
    }
    if (ids.has(book.book_id)) {
      throw new Error(`定跡IDが重複しています: ${book.book_id}`);
    }
    ids.add(book.book_id);
    if (book.side !== 'white') {
      throw new Error(`${book.book_id}.sideはwhiteにしてください`);
    }
    if (!Array.isArray(book.steps) || book.steps.length === 0) {
      throw new Error(`${book.book_id}.stepsは1件以上にしてください`);
    }
    for (const [stepIndex, step] of book.steps.entries()) {
      if (!step || !Array.isArray(step.moves) || step.moves.length === 0
        || step.moves.some((move) => typeof move !== 'string' || !USI_MOVE_PATTERN.test(move))
        || new Set(step.moves).size !== step.moves.length) {
        throw new Error(`${book.book_id}.steps[${stepIndex}].movesが不正です`);
      }
    }
    if (!Array.isArray(book.completion) || book.completion.length === 0) {
      throw new Error(`${book.book_id}.completionは1件以上にしてください`);
    }
    const completionSquares = new Set();
    for (const target of book.completion) {
      if (!target || !SQUARE_PATTERN.test(target.square)
        || !Object.hasOwn(PIECE_KINDS, target.piece)) {
        throw new Error(`${book.book_id}.completionが不正です`);
      }
      if (completionSquares.has(target.square)) {
        throw new Error(`${book.book_id}.completionのマスが重複しています: ${target.square}`);
      }
      completionSquares.add(target.square);
    }
    if (book.constraints !== undefined) {
      const constraints = book.constraints;
      if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)
        || !Array.isArray(constraints.rook_files) || constraints.rook_files.length === 0
        || constraints.rook_files.some((file) => !Number.isInteger(file) || file < 1 || file > 9)
        || new Set(constraints.rook_files).size !== constraints.rook_files.length
        || typeof constraints.activate_after_move !== 'string'
        || !USI_MOVE_PATTERN.test(constraints.activate_after_move)
        || !book.steps.some((step) => step.moves.includes(constraints.activate_after_move))) {
        throw new Error(`${book.book_id}.constraintsが不正です`);
      }
    }
  }
  return value;
}

/**
 * 現局面で敵定跡を続けるため、searchmovesへ渡す合法手を返す。
 * 王手や進路妨害で次の定跡手が指せない場合はblockedとし、通常探索へ委ねる。
 */
export function getEnemyOpeningDecision(book, sfen, moveHistory = []) {
  if (!book) return { status: 'none', moves: [] };
  if (!Array.isArray(moveHistory)) throw new Error('moveHistoryは配列にしてください');

  const shogi = positionFromSfen(sfen);
  const color = colorForSide(book.side);
  if (shogi.turn !== color) return { status: 'blocked', moves: [], reason: 'wrong_turn' };
  // 現行ゲームは人間が先手、敵が後手なので、奇数番目（0始まり）が敵の着手。
  // 同じUSI手が別の駒で再登場する棒銀（歩8c8d→銀8c8d）も、順序付きで追跡する。
  const { enemyMoves, nextStep } = openingProgress(book, moveHistory);
  if (!nextStep) {
    const constrained = constrainedDecision(
      shogi, color, book, enemyMoves,
      matchesCompletion(shogi, book) ? 'formation_complete' : 'book_exhausted',
    );
    if (constrained) return constrained;
    if (matchesCompletion(shogi, book)) return { status: 'complete', moves: [] };
    return { status: 'blocked', moves: [], reason: 'book_exhausted' };
  }

  const legalMoves = nextStep.moves.filter((move) => isLegalBookMove(shogi, move, color));
  if (legalMoves.length === 0) {
    const constrained = constrainedDecision(
      shogi, color, book, enemyMoves, 'no_legal_book_move',
    );
    if (constrained) return constrained;
    return { status: 'blocked', moves: [], reason: 'no_legal_book_move' };
  }
  return { status: 'active', moves: legalMoves };
}

export function findEnemyOpeningBook(books, bookId) {
  if (bookId === null || bookId === undefined) return null;
  return books.find((book) => book.book_id === bookId) || null;
}
