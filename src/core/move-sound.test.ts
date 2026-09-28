import { describe, expect, it } from "vitest";
import { PieceType } from "tsshogi";
import { moveSoundForUsi, selectMoveSound } from "./move-sound";

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

describe("moveSoundForUsi", () => {
  const standard = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

  it("chooses the sound from the move played in the position", () => {
    expect(moveSoundForUsi(standard, "7g7f")).toBe("normal");
    // 角交換（大駒を取る手）は強い音。
    expect(moveSoundForUsi("lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3", "8h2b+")).toBe("strong");
    // 王手も強い音。
    expect(moveSoundForUsi("4k4/9/9/9/9/9/9/9/4K3R b G 1", "G*5b")).toBe("strong");
  });

  it("returns null for a move that cannot be played", () => {
    expect(moveSoundForUsi(standard, "7g7e")).toBeNull();
  });
});
