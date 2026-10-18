import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import { applyUsiToBoard, attackedSquares, parseSfenState } from "./piece-movement.mjs";
import { capturePoints } from "./piece-points.mjs";
import { isPieceLoose } from "./board-insight.mjs";

/**
 * 将棋教室の「駒得するまで指す」課題(両取りのあと、相手が1枚逃がしたら、もう1枚を取る)と、
 * 「角打ちの隙」の課題の、軽い損得の読み。駒の値段(piece-points.mjs)で、1手先・2手先の駒の損得だけを読む。
 * 教室の盤は駒が少ないので、合法手をすべて調べても待たせない。
 */

function legalUsis(sfen) {
  return enumerateLegalMoves(createGameRecord(sfen).position).map(({ usi }) => usi);
}

/** 局面sfenでusiを指したあとの局面。指せなければ""。 */
export function sfenAfterMove(sfen, usi) {
  const record = createGameRecord(sfen);
  return appendUsiMove(record, usi) ? record.position.sfen : "";
}

/**
 * usiを指した側から見た、その手の駒の損得。取った駒の値段から、動かした駒が取られて損をする形なら、その駒の値段を引く。
 * 例: 守られていない金を桂で取る＝＋6。歩に守られた金を飛車で取る＝＋6−10＝−4。
 * @param {string} sfen 指す前の局面
 * @param {string} usi
 */
export function moveGain(sfen, usi) {
  const { board, turn } = parseSfenState(sfen);
  const applied = applyUsiToBoard(board, usi, turn);
  if (!applied) return 0;
  const gained = applied.captured ? capturePoints(applied.captured.kind) : 0;
  const lost = isPieceLoose(applied.board, applied.moved.to) ? capturePoints(applied.moved.kind) : 0;
  return gained - lost;
}

/**
 * 手番の側が、いちばん駒得できる手。同じ損得なら、高い駒を取る手を選ぶ。駒得できる手がなければgainは0以下。
 * @param {string} sfen
 * @returns {{ usi: string, gain: number }}
 */
export function bestGainMove(sfen) {
  const { board, turn } = parseSfenState(sfen);
  let best = { usi: "", gain: -Infinity, captured: 0 };
  for (const usi of legalUsis(sfen)) {
    const gain = moveGain(sfen, usi);
    const captured = capturePoints(applyUsiToBoard(board, usi, turn)?.captured?.kind ?? "");
    if (gain > best.gain || (gain === best.gain && captured > best.captured)) best = { usi, gain, captured };
  }
  return { usi: best.usi, gain: Number.isFinite(best.gain) ? best.gain : 0 };
}

/**
 * 守る側(手番の側)のいちばん良い応手。相手が次に取れる駒の損得がいちばん小さくなる手を選ぶ
 * (両取りなら、高いほうの駒を逃がす。両取りをかけた駒を取れるなら取る)。
 * scoreは、攻める側から見た、この応手と次の1手の駒の損得の合計。
 * @param {string} sfen 守る側の手番の局面
 * @returns {{ usi: string, score: number }}
 */
export function defendingReply(sfen) {
  const { board, turn } = parseSfenState(sfen);
  let best = { usi: "", score: Infinity, escape: false };
  for (const usi of legalUsis(sfen)) {
    const applied = applyUsiToBoard(board, usi, turn);
    const taken = capturePoints(applied?.captured?.kind ?? "");
    const after = sfenAfterMove(sfen, usi);
    if (!after) continue;
    const score = -taken + Math.max(0, bestGainMove(after).gain);
    // 同じ損得なら、ねらわれている駒を逃がす手を選ぶ(自然な受けに見せる)。
    const escape = Boolean(applied?.moved.from && isPieceLoose(board, applied.moved.from));
    if (score < best.score || (score === best.score && escape && !best.escape)) best = { usi, score, escape };
  }
  return { usi: best.usi, score: Number.isFinite(best.score) ? best.score : 0 };
}

/**
 * 駒を打って、2枚以上の駒を同時にねらえるマス(両取りの候補)。玉は数えない。
 * @param {Map<string, { color: string, kind: string }>} board
 * @param {string} kind 打つ駒("B"など)
 * @param {"black" | "white"} color 打つ側
 */
function forkDropSquares(board, kind, color) {
  const squares = [];
  for (let x = 1; x <= 9; x += 1) {
    for (let y = 1; y <= 9; y += 1) {
      const square = `${x}${String.fromCharCode(96 + y)}`;
      if (board.has(square)) continue;
      const targets = attackedSquares(board, square, { color, kind }).filter((target) => {
        const piece = board.get(target);
        return piece && piece.color !== color && piece.kind !== "K";
      });
      if (targets.length >= 2) squares.push(square);
    }
  }
  return squares;
}

/**
 * 持ち駒(kind)を打ち込まれる隙。手番の側(打つ側)が、その駒を打って両取りをかけ、相手のいちばん良い受けのあとも
 * 駒得できる打ち込みのうち、いちばん得なもの。隙がなければnull。
 * 角換わりの「自陣に角を打ち込まれないように」の課題で、まちがえた手に相手の角打ちを見せるのに使う。
 * @param {string} sfen 打つ側の手番の局面
 * @param {string} kind
 * @returns {{ usi: string, gain: number } | null}
 */
export function dropThreat(sfen, kind) {
  const { board, turn } = parseSfenState(sfen);
  const legal = new Set(legalUsis(sfen));
  let best = null;
  for (const square of forkDropSquares(board, kind, turn)) {
    const usi = `${kind}*${square}`;
    if (!legal.has(usi)) continue;
    const after = sfenAfterMove(sfen, usi);
    const gain = defendingReply(after).score;
    if (gain > 0 && (!best || gain > best.gain)) best = { usi, gain };
  }
  return best;
}
