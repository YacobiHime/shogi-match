import {
  Color,
  handPieceTypes,
  Move,
  Position,
  Record,
  reverseColor,
  Square,
} from "tsshogi";

export const STANDARD_SFEN =
  "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

export type GameMode = "local" | "cpu";
export type MatchOutcome = "black-win" | "white-win" | "draw";
export type MatchReason = "checkmate" | "resignation" | "repetition" | "perpetual-check";

export type MatchResult = {
  outcome: MatchOutcome;
  winner: Color | null;
  reason: MatchReason;
  moveCount: number;
  moves: string[];
  finalSfen: string;
};

export function createGameRecord(initialSfen = STANDARD_SFEN): Record {
  const position = Position.newBySFEN(initialSfen);
  if (!position) {
    throw new Error("開始局面のSFENが不正です。");
  }
  return new Record(position);
}

export function enumerateLegalMoves(position: Position): Move[] {
  const moves: Move[] = [];
  const seen = new Set<string>();
  const append = (move: Move | null) => {
    if (!move || !position.isValidMove(move) || seen.has(move.usi)) return;
    seen.add(move.usi);
    moves.push(move);
  };

  for (const from of position.board.listNonEmptySquares()) {
    const piece = position.board.at(from);
    if (!piece || piece.color !== position.color) continue;
    for (const to of Square.all) {
      const move = position.createMove(from, to);
      append(move);
      append(move?.withPromote() ?? null);
    }
  }

  for (const pieceType of handPieceTypes) {
    if (position.hand(position.color).count(pieceType) < 1) continue;
    for (const to of Square.all) {
      append(position.createMove(pieceType, to));
    }
  }
  return moves;
}

export function appendUsiMove(record: Record, usi: string): boolean {
  const move = record.position.createMoveByUSI(usi);
  return Boolean(move && record.append(move));
}

export function selectCpuMove(
  position: Position,
  random: () => number = Math.random,
): Move | null {
  const moves = enumerateLegalMoves(position);
  if (moves.length === 0) return null;
  const index = Math.min(moves.length - 1, Math.floor(Math.max(0, random()) * moves.length));
  return moves[index];
}

export function resultAfterMove(record: Record): MatchResult | null {
  if (record.repetition) {
    const checkingColor = record.perpetualCheck;
    return buildResult(
      record,
      checkingColor ? reverseColor(checkingColor) : null,
      checkingColor ? "perpetual-check" : "repetition",
    );
  }
  if (enumerateLegalMoves(record.position as Position).length === 0) {
    return buildResult(record, reverseColor(record.position.color), "checkmate");
  }
  return null;
}

export function resignationResult(record: Record): MatchResult {
  return buildResult(record, reverseColor(record.position.color), "resignation");
}

function buildResult(
  record: Record,
  winner: Color | null,
  reason: MatchReason,
): MatchResult {
  const moves = record.movesBefore
    .map((node) => node.move)
    .filter((move): move is Move => move instanceof Move)
    .map((move) => move.usi);
  return {
    outcome: winner === Color.BLACK ? "black-win" : winner === Color.WHITE ? "white-win" : "draw",
    winner,
    reason,
    moveCount: moves.length,
    moves,
    finalSfen: record.position.sfen,
  };
}
