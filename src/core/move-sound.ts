import { PieceType } from "tsshogi";

export type MoveSoundKind = "normal" | "strong";

const MAJOR_PIECE_TYPES = new Set<PieceType>([
  PieceType.ROOK,
  PieceType.BISHOP,
  PieceType.DRAGON,
  PieceType.HORSE,
]);

export function selectMoveSound(
  capturedPieceType: PieceType | null,
  givesCheck: boolean,
): MoveSoundKind {
  return givesCheck || (capturedPieceType !== null && MAJOR_PIECE_TYPES.has(capturedPieceType))
    ? "strong"
    : "normal";
}
