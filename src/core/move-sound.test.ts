import { describe, expect, it } from "vitest";
import { PieceType } from "tsshogi";
import { selectMoveSound } from "./move-sound";

describe("selectMoveSound", () => {
  it("uses the normal sound for an ordinary move", () => {
    expect(selectMoveSound(null, false)).toBe("normal");
    expect(selectMoveSound(PieceType.PAWN, false)).toBe("normal");
  });

  it.each([
    PieceType.ROOK,
    PieceType.BISHOP,
    PieceType.DRAGON,
    PieceType.HORSE,
  ])("uses the strong sound when capturing %s", (pieceType) => {
    expect(selectMoveSound(pieceType, false)).toBe("strong");
  });

  it("uses the strong sound for check", () => {
    expect(selectMoveSound(null, true)).toBe("strong");
    expect(selectMoveSound(PieceType.PAWN, true)).toBe("strong");
  });
});
