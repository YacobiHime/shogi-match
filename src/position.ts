import {
  ImmutablePosition,
  Move,
  Position,
  Square,
  parseUSIMove,
  reverseColor,
  unpromotedPieceType,
} from "tsshogi";

export type CandidateGuideKind = "plan" | "unsafe-plan" | "urgent" | "ai";
export type CandidateInput = { usi: string; score?: number; guideKind?: CandidateGuideKind };
export type CandidateMove = {
  move: Move;
  score?: number;
  promotion?: "成" | "不成";
  guideKind?: CandidateGuideKind;
};

export function positionFromSfen(sfen: string): ImmutablePosition {
  return Position.newBySFEN(sfen);
}

export function candidateMovesFromUsi(
  position: ImmutablePosition,
  candidates: CandidateInput[],
): CandidateMove[] {
  return candidates.flatMap((candidate) => {
    const move = position.createMoveByUSI(candidate.usi);
    const score =
      typeof candidate.score === "number" && Number.isFinite(candidate.score)
        ? candidate.score
        : undefined;
    if (!move) return [];
    let promotion: CandidateMove["promotion"];
    if (move.promote) {
      promotion = "成";
    } else if (/^[1-9][a-i][1-9][a-i]$/.test(candidate.usi)) {
      const promoted = position.createMoveByUSI(`${candidate.usi}+`);
      if (promoted && position.isValidMove(promoted)) promotion = "不成";
    }
    return [{ move, score, promotion, guideKind: candidate.guideKind }];
  });
}

export function legalDestinationSquares(
  position: ImmutablePosition,
  source: Square | PieceType,
): Square[] {
  return Square.all.filter((square) => {
    const move = position.createMove(source, square);
    return move !== null &&
      (position.isValidMove(move) || position.isValidMove(move.withPromote()));
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
