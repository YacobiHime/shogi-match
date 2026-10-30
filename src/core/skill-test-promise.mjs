/**
 * 棋力テストの問いの約束(docs/skill-assessment-design.mdの10-4)を、盤だけで判定する。
 * 問いは約束で、約束を守る手を全部正解にする。問題を作るスクリプトと、束のテストと、答えのあとの理由の一言で使う。
 * 「詰まない手」(受けの約束)はエンジンが要るので、ここでは扱わない(問題を作るときに読んで、正解の一覧に入れる)。
 */
import { applyUsiToBoard, attackersOf, opponentOf, parseSfenState } from './piece-movement.mjs';
import { material, playLight, replyLoss, stateFromSfen } from './logic-position.mjs';

/** 得する駒取り: 取り合いの2手の読みで、これ以上の駒得(歩=100。取った駒は相手の損と自分の持ち駒の両方に数える)。 */
export const TAKE_GAIN_MIN = 300;
/** 取られないようにする手: 取り合いの2手の読みで、損がこれ以下。 */
export const SAVE_LOSS_MAX = 100;
/** 駒を取られそうな局面: 手を渡すと、取り合いの2手の読みでこれ以上の損。 */
export const THREAT_LOSS_MIN = 300;

/** 駒を取る手か(打つ手は取らない)。 */
export function isCaptureMove(sfen, usi) {
  if (!usi || usi.includes('*')) return false;
  const { board, turn } = parseSfenState(sfen);
  const target = board.get(usi.slice(2, 4));
  return Boolean(target && target.color !== turn);
}

/**
 * 手を指したあと、相手の取りの読み(2手)を受けた、手番側の駒の損得の変わり方。
 * @param {string} sfen
 * @param {string} usi
 */
export function materialSwing(sfen, usi) {
  const state = stateFromSfen(sfen);
  const child = playLight(state, usi);
  if (!child) return -Infinity;
  return material(child, state.turn) - replyLoss(child, 2) - material(state, state.turn);
}

/** 手を渡したら(何もしなかったら)、取り合いの2手の読みで取られる駒の損。 */
export function passLoss(sfen) {
  const state = stateFromSfen(sfen);
  return replyLoss({ ...state, turn: opponentOf(state.turn) }, 2);
}

/**
 * 得する駒取り(take の約束)のすべて。
 * @param {string} sfen
 * @param {readonly string[]} moves 合法手
 */
export const profitableCaptures = (sfen, moves) => moves.filter((usi) => isCaptureMove(sfen, usi) && materialSwing(sfen, usi) >= TAKE_GAIN_MIN);

/**
 * 取られないようにする手(save の約束)のすべて。逃げる・守る・先に相手の駒を取る・間に打つ、のどれでもよい。
 * @param {string} sfen
 * @param {readonly string[]} moves 合法手
 */
export const savingMoves = (sfen, moves) => moves.filter((usi) => materialSwing(sfen, usi) >= -SAVE_LOSS_MAX);

/**
 * 駒取りの理由の一言の材料。取った駒の種類と、取り返されるか(相手の駒が利いているか)。
 * @param {string} sfen
 * @param {string} usi
 * @returns {{ kind: string, free: boolean } | null}
 */
export function captureNote(sfen, usi) {
  if (!isCaptureMove(sfen, usi)) return null;
  const { board, turn } = parseSfenState(sfen);
  const to = usi.slice(2, 4);
  const kind = /** @type {{ kind: string }} */ (board.get(to)).kind;
  const applied = applyUsiToBoard(board, usi, turn);
  return { kind, free: !applied || attackersOf(applied.board, to, opponentOf(turn)).length === 0 };
}
