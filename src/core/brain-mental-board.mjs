// 脳トレ「頭の中の盤」(docs/brain-training-design.mdの3-3)。少ない駒の局面を覚え、駒が消えたあと、
// 文字で流れる指し手を頭の中で追う。最後に「飛車はどこ？」「2三にいる駒は？」に答える。読みの土台の練習。
// 指し手は合法手だけ(game-stateで指す)。画面に依存しない。

import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import { formatHintMove } from './match-assists.mjs';
import { isKingAttacked, parseSfenState } from './piece-movement.mjs';
import { createRng, pick } from './ryuo-random.mjs';

/** 段ごとの手数と、玉のほかに置く駒の数。 */
export const MENTAL_LEVELS = Object.freeze([
  { plies: 1, pieces: 1 },
  { plies: 2, pieces: 1 },
  { plies: 3, pieces: 2 },
  { plies: 4, pieces: 2 },
  { plies: 5, pieces: 3 },
  { plies: 6, pieces: 3 },
  { plies: 8, pieces: 3 },
  { plies: 10, pieces: 4 },
  { plies: 12, pieces: 4 },
]);
export const MENTAL_MAX_LEVEL = MENTAL_LEVELS.length - 1;
/** 1手を見せる時間(押せば早く進む)。 */
export const MENTAL_MOVE_MS = 1500;

const PIECE_KANJI = { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩' };
const PROMOTED_KANJI = { R: '龍', B: '馬', S: '全', N: '圭', L: '杏', P: 'と' };
/** 置く駒の種類。動きの分かりやすい駒を多めにする。 */
const EXTRA_KINDS = ['R', 'B', 'G', 'S', 'N', 'L', 'P', 'G', 'S', 'R'];

function fileRank(square) {
  return { file: Number(square[0]), rank: square.charCodeAt(1) - 96 };
}
function squareOf(file, rank) {
  return `${file}${String.fromCharCode(96 + rank)}`;
}

export function mentalLevel(level) {
  return MENTAL_LEVELS[Math.max(0, Math.min(MENTAL_MAX_LEVEL, Math.floor(level)))];
}

/** 駒の名前(成った駒は成った名前)。 */
export function pieceName(kind, promoted = false) {
  return promoted ? PROMOTED_KANJI[kind] ?? PIECE_KANJI[kind] : PIECE_KANJI[kind];
}

/** SFENの盤の部分を、駒の一覧にする。 */
export function piecesFromSfen(sfen) {
  const [board] = sfen.split(' ');
  const pieces = [];
  board.split('/').forEach((row, rowIndex) => {
    let file = 9;
    for (let index = 0; index < row.length; index += 1) {
      const char = row[index];
      if (/\d/.test(char)) {
        file -= Number(char);
        continue;
      }
      let promoted = false;
      let letter = char;
      if (char === '+') {
        promoted = true;
        index += 1;
        letter = row[index];
      }
      pieces.push({ square: squareOf(file, rowIndex + 1), kind: letter.toUpperCase(), color: letter === letter.toUpperCase() ? 'black' : 'white', promoted });
      file -= 1;
    }
  });
  return pieces;
}

function sfenFromPieces(pieces, turn) {
  const rows = [];
  for (let rank = 1; rank <= 9; rank += 1) {
    let row = '';
    let empty = 0;
    for (let file = 9; file >= 1; file -= 1) {
      const found = pieces.find(({ square }) => square === squareOf(file, rank));
      if (!found) {
        empty += 1;
        continue;
      }
      if (empty) row += String(empty);
      empty = 0;
      const letter = found.color === 'black' ? found.kind : found.kind.toLowerCase();
      row += `${found.promoted ? '+' : ''}${letter}`;
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  return `${rows.join('/')} ${turn === 'black' ? 'b' : 'w'} - 1`;
}

function legal(sfen) {
  return enumerateLegalMoves(createGameRecord(sfen).position).map(({ usi }) => usi);
}

/** どちらの玉にも王手がかかっていない局面か(初めの局面は静かにする)。 */
function noCheck(pieces) {
  const { board } = parseSfenState(sfenFromPieces(pieces, 'black'));
  return !isKingAttacked(board, 'black') && !isKingAttacked(board, 'white');
}

function randomPosition(rng, extras) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const pieces = [];
    const used = new Set();
    const place = (kind, color, ranks) => {
      for (let tries = 0; tries < 100; tries += 1) {
        const file = 2 + Math.floor(rng.next() * 7);
        const rank = ranks[0] + Math.floor(rng.next() * (ranks[1] - ranks[0] + 1));
        const square = squareOf(file, rank);
        if (used.has(square)) continue;
        used.add(square);
        pieces.push({ square, kind, color, promoted: false });
        return true;
      }
      return false;
    };
    place('K', 'black', [7, 9]);
    place('K', 'white', [1, 3]);
    for (let index = 0; index < extras; index += 1) {
      const color = index % 2 === 0 ? 'black' : 'white';
      const kind = pick(rng, EXTRA_KINDS);
      // 行き所のない駒を作らないよう、歩・香・桂は自分の陣寄り(4〜8段目、後手は2〜6段目)に置く。
      place(kind, color, color === 'black' ? [4, 8] : [2, 6]);
    }
    const pawnFiles = new Set();
    let twoPawns = false;
    for (const { kind, color, square } of pieces) {
      if (kind !== 'P') continue;
      const key = `${color}${square[0]}`;
      if (pawnFiles.has(key)) twoPawns = true;
      pawnFiles.add(key);
    }
    if (twoPawns || pieces.length !== extras + 2) continue;
    if (noCheck(pieces) && legal(sfenFromPieces(pieces, 'black')).length) return pieces;
  }
  throw new Error('頭の中の盤の局面を作れませんでした');
}

/**
 * 1問を作る。同じ種と段なら同じ問題。指し手は先手から交互に、合法手からえらぶ。
 * 玉より玉以外の駒を多く動かし、同じ駒を3回続けては動かさない。
 * 問いは「動いた駒がいまどこにいるか」(square)か「あるマスにいる駒は何か」(piece)。
 * @param {number} seed
 * @param {number} level
 */
export function mentalProblem(seed, level) {
  const rng = createRng(seed);
  const spec = mentalLevel(level);
  const start = randomPosition(rng, spec.pieces);
  const startSfen = sfenFromPieces(start, 'black');
  const record = createGameRecord(startSfen);
  /** 駒の名札: マス→最初にいたマス(同じ駒を追う)。 */
  let ids = new Map(start.map(({ square }) => [square, square]));
  const moves = [];
  const labels = [];
  const movedIds = [];
  for (let ply = 0; ply < spec.plies; ply += 1) {
    const sfen = record.position.sfen;
    const options = legal(sfen);
    if (!options.length) break;
    // 同じ側の直前の2手(2手前と4手前)が同じ駒なら、その駒は3回続けて動かさない。
    const sameSide = [movedIds.at(-2), movedIds.at(-4)];
    const piecesNow = piecesFromSfen(sfen);
    const weighted = options.map((usi) => {
      const from = usi.includes('*') ? '' : usi.slice(0, 2);
      const id = from ? ids.get(from) : '';
      const isKing = piecesNow.find(({ square }) => square === from)?.kind === 'K';
      let weight = isKing ? 1 : 4;
      if (id && sameSide[0] === id && sameSide[1] === id) weight = 0;
      return /** @type {[string, number]} */ ([usi, weight]);
    }).filter(([, weight]) => weight > 0);
    // 王手を受ける手がその駒しかないときなどは、決まりより合法手を優先する。
    if (!weighted.length) weighted.push(...options.map((usi) => /** @type {[string, number]} */ ([usi, 1])));
    const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rng.next() * total;
    let chosen = weighted.at(-1)[0];
    for (const [usi, weight] of weighted) {
      roll -= weight;
      if (roll < 0) {
        chosen = usi;
        break;
      }
    }
    const mark = ply % 2 === 0 ? '▲' : '△';
    labels.push(`${mark}${formatHintMove(chosen, sfen)}`);
    const drop = chosen.includes('*');
    const from = drop ? '' : chosen.slice(0, 2);
    const to = drop ? chosen.slice(2, 4) : chosen.slice(2, 4);
    const id = drop ? `drop:${to}:${ply}` : ids.get(from);
    const next = new Map(ids);
    if (from) next.delete(from);
    next.set(to, id);
    ids = next;
    movedIds.push(id);
    moves.push(chosen);
    appendUsiMove(record, chosen);
  }
  const finalPieces = piecesFromSfen(record.position.sfen);
  // 問いを決める。動いた駒(玉以外を優先)の行き先か、駒のいるマスの中身。
  const movedPieces = finalPieces.filter(({ square }) => movedIds.includes(ids.get(square)));
  const nonKing = movedPieces.filter(({ kind }) => kind !== 'K');
  const target = pick(rng, nonKing.length ? nonKing : movedPieces.length ? movedPieces : finalPieces);
  const askSquare = rng.next() < 0.6;
  const owner = target.color === 'black' ? '▲' : '△';
  const question = askSquare
    ? { type: 'square', text: `${owner}の${pieceName(target.kind, target.promoted)}はどこ？`, answer: target.square }
    : { type: 'piece', text: `${target.square[0]}${'一二三四五六七八九'[fileRank(target.square).rank - 1]}にいる駒は？`, answer: `${target.color}:${target.kind}${target.promoted ? '+' : ''}`, square: target.square };
  return {
    level: Math.max(0, Math.min(MENTAL_MAX_LEVEL, Math.floor(level))),
    startSfen,
    start,
    moves,
    labels,
    finalPieces,
    question,
  };
}

/** 駒の名前の答えの選択肢(盤にある駒の種類と先後から作る。答えを必ず含む)。 */
export function mentalPieceChoices(problem) {
  const choices = new Map();
  for (const { color, kind, promoted } of [...problem.start, ...problem.finalPieces]) {
    const id = `${color}:${kind}${promoted ? '+' : ''}`;
    if (!choices.has(id)) choices.set(id, { id, label: `${color === 'black' ? '▲' : '△'}${pieceName(kind, promoted)}` });
  }
  choices.set('empty', { id: 'empty', label: '空き' });
  return [...choices.values()];
}

export function scoreMental(problem, answer) {
  return { correct: answer === problem.question.answer };
}

/** 1回のまとめ。記録は正解したいちばん多い手数。 */
export function mentalSummary(trials) {
  const best = trials.filter(({ correct }) => correct).reduce((max, { plies }) => Math.max(max, plies), 0);
  return { value: best, correct: trials.filter(({ correct }) => correct).length, total: trials.length };
}
