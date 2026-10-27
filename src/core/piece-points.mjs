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
 * 成った分の値段(成った駒の値段と、元の駒の値段の差)。成っていない駒・値段のない駒は0。
 * 成駒が取られると、取った側の持ち駒になるのは元の駒なので、この分は盤から消える。
 * @param {string} kind "+B"・"B"など
 * @param {Record<string, number>} [values] 省略時は教室用。対局はAI_PIECE_POINTS。
 */
export function promotionBonus(kind, values = TEACHING_PIECE_POINTS) {
  const name = String(kind);
  if (!name.startsWith("+")) return 0;
  return Math.max(0, (values[name] ?? 0) - (values[name.slice(1)] ?? 0));
}

/**
 * 1手で動く駒の損得を、取った駒(持ち駒になる元の駒の値段)と、成りの分に分けて、sideから見た符号つきで返す
 * (docs/material-guide-design.mdの「成りの分」)。
 * - capture: 取った駒の元の値段(取ったら＋、取られたら−)。
 * - lostBonus: 取られた成駒の成った分(成駒を取ったら＋、取られたら−)。
 * - promotion: この手で成った分(成ったら＋、相手が成ったら−)。
 * 取りも成りもない手や、読めない手はnull。
 * @param {string} sfen 指す前の局面
 * @param {string} usi
 * @param {"black" | "white"} side
 * @param {Record<string, number>} [values]
 * @returns {{ square: string, capture: number, lostBonus: number, promotion: number, total: number } | null}
 */
export function moveMaterial(sfen, usi, side, values = TEACHING_PIECE_POINTS) {
  const { board, turn } = parseSfenState(sfen);
  const result = applyUsiToBoard(board, usi, turn);
  if (!result) return null;
  const sign = turn === side ? 1 : -1;
  const capturedKind = result.captured && result.captured.kind !== "K" ? result.captured.kind : "";
  const capture = capturedKind ? sign * (values[capturedKind.replace("+", "")] ?? 0) : 0;
  const lostBonus = capturedKind ? sign * promotionBonus(capturedKind, values) : 0;
  const promoted = !result.moved.drop && result.moved.promote && result.moved.kind.startsWith("+");
  const fromKind = promoted ? board.get(result.moved.from)?.kind ?? "" : "";
  const promotion = promoted && !fromKind.startsWith("+") ? sign * promotionBonus(result.moved.kind, values) : 0;
  if (!capture && !lostBonus && !promotion) return null;
  return { square: result.moved.to, capture, lostBonus, promotion, total: capture + lostBonus + promotion };
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
 * 手順を指したあとの駒の損得を、sideから見た点数の合計で返す(取った駒は＋、取られた駒は−。成りの分も数える。
 * moveMaterialの合計)。観戦の「▲先手 ＋3」や、課題の中の合計に使う。
 * @param {string} sfen 開始局面
 * @param {string[]} moves 開始局面からの手順
 * @param {"black" | "white"} [side]
 * @param {Record<string, number>} [values]
 */
export function materialSwing(sfen, moves, side = "black", values = TEACHING_PIECE_POINTS) {
  let { board, turn } = parseSfenState(sfen);
  let total = 0;
  for (const usi of moves) {
    const result = applyUsiToBoard(board, usi, turn);
    if (!result) break;
    const sign = turn === side ? 1 : -1;
    if (result.captured && result.captured.kind !== "K") {
      total += sign * ((values[result.captured.kind.replace("+", "")] ?? 0) + promotionBonus(result.captured.kind, values));
    }
    const fromKind = result.moved.drop ? "" : board.get(result.moved.from)?.kind ?? "";
    if (result.moved.kind.startsWith("+") && !fromKind.startsWith("+") && !result.moved.drop) total += sign * promotionBonus(result.moved.kind, values);
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

/**
 * 駒の損得の札の点数(docs/material-guide-design.mdの「成りの分」)。取った駒の差と、成りの分の差を、先手・後手ごとに返す。
 * 差(自分−相手)は、浮かべる数字(moveMaterial)を足したものと同じになる: 歩を1枚取ると＋90(盤と持ち駒の合計の差なら＋180)、
 * 角が成ると＋90、角と馬の交換は馬の側が−90。
 * 盤と持ち駒の元の駒の値段の差は、取り合いのたびに2倍動くので半分にする。駒落ちの開始局面の差(startSfen)は、
 * 駒がまるごとない差なので、そのまま数える。
 * @param {string} sfen
 * @param {string} [startSfen] 対局の開始局面(駒落ちの差を数えるため)。なければ平手と同じに見る。
 * @param {Record<string, number>} [values]
 * @returns {{ black: number, white: number }}
 */
export function materialBalance(sfen, startSfen = "", values = AI_PIECE_POINTS) {
  const base = sumMaterial(sfen, values, { promoted: false });
  const bonus = promotionTotals(sfen, values);
  const start = startSfen ? sumMaterial(startSfen, values, { promoted: false }) : { black: 0, white: 0 };
  const startGap = (start.black - start.white) / 2;
  const half = (side) => (base[side] - start[side]) / 2;
  return {
    black: half("black") + bonus.black + startGap,
    white: half("white") + bonus.white - startGap,
  };
}

/** 盤の上の成駒の、成った分の合計(先手・後手)。 */
function promotionTotals(sfen, values) {
  const totals = { black: 0, white: 0 };
  for (const [, piece] of parseSfenState(sfen).board) totals[piece.color] += promotionBonus(piece.kind, values);
  return totals;
}

/**
 * @param {string} sfen
 * @param {Record<string, number>} values
 * @param {{ promoted?: boolean }} [options] promoted: falseなら、盤の上の成駒も元の駒の値段で数える。
 */
function sumMaterial(sfen, values, { promoted = true } = {}) {
  const fields = String(sfen ?? "").trim().split(/\s+/);
  const totals = { black: 0, white: 0 };
  for (const [, piece] of parseSfenState(sfen).board) {
    if (piece.kind === "K") continue;
    totals[piece.color] += values[promoted ? piece.kind : piece.kind.replace("+", "")] ?? 0;
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
 * 1手で盤へ浮かべる数字の並び。取った駒の元の値段(「＋855」)と、成りの分(「成り−90」)を分けて出す。
 * 成りの分は小さく、取った駒の数字があるときはその下にずらす(sub・offset)。取りも成りもない手は空。
 * @param {string} sfen 指す前の局面
 * @param {string} usi
 * @param {"black" | "white"} side プレイヤーの側
 * @param {number} id 1つ目の数字のID。2つ目は id + 0.5
 * @param {Record<string, number>} [values]
 * @param {number} [bigCapturePoints]
 * @returns {{ id: number, file: number, rank: number, text: string, tone: "good" | "bad", big: boolean, sub: boolean, offset: boolean, points: number }[]}
 */
export function materialPops(sfen, usi, side, id, values = PIECE_POINTS, bigCapturePoints = BIG_CAPTURE_POINTS) {
  const teaching = values === PIECE_POINTS ? TEACHING_PIECE_POINTS : values;
  const change = moveMaterial(sfen, usi, side, teaching);
  if (!change) return [];
  const file = Number(change.square[0]);
  const rank = change.square.charCodeAt(1) - 96;
  const sign = (points) => (points > 0 ? `＋${points}` : `−${-points}`);
  const tone = (points) => /** @type {"good" | "bad"} */ (points > 0 ? "good" : "bad");
  const pops = [];
  if (change.capture) {
    pops.push({ id, file, rank, text: sign(change.capture), tone: tone(change.capture), big: Math.abs(change.capture) >= bigCapturePoints, sub: false, offset: false, points: change.capture });
  }
  const bonus = change.lostBonus + change.promotion;
  if (bonus) {
    pops.push({ id: id + 0.5, file, rank, text: `成り${sign(bonus)}`, tone: tone(bonus), big: false, sub: true, offset: pops.length > 0, points: bonus });
  }
  return pops;
}

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
