import { describe, expect, it } from "vitest";
import { Color } from "tsshogi";
import {
  appendUsiMove,
  createGameRecord,
  enumerateLegalMoves,
  resignationResult,
  selectCpuMove,
} from "./game-state";

describe("standalone game state", () => {
  it("starts a standard game and applies legal USI moves", () => {
    const record = createGameRecord();
    expect(record.position.color).toBe(Color.BLACK);
    expect(appendUsiMove(record, "7g7f")).toBe(true);
    expect(record.position.color).toBe(Color.WHITE);
    expect(record.current.ply).toBe(1);
  });

  it("rejects an illegal move without changing the record", () => {
    const record = createGameRecord();
    expect(appendUsiMove(record, "7g7e")).toBe(false);
    expect(record.current.ply).toBe(0);
  });

  it("enumerates legal board moves and lets the CPU select one", () => {
    const record = createGameRecord();
    const moves = enumerateLegalMoves(record.position);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((move) => record.position.isValidMove(move))).toBe(true);
    expect(selectCpuMove(record.position, () => 0)?.usi).toBe(moves[0].usi);
  });

  it("awards resignation to the side that is not on move", () => {
    const record = createGameRecord();
    const result = resignationResult(record);
    expect(result.winner).toBe(Color.WHITE);
    expect(result.outcome).toBe("white-win");
    expect(result.reason).toBe("resignation");
  });
});
