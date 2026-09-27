import { Position, reverseColor } from 'tsshogi';
import { enumerateLegalMoves } from '../game-state.ts';

/** エンジン候補の正の詰みスコアを手数（ply）として取り出す。 */
export function parseMateScore(candidate) {
  const value = candidate?.score?.type === 'mate' ? candidate.score.value : undefined;
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * 通常探索のPVが、開始側の連続王手で指定手数後に詰む手順かを検証する。
 * エンジンのmateスコアだけを信用せず、壊れた・短いPVを除外する。
 */
export function isContinuousCheckMate(sfen, pv, plies) {
  if (!Number.isInteger(plies) || plies < 1 || !Array.isArray(pv) || pv.length < plies) {
    return false;
  }
  const position = Position.newBySFEN(sfen);
  if (!position) return false;
  const attacker = position.color;
  for (let index = 0; index < plies; index += 1) {
    const move = position.createMoveByUSI(pv[index]);
    if (!move || !position.isValidMove(move) || !position.doMove(move)) return false;
    if (index % 2 === 0 && !position.checked) return false;
    if (index < plies - 1 && enumerateLegalMoves(position).length === 0) return false;
  }
  return position.color !== attacker
    && position.checked
    && enumerateLegalMoves(position).length === 0;
}

/**
 * SFENの盤面を変えず手番だけを反転する。
 * 現在の手番側が王手中なら、反転後に相手玉を取れる不正局面になるためnullを返す。
 */
export function flipSideToMove(sfen) {
  const position = Position.newBySFEN(sfen);
  if (!position || position.checked) return null;
  position.setColor(reverseColor(position.color));
  return position.sfen;
}
