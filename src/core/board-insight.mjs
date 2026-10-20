import { createGameRecord, enumerateLegalMoves } from "../game-state";
import { attackersOf, applyUsiToBoard, attackedSquares, findKing, opponentOf, parseSfenState, squareXY, xySquare } from "./piece-movement.mjs";
import { capturePoints } from "./piece-points.mjs";
import { exchangeGain } from "./exchange-eval.mjs";

/**
 * 盤の「見える化」のための計算。将棋教室の利きメガネ(取られるマス・玉の逃げ道・取り返し)と、
 * 形勢の3つのものさしで使う。tsshogiの合法手と、piece-movement.mjsの軽い利きの計算を組み合わせる。
 */

function legalUsis(sfen) {
  return enumerateLegalMoves(createGameRecord(sfen).position).map(({ usi }) => usi);
}

/** 駒の値段。玉は取られてはいけない駒なので、いちばん高くする。 */
function pieceWorth(kind) {
  return kind === "K" ? 1000 : capturePoints(kind) || 0;
}

/**
 * squareの駒が、取られて損をするか。相手が安い駒から順に取り合ったとき、相手が得をするなら真。玉は数えない。
 * CPU(ロジックAI)の「取られる損」と同じ取り合いの計算(exchange-eval.mjs)で、裏の利き・ピン・成りまで見る。
 */
export function isPieceLoose(board, square) {
  const piece = board.get(square);
  if (!piece || piece.kind === "K") return false;
  return exchangeGain(board, square, opponentOf(piece.color), { mode: "full" }).gain > 0;
}

/**
 * 駒を選んだとき、動かすと取られて損をする行き先(USIのマス)。sourceは盤の駒なら"5e"、持ち駒なら"P*"。
 * 利きメガネの「取られるマス」(青い点の外側の赤い輪)に使う。
 * @param {string} sfen 手番の側が動かす局面
 * @param {string} source
 * @returns {string[]}
 */
export function unsafeDestinations(sfen, source) {
  const { board, turn } = parseSfenState(sfen);
  const result = new Set();
  for (const usi of legalUsis(sfen)) {
    if (!usi.startsWith(source)) continue;
    const applied = applyUsiToBoard(board, usi, turn);
    if (applied && isPieceLoose(applied.board, applied.moved.to)) result.add(applied.moved.to);
  }
  return [...result];
}

/**
 * squareの駒を、手番の側がいちばん安い駒で取る手。取れなければ""。
 * まちがえて取られる場所へ動かしたとき、相手が取り返す手を見せる(取り返しの再生)。
 */
export function cheapestRecapture(sfen, square) {
  const { board } = parseSfenState(sfen);
  let best = "";
  let bestWorth = Infinity;
  for (const usi of legalUsis(sfen)) {
    if (usi.includes("*") || usi.slice(2, 4) !== square) continue;
    const worth = pieceWorth(board.get(usi.slice(0, 2))?.kind);
    // 同じ駒なら、成らない手より成る手を選ぶ(強い取り方を見せる)。
    if (worth < bestWorth || (worth === bestWorth && usi.endsWith("+"))) {
      best = usi;
      bestWorth = worth;
    }
  }
  return best;
}

/**
 * まちがえた手に対する相手の取り返し。指した駒が取られて損をするなら、相手のいちばん安い取り返しを返す。
 * @returns {{ reply: string, square: string } | null}
 */
export function refutationOf(sfen, usi) {
  const { board, turn } = parseSfenState(sfen);
  const applied = applyUsiToBoard(board, usi, turn);
  if (!applied || !isPieceLoose(applied.board, applied.moved.to)) return null;
  const position = createGameRecord(sfen).position.clone();
  const move = position.createMoveByUSI(usi);
  if (!move || !position.doMove(move)) return null;
  const reply = cheapestRecapture(position.sfen, applied.moved.to);
  return reply ? { reply, square: applied.moved.to } : null;
}

const KING_NEIGHBORS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/**
 * 玉のまわり8マスの様子。玉の逃げ道(利きメガネ)と、詰みの理由を見せるのに使う。
 * state: open(逃げられる) / covered(相手の駒が利いている) / blocked(玉の味方の駒がふさいでいる)
 * 玉を盤から外して利きを数える(飛車・角の利きが、玉の後ろのマスにも通るため)。
 * @param {string} sfen
 * @param {"black" | "white"} color 玉の側
 * @returns {{ king: string, squares: { square: string, state: "open" | "covered" | "blocked" }[] } | null}
 */
export function kingEscapeMap(sfen, color) {
  const { board } = parseSfenState(sfen);
  const king = findKing(board, color);
  if (!king) return null;
  const without = new Map(board);
  without.delete(king);
  const { x, y } = squareXY(king);
  const squares = [];
  for (const [dx, dy] of KING_NEIGHBORS) {
    const square = xySquare(x + dx, y + dy);
    if (!square) continue;
    const piece = board.get(square);
    if (piece?.color === color) {
      squares.push({ square, state: "blocked" });
      continue;
    }
    const covered = attackersOf(without, square, opponentOf(color)).length > 0;
    squares.push({ square, state: covered ? "covered" : "open" });
  }
  return { king, squares };
}

/**
 * 先手・後手の駒が利いているマスの数(駒の働き)。形勢の3つのものさしの「駒の働き」に使う。
 * 玉の利きは数えない(働きは攻めと守りに使える駒で比べる)。
 */
export function controlCount(sfen) {
  const { board } = parseSfenState(sfen);
  const covered = { black: new Set(), white: new Set() };
  for (const [square, piece] of board) {
    if (piece.kind === "K") continue;
    for (const target of attackedSquares(board, square, piece)) covered[piece.color].add(target);
  }
  return { black: covered.black.size, white: covered.white.size };
}

/** 手番の側が王手をかけられる手があるか(攻めくらべで、王手が続かなくなったかを調べる)。 */
export function hasCheckingMove(sfen) {
  const position = createGameRecord(sfen).position;
  for (const { usi } of enumerateLegalMoves(position)) {
    const next = position.clone();
    const move = next.createMoveByUSI(usi);
    if (move && next.doMove(move) && next.checked) return true;
  }
  return false;
}
