import {
  ImmutablePosition,
  Move,
  Position,
  Square,
  parseUSIMove,
  reverseColor,
  unpromotedPieceType,
} from "tsshogi";

export type CandidateGuideKind = "plan" | "unsafe-plan" | "urgent" | "ai" | "move";
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

/**
 * 駒の動き方を矢印で見せるための手。盤上の駒が動けるマスを方向ごとにまとめ、
 * 飛車・角・香のように遠くまで動ける駒は、その方向でいちばん遠いマスまでの1本にする。桂の2方向は別々の矢印にする。
 */
export function movementArrowMoves(position: ImmutablePosition, from: Square): Move[] {
  const farthest = new Map<string, { square: Square; distance: number }>();
  for (const square of legalDestinationSquares(position, from)) {
    const fileStep = square.file - from.file;
    const rankStep = square.rank - from.rank;
    const distance = Math.max(Math.abs(fileStep), Math.abs(rankStep));
    // 縦・横・斜めは方向だけで、桂のような飛ぶ動きは動いた量そのもので分ける。
    const straight = fileStep === 0 || rankStep === 0 || Math.abs(fileStep) === Math.abs(rankStep);
    const key = straight ? `${Math.sign(fileStep)},${Math.sign(rankStep)}` : `${fileStep},${rankStep}`;
    const known = farthest.get(key);
    if (!known || distance > known.distance) farthest.set(key, { square, distance });
  }
  return [...farthest.values()]
    .map(({ square }) => position.createMove(from, square))
    .filter((move): move is Move => move !== null);
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
