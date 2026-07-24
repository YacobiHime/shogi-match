import { ImmutablePosition, Move, Position } from "tsshogi";

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
