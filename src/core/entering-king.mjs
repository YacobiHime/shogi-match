const BLACK = 0;
const WHITE = 1;
const LARGE_PIECES = new Set(['R', 'B']);
const HAND_PIECES = new Set(['R', 'B', 'G', 'S', 'N', 'L', 'P']);

function pieceColor(symbol) {
  return symbol === symbol.toUpperCase() ? BLACK : WHITE;
}

function piecePoint(symbol) {
  return LARGE_PIECES.has(symbol.toUpperCase()) ? 5 : 1;
}

function isEnemyCamp(y, color) {
  return color === BLACK ? y <= 3 : y >= 7;
}

function parseBoard(boardField, color) {
  const rows = boardField.split('/');
  if (rows.length !== 9) throw new Error('SFENの盤面は9段である必要があります');

  let kingInEnemyCamp = false;
  let campPieceCount = 0;
  let points = 0;

  rows.forEach((row, rowIndex) => {
    const y = rowIndex + 1;
    let squares = 0;

    for (let i = 0; i < row.length; i++) {
      const symbol = row[i];
      if (/\d/.test(symbol)) {
        squares += Number(symbol);
        continue;
      }
      if (symbol === '+') {
        i++;
        if (i >= row.length) throw new Error('SFENの成駒表記が不正です');
      }

      const piece = row[i];
      if (!/[prnbgslk]/i.test(piece)) throw new Error('SFENの駒表記が不正です');
      squares++;
      if (pieceColor(piece) !== color || !isEnemyCamp(y, color)) continue;

      if (piece.toUpperCase() === 'K') {
        kingInEnemyCamp = true;
      } else {
        campPieceCount++;
        points += piecePoint(piece);
      }
    }

    if (squares !== 9) throw new Error('SFENの各段は9マスである必要があります');
  });

  return { kingInEnemyCamp, campPieceCount, points };
}

function countHandPoints(handField, color) {
  if (handField === '-') return 0;

  let points = 0;
  let countText = '';
  for (const symbol of handField) {
    if (/\d/.test(symbol)) {
      countText += symbol;
      continue;
    }
    if (!HAND_PIECES.has(symbol.toUpperCase())) {
      throw new Error('SFENの持ち駒表記が不正です');
    }

    const count = countText === '' ? 1 : Number(countText);
    if (!Number.isInteger(count) || count < 1) {
      throw new Error('SFENの持ち駒枚数が不正です');
    }
    if (pieceColor(symbol) === color) points += count * piecePoint(symbol);
    countText = '';
  }

  if (countText !== '') throw new Error('SFENの持ち駒表記が不正です');
  return points;
}

/**
 * 27点法の入玉宣言条件を評価する。
 * 点数対象は、宣言側の持ち駒と敵陣3段目以内にある宣言側の駒（玉を除く）。
 *
 * @param {string} sfen
 * @param {0|1} color 先手=0、後手=1
 * @param {boolean} inCheck 宣言側の玉に王手がかかっているか
 */
export function evaluateEnteringKingDeclaration(sfen, color, inCheck) {
  if (color !== BLACK && color !== WHITE) throw new Error('先後の指定が不正です');
  if (typeof inCheck !== 'boolean') throw new Error('王手状態はbooleanで指定してください');

  const fields = sfen.trim().split(/\s+/);
  if (fields.length < 4 || !['b', 'w'].includes(fields[1])) {
    throw new Error('SFENが不正です');
  }

  const board = parseBoard(fields[0], color);
  const points = board.points + countHandPoints(fields[2], color);
  const requiredPoints = color === BLACK ? 28 : 27;
  const isTurn = fields[1] === (color === BLACK ? 'b' : 'w');

  return {
    eligible:
      isTurn &&
      board.kingInEnemyCamp &&
      board.campPieceCount >= 10 &&
      points >= requiredPoints &&
      !inCheck,
    isTurn,
    kingInEnemyCamp: board.kingInEnemyCamp,
    campPieceCount: board.campPieceCount,
    points,
    requiredPoints,
    inCheck,
  };
}
