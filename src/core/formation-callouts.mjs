const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const DETECTOR_IDS = new Set(['bogin', 'gold_yagura', 'right_shiken']);

function requireText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > maxLength) {
    throw new Error(`${label}は1〜${maxLength}文字にしてください`);
  }
  return value;
}

export function validateFormationCallouts(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.callouts)) {
    throw new Error('formation_callouts.jsonの基本情報が不正です');
  }
  requireText(value.initial_speech, 'initial_speech', 80);
  requireText(value.undo_speech, 'undo_speech', 80);
  const ids = new Set();
  for (const [index, callout] of value.callouts.entries()) {
    if (!callout || typeof callout !== 'object' || Array.isArray(callout)) {
      throw new Error(`callouts[${index}]が不正です`);
    }
    if (!ID_PATTERN.test(callout.callout_id) || !DETECTOR_IDS.has(callout.callout_id)) {
      throw new Error(`未対応の戦形コールアウトです: ${String(callout.callout_id)}`);
    }
    if (ids.has(callout.callout_id)) {
      throw new Error(`戦形コールアウトIDが重複しています: ${callout.callout_id}`);
    }
    ids.add(callout.callout_id);
    requireText(callout.name, `${callout.callout_id}.name`, 30);
    requireText(callout.speech, `${callout.callout_id}.speech`, 40);
  }
  for (const id of DETECTOR_IDS) {
    if (!ids.has(id)) throw new Error(`戦形コールアウトが不足しています: ${id}`);
  }
  return value;
}

function parseSfenBoard(sfen) {
  const boardPart = String(sfen).trim().split(/\s+/)[0];
  const ranks = boardPart.split('/');
  if (ranks.length !== 9) throw new Error('SFENの盤面は9段にしてください');
  const board = new Map();
  ranks.forEach((rank, rankIndex) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) {
        if (promoted) throw new Error(`SFENの${rankIndex + 1}段目が不正です`);
        file -= Number(symbol);
        continue;
      }
      if (symbol === '+') {
        if (promoted) throw new Error(`SFENの${rankIndex + 1}段目が不正です`);
        promoted = true;
        continue;
      }
      if (file < 1 || !/[plnsgbrk]/i.test(symbol)) {
        throw new Error(`SFENの${rankIndex + 1}段目が不正です`);
      }
      const color = symbol === symbol.toUpperCase() ? 'black' : 'white';
      const kind = `${promoted ? '+' : ''}${symbol.toUpperCase()}`;
      board.set(`${file}${String.fromCharCode(97 + rankIndex)}`, { color, kind });
      file -= 1;
      promoted = false;
    }
    if (file !== 0 || promoted) throw new Error(`SFENの${rankIndex + 1}段目が不正です`);
  });
  return board;
}

function has(board, square, color, kind) {
  const piece = board.get(square);
  return piece?.color === color && piece.kind === kind;
}

function hasAny(board, squares, color, kind) {
  return squares.some((square) => has(board, square, color, kind));
}

const DETECTORS = {
  bogin: (board) => (
    has(board, '2h', 'black', 'R')
      && hasAny(board, ['2g', '2f', '2e'], 'black', 'S')
  ) || (
    has(board, '8b', 'white', 'R')
      && hasAny(board, ['8c', '8d', '8e'], 'white', 'S')
  ),
  gold_yagura: (board) => (
    has(board, '8h', 'black', 'K')
      && has(board, '7h', 'black', 'G')
      && has(board, '6g', 'black', 'G')
      && has(board, '7g', 'black', 'S')
  ) || (
    has(board, '2b', 'white', 'K')
      && has(board, '3b', 'white', 'G')
      && has(board, '4c', 'white', 'G')
      && has(board, '3c', 'white', 'S')
  ),
  right_shiken: (board) => (
    has(board, '6h', 'black', 'R')
      && has(board, '5g', 'black', 'S')
      && has(board, '6f', 'black', 'P')
  ) || (
    has(board, '4b', 'white', 'R')
      && has(board, '5c', 'white', 'S')
      && has(board, '4d', 'white', 'P')
  ),
};

export function detectFormationCallouts(sfen, master) {
  const validated = validateFormationCallouts(master);
  const board = parseSfenBoard(sfen);
  return validated.callouts.filter((callout) => DETECTORS[callout.callout_id](board));
}

export function findNewFormationCallouts(sfen, master, announcedIds = []) {
  const announced = new Set(announcedIds);
  return detectFormationCallouts(sfen, master)
    .filter((callout) => !announced.has(callout.callout_id));
}
