import { describe, expect, it } from "vitest";
import {
  buildOpeningDexSteps,
  parseSfenBoard,
  serializeSfenBoard,
} from "./opening-dex-replay.mjs";

const STANDARD_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

function pieceAt(sfen, square) {
  return parseSfenBoard(sfen).board.get(square) ?? "";
}

describe("opening dex replay", () => {
  it("keeps initial position only for definitions without moves", () => {
    const steps = buildOpeningDexSteps({ blackMoves: [] }, { initialSfen: STANDARD_SFEN });
    expect(steps).toHaveLength(1);
    expect(steps[0].label).toBe("初期局面");
  });

  it("replays guide moves that depend on opponent replies left out of the list", () => {
    // 横歩取り: 2四歩→(相手の応手を省略)→2h2d は合法手判定では成立しない。
    const steps = buildOpeningDexSteps({
      blackMoves: ["7g7f", "2g2f", "2f2e", "6i7h", "2e2d", "2h2d", "8g8f", "2d3d"],
    }, { initialSfen: STANDARD_SFEN });
    expect(steps).toHaveLength(9);
    expect(steps[6].lastMove).toBe("2h2d");
    // 最後は2d3dで飛車が3四へ。
    expect(pieceAt(steps.at(-1).sfen, "3d")).toBe("R");
  });

  it("mirrors moves and flips drop piece color for white-side definitions", () => {
    const steps = buildOpeningDexSteps({
      blackMoves: ["2h7h", "7g7f", "7f7e", "7h7f"],
    }, { initialSfen: STANDARD_SFEN, whiteSide: true });
    expect(steps).toHaveLength(5);
    // 先手基準の2h7hは、後手では8b3b。
    expect(steps[1].lastMove).toBe("8b3b");
    expect(pieceAt(steps.at(-1).sfen, "3d")).toBe("r");
  });

  it("expands routine tokens into a single representative-position step", () => {
    const routines = [{
      token: "@kakugawari",
      label: "角換わり手順",
      previewMoves: ["7g7f", "3c3d", "8h2b+", "3a2b"],
    }];
    const steps = buildOpeningDexSteps({
      blackMoves: ["@kakugawari", "7i8h"],
    }, { initialSfen: STANDARD_SFEN, routines });
    expect(steps).toHaveLength(3);
    expect(steps[1].routine).toBe("角換わり手順");
    expect(steps[1].label).toBe("角換わり手順");
    expect(steps[1].lastMove).toBe("");
    // 7i8hで銀が8八へ（角は交換済みで8hは空いている）。
    expect(pieceAt(steps.at(-1).sfen, "8h")).toBe("S");
  });

  it("formats labels via the injected formatter and falls back on errors", () => {
    const options = {
      initialSfen: STANDARD_SFEN,
      formatLabel: (usi, beforeSfen) => `${usi}@${beforeSfen ? "sfen" : "empty"}`,
    };
    const steps = buildOpeningDexSteps({ blackMoves: ["7g7f"] }, options);
    expect(steps[1].label).toBe("7g7f@sfen");
    const failing = buildOpeningDexSteps({ blackMoves: ["7g7f"] }, {
      initialSfen: STANDARD_SFEN,
      formatLabel: () => { throw new Error("boom"); },
    });
    expect(failing[1].label).toBe("7g7f");
  });

  it("round-trips board serialization through parse", () => {
    const parsed = parseSfenBoard(STANDARD_SFEN);
    expect(serializeSfenBoard(parsed)).toBe(STANDARD_SFEN.replace(/ b - 1$/, " b - 1"));
  });

  it("moves captured pieces to the opposite hand", () => {
    // 5dの黒歩が5cの白歩を取る局面。
    const initial = "4k4/9/4p4/4P4/9/9/9/9/4K4 b - 1";
    const steps = buildOpeningDexSteps({ blackMoves: ["5d5c"] }, { initialSfen: initial });
    // 白歩を取って黒の持ち駒になる。
    expect(parseSfenBoard(steps[1].sfen).hands.get("P")).toBe(1);
    expect(pieceAt(steps[1].sfen, "5c")).toBe("P");
  });
});
