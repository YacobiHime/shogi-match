/**
 * 研究モードの局面編集で、定跡補助の戦法・囲いの完成形を、片方の側にまとめて置く(docs/research-mode-design.mdの11章)。
 * 形は作戦カードの完成形の小さな盤と同じ openingFormation(戦法→囲いの順に、手順どおり自分の駒だけを動かした形)。
 * 画面に依存しない。局面はSFENの文字で受け渡す。駒はいつも盤・持ち駒・駒箱で40枚のまま。
 *
 * 置き方:
 * 1. 選んだ側の盤の駒と持ち駒を、全部駒箱へしまう(相手の駒はそのまま)。
 * 2. 完成形の駒を、駒箱から出して置く。後手は盤を180度回したマスに置く。相手の駒がいるマスと、駒箱に残っていない駒は置かない(置けなかったマスとして返す)。
 * 3. 完成形で減った駒(飛車先の歩交換の歩・角換わりの角)は、交換で手に入れたものとして持ち駒にする(駒箱にあれば)。
 */

import { Color, Piece, Position, Square, countNotExistingPieces } from "tsshogi";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./opening-guide.mjs";
import { OPENING_PLANS, OPENING_PLAN_GROUPS, OPENING_CASTLE_PLANS } from "./opening-catalog.mjs";
import { openingFormation } from "./opening-formation.mjs";

const KIND_TYPES = Object.freeze({ K: "king", R: "rook", B: "bishop", G: "gold", S: "silver", N: "knight", L: "lance", P: "pawn" });
const PROMOTED_TYPES = Object.freeze({ pawn: "promPawn", lance: "promLance", knight: "promKnight", silver: "promSilver", bishop: "horse", rook: "dragon" });
/** 片方の側の駒の数(平手)。 */
const FULL_SET = Object.freeze({ king: 1, rook: 1, bishop: 1, gold: 2, silver: 2, knight: 2, lance: 2, pawn: 9 });

const strategyLabel = (id) => OPENING_STRATEGIES.find((entry) => entry.id === id)?.label ?? "";
const castleLabel = (id) => OPENING_CASTLES.find((entry) => entry.id === id)?.label ?? "";

/** 後手のマス(盤を180度回す)。 */
export function mirrorSquare(square) {
  const file = 10 - Number(square[0]);
  const rank = String.fromCharCode(105 - (square.charCodeAt(1) - 97));
  return `${file}${rank}`;
}

/**
 * 選べる作戦の目録(作戦カードの群の順)。囲いが2つ以上ある戦法は、castlesから1つ選ぶ(最初が◎)。
 * 局面編集はどの作戦でも置けてよい(解放は対局で組めるかどうかの話なので、ここでは問わない)。
 * @returns {{ id: string, label: string, items: { id: string, label: string, strategyId: string, castles: { id: string, label: string }[], named: boolean }[] }[]}
 */
export function formationChoices() {
  return OPENING_PLAN_GROUPS.map((group) => {
    const plans = group.id === "castle" ? OPENING_CASTLE_PLANS : OPENING_PLANS.filter((entry) => entry.group === group.id);
    const items = plans.map((entry) => {
      const named = Boolean(entry.name) || !entry.strategyId;
      const castles = (named ? entry.castles.slice(0, 1) : entry.castles).map((id) => ({ id, label: castleLabel(id) }));
      return {
        id: entry.id,
        label: entry.name ?? (entry.strategyId ? strategyLabel(entry.strategyId) : castleLabel(entry.castles[0] ?? "")),
        strategyId: entry.strategyId,
        castles,
        named,
      };
    }).filter((item) => item.label);
    return { id: group.id, label: group.label, items };
  }).filter((group) => group.items.length);
}

/**
 * 作戦の完成形を、片方の側に置く。
 * @param {string} sfen
 * @param {{ strategyId?: string, castleId?: string, side?: "black" | "white" }} options
 * @returns {{ sfen: string, skipped: string[], hand: string[] }} skippedは置けなかったマス(USI)、handは持ち駒にした駒の種類
 */
export function placeFormation(sfen, { strategyId = "", castleId = "", side = "black" } = {}) {
  const position = Position.newBySFEN(sfen);
  if (!position) throw new Error("局面のSFENが不正です。");
  const color = side === "white" ? Color.WHITE : Color.BLACK;
  // 1. 選んだ側の駒を駒箱へしまう。
  for (const square of position.board.listNonEmptySquares()) {
    if (position.board.at(square)?.color === color) position.board.remove(square);
  }
  const hand = position.hand(color);
  for (const type of Object.keys(FULL_SET)) {
    const count = type === "king" ? 0 : hand.count(type);
    if (count > 0) hand.reduce(type, count);
  }
  // 2. 完成形の駒を置く。
  const { pieces } = openingFormation(strategyId, castleId);
  const used = {};
  const skipped = [];
  for (const piece of pieces) {
    const base = KIND_TYPES[piece.kind];
    if (!base) continue;
    used[base] = (used[base] ?? 0) + 1;
    const usi = side === "white" ? mirrorSquare(piece.square) : piece.square;
    const square = Square.newByUSI(usi);
    const boxCount = countNotExistingPieces(position)[base] ?? 0;
    if (!square || position.board.at(square) || boxCount < 1) {
      skipped.push(usi);
      continue;
    }
    position.board.set(square, new Piece(color, piece.promoted ? PROMOTED_TYPES[base] ?? base : base));
  }
  // 3. 交換で減った駒を持ち駒にする。
  const handed = [];
  for (const [type, full] of Object.entries(FULL_SET)) {
    if (type === "king") continue;
    for (let missing = full - (used[type] ?? 0); missing > 0; missing -= 1) {
      if ((countNotExistingPieces(position)[type] ?? 0) < 1) break;
      hand.add(type, 1);
      handed.push(type);
    }
  }
  return { sfen: position.sfen, skipped, hand: handed };
}
