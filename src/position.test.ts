import { describe, expect, it } from "vitest";
import { candidateMovesFromUsi, positionFromSfen } from "./position";

const START_SFEN =
  "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

describe("ShogiHome board adapter contract", () => {
  it("turns SFEN and recommended USI moves into BoardView values", () => {
    const position = positionFromSfen(START_SFEN);
    const candidates = candidateMovesFromUsi(position, [
      { usi: "7g7f", score: 120 },
      { usi: "invalid" },
    ]);

    expect(position.sfen).toBe(START_SFEN);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].move.usi).toBe("7g7f");
    expect(candidates[0].score).toBe(120);
  });
});
