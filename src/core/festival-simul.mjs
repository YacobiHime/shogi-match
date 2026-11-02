// ぐるぐる指導対局(docs/pro-year-design.mdの10-2の6・11章)の盤の処理。あなたとほかの棋士2人が上手(後手)で、
// 3つの盤を1手ずつ回りながら指し継ぐ。アマチュアと、ほかの棋士はロジックAI(JSの軽いCPU。エンジンを使わない)で指す。
// アマチュアは駒を大きく損すると投了する。振り飛車党の棋士は、平手の盤で飛車を振る(ほかの棋士はそれを指し継ぐ)。
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
  if (handicapId === 'even') return EVEN_SFEN;
  return handicapById(handicapId)?.sfen ?? handicapById('6pieces')?.sfen ?? '';
}

/** 平手の始めの局面(先手のアマチュアから指す)。 */
export const EVEN_SFEN = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

/** 序盤とみなす上手の手数(この間は、居飛車党は飛車を横に動かさず、振り飛車党は振る)。 */
export const SIMUL_OPENING_PRO_MOVES = 10;

/**
 * ほかの棋士の1手(ロジックAIに、棋風を足す)。振り飛車党は、飛車がまだ8二にいれば振り先へ振る(2手目から)。
 * 居飛車党は、序盤に飛車を横へ動かさない。
 * @param {{ sfen: string, partner: { logic: number, party: string, rangeSquare: string }, moveHistory?: string[], random?: () => number }} options
 * @returns {string | null}
 */
export function partnerMove({ sfen, partner, moveHistory = [], random = Math.random }) {
  const legalMoves = legalMovesOf(sfen);
  if (!legalMoves.length) return null;
  const proMoves = Math.floor(moveHistory.length / 2);
  const opening = proMoves < SIMUL_OPENING_PRO_MOVES;
  if (opening && partner.rangeSquare && (partner.party === 'ranging' || random() < 0.5)) {
    const range = `8b${partner.rangeSquare}`;
    if (proMoves >= 1 && legalMoves.includes(range) && pieceOn(sfen, '8b') === 'r') return range;
  }
  let pool = legalMoves;
  if (opening && partner.party === 'static') {
    const kept = legalMoves.filter((usi) => !isRookSlide(sfen, usi));
    if (kept.length) pool = kept;
  }
  const choice = chooseLogicMove({ sfen, legalMoves: pool, level: partner.logic, moveHistory, random, maxTimeMs: SIMUL_THINK_MS });
  return choice?.move && pool.includes(choice.move) ? choice.move : pool[0];
}

/** 盤のその升の駒(SFENの文字。空ならnull)。 */
export function pieceOn(sfen, square) {
  const rows = String(sfen).split(' ')[0].split('/');
  const file = Number(square[0]);
  const rank = square.charCodeAt(1) - 96;
  const row = rows[rank - 1] ?? '';
  let column = 9;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (/\d/.test(char)) { column -= Number(char); continue; }
    const piece = char === '+' ? `+${row[++index]}` : char;
    if (column === file) return piece;
    column -= 1;
  }
  return null;
}

/** 上手(後手)の飛車が2段目を横に動く手か。 */
function isRookSlide(sfen, usi) {
  if (usi.includes('*') || usi[1] !== usi[3]) return false;
  return pieceOn(sfen, usi.slice(0, 2)) === 'r';
}

/** 上手の飛車を振った手なら、その戦法の名前(8二から2二〜5二へ。6二は右四間飛車で居飛車)。 */
export function rangingMoveLabel(sfen, usi) {
  if (!/^8b[2-5]b$/.test(usi) || pieceOn(sfen, '8b') !== 'r') return '';
  return { 2: '向かい飛車', 3: '三間飛車', 4: '四間飛車', 5: '中飛車' }[Number(usi[2])] ?? '';
}

/**
 * ぐるぐる回る順番。round回目に、棋士kはどの盤の前にいるか(棋士の数と盤の数は同じ。あなたはk=0)。
 * @param {number} round
 * @param {number} pro
 * @param {number} boards
 */
export const simulBoardOf = (round, pro, boards) => ((pro + round) % boards + boards) % boards;
/** round回目に、その盤の前にいる棋士。 */
export const simulProAt = (round, board, boards) => ((board - round) % boards + boards) % boards;

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
