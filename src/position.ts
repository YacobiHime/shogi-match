import {
  ImmutablePosition,
  Move,
  Position,
  Square,
  parseUSIMove,
  reverseColor,
  unpromotedPieceType,
} from "tsshogi";

export type CandidateInput = { usi: string; score?: number };
export type CandidateMove = { move: Move; score?: number };

export function positionFromSfen(sfen: string): ImmutablePosition {
  return Position.newBySFEN(sfen);
}

export function candidateMovesFromUsi(
  position: ImmutablePosition,
  candidates: CandidateInput[],
): CandidateMove[] {
  return candidates.flatMap((candidate) => {
    const move = position.createMoveByUSI(candidate.usi);
    return move ? [{ move, score: candidate.score }] : [];
  });
}

export function lastMoveFromUsi(
  position: ImmutablePosition,
  usi: string,
): Move | null {
  const parsed = parseUSIMove(usi);
  if (!parsed) return null;
  const destinationPiece = position.board.at(parsed.to);
  if (!destinationPiece) return null;
  const pieceType = parsed.from instanceof Square
    ? (parsed.promote ? unpromotedPieceType(destinationPiece.type) : destinationPiece.type)
    : parsed.from;
  return new Move(
    parsed.from,
    parsed.to,
    parsed.promote,
    reverseColor(position.color),
    pieceType,
    null,
  );
}
