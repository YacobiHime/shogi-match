/*
 * 対局でコツの形ができた瞬間(docs/nyumon-mode-design.mdの21-14-2と22章)。
 * 教室の「すぐ使えるコツ」で覚えた形が、ふだんの対局でできた手に「コツどおり！」の札を出し、使った回数を残す。
 * 判定は駒の位置・利き・取り合いの計算・作戦カードと同じ完成形のマス(openingCompletionVariants)・寄せの数え方で決める
 * (新しい探索はしない)。対局画面から読むので、教室のカリキュラム(tutorial-curriculum.mjs)は読まない。IDはコツのカードと同じ。
 */

import { appendUsiMove, createGameRecord, enumerateLegalMoves, STANDARD_SFEN } from "../game-state";
import { exchangeGain } from "./exchange-eval.mjs";
import { finishingMate } from "./mate-finish.mjs";
import { detectTesuji } from "./move-tesuji.mjs";
import { OPENING_CASTLES, openingCompletionVariants } from "./opening-guide.mjs";
import { applyUsiToBoard, attackedSquares, attackersOf, findKing, pieceValue } from "./piece-movement.mjs";
import { parseSfenBoard } from "./sfen-board.mjs";

export const TIP_USES_KEY = "yacobihime:shogi-match:tip-uses:v1";
/** 盤の上の札を出すのは、そのコツを対局で使ったのが何回目までか(22-1。慣れたら札を出さずに数えるだけ)。 */
export const TIP_CALLOUT_LIMIT = 3;

/**
 * 12枚のコツ。並びは教室のカードと同じで、同じ手で2つできたときに先に札を出す順。
 * titleは札の真ん中(後手のときの言い方があればwhiteTitle)、lineは下の一言、shortは結果の窓とアルバムの名前。
 * mateは、詰ませた手で決まるコツ(盤の札は出さず、結果の窓の行にだけ出す)。
 */
export const TIP_MOMENTS = Object.freeze([
  Object.freeze({ id: "tip-rook-pawn", short: "飛車先の歩の交換", title: "飛車先の歩を交換！", line: "コツどおり！ 歩が1枚手に入ったね" }),
  Object.freeze({ id: "tip-castle-first", short: "囲ってから戦う", title: "囲ってから戦えた！", line: "コツどおり！ 玉が安全なまま戦えるね" }),
  Object.freeze({ id: "tip-vs-ibisha", short: "7七銀・7八金", title: "7七銀・7八金の形！", whiteTitle: "3三銀・3二金の形！", line: "コツどおり！ 相手の飛車先を受けたね" }),
  Object.freeze({ id: "tip-vs-furibisha", short: "振り飛車にエルモ囲い", title: "振り飛車にエルモ囲い！", line: "コツどおり！ 早くて堅い囲いだよ" }),
  Object.freeze({ id: "tip-shiken", short: "四間飛車と美濃囲い", title: "四間飛車と美濃囲い！", line: "コツどおり！ 攻めと守りが分かれたね" }),
  Object.freeze({ id: "tip-supported", short: "味方の利きの上へ", title: "味方の利きの上へ！", line: "コツどおり！ 取られても取り返せるね" }),
  Object.freeze({ id: "tip-free-piece", short: "タダの駒を取る", title: "タダの駒を取った！", line: "コツどおり！ 駒得したね" }),
  Object.freeze({ id: "tip-fork", short: "両取り", title: "両取り！", line: "コツどおり！ 次に駒得できるよ" }),
  Object.freeze({ id: "tip-head-gold", short: "頭金", title: "頭金で詰み！", line: "コツどおり！", mate: true }),
  Object.freeze({ id: "tip-bottom", short: "下段に落とす", title: "下段に落として詰み！", line: "コツどおり！", mate: true }),
  Object.freeze({ id: "tip-pawn-hand", short: "垂れ歩でと金", title: "垂れ歩からと金！", line: "コツどおり！ 歩1枚でと金ができたね" }),
  Object.freeze({ id: "tip-speed", short: "駒を捨てて詰ます", title: "駒を捨てて詰み！", line: "コツどおり！", mate: true }),
]);
const TIP_IDS = new Set(TIP_MOMENTS.map(({ id }) => id));
/** 両取りでねらう価値のある駒(銀より上と玉。move-tesuji.mjsと同じ)。 */
const FORK_MIN_VALUE = pieceValue("S");

const other = (color) => (color === "black" ? "white" : "black");

/** 先手から見たマスと、その側の盤のマスを行き来する(後手は盤を180度回す。同じ式で戻せる)。 */
function relative(square, color) {
  if (color === "black") return square;
  return `${10 - Number(square[0])}${String.fromCharCode(97 + 8 - (square.charCodeAt(1) - 97))}`;
}

/** その側から見た段(1〜9。1が相手の陣のいちばん奥)。 */
const relativeRankOf = (square, color) => relative(square, color).charCodeAt(1) - 96;

function hasPiece(board, color, relativeSquare, kind) {
  const piece = board.get(relative(relativeSquare, color));
  return piece?.color === color && piece.kind === kind;
}

function castleBuilt(board, color, castleId) {
  const definition = OPENING_CASTLES.find(({ id }) => id === castleId);
  return openingCompletionVariants(definition)
    .some((squares) => squares.every(([square, kind]) => hasPiece(board, color, square, kind)));
}

/** 作戦カードの囲いのどれかが完成しているか。 */
const anyCastleBuilt = (board, color) => OPENING_CASTLES.some(({ id }) => castleBuilt(board, color, id));

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

/** 持ち駒(SFENの3つめ)に、歩でない駒があるか。 */
function handsHaveMajor(sfen) {
  const hands = String(sfen ?? "").trim().split(/\s+/)[2] ?? "-";
  return /[^0-9pP-]/.test(hands);
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
function rookPawnExchange(board, usi, color) {
  if (usi.includes("*")) return false;
  const from = relative(usi.slice(0, 2), color);
  const to = relative(usi.slice(2, 4), color);
  if (from[0] !== "2" || to !== "2d") return false;
  const taken = board.get(usi.slice(2, 4));
  if (!hasPiece(board, color, from, "R") || taken?.color !== other(color) || taken.kind !== "P") return false;
  for (const rank of "abcdefghi") if (hasPiece(board, color, `2${rank}`, "P")) return false;
  return true;
}

/** そのマスの1段うしろ(その側から見て)。 */
function behind(square, color) {
  const rank = square.charCodeAt(1) - 96 + (color === "black" ? 1 : -1);
  return rank >= 1 && rank <= 9 ? `${square[0]}${String.fromCharCode(96 + rank)}` : "";
}

/** そのマスの歩が、自分で打った歩(打ったあと、まっすぐ進んできた歩)か。historyは、この手を指す前までの手。 */
function droppedPawn(history, square, color) {
  let at = square;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const usi = history[index];
    if (usi.slice(2, 4) !== at) continue;
    if (usi === `P*${at}`) return true;
    const from = usi.slice(0, 2);
    if (usi.includes("*") || usi.endsWith("+") || from !== behind(at, color)) return false;
    at = from;
  }
  return false;
}

/** 手の判定(盤の札を出すコツ)。指す前の盤・指したあとの盤・動いた駒・取った駒から決める。 */
const MOVES = Object.freeze({
  "tip-rook-pawn": ({ before, usi, color }) => rookPawnExchange(before, usi, color),
  // 駒を取る手で、大きな駒の取り合いはまだ(持ち駒が歩だけ)。自分の囲いが完成している。
  "tip-castle-first": ({ captured, beforeSfen, after, color }) => Boolean(captured) && !handsHaveMajor(beforeSfen) && anyCastleBuilt(after, color),
  // 歩と玉でない駒を、取らずに前へ。行き先に相手の利きと味方の利きがあり、取り合っても損をしない。
  "tip-supported": ({ moved, captured, after, color }) => {
    if (moved.drop || captured || ["P", "K"].includes(moved.kind)) return false;
    if (relativeRankOf(moved.to, color) >= relativeRankOf(moved.from, color)) return false;
    return attackersOf(after, moved.to, other(color)).length > 0
      && attackersOf(after, moved.to, color).length > 0
      && exchangeGain(after, moved.to, other(color), { mode: "full" }).gain <= 0;
  },
  // 歩でない駒を取り、取ったあと相手がそのマスに利いていない。
  "tip-free-piece": ({ moved, captured, after, color }) => Boolean(captured) && captured.kind !== "P"
    && attackersOf(after, moved.to, other(color)).length === 0,
  // 動かした(打った)駒が、銀より上の駒か玉を2つ以上ねらい、行き先で取られても損をしない。
  "tip-fork": ({ moved, after, color }) => {
    if (moved.kind === "K") return false;
    const targets = attackedSquares(after, moved.to).filter((square) => {
      const piece = after.get(square);
      return piece?.color === other(color) && (piece.kind === "K" || pieceValue(piece.kind) >= FORK_MIN_VALUE);
    });
    return targets.length >= 2 && exchangeGain(after, moved.to, other(color), { mode: "full" }).gain <= 0;
  },
  // 歩がと金に成った手で、その歩は自分で打った歩。
  "tip-pawn-hand": ({ usi, moved, before, history, color }) => moved.kind === "+P" && usi.endsWith("+")
    && before.get(moved.from)?.kind === "P" && droppedPawn(history, moved.from, color),
});

/**
 * 対局の始めの局面で、もうできている形のコツ。その対局では出さない(1局に1回の印と同じ扱い)。
 * @param {string} sfen
 * @param {"black" | "white"} color
 */
export function startTipMoments(sfen, color) {
  return tipShapesHolding(sfen, color);
}

/** 札の文(後手の言い方を選ぶ)。 */
function momentView(moment, color) {
  return { id: moment.id, short: moment.short, title: color === "white" && moment.whiteTitle ? moment.whiteTitle : moment.title, line: moment.line };
}

/**
 * プレイヤーが指した手でできたコツを、全部返す(並びは12枚の順。詰ませた手のコツは含めない)。
 * @param {{ before: string, usi: string, after: string, color: "black" | "white", learned: Iterable<string>, fired: Iterable<string>, history?: readonly string[] }} input
 *   learnedはクリアしたコツのカード、firedはこの対局でもう出した(か始めからできていた)コツ、historyはこの手を指す前までの手
 */
export function tipMoments({ before, usi, after, color, learned, fired, history = [] }) {
  const known = new Set(learned);
  const done = new Set(fired);
  const open = TIP_MOMENTS.filter(({ id, mate }) => !mate && known.has(id) && !done.has(id));
  if (!open.length) return [];
  const beforeBoard = parseSfenBoard(before);
  const applied = applyUsiToBoard(beforeBoard, usi, color);
  if (!applied) return [];
  const afterBoard = parseSfenBoard(after);
  const holding = new Set(tipShapesHolding(after, color));
  const context = { before: beforeBoard, beforeSfen: before, after: afterBoard, usi, color, history, moved: applied.moved, captured: applied.captured };
  return open
    .filter(({ id }) => (SHAPES[id] ? holding.has(id) : Boolean(MOVES[id]?.(context))))
    .map((moment) => momentView(moment, color));
}

/**
 * プレイヤーが指した手でできたコツのうち、札に出す1つ(なければnull)。
 * @param {Parameters<typeof tipMoments>[0]} input
 */
export function tipMoment(input) {
  return tipMoments(input)[0] ?? null;
}

/**
 * 詰ませた手で決まるコツ(頭金・下段に落とす・駒を捨てて詰ます)。プレイヤーが詰ませて終わった棋譜でだけ返す。
 * @param {{ moves: readonly string[], initialSfen?: string, color: "black" | "white", learned: Iterable<string>, fired: Iterable<string> }} input
 */
export function mateTipMoments({ moves, initialSfen = STANDARD_SFEN, color, learned, fired }) {
  const known = new Set(learned);
  const done = new Set(fired);
  const open = TIP_MOMENTS.filter(({ id, mate }) => mate && known.has(id) && !done.has(id));
  if (!open.length || !moves.length) return [];
  const mate = finishingMate([...moves], { initialSfen });
  if (!mate) return [];
  // 局面を1手ずつ並べる(sfens[i]はi手指したあと)。詰ませたのがプレイヤーかを確かめる。
  const record = createGameRecord(initialSfen);
  const sfens = [record.position.sfen];
  for (const usi of moves) {
    if (!appendUsiMove(record, usi)) return [];
    sfens.push(record.position.sfen);
  }
  const lastBefore = sfens[moves.length - 1];
  if ((lastBefore.split(" ")[1] === "w" ? "white" : "black") !== color || enumerateLegalMoves(record.position).length) return [];
  const enemy = other(color);
  const kingRank = (sfen) => {
    const king = findKing(parseSfenBoard(sfen), enemy);
    return king ? relativeRankOf(king, enemy) : 0;
  };
  // 段は相手から見た段(9が自分の陣のいちばん奥)。下段は奥の2段(8・9段目)。
  const startRank = kingRank(sfens[mate.from - 1]);
  const endRank = kingRank(sfens[moves.length]);
  const sequence = moves.slice(mate.from - 1);
  const sacrificed = sequence.some((usi, index) => index % 2 === 0 && index + 1 < sequence.length
    && sequence[index + 1].slice(2, 4) === usi.slice(2, 4));
  const checks = {
    "tip-head-gold": () => detectTesuji({ sfenBefore: lastBefore, usi: moves.at(-1), checkmate: true }).includes("head-gold"),
    // 王手の連続のあいだに玉が奥へ下がり、奥の2段(下段)で詰んだ。
    "tip-bottom": () => mate.plies >= 3 && endRank > startRank && endRank >= 8,
    "tip-speed": () => mate.plies >= 3 && sacrificed,
  };
  return open.filter(({ id }) => checks[id]?.()).map((moment) => momentView(moment, color));
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

/**
 * 盤の上の札を出すか。使ったのが(この回を入れて)TIP_CALLOUT_LIMIT回目までなら出す。
 * @param {number} usesBefore この回より前に使った回数
 */
export const tipCalloutDue = (usesBefore) => usesBefore < TIP_CALLOUT_LIMIT;
