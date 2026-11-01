// ぐるぐる指導対局(多面指し。docs/pro-year-design.mdの10-2の6)の盤の処理。あなたが上手(後手・先に指す)で、
// 3人のアマチュアはロジックAI(JSの軽いCPU。エンジンを使わない)で指す。アマチュアは駒を大きく損すると投了する。
// 将棋まつりの画面からだけ読む(盤の処理を持つので、pro-year.mjsからは読まない)。

import { Position } from 'tsshogi';
import { enumerateLegalMoves } from '../game-state';
import { chooseLogicMove } from './logic-ai.mjs';
import { materialBalance } from './piece-points.mjs';
import { handicapById } from './learning-setup.mjs';

/** アマチュアが投了する駒の損(駒落ちの始めより、上手の駒得がこれ以上。飛車1枚と少し)。 */
export const SIMUL_RESIGN_GAP = 1300;
/** アマチュアが1手に考える時間の上限(ミリ秒。画面を止めない短さ)。 */
export const SIMUL_THINK_MS = 220;

const positionOf = (sfen) => /** @type {Position} */ (Position.newBySFEN(sfen));

/** 駒落ちの始めの局面(上手=後手の手番)。 */
export function simulStartSfen(handicapId) {
  return handicapById(handicapId)?.sfen ?? handicapById('6pieces')?.sfen ?? '';
}

/** 合法手(USI)。 */
export function legalMovesOf(sfen) {
  return enumerateLegalMoves(positionOf(sfen)).map(({ usi }) => usi);
}

/** 指したあとの局面(合法でなければnull)。 */
export function sfenAfter(sfen, usi) {
  const position = positionOf(sfen);
  const move = position.createMoveByUSI(usi);
  if (!move || !position.doMove(move)) return null;
  return position.sfen;
}

/** 手番の側('black' | 'white')。 */
export const sideToMove = (sfen) => (String(sfen).split(' ')[1] === 'w' ? 'white' : 'black');

/** 上手(後手)から見た、始めからの駒得(AIの駒の値段)。 */
export function proGain(sfen, startSfen) {
  const now = materialBalance(sfen);
  const start = materialBalance(startSfen);
  return (now.white - now.black) - (start.white - start.black);
}

/**
 * 盤の決着。詰み(手番の側に合法手がない)か、アマチュアの投了(手番がアマチュアで、駒を大きく損している)。
 * @returns {{ over: boolean, winner: 'pro' | 'guest' | null, reason: 'mate' | 'resign' | '' }}
 */
export function simulStatus(sfen, startSfen) {
  const side = sideToMove(sfen);
  if (!legalMovesOf(sfen).length) return { over: true, winner: side === 'white' ? 'guest' : 'pro', reason: 'mate' };
  if (side === 'black' && proGain(sfen, startSfen) >= SIMUL_RESIGN_GAP) return { over: true, winner: 'pro', reason: 'resign' };
  return { over: false, winner: null, reason: '' };
}

/**
 * アマチュアの1手(ロジックAI)。
 * @param {{ sfen: string, logic: number, moveHistory?: string[], random?: () => number }} options
 */
export function guestMove({ sfen, logic, moveHistory = [], random = Math.random }) {
  const legalMoves = legalMovesOf(sfen);
  if (!legalMoves.length) return null;
  const choice = chooseLogicMove({ sfen, legalMoves, level: logic, moveHistory, random, maxTimeMs: SIMUL_THINK_MS });
  return choice?.move ?? legalMoves[0];
}

/**
 * 終わった盤の数え方(「ここまで」で区切った盤は引き分け)。
 * @param {{ result: 'win' | 'loss' | 'draw' | null }[]} boards resultは上手(あなた)から見た結果
 */
export function simulTally(boards) {
  const wins = boards.filter((board) => board.result === 'win').length;
  const losses = boards.filter((board) => board.result === 'loss').length;
  return { wins, losses, draws: boards.length - wins - losses };
}
