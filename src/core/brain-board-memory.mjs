// 脳トレ「盤面の記憶」(docs/brain-training-design.mdの3-2)。局面を数秒見て、空の盤に並べ直す。
// 強い人は駒を形のまとまり(チャンク)で覚える(Chase・Simon 1973)ので、局面は囲いと戦法の完成形から作る。
// ときどき同じ枚数のでたらめな配置を出し、「形があると覚えやすい」を自分の点数で見せる。画面に依存しない。

import { OPENING_CASTLES } from './opening-guide.mjs';
import { openingFormation } from './opening-formation.mjs';
import { createRng, pick } from './ryuo-random.mjs';

/** 段ごとの駒の数と、局面の出どころ。castleは自分の囲いのまわり、sideは自分の陣の片側、bothは両方の陣。 */
export const BOARD_MEMORY_LEVELS = Object.freeze([
  { pieces: 3, source: 'castle' },
  { pieces: 4, source: 'castle' },
  { pieces: 5, source: 'castle' },
  { pieces: 6, source: 'castle' },
  { pieces: 7, source: 'side' },
  { pieces: 8, source: 'side' },
  { pieces: 10, source: 'side' },
  { pieces: 12, source: 'side' },
  { pieces: 14, source: 'both' },
  { pieces: 16, source: 'both' },
  { pieces: 20, source: 'both' },
  { pieces: 24, source: 'both' },
  { pieces: 30, source: 'both' },
]);
export const BOARD_MEMORY_MAX_LEVEL = BOARD_MEMORY_LEVELS.length - 1;
/** 1回の問題の数のうち、でたらめな配置を出す問題の番号(0から)。5問の回だけ、3問目に出す。 */
export const RANDOM_TRIAL_INDEX = 2;
/** 覚える時間。駒1枚あたりの秒と、上限・下限。 */
export const MEMORIZE_SECONDS_PER_PIECE = 0.6;
export const MEMORIZE_MIN_SECONDS = 3;
export const MEMORIZE_MAX_SECONDS = 15;
/** 段を上げる・下げる、合った割合。 */
export const BOARD_MEMORY_UP = 0.9;
export const BOARD_MEMORY_DOWN = 0.6;

/** 使う形(戦法と囲いの組)。完成形の駒が重ならないことをテストで確かめる。 */
export const MEMORY_FORMATIONS = Object.freeze([
  ['', 'funagakoi'],
  ['', 'yagura'],
  ['', 'elmo'],
  ['', 'ibisha-anaguma'],
  ['', 'gangi'],
  ['', 'kikusui-yagura'],
  ['', 'left-mino'],
  ['shiken', 'mino'],
  ['shiken', 'high-mino'],
  ['shiken', 'furibisha-anaguma'],
  ['shiken', 'diamond-mino'],
]);

const KIND_ORDER = ['K', 'R', 'B', 'G', 'S', 'N', 'L', 'P'];
const MAX_RANK_FOR_BLACK = { P: 2, L: 2, N: 3 };

/** 盤の駒。colorはblack(先手)かwhite(後手)。 */
function piece(square, kind, color) {
  return { square, kind, color };
}

function fileRank(square) {
  return { file: Number(square[0]), rank: square.charCodeAt(1) - 96 };
}
function squareOf(file, rank) {
  return `${file}${String.fromCharCode(96 + rank)}`;
}
/** 盤を180度回したマス(後手の陣にする)。 */
export function rotateSquare(square) {
  const { file, rank } = fileRank(square);
  return squareOf(10 - file, 10 - rank);
}

export function boardMemoryLevel(level) {
  return BOARD_MEMORY_LEVELS[Math.max(0, Math.min(BOARD_MEMORY_MAX_LEVEL, Math.floor(level)))];
}

function castleLabel(castleId) {
  return OPENING_CASTLES.find(({ id }) => id === castleId)?.label ?? '';
}

/** 完成形の駒(先手)を、玉に近い順に並べる。同じ近さなら、手順で動いた駒を先にする(形の中心から覚えさせる)。 */
function formationByKingDistance(strategyId, castleId) {
  const { pieces } = openingFormation(strategyId, castleId);
  const king = pieces.find(({ kind }) => kind === 'K');
  const origin = fileRank(king.square);
  return [...pieces]
    .filter(({ promoted }) => !promoted)
    .map((item) => {
      const { file, rank } = fileRank(item.square);
      return { item, distance: Math.max(Math.abs(file - origin.file), Math.abs(rank - origin.rank)) };
    })
    .sort((a, b) => a.distance - b.distance || Number(b.item.moved) - Number(a.item.moved) || a.item.square.localeCompare(b.item.square))
    .map(({ item }) => piece(item.square, item.kind, 'black'));
}

/**
 * 1問の局面を作る。同じ種と段なら同じ局面。randomが真なら、同じ駒をでたらめなマスに置く。
 * @param {number} seed
 * @param {number} level
 * @param {{ random?: boolean }} [options]
 * @returns {{ pieces: { square: string, kind: string, color: 'black' | 'white' }[], level: number, random: boolean, castle: string, castleLabel: string, castleSquares: string[], memorizeMs: number, bothSides: boolean }}
 */
export function boardMemoryProblem(seed, level, { random = false } = {}) {
  const rng = createRng(seed);
  const spec = boardMemoryLevel(level);
  const [strategyId, castleId] = pick(rng, MEMORY_FORMATIONS);
  const black = formationByKingDistance(strategyId, castleId);
  let pieces;
  if (spec.source === 'both') {
    const [otherStrategy, otherCastle] = pick(rng, MEMORY_FORMATIONS);
    const white = formationByKingDistance(otherStrategy, otherCastle)
      .map(({ square, kind }) => piece(rotateSquare(square), kind, 'white'));
    const blackCount = Math.ceil(spec.pieces / 2);
    pieces = [...black.slice(0, blackCount), ...white.slice(0, spec.pieces - blackCount)];
    // 両方の陣で同じマスを使っていたら(ほぼない)、後手の駒を外す。
    const used = new Set();
    pieces = pieces.filter(({ square }) => (used.has(square) ? false : (used.add(square), true)));
  } else {
    pieces = black.slice(0, spec.pieces);
  }
  if (random) pieces = scatter(rng, pieces);
  // 囲いをまるごと当てたかを見るためのマス(完成形の囲いの駒のうち、出した駒)。
  const castle = OPENING_CASTLES.find(({ id }) => id === castleId);
  const shown = new Set(pieces.filter(({ color }) => color === 'black').map(({ square }) => square));
  // 囲いの駒がすべて出ているときだけ数える(一部だけでは「囲いをまるごと」と言わない)。
  const completion = (castle?.completionSquares ?? []).map(([square]) => square);
  const castleSquares = !random && completion.length && completion.every((square) => shown.has(square)) ? completion : [];
  const seconds = Math.min(MEMORIZE_MAX_SECONDS, Math.max(MEMORIZE_MIN_SECONDS, pieces.length * MEMORIZE_SECONDS_PER_PIECE));
  return {
    pieces,
    level: Math.max(0, Math.min(BOARD_MEMORY_MAX_LEVEL, Math.floor(level))),
    random,
    castle: castleId,
    castleLabel: castleLabel(castleId),
    castleSquares,
    memorizeMs: Math.round(seconds * 1000),
    bothSides: pieces.some(({ color }) => color === 'white'),
  };
}

/**
 * 同じ駒を、でたらめなマスに置き直す(行き所のない駒と二歩は作らない)。先手の駒は盤の下半分、後手は上半分にかたよらせない。
 */
function scatter(rng, pieces) {
  const used = new Set();
  const pawnFiles = { black: new Set(), white: new Set() };
  return pieces.map(({ kind, color }) => {
    for (let tries = 0; tries < 400; tries += 1) {
      const file = 1 + Math.floor(rng.next() * 9);
      const rank = 1 + Math.floor(rng.next() * 9);
      const square = squareOf(file, rank);
      if (used.has(square)) continue;
      const relative = color === 'black' ? rank : 10 - rank;
      if (relative <= (MAX_RANK_FOR_BLACK[kind] ?? 0) - 1) continue;
      if (kind === 'P' && pawnFiles[color].has(file)) continue;
      used.add(square);
      if (kind === 'P') pawnFiles[color].add(file);
      return piece(square, kind, color);
    }
    throw new Error('でたらめな配置を作れませんでした');
  });
}

/**
 * 並べた答えの採点。合った駒(マス・種類・先後がすべて同じ)の数を数える。
 * 置きすぎた駒は割合を下げる(全部のマスに置けば当たる、をなくす)。
 * @param {{ pieces: { square: string, kind: string, color: string }[], castleSquares: string[] }} problem
 * @param {Record<string, { kind: string, color: string }>} answer マス→置いた駒
 */
export function scoreBoardMemory(problem, answer) {
  const truth = new Map(problem.pieces.map((item) => [item.square, item]));
  /** @type {Record<string, 'ok' | 'wrong' | 'missed'>} */
  const marks = {};
  let correct = 0;
  for (const [square, placed] of Object.entries(answer)) {
    const expected = truth.get(square);
    const ok = Boolean(expected) && expected.kind === placed.kind && expected.color === placed.color;
    marks[square] = ok ? 'ok' : 'wrong';
    if (ok) correct += 1;
  }
  for (const square of truth.keys()) if (!marks[square]) marks[square] = 'missed';
  const placed = Object.keys(answer).length;
  const accuracy = correct / Math.max(problem.pieces.length, placed);
  const castleWhole = problem.castleSquares.length >= 3 && problem.castleSquares.every((square) => marks[square] === 'ok');
  return { correct, total: problem.pieces.length, placed, accuracy, marks, castleWhole };
}

/** 次の段。9割以上で1段上、6割未満で1段下。でたらめな配置の問題では動かさない。 */
export function nextBoardMemoryLevel(level, accuracy, random = false) {
  if (random) return level;
  if (accuracy >= BOARD_MEMORY_UP) return Math.min(BOARD_MEMORY_MAX_LEVEL, level + 1);
  if (accuracy < BOARD_MEMORY_DOWN) return Math.max(0, level - 1);
  return level;
}

/**
 * 1回のまとめ。記録は9割以上合った問題のいちばん多い駒の数(でたらめな配置は数えない)。
 * 形のある局面とでたらめな配置の割合も返す(結果の一言で比べる)。
 * @param {{ pieces: number, accuracy: number, random: boolean }[]} trials
 */
export function boardMemorySummary(trials) {
  const shaped = trials.filter(({ random }) => !random);
  const randoms = trials.filter(({ random }) => random);
  const best = shaped.filter(({ accuracy }) => accuracy >= BOARD_MEMORY_UP).reduce((max, { pieces }) => Math.max(max, pieces), 0);
  const average = (list) => (list.length ? list.reduce((sum, { accuracy }) => sum + accuracy, 0) / list.length : null);
  return {
    value: best,
    correct: shaped.filter(({ accuracy }) => accuracy >= BOARD_MEMORY_UP).length,
    total: shaped.length,
    shapedAccuracy: average(shaped),
    randomAccuracy: average(randoms),
  };
}

/** 駒箱に出す駒の種類(局面にある種類だけ、決まった順)。 */
export function paletteKinds(problem) {
  const kinds = new Set(problem.pieces.map(({ kind }) => kind));
  return KIND_ORDER.filter((kind) => kinds.has(kind));
}
