/*
 * 対局でコツの形ができた瞬間(docs/nyumon-mode-design.mdの21-14-2)。
 * 教室の「すぐ使えるコツ」で覚えた形が、ふだんの対局でできた手に「コツどおり！」の札を出し、使った回数を残す。
 * 判定は駒の位置と、作戦カードと同じ完成形のマス(openingCompletionVariants)だけで決める(探索はしない)。
 * 対局画面から読むので、教室のカリキュラム(tutorial-curriculum.mjs)は読まない。IDはコツのカードと同じ。
 */

import { OPENING_CASTLES, openingCompletionVariants } from "./opening-guide.mjs";
import { parseSfenBoard } from "./sfen-board.mjs";

export const TIP_USES_KEY = "yacobihime:shogi-match:tip-uses:v1";

/**
 * 札に出すコツ。titleは札の真ん中(後手のときの言い方があればwhiteTitle)、lineは下の一言。
 * 並びは、同じ手で2つできたときに先に出す順。
 */
export const TIP_MOMENTS = Object.freeze([
  Object.freeze({ id: "tip-rook-pawn", title: "飛車先の歩を交換！", line: "コツどおり！ 歩が1枚手に入ったね" }),
  Object.freeze({ id: "tip-vs-ibisha", title: "7七銀・7八金の形！", whiteTitle: "3三銀・3二金の形！", line: "コツどおり！ 相手の飛車先を受けたね" }),
  Object.freeze({ id: "tip-vs-furibisha", title: "振り飛車にエルモ囲い！", line: "コツどおり！ 早くて堅い囲いだよ" }),
  Object.freeze({ id: "tip-shiken", title: "四間飛車と美濃囲い！", line: "コツどおり！ 攻めと守りが分かれたね" }),
]);
const TIP_IDS = new Set(TIP_MOMENTS.map(({ id }) => id));

const other = (color) => (color === "black" ? "white" : "black");

/** 先手から見たマスと、その側の盤のマスを行き来する(後手は盤を180度回す。同じ式で戻せる)。 */
function relative(square, color) {
  if (color === "black") return square;
  return `${10 - Number(square[0])}${String.fromCharCode(97 + 8 - (square.charCodeAt(1) - 97))}`;
}

function hasPiece(board, color, relativeSquare, kind) {
  const piece = board.get(relative(relativeSquare, color));
  return piece?.color === color && piece.kind === kind;
}

function castleBuilt(board, color, castleId) {
  const definition = OPENING_CASTLES.find(({ id }) => id === castleId);
  return openingCompletionVariants(definition)
    .some((squares) => squares.every(([square, kind]) => hasPiece(board, color, square, kind)));
}

/** その側の(成っていない)飛車の、その側から見たマス。いなければ""。 */
function rookSquare(board, color) {
  for (const [square, piece] of board) if (piece.color === color && piece.kind === "R") return relative(square, color);
  return "";
}

/** 相手の飛車が自陣(その側から見て6〜9段目)にいて、筋が条件に合うか。中盤に飛車が動き回ったあとは数えない。 */
function opponentRookOnFile(board, opponent, files) {
  const square = rookSquare(board, opponent);
  return Boolean(square) && square[1] >= "f" && files.includes(Number(square[0]));
}

/** 形のコツ(局面で決まるもの)。それぞれ、プレイヤー(color)の側から見て判定する。 */
const SHAPES = Object.freeze({
  // 自分の銀が7七・金が7八。相手は居飛車(飛車が2筋)で、飛車先の歩が2五か2四まで伸びている。
  "tip-vs-ibisha": (board, color) => {
    const opponent = other(color);
    return hasPiece(board, color, "7g", "S") && hasPiece(board, color, "7h", "G")
      && opponentRookOnFile(board, opponent, [2])
      && (hasPiece(board, opponent, "2e", "P") || hasPiece(board, opponent, "2d", "P"));
  },
  // エルモ囲いが完成していて、相手は振り飛車(飛車が5〜8筋)。
  "tip-vs-furibisha": (board, color) => castleBuilt(board, color, "elmo") && opponentRookOnFile(board, other(color), [5, 6, 7, 8]),
  // 自分の飛車が6八(四間飛車)で、美濃囲いが完成している。
  "tip-shiken": (board, color) => hasPiece(board, color, "6h", "R") && castleBuilt(board, color, "mino"),
});

/**
 * 局面で、できている形のコツのID。対局の始めの局面でできているものは、その対局では出さない(startTipMoments)。
 * @param {string} sfen
 * @param {"black" | "white"} color プレイヤーの側
 */
export function tipShapesHolding(sfen, color) {
  const board = parseSfenBoard(sfen);
  return Object.entries(SHAPES).filter(([, holds]) => holds(board, color)).map(([id]) => id);
}

/**
 * 飛車先の歩の交換か: 2筋の飛車が、相手が2四で取った歩を取り返した手(後手は8筋・8六)。
 * 指す前の盤に、自分の2筋の歩がもうない(歩を突いて取られた)ことで見分ける。
 */
function rookPawnExchange(before, usi, color) {
  if (usi.includes("*")) return false;
  const from = relative(usi.slice(0, 2), color);
  const to = relative(usi.slice(2, 4), color);
  if (from[0] !== "2" || to !== "2d") return false;
  const board = parseSfenBoard(before);
  const taken = board.get(usi.slice(2, 4));
  if (!hasPiece(board, color, from, "R") || taken?.color !== other(color) || taken.kind !== "P") return false;
  for (const rank of "abcdefghi") if (hasPiece(board, color, `2${rank}`, "P")) return false;
  return true;
}

/**
 * 対局の始めの局面で、もうできている形のコツ。その対局では出さない(1局に1回の印と同じ扱い)。
 * @param {string} sfen
 * @param {"black" | "white"} color
 */
export function startTipMoments(sfen, color) {
  return tipShapesHolding(sfen, color);
}

/**
 * プレイヤーが指した手で、コツの形ができたか。できたら札(id・title・line)、なければnull。
 * @param {{ before: string, usi: string, after: string, color: "black" | "white", learned: Iterable<string>, fired: Iterable<string> }} input
 *   learnedはクリアしたコツのカード、firedはこの対局でもう出した(か始めからできていた)コツ
 */
export function tipMoment({ before, usi, after, color, learned, fired }) {
  const known = new Set(learned);
  const done = new Set(fired);
  const open = TIP_MOMENTS.filter(({ id }) => known.has(id) && !done.has(id));
  if (!open.length) return null;
  const holding = new Set(tipShapesHolding(after, color));
  const moment = open.find(({ id }) => (id === "tip-rook-pawn" ? rookPawnExchange(before, usi, color) : holding.has(id)));
  if (!moment) return null;
  return { id: moment.id, title: color === "white" && moment.whiteTitle ? moment.whiteTitle : moment.title, line: moment.line };
}

/** コツを対局で使った回数。読めない値は捨てる。 */
export function loadTipUses(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(TIP_USES_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .filter(([id, count]) => TIP_IDS.has(id) && Number.isInteger(count) && count > 0)
      .map(([id, count]) => [id, Math.min(count, 9999)]));
  } catch {
    return {};
  }
}

/** コツを1回使ったことを残す。残したあとの回数を返す。 */
export function noteTipUse(storage, id) {
  const uses = loadTipUses(storage);
  if (!TIP_IDS.has(id)) return uses;
  const next = { ...uses, [id]: Math.min((uses[id] ?? 0) + 1, 9999) };
  try {
    storage?.setItem(TIP_USES_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても、対局は続ける。
  }
  return next;
}
