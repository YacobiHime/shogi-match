/**
 * 振り返りで使う、駒のタダ取りの判定。棋譜の本筋の各局面の盤を作り、
 * 「守りのない駒（タダの駒）を取る手」かどうかを調べる。
 * 取る手が本当に良い手かどうかは、ここでは決めない。呼び出し側が、エンジンの最善手と合わせて使う。
 */

import { attackersOf, pieceValue } from './piece-movement.mjs';
import { parseSfenBoard } from './sfen-board.mjs';

const PIECE_NAMES = Object.freeze({
  P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '玉',
  '+P': 'と', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '竜',
});

/** 駒の種類の、ふつうの呼び方。 */
export function pieceName(kind) {
  return PIECE_NAMES[kind] ?? '駒';
}

const isDrop = (usi) => typeof usi === 'string' && usi[1] === '*';
/** USIの移動先。盤のキー（'7f'など）と同じ形。 */
export const usiTo = (usi) => (typeof usi === 'string' ? usi.slice(2, 4) : '');
const usiFrom = (usi) => (isDrop(usi) ? '' : String(usi ?? '').slice(0, 2));

/**
 * 盤に1手を指した後の盤。駒台は扱わない(盤の駒だけ)。
 * @param {Map<string, { color: 'black' | 'white', kind: string }>} board
 * @param {string} usi
 * @param {'black' | 'white'} color 指した側(駒打ちの駒の色)
 */
export function applyUsiToBoard(board, usi, color) {
  const next = new Map(board);
  const to = usiTo(usi);
  if (isDrop(usi)) {
    next.set(to, { color, kind: usi[0] });
    return next;
  }
  const from = usiFrom(usi);
  const piece = next.get(from);
  if (!piece) return next;
  next.delete(from);
  next.set(to, { color: piece.color, kind: usi.endsWith('+') ? `+${piece.kind}` : piece.kind });
  return next;
}

/**
 * 開始局面から本筋の各局面の盤を作る。戻り値の[i]は、i手指した後の盤(0は開始局面)。
 * @param {string} initialSfen
 * @param {string[]} moves
 * @param {(ply: number) => 'black' | 'white'} moverForPly
 */
export function boardsAlongLine(initialSfen, moves, moverForPly) {
  const boards = [parseSfenBoard(initialSfen)];
  moves.forEach((usi, index) => {
    boards.push(applyUsiToBoard(boards[index], usi, moverForPly(index + 1)));
  });
  return boards;
}

/**
 * usiが、相手の守りのない駒(取ったあと、取り返されない駒)を取る手なら、取る駒を返す。そうでなければnull。
 * 取り返されるかは、取ったあとの盤で調べる(取った駒の後ろから利いていた飛び駒も数える)。
 */
export function freeCapture(board, usi) {
  if (!usi || isDrop(usi)) return null;
  const to = usiTo(usi);
  const target = board.get(to);
  const mover = board.get(usiFrom(usi));
  if (!target || !mover || target.color === mover.color || target.kind === 'K') return null;
  const after = applyUsiToBoard(board, usi, mover.color);
  if (attackersOf(after, to, target.color).length) return null;
  return { square: to, kind: target.kind, name: pieceName(target.kind), value: pieceValue(target.kind) };
}

/**
 * colorの駒のうち、squareの駒をタダで取れる駒の位置。取る駒によっては、動いた後ろの筋が開いて取り返されるので、1つずつ調べる。
 * @param {Map<string, { color: 'black' | 'white', kind: string }>} board
 * @param {string} square
 * @param {'black' | 'white'} color 取る側
 */
export function freeCaptureOrigins(board, square, color) {
  return attackersOf(board, square, color)
    .map((attacker) => attacker.square)
    .filter((from) => freeCapture(board, `${from}${square}`));
}

/** usiで取る駒の価値(取らない手は0)。 */
export function capturedValue(board, usi) {
  if (!usi || isDrop(usi)) return 0;
  const target = board.get(usiTo(usi));
  return target ? pieceValue(target.kind) : 0;
}
