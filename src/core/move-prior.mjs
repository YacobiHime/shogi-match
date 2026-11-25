// 人が指しそうな手の好み(docs/disciple-mode-design.mdの40章のL3)。
// 1手を小さな特徴(どの駒で・打つか・取るか・成るか・前か後ろか・取り返しか・王手か・玉の近くか・当たっている駒が逃げるか・取られる升へ行くか)に分け、
// プロの棋譜でその特徴の手が選ばれた割合と、合法手全体の中の割合の比(対数)を重みにする(src/data/pro-move-prior.mjs。scripts/pro-move-prior.mjsで作る)。
// 手の好みの点は、その手の特徴の重みの和。論理の探索で差の小さい手から選ぶときに使う(reason-think.mjs)。画面・保存の仕組みに依存しない。

import { PRO_MOVE_PRIOR } from '../data/pro-move-prior.mjs';
import { BISHOP, KING, PAWN, ROOK, fileOf, rankOf } from './fast-board.mjs';

const PROMOTE = 8;
const KIND_LETTERS = ['', 'P', 'L', 'N', 'S', 'G', 'B', 'R', 'K', '+P', '+L', '+N', '+S', '', '+B', '+R'];

/** 局面の段(序盤・中盤・終盤)。手数で分ける(一致率の道具と同じ区切り)。 */
export function priorPhase(ply) {
  return ply <= 30 ? 'op' : ply <= 80 ? 'mid' : 'end';
}

const near = (a, b) => a >= 0 && b >= 0 && Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b))) <= 2;

/**
 * 1手の特徴。boardは指す前の局面(FastBoard。この関数の中で指して戻す)。
 * @param {import('./fast-board.mjs').FastBoard} board
 * @param {number} move
 * @param {{ lastTo?: number }} [context] lastToは直前の相手の手の行き先(取り返しを見る)
 * @returns {string[]}
 */
export function moveFeatures(board, move, { lastTo = -1 } = {}) {
  const color = board.turn;
  const enemy = color ^ 1;
  const from = move & 127;
  const to = (move >> 7) & 127;
  const promote = (move >> 14) & 1;
  const out = [];
  let kind;
  if (from >= 81) {
    kind = from - 81;
    out.push(`drop:${KIND_LETTERS[kind]}`);
  } else {
    const p = board.sq[from];
    kind = p > 0 ? p : -p;
    out.push(`piece:${KIND_LETTERS[kind]}`);
    const dy = (rankOf(to) - rankOf(from)) * (color === 0 ? 1 : -1);
    out.push(dy < 0 ? 'dir:forward' : dy > 0 ? 'dir:back' : 'dir:side');
    if (board.attacked(from, enemy)) out.push('escape');
  }
  const victim = board.sq[to];
  if (victim) {
    const v = victim > 0 ? victim : -victim;
    out.push(v === PAWN ? 'cap:pawn' : v === ROOK || v === BISHOP ? 'cap:major' : v >= 9 && v !== BISHOP + PROMOTE && v !== ROOK + PROMOTE ? 'cap:promoted' : v === BISHOP + PROMOTE || v === ROOK + PROMOTE ? 'cap:dragon' : 'cap:minor');
    if (to === lastTo) out.push('recapture');
  } else {
    out.push('quiet');
  }
  if (promote) out.push('promote');
  const ownKing = board.king[color];
  const enemyKing = board.king[enemy];
  if (kind !== KING && near(to, ownKing)) out.push('near:own-king');
  if (near(to, enemyKing)) out.push('near:enemy-king');
  board.make(move);
  if (board.inCheck(enemy)) out.push('check');
  // 行き先に相手の駒が利いていて、味方が利いていない(取られる升へ行く)。
  if (kind !== KING && board.attacked(to, enemy) && !board.attacked(to, color)) out.push('hang');
  board.unmake(move);
  return out;
}

/**
 * 手の好みの点(大きいほど人が指しそう)。重みの表がなければ0。
 * @param {string[]} features
 * @param {string} phase priorPhaseの値
 * @param {Record<string, Record<string, number>>} [table]
 */
export function priorScore(features, phase, table = PRO_MOVE_PRIOR) {
  const weights = table?.[phase];
  if (!weights) return 0;
  let total = 0;
  for (const feature of features) total += weights[feature] ?? 0;
  return total;
}

/**
 * 静かな手(取らない・成らない手)の好みの点を、局面を動かさずに軽く数える(読む順番に使う。40章)。
 * 王手・取られる升へ行く・取り返しは数えない(指して戻す手間を省く)。weightsはPRO_MOVE_PRIORの1つの段。
 * @param {import('./fast-board.mjs').FastBoard} board
 * @param {number} move
 * @param {Record<string, number>} weights
 */
export function quietPrior(board, move, weights) {
  const color = board.turn;
  const from = move & 127;
  const to = (move >> 7) & 127;
  let total = weights.quiet ?? 0;
  let kind;
  if (from >= 81) {
    kind = from - 81;
    total += weights[`drop:${KIND_LETTERS[kind]}`] ?? 0;
  } else {
    const p = board.sq[from];
    kind = p > 0 ? p : -p;
    total += weights[`piece:${KIND_LETTERS[kind]}`] ?? 0;
    const dy = (rankOf(to) - rankOf(from)) * (color === 0 ? 1 : -1);
    total += weights[dy < 0 ? 'dir:forward' : dy > 0 ? 'dir:back' : 'dir:side'] ?? 0;
    if (board.attacked(from, color ^ 1)) total += weights.escape ?? 0;
  }
  if (kind !== KING && near(to, board.king[color])) total += weights['near:own-king'] ?? 0;
  if (near(to, board.king[color ^ 1])) total += weights['near:enemy-king'] ?? 0;
  return total;
}
