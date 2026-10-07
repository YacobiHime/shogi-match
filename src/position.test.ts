import { describe, expect, it } from "vitest";
import {
  candidateMovesFromUsi,
  legalDestinationSquares,
  lastMoveFromUsi,
  movementArrowMoves,
  positionFromSfen,
} from "./position";
import { PieceType, Position, Square } from "tsshogi";

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
    const candidates = candidateMovesFromUsi(position, [
      { usi: "7g7f", guideKind: "urgent" },
      { usi: "2g2f", guideKind: "unsafe-plan" },
    ]);
    expect(candidates.map(({ guideKind }) => guideKind)).toEqual(["urgent", "unsafe-plan"]);
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
    const position = positionFromSfen(START_SFEN) as Position;
    const move = position.createMoveByUSI("7g7f");
    expect(move).not.toBeNull();
    expect(position.doMove(move!)).toBe(true);

    const lastMove = lastMoveFromUsi(position, "7g7f");
    expect((lastMove?.from as Square).usi).toBe("7g");
    expect(lastMove?.to.usi).toBe("7f");
  });

  it("lists legal destinations for board pieces and drops", () => {
    const position = positionFromSfen(START_SFEN);

    expect(legalDestinationSquares(position, new Square(7, 7)).map((square) => square.usi))
      .toEqual(["7f"]);
    expect(legalDestinationSquares(position, PieceType.PAWN)).toEqual([]);
  });

  it("draws one movement arrow per direction, to the farthest square a long-range piece can reach", () => {
    // 先手の飛車を5五、角を3三に置いた局面。玉は9九と1一。
    const position = positionFromSfen("8k/9/6B2/9/4R4/9/9/9/K8 b - 1");
    const usis = (file: number, rank: number) => movementArrowMoves(position, new Square(file, rank))
      .map((move) => move.usi).sort();
    // 飛車は上下左右の4本で、それぞれ端まで(左は1五、右は9五、上は5一、下は5九)。
    expect(usis(5, 5)).toEqual(["5e1e", "5e5a", "5e5i", "5e9e"]);
    // 角の右上(2二→1一)は相手の玉を取れるマスまで。
    expect(usis(3, 3)).toHaveLength(4);
    expect(usis(3, 3)).toContain("3c1a");
  });

  it("keeps the two knight jumps as separate arrows", () => {
    const position = positionFromSfen(START_SFEN);
    expect(movementArrowMoves(position, new Square(8, 9))).toEqual([]);
    const opened = positionFromSfen("lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 1");
    expect(movementArrowMoves(opened, new Square(8, 9)).map((move) => move.usi)).toEqual(["8i7g"]);
    const knight = positionFromSfen("4k4/9/9/9/4N4/9/9/9/4K4 b - 1");
    expect(movementArrowMoves(knight, new Square(5, 5)).map((move) => move.usi).sort()).toEqual(["5e4c", "5e6c"]);
  });
});
