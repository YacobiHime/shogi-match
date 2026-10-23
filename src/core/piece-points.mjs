import { applyUsiToBoard, parseSfenState } from "./piece-movement.mjs";

/**
 * 駒の値段(点数)。駒図鑑の「駒の価値 tier表」と、将棋教室の駒得の数字(＋6／−5)で共通に使う。
 * よく使われる目安で、局面によって変わる。
 */
export const PIECE_POINTS = Object.freeze({ P: 1, L: 3, N: 4, S: 5, G: 6, B: 8, R: 10 });

/** 成った駒の盤の上での値段。tier表に出す。取ったときの数字には使わない(持ち駒になるのは元の駒なので)。 */
export const PROMOTED_PIECE_POINTS = Object.freeze({ "+P": 7, "+L": 6, "+N": 6, "+S": 6, "+B": 10, "+R": 12 });

/** 図鑑の「将棋AI（やねうら王）が使う駒の価値」。歩90を基準とした表示用の共通表。玉は数えない。 */
export const AI_PIECE_POINTS = Object.freeze({
  P: 90, L: 315, N: 405, S: 495, G: 540, B: 855, R: 990,
  "+P": 540, "+L": 540, "+N": 540, "+S": 540, "+B": 945, "+R": 1395,
});
const TEACHING_PIECE_POINTS = Object.freeze({ ...PIECE_POINTS, ...PROMOTED_PIECE_POINTS });

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
  return sumMaterial(sfen, TEACHING_PIECE_POINTS);
}

/** 対局・検討中の駒得表示。AI用の共通表で盤上と持ち駒を合計する。 */
export function aiMaterialTotals(sfen) {
  return sumMaterial(sfen, AI_PIECE_POINTS);
}

function sumMaterial(sfen, values) {
  const fields = String(sfen ?? "").trim().split(/\s+/);
  const totals = { black: 0, white: 0 };
  for (const [, piece] of parseSfenState(sfen).board) {
    if (piece.kind === "K") continue;
    totals[piece.color] += values[piece.kind] ?? 0;
  }
  const hands = fields[2] ?? "-";
  if (hands !== "-") {
    for (const [, count, letter] of hands.matchAll(/(\d*)([PLNSGBRplnsgbr])/g)) {
      const color = letter === letter.toUpperCase() ? "black" : "white";
      totals[color] += (Number(count) || 1) * (values[letter.toUpperCase()] ?? 0);
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
 * @param {Record<string, number>} [values] 省略時は教室用。対局画面はAI_PIECE_POINTSを渡す。
 * @param {number} [bigCapturePoints] 大きく出す駒の値段の下限
 * @returns {{ id: string | number, file: number, rank: number, text: string, tone: "good" | "bad", big: boolean, points: number } | null}
 */
export function capturePop(sfen, usi, side, id, values = PIECE_POINTS, bigCapturePoints = BIG_CAPTURE_POINTS) {
  const capture = captureOf(sfen, usi);
  if (!capture) return null;
  // 取った成り駒は、持ち駒になる元の駒の値で数える。
  const points = values[capture.kind.replace("+", "")] ?? 0;
  if (!points) return null;
  const mine = capture.color === side;
  return {
    id,
    file: Number(capture.square[0]),
    rank: capture.square.charCodeAt(1) - 96,
    text: `${mine ? "＋" : "−"}${points}`,
    tone: /** @type {"good" | "bad"} */ (mine ? "good" : "bad"),
    big: points >= bigCapturePoints,
    points: mine ? points : -points,
  };
}
