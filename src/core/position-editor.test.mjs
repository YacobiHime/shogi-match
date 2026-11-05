import { describe, expect, it } from "vitest";
import { Color, Piece, Square } from "tsshogi";
import {
  EDIT_PRESETS,
  applyBoardEdit,
  boardToBox,
  boxToHand,
  handToBox,
  handsOf,
  pieceAt,
  pieceBox,
  pieceTotals,
  placeFromBox,
  setTurn,
  toggleColor,
  togglePromote,
  validateEditedPosition,
  withPlyOne,
} from "./position-editor.mjs";

const EMPTY = EDIT_PRESETS.find(({ id }) => id === "empty").sfen;

describe("局面編集", () => {
  it("何もない盤は40枚すべてが駒箱、平手は駒箱が空", () => {
    expect(pieceTotals(EMPTY)).toEqual({ box: 40, placed: 0 });
    expect(pieceBox(EMPTY)).toMatchObject({ king: 2, rook: 2, pawn: 18 });
    expect(pieceTotals(EDIT_PRESETS[0].sfen)).toEqual({ box: 0, placed: 40 });
  });

  it("駒箱から盤に置き、駒箱へしまうと、いつも40枚", () => {
    let sfen = placeFromBox(EMPTY, "king", "white", "5a");
    sfen = placeFromBox(sfen, "pawn", "black", "2d");
    expect(pieceAt(sfen, "5a")).toMatchObject({ type: "king", side: "white" });
    expect(pieceTotals(sfen)).toEqual({ box: 38, placed: 2 });
    sfen = boardToBox(sfen, "2d");
    expect(pieceTotals(sfen)).toEqual({ box: 39, placed: 1 });
    expect(boardToBox(sfen, "2d")).toBeNull();
  });

  it("駒箱にない駒は置けない、玉は持ち駒にできない", () => {
    expect(placeFromBox(EDIT_PRESETS[0].sfen, "pawn", "black", "5e")).toBeNull();
    expect(boxToHand(EMPTY, "king", "black")).toBeNull();
    const sfen = boxToHand(EMPTY, "gold", "black");
    expect(handsOf(sfen).black.gold).toBe(1);
    expect(handsOf(handToBox(sfen, "gold", "black")).black.gold).toBe(0);
  });

  it("盤の駒を動かす・持ち駒にする(盤の部品のeditと同じ形)", () => {
    let sfen = placeFromBox(EMPTY, "silver", "black", "5e");
    sfen = applyBoardEdit(sfen, { move: { from: Square.newByUSI("5e"), to: Square.newByUSI("4d") } });
    expect(pieceAt(sfen, "4d")).toMatchObject({ type: "silver" });
    sfen = applyBoardEdit(sfen, { move: { from: Square.newByUSI("4d"), to: Color.BLACK } });
    expect(handsOf(sfen).black.silver).toBe(1);
    sfen = applyBoardEdit(sfen, { move: { from: new Piece(Color.BLACK, "silver"), to: Square.newByUSI("3c") } });
    expect(pieceAt(sfen, "3c")).toMatchObject({ type: "silver", side: "black" });
  });

  it("成る・戻す、向きを変える", () => {
    let sfen = placeFromBox(EMPTY, "rook", "black", "2b");
    sfen = togglePromote(sfen, "2b");
    expect(pieceAt(sfen, "2b").type).toBe("dragon");
    sfen = togglePromote(sfen, "2b");
    expect(pieceAt(sfen, "2b").type).toBe("rook");
    sfen = toggleColor(sfen, "2b");
    expect(pieceAt(sfen, "2b").side).toBe("white");
    const gold = placeFromBox(EMPTY, "gold", "black", "5e");
    expect(togglePromote(gold, "5e")).toBeNull();
  });

  it("手番と手数", () => {
    expect(setTurn("4k4/9/9/9/9/9/9/9/4K4 b - 1", "white")).toBe("4k4/9/9/9/9/9/9/9/4K4 w - 1");
    expect(withPlyOne("4k4/9/9/9/9/9/9/9/4K4 w - 37")).toBe("4k4/9/9/9/9/9/9/9/4K4 w - 1");
  });
});

describe("編集した局面の確かめ", () => {
  it("平手は問題なし、エンジンで読める", () => {
    expect(validateEditedPosition(EDIT_PRESETS[0].sfen)).toEqual({ problems: [], engineReady: true, kings: { black: 1, white: 1 } });
  });

  it("二歩を知らせ、その2マスを返す", () => {
    const result = validateEditedPosition("4k4/9/9/7P1/9/9/7P1/9/4K4 b - 1");
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({ code: "nifu", squares: ["2d", "2g"] });
    expect(result.problems[0].message).toContain("2筋");
  });

  it("行き所のない駒・玉が2枚・手番でない側に王手・玉なし", () => {
    expect(validateEditedPosition("P3k4/9/9/9/9/9/9/9/4K4 b - 1").problems.map(({ code }) => code)).toEqual(["dead"]);
    expect(validateEditedPosition("4k4/9/9/9/9/9/9/9/N3K4 w - 1").problems.map(({ code }) => code)).toEqual([]);
    expect(validateEditedPosition("4k4/9/9/9/9/9/9/9/3KK4 b - 1").problems.map(({ code }) => code)).toEqual(["kings"]);
    // 先手の手番で、後手の玉に先手の金が王手をかけている。
    expect(validateEditedPosition("4k4/4G4/9/9/9/9/9/9/4K4 b - 1").problems.map(({ code }) => code)).toEqual(["check"]);
    expect(validateEditedPosition("4k4/4G4/9/9/9/9/9/9/4K4 w - 1").problems).toEqual([]);
    expect(validateEditedPosition(EMPTY).problems.map(({ code }) => code)).toEqual(["no-king"]);
  });

  it("片方の玉だけの詰将棋は、エンジンではなく詰み探索で読む", () => {
    const tsume = EDIT_PRESETS.find(({ id }) => id === "tsume").sfen;
    expect(validateEditedPosition(tsume)).toMatchObject({ problems: [], engineReady: false, kings: { black: 0, white: 1 } });
  });
});
