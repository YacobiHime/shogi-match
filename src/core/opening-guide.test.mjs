import { describe, expect, it } from "vitest";
import { appendUsiMove, createGameRecord } from "../game-state";
import {
  mirrorUsiMove,
  nextOpeningPlanMove,
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

describe("opening guide", () => {
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
});
