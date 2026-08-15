import { describe, expect, it } from "vitest";
import { appendUsiMove, createGameRecord } from "../game-state";
import {
  isOpeningPlanComplete,
  mirrorUsiMove,
  nextOpeningPlanMove,
  openingUrgentResponse,
  chooseSafeOpeningMove,
  openingFollowupCount,
  openingPlanSteps,
  OPENING_CASTLES,
  OPENING_STRATEGIES,
} from "./opening-guide.mjs";

function withTurn(sfen, color) {
  const fields = sfen.split(" ");
  fields[1] = color === "black" ? "b" : "w";
  return fields.join(" ");
}

function expectPlanLegal(strategyId, castleId, color, opponentDependent = []) {
  let record = createGameRecord();
  for (const { usi } of openingPlanSteps(strategyId, castleId, color)) {
    record = createGameRecord(withTurn(record.position.sfen, color));
    const applied = appendUsiMove(record, usi);
    if (!applied && opponentDependent.includes(usi)) continue;
    expect(applied, `${color}: ${usi}`).toBe(true);
  }
}

function sfenAfterMoves(moves, color = "black") {
  let record = createGameRecord();
  for (const usi of moves) {
    record = createGameRecord(withTurn(record.position.sfen, color));
    expect(appendUsiMove(record, usi), `${color}: ${usi}`).toBe(true);
  }
  return record.position.sfen;
}

describe("opening guide", () => {
  it("distinguishes a completed plan from a temporarily unavailable next move", () => {
    expect(isOpeningPlanComplete({
      strategyId: "shiken",
      playedMoves: ["7g7f", "6g6f"],
    })).toBe(false);
    expect(isOpeningPlanComplete({
      strategyId: "shiken",
      playedMoves: ["7g7f", "6g6f", "2h6h"],
    })).toBe(true);
    expect(isOpeningPlanComplete({
      strategyId: "shiken",
      detectedFormations: ["四間飛車"],
    })).toBe(true);
  });

  it("shows three to five AI follow-up arrows", () => {
    expect([0, 0.34, 0.99].map((value) => openingFollowupCount(() => value)))
      .toEqual([3, 4, 5]);
  });

  it("mirrors black guidance for a white player", () => {
    expect(mirrorUsiMove("7g7f")).toBe("3c3d");
    expect(mirrorUsiMove("2h6h")).toBe("8b4b");
  });

  it.each(OPENING_STRATEGIES)("uses a legal strategy sequence for $label", ({ id }) => {
    const blackConditional = id === "kakugawari" ? ["8h2b+"] : [];
    const whiteConditional = id === "kakugawari" ? ["2b8h+"] : [];
    expectPlanLegal(id, "", "black", blackConditional);
    expectPlanLegal(id, "", "white", whiteConditional);
  });

  it.each(OPENING_CASTLES)("uses a legal castle sequence for $label", ({ id }) => {
    expectPlanLegal("", id, "black");
    expectPlanLegal("", id, "white");
  });

  it("skips played and currently illegal steps", () => {
    const next = nextOpeningPlanMove({
      strategyId: "shiken",
      castleId: "mino",
      playedMoves: ["7g7f"],
      legalMoves: ["2h6h", "5i4h"],
    });
    expect(next).toEqual({ usi: "2h6h", phase: "strategy" });
  });

  it("skips a phase already recognized by formation detection", () => {
    const next = nextOpeningPlanMove({
      strategyId: "shiken",
      castleId: "mino",
      legalMoves: ["7g7f", "5i4h"],
      detectedFormations: ["四間飛車"],
    });
    expect(next).toEqual({ usi: "5i4h", phase: "castle" });
  });

  it("finishes Fujii System guidance once the formation is recognized", () => {
    const next = nextOpeningPlanMove({
      strategyId: "fujii-system",
      castleId: "",
      legalMoves: ["7g7f", "6g6f", "2h6h"],
      detectedFormations: ["藤井システム"],
    });
    expect(next).toBeNull();
  });

  it("does not finish Right King guidance after only moving the king to 4h", () => {
    const next = nextOpeningPlanMove({
      strategyId: "",
      castleId: "right-king",
      playedMoves: ["5i4h"],
      legalMoves: ["7g7f", "6g6f"],
      detectedFormations: ["右玉"],
    });
    expect(next).toEqual({ usi: "7g7f", phase: "castle" });
  });

  it("guides Right King through the twin-silver shape and rook retreat", () => {
    expect(openingPlanSteps("", "right-king").map(({ usi }) => usi)).toEqual([
      "7g7f", "6g6f", "7i6h", "6h6g", "3i4h", "4g4f",
      "4h4g", "3g3f", "6i7h", "5i4h", "2i3g", "2h2i",
    ]);
  });

  it("requires the complete Right King position instead of move history alone", () => {
    const moves = openingPlanSteps("", "right-king").map(({ usi }) => usi);
    expect(isOpeningPlanComplete({
      castleId: "right-king",
      playedMoves: moves,
      currentSfen: createGameRecord().position.sfen,
    })).toBe(false);
    expect(isOpeningPlanComplete({
      castleId: "right-king",
      playedMoves: moves,
      currentSfen: sfenAfterMoves(moves),
    })).toBe(true);
  });

  it("prepares a fourth-file rook before building Kinmusou", () => {
    const moves = openingPlanSteps("", "kinmusou").map(({ usi }) => usi);
    expect(moves).toEqual([
      "7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3i2h", "4i4h", "6i5h",
    ]);
    expect(isOpeningPlanComplete({
      castleId: "kinmusou",
      detectedFormations: ["金無双"],
      currentSfen: createGameRecord().position.sfen,
    })).toBe(false);
    expect(isOpeningPlanComplete({
      castleId: "kinmusou",
      playedMoves: moves,
      currentSfen: sfenAfterMoves(moves),
    })).toBe(true);
  });

  it("does not skip a blocked prerequisite in the Static Rook Anaguma sequence", () => {
    expect(nextOpeningPlanMove({
      castleId: "ibisha-anaguma",
      playedMoves: ["9i9h", "7g7f"],
      legalMoves: ["8i7g", "7i8h", "6i7h"],
    })).toBeNull();
  });

  it("does not accept a premature Static Rook Anaguma detection", () => {
    const moves = openingPlanSteps("", "ibisha-anaguma").map(({ usi }) => usi);
    expect(isOpeningPlanComplete({
      castleId: "ibisha-anaguma",
      detectedFormations: ["居飛車穴熊"],
      currentSfen: createGameRecord().position.sfen,
    })).toBe(false);
    expect(isOpeningPlanComplete({
      castleId: "ibisha-anaguma",
      playedMoves: moves,
      currentSfen: sfenAfterMoves(moves),
    })).toBe(true);
  });

  it("prioritizes 7h gold against the fourth-file rook-pawn push in Aigakari", () => {
    expect(openingUrgentResponse({
      strategyId: "aigakari",
      color: "black",
      moveHistory: ["2g2f", "8c8d", "2f2e", "8d8e"],
      legalMoves: ["6i7h", "7g7f"],
    })).toEqual({
      usi: "6i7h",
      reason: "相手が8五歩まで伸ばしたから、先に7八金で角頭を守ろう！",
    });
  });

  it("mirrors the Aigakari gold defense for a white player", () => {
    expect(openingUrgentResponse({
      strategyId: "aigakari",
      color: "white",
      moveHistory: ["2g2f", "8c8d", "2f2e"],
      legalMoves: ["4a3b", "3c3d"],
    })?.usi).toBe("4a3b");
  });

  it("replaces a plan move that falls outside the safe top candidates", () => {
    expect(chooseSafeOpeningMove("2g2f", [
      { rank: 1, move: "6i7h", score: { type: "cp", value: 80 } },
      { rank: 2, move: "7g7f", score: { type: "cp", value: 20 } },
    ])).toEqual({ usi: "6i7h", source: "ai", scoreLoss: undefined });
  });

  it("keeps a plan move when its evaluation loss is small", () => {
    expect(chooseSafeOpeningMove("2g2f", [
      { rank: 1, move: "7g7f", score: { type: "cp", value: 90 } },
      { rank: 2, move: "2g2f", score: { type: "cp", value: -40 } },
    ])).toEqual({ usi: "2g2f", source: "plan", scoreLoss: 130 });
  });

  it("rejects a plan move with a large evaluation drop", () => {
    expect(chooseSafeOpeningMove("2g2f", [
      { rank: 1, move: "6i7h", score: { type: "cp", value: 120 } },
      { rank: 4, move: "2g2f", score: { type: "cp", value: -500 } },
    ])).toEqual({ usi: "6i7h", source: "ai", scoreLoss: 620 });
  });
});
