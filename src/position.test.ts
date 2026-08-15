import { describe, expect, it } from "vitest";
import {
  candidateMovesFromUsi,
  legalDestinationSquares,
  lastMoveFromUsi,
  positionFromSfen,
} from "./position";
import { PieceType, Square } from "tsshogi";

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

  it("omits non-finite candidate scores from arrow labels", () => {
    const position = positionFromSfen(START_SFEN);
    const candidates = candidateMovesFromUsi(position, [{ usi: "7g7f", score: Number.NaN }]);

    expect(candidates[0].score).toBeUndefined();
  });

  it("preserves the opening-guide kind used to color safety arrows", () => {
    const position = positionFromSfen(START_SFEN);
    const candidates = candidateMovesFromUsi(position, [{ usi: "7g7f", guideKind: "urgent" }]);
    expect(candidates[0].guideKind).toBe("urgent");
  });

  it("marks promote and non-promote recommendations only when promotion is available", () => {
    const position = positionFromSfen("4k4/9/9/4P4/9/9/9/9/4K4 b - 1");
    const candidates = candidateMovesFromUsi(position, [
      { usi: "5d5c+", score: 100 },
      { usi: "5d5c", score: 80 },
    ]);

    expect(candidates.map(({ promotion }) => promotion)).toEqual(["成", "不成"]);
    expect(candidateMovesFromUsi(position, [{ usi: "5d5e" }])[0].promotion).toBeUndefined();
  });

  it("restores the last move from the position after that move", () => {
    const position = positionFromSfen(START_SFEN) as ReturnType<typeof positionFromSfen> & {
      doMove: (move: NonNullable<ReturnType<typeof positionFromSfen>["createMoveByUSI"]>) => boolean;
    };
    const move = position.createMoveByUSI("7g7f");
    expect(move).not.toBeNull();
    expect(position.doMove(move!)).toBe(true);

    const lastMove = lastMoveFromUsi(position, "7g7f");
    expect(lastMove?.from.usi).toBe("7g");
    expect(lastMove?.to.usi).toBe("7f");
  });

  it("lists legal destinations for board pieces and drops", () => {
    const position = positionFromSfen(START_SFEN);

    expect(legalDestinationSquares(position, new Square(7, 7)).map((square) => square.usi))
      .toEqual(["7f"]);
    expect(legalDestinationSquares(position, PieceType.PAWN)).toEqual([]);
  });
});
