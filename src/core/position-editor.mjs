/**
 * 研究モードの局面編集(docs/research-mode-design.mdの3-5)。盤・持ち駒・駒箱のあいだで駒を動かし、
 * はじめの形・手番を選び、反則がないかを確かめる。画面に依存しない。局面はSFENの文字で受け渡す。
 * 駒は盤と持ち駒と駒箱でいつも40枚(駒箱は盤と持ち駒にない駒)。
 */

import { Color, InitialPositionSFEN, Piece, PieceType, Position, Square, countNotExistingPieces } from "tsshogi";

/** はじめの形(3-5)。駒落ちはシートで選ぶ。 */
export const EDIT_PRESETS = Object.freeze([
  Object.freeze({ id: "standard", label: "平手", sfen: InitialPositionSFEN.STANDARD }),
  Object.freeze({ id: "empty", label: "何もない盤", sfen: InitialPositionSFEN.EMPTY }),
  Object.freeze({ id: "tsume", label: "詰将棋", sfen: InitialPositionSFEN.TSUME_SHOGI }),
]);
export const HANDICAP_PRESETS = Object.freeze([
  Object.freeze({ id: "lance", label: "香落ち", sfen: InitialPositionSFEN.HANDICAP_LANCE }),
  Object.freeze({ id: "right-lance", label: "右香落ち", sfen: InitialPositionSFEN.HANDICAP_RIGHT_LANCE }),
  Object.freeze({ id: "bishop", label: "角落ち", sfen: InitialPositionSFEN.HANDICAP_BISHOP }),
  Object.freeze({ id: "rook", label: "飛車落ち", sfen: InitialPositionSFEN.HANDICAP_ROOK }),
  Object.freeze({ id: "rook-lance", label: "飛香落ち", sfen: InitialPositionSFEN.HANDICAP_ROOK_LANCE }),
  Object.freeze({ id: "2", label: "二枚落ち", sfen: InitialPositionSFEN.HANDICAP_2PIECES }),
  Object.freeze({ id: "4", label: "四枚落ち", sfen: InitialPositionSFEN.HANDICAP_4PIECES }),
  Object.freeze({ id: "6", label: "六枚落ち", sfen: InitialPositionSFEN.HANDICAP_6PIECES }),
  Object.freeze({ id: "8", label: "八枚落ち", sfen: InitialPositionSFEN.HANDICAP_8PIECES }),
  Object.freeze({ id: "10", label: "十枚落ち", sfen: InitialPositionSFEN.HANDICAP_10PIECES }),
]);

/** 駒箱と持ち駒に並べる駒の順(強い順)。玉は駒箱にだけ入る。 */
export const BOX_ORDER = Object.freeze(["king", "rook", "bishop", "gold", "silver", "knight", "lance", "pawn"]);
export const PIECE_NAMES = Object.freeze({
  king: "玉", rook: "飛", bishop: "角", gold: "金", silver: "銀", knight: "桂", lance: "香", pawn: "歩",
  promPawn: "と", promLance: "成香", promKnight: "成桂", promSilver: "成銀", horse: "馬", dragon: "龍",
});
const UNPROMOTED = Object.freeze({
  promPawn: "pawn", promLance: "lance", promKnight: "knight", promSilver: "silver", horse: "bishop", dragon: "rook",
});
const PROMOTABLE = Object.freeze(["pawn", "lance", "knight", "silver", "bishop", "rook"]);
const RANK_KANJI = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

function positionOf(sfen) {
  const position = Position.newBySFEN(sfen);
  if (!position) throw new Error("局面のSFENが不正です。");
  return position;
}

function squareOf(usi) {
  const square = Square.newByUSI(usi);
  if (!square) throw new Error(`マスが不正です: ${usi}`);
  return square;
}

const colorOf = (side) => (side === "white" ? Color.WHITE : Color.BLACK);
const sideOf = (color) => (color === Color.WHITE ? "white" : "black");
const baseType = (type) => UNPROMOTED[type] ?? type;

/** 駒箱の駒の数(種類ごと。成り駒は元の駒で数える)。 */
export function pieceBox(sfen) {
  const counts = countNotExistingPieces(positionOf(sfen));
  return Object.fromEntries(BOX_ORDER.map((type) => [type, counts[type] ?? 0]));
}

/** 盤と持ち駒の駒の数と、駒箱の数。合わせていつも40枚。 */
export function pieceTotals(sfen) {
  const box = Object.values(pieceBox(sfen)).reduce((sum, count) => sum + count, 0);
  return { box, placed: 40 - box };
}

/** 持ち駒(種類ごと)。 */
export function handsOf(sfen) {
  const position = positionOf(sfen);
  const read = (color) => Object.fromEntries(BOX_ORDER.filter((type) => type !== "king").map((type) => [type, position.hand(color).count(type)]));
  return { black: read(Color.BLACK), white: read(Color.WHITE) };
}

/** 手番を替える。 */
export function setTurn(sfen, side) {
  const parts = String(sfen).split(" ");
  parts[1] = side === "white" ? "w" : "b";
  return parts.join(" ");
}

/** 手数を1にした局面(研究を始め直すときに使う)。 */
export function withPlyOne(sfen) {
  const parts = String(sfen).split(" ");
  return `${parts[0]} ${parts[1] ?? "b"} ${parts[2] ?? "-"} 1`;
}

/**
 * 駒箱の駒を盤のマスに置く(置くマスの駒は駒箱へ戻す)。駒箱になければnull。
 * @param {string} sfen
 * @param {string} type 駒の種類(PieceTypeの値。成っていない駒)
 * @param {"black" | "white"} side
 * @param {string} square USIのマス(「2d」など)
 */
export function placeFromBox(sfen, type, side, square) {
  if ((pieceBox(sfen)[type] ?? 0) < 1) return null;
  const position = positionOf(sfen);
  const target = squareOf(square);
  position.board.remove(target);
  position.board.set(target, new Piece(colorOf(side), type));
  return position.sfen;
}

/** 駒箱の駒を持ち駒にする(玉は持ち駒にできない)。 */
export function boxToHand(sfen, type, side) {
  if (type === "king" || (pieceBox(sfen)[type] ?? 0) < 1) return null;
  const position = positionOf(sfen);
  position.hand(colorOf(side)).add(type, 1);
  return position.sfen;
}

/** 盤の駒を駒箱へしまう。 */
export function boardToBox(sfen, square) {
  const position = positionOf(sfen);
  if (!position.board.remove(squareOf(square))) return null;
  return position.sfen;
}

/** 持ち駒を1枚駒箱へしまう。 */
export function handToBox(sfen, type, side) {
  const position = positionOf(sfen);
  if (position.hand(colorOf(side)).count(type) < 1) return null;
  position.hand(colorOf(side)).reduce(type, 1);
  return position.sfen;
}

/**
 * 盤の駒・持ち駒を動かす(盤の部品の edit のイベントと同じ形)。動かせなければnull。
 * @param {string} sfen
 * @param {import("tsshogi").PositionChange} change
 */
export function applyBoardEdit(sfen, change) {
  const position = positionOf(sfen);
  if (change?.move && !position.isValidEditing(change.move.from, change.move.to)) return null;
  if (!position.edit(change)) return null;
  return position.sfen;
}

/**
 * 盤の駒を成る・戻す(成れない駒はそのまま)。
 * @param {string} sfen
 * @param {string} square
 */
export function togglePromote(sfen, square) {
  const position = positionOf(sfen);
  const target = squareOf(square);
  const piece = position.board.at(target);
  if (!piece) return null;
  const type = piece.type;
  let next;
  if (UNPROMOTED[type]) next = UNPROMOTED[type];
  else if (PROMOTABLE.includes(type)) next = new Piece(piece.color, type).promoted().type;
  else return null;
  position.board.set(target, new Piece(piece.color, next));
  return position.sfen;
}

/** 盤の駒の向きを変える(先手の駒⇔後手の駒)。 */
export function toggleColor(sfen, square) {
  const position = positionOf(sfen);
  const target = squareOf(square);
  const piece = position.board.at(target);
  if (!piece) return null;
  position.board.set(target, new Piece(piece.color === Color.BLACK ? Color.WHITE : Color.BLACK, piece.type));
  return position.sfen;
}

/** 盤の駒(なければnull)。 */
export function pieceAt(sfen, square) {
  const piece = positionOf(sfen).board.at(squareOf(square));
  if (!piece) return null;
  return { type: piece.type, side: sideOf(piece.color), name: PIECE_NAMES[piece.type] ?? "", promotable: PROMOTABLE.includes(piece.type) || Boolean(UNPROMOTED[piece.type]) };
}

/** マスの名前(「2四」)。 */
export function squareName(square) {
  const target = squareOf(square);
  return `${target.file}${RANK_KANJI[target.rank]}`;
}

/**
 * 編集した局面の反則を確かめる(3-5)。problems が空なら完了できる。
 * engineReady は両方の玉があるか(エンジンで読めるか。片方なら詰み探索で読む)。
 * @param {string} sfen
 * @returns {{ problems: { code: string, message: string, squares: string[] }[], engineReady: boolean, kings: { black: number, white: number } }}
 */
export function validateEditedPosition(sfen) {
  const position = positionOf(sfen);
  const problems = [];
  const kings = { black: [], white: [] };
  const pawns = { black: new Map(), white: new Map() };
  const dead = [];
  for (const square of position.board.listNonEmptySquares()) {
    const piece = position.board.at(square);
    const side = sideOf(piece.color);
    const usi = square.usi;
    if (piece.type === "king") kings[side].push(usi);
    if (piece.type === "pawn") {
      const list = pawns[side].get(square.file) ?? [];
      list.push(usi);
      pawns[side].set(square.file, list);
    }
    // 行き所のない駒(先手から見た段。後手は逆さにする)。
    const rank = side === "black" ? square.rank : 10 - square.rank;
    if ((piece.type === "pawn" || piece.type === "lance") && rank === 1) dead.push(usi);
    if (piece.type === "knight" && rank <= 2) dead.push(usi);
  }
  for (const side of ["black", "white"]) {
    if (kings[side].length > 1) {
      problems.push({ code: "kings", message: `${side === "black" ? "先手" : "後手"}の玉が${kings[side].length}枚あるよ。1枚にしてね。`, squares: kings[side] });
    }
    for (const [file, list] of pawns[side]) {
      if (list.length > 1) problems.push({ code: "nifu", message: `${file}筋に${side === "black" ? "先手" : "後手"}の歩が${list.length}枚あるよ（二歩）。どちらかを動かしてね。`, squares: list });
    }
  }
  if (dead.length) {
    problems.push({ code: "dead", message: `${dead.map(squareName).join("・")}の駒は、そこから動けないよ（行き所のない駒）。`, squares: dead });
  }
  // 手番でない側の玉に王手がかかっていたら、手番の側がすぐ玉を取れてしまう。
  const waiting = position.color === Color.BLACK ? Color.WHITE : Color.BLACK;
  const waitingKing = kings[sideOf(waiting)];
  if (waitingKing.length === 1 && position.board.isChecked(waiting)) {
    problems.push({ code: "check", message: "手番でない側の玉に王手がかかっているよ。手番を替えるか、駒を動かしてね。", squares: waitingKing });
  }
  if (!kings.black.length && !kings.white.length) {
    problems.push({ code: "no-king", message: "玉がひとつもないよ。駒箱から玉を置いてね。", squares: [] });
  }
  return {
    problems,
    engineReady: kings.black.length === 1 && kings.white.length === 1,
    kings: { black: kings.black.length, white: kings.white.length },
  };
}
