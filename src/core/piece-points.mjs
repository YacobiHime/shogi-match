import { applyUsiToBoard, parseSfenState } from "./piece-movement.mjs";

/**
 * 駒の値段(点数)。駒図鑑の「駒の価値 tier表」と、将棋教室・学習対局の駒得の数字(＋6／−5)で共通に使う。
 * よく使われる目安で、局面によって変わる。
 */
export const PIECE_POINTS = Object.freeze({ P: 1, L: 3, N: 4, S: 5, G: 6, B: 8, R: 10 });

/** 成った駒の盤の上での値段。tier表に出す。取ったときの数字には使わない(持ち駒になるのは元の駒なので)。 */
export const PROMOTED_PIECE_POINTS = Object.freeze({ "+P": 7, "+L": 6, "+N": 6, "+S": 6, "+B": 10, "+R": 12 });

/**
 * 取ったときの値段。成った駒は、持ち駒になる元の駒の値段にする(と金を取ったら＋1)。玉は数えない。
 * @param {string} kind "P"・"+P"など
 */
export function capturePoints(kind) {
  return PIECE_POINTS[String(kind).replace("+", "")] ?? 0;
}

/**
 * 局面sfenでusiを指したときに取る駒。取らない手や読めない手はnull。
 * colorは取った側("black"／"white")、pointsは取った駒の値段。
 * @returns {{ square: string, kind: string, color: "black" | "white", points: number } | null}
 */
export function captureOf(sfen, usi) {
  const { board, turn } = parseSfenState(sfen);
  const result = applyUsiToBoard(board, usi, turn);
  if (!result?.captured) return null;
  return { square: result.moved.to, kind: result.captured.kind, color: turn, points: capturePoints(result.captured.kind) };
}

/**
 * 手順を指したあとの駒の損得を、sideから見た点数の合計で返す(取った駒は＋、取られた駒は−)。
 * 観戦の「▲先手 ＋3」や、課題の中の合計に使う。
 * @param {string} sfen 開始局面
 * @param {string[]} moves 開始局面からの手順
 * @param {"black" | "white"} [side]
 */
export function materialSwing(sfen, moves, side = "black") {
  let { board, turn } = parseSfenState(sfen);
  let total = 0;
  for (const usi of moves) {
    const result = applyUsiToBoard(board, usi, turn);
    if (!result) break;
    if (result.captured) total += (turn === side ? 1 : -1) * capturePoints(result.captured.kind);
    board = result.board;
    turn = turn === "black" ? "white" : "black";
  }
  return total;
}

/** 合計の点数を「駒得 ＋1」「駒損 −4」「とりかえ ±0」の札にする。toneは色(good／bad／even)。 */
export function materialLabel(total) {
  if (total > 0) return { text: `駒得 ＋${total}`, tone: "good" };
  if (total < 0) return { text: `駒損 −${-total}`, tone: "bad" };
  return { text: "とりかえ ±0", tone: "even" };
}

/**
 * 盤の上と持ち駒の点数の合計(玉は数えない)。盤の上の成った駒は成った駒の値段、持ち駒は元の駒の値段で数える。
 * 形勢の3つのものさしの「駒の損得」で、先手と後手を比べるのに使う。
 */
export function materialTotals(sfen) {
  const fields = String(sfen ?? "").trim().split(/\s+/);
  const totals = { black: 0, white: 0 };
  for (const [, piece] of parseSfenState(sfen).board) {
    if (piece.kind === "K") continue;
    totals[piece.color] += PROMOTED_PIECE_POINTS[piece.kind] ?? PIECE_POINTS[piece.kind] ?? 0;
  }
  const hands = fields[2] ?? "-";
  if (hands !== "-") {
    for (const [, count, letter] of hands.matchAll(/(\d*)([PLNSGBRplnsgbr])/g)) {
      const color = letter === letter.toUpperCase() ? "black" : "white";
      totals[color] += (Number(count) || 1) * (PIECE_POINTS[letter.toUpperCase()] ?? 0);
    }
  }
  return totals;
}

/** この点数以上の駒(角・飛車)を取ったときは、数字を大きくする(Game_Nintendo_Implementation.mdの3-1の段階3)。 */
export const BIG_CAPTURE_POINTS = 8;
/** 駒得の数字を盤に出しておく時間(ミリ秒)。BoardView.vueの動きと同じ長さ。 */
export const CAPTURE_POP_MS = 900;

/**
 * 1手で駒を取ったときに盤へ浮かべる数字。sideから見て、取ったら緑の「＋6」、取られたら赤の「−5」。
 * 取らない手ならnull。
 * @param {string} sfen 指す前の局面
 * @param {string} usi
 * @param {"black" | "white"} side プレイヤーの側
 * @param {string | number} id 浮かべる数字を見分けるID(同じマスでも動きをやり直す)
 * @returns {{ id: string | number, file: number, rank: number, text: string, tone: "good" | "bad", big: boolean, points: number } | null}
 */
export function capturePop(sfen, usi, side, id) {
  const capture = captureOf(sfen, usi);
  if (!capture || !capture.points) return null;
  const mine = capture.color === side;
  return {
    id,
    file: Number(capture.square[0]),
    rank: capture.square.charCodeAt(1) - 96,
    text: `${mine ? "＋" : "−"}${capture.points}`,
    tone: /** @type {"good" | "bad"} */ (mine ? "good" : "bad"),
    big: capture.points >= BIG_CAPTURE_POINTS,
    points: mine ? capture.points : -capture.points,
  };
}
