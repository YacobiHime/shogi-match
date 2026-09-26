import {
  applyUsiToBoard,
  attackedSquares,
  attackersOf,
  countHanging,
  findKing,
  isHanging,
  isKingAttacked,
  opponentOf,
  parseSfenState,
  parseUsiMove,
  pieceValue,
  relativeFile,
  relativeRank,
} from "./piece-movement.mjs";

export const NATURALNESS_MIN = 0.02;
export const NATURALNESS_MAX = 8;
/** これ未満の重みを「人間が指しにくい手」として集計する。 */
export const LOW_NATURALNESS_THRESHOLD = 0.3;

const OPENING_KING_PLY = 30;
const CASTLE_BUILD_PLY = 40;
const BIG_PIECES = new Set(["B", "R", "+B", "+R"]);

function chebyshev(a, b) {
  return Math.max(Math.abs(Number(a[0]) - Number(b[0])), Math.abs(a.charCodeAt(1) - b.charCodeAt(1)));
}

function initialKingSquare(color) {
  return color === "white" ? "5a" : "5i";
}

/** 自陣の飛車位置から、囲いを作る方向(相対筋の増減)を返す。 */
function castleDirection(board, color) {
  for (const [square, piece] of board) {
    if (piece.color === color && piece.kind === "R") {
      return relativeFile(square, color) <= 4 ? 1 : -1;
    }
  }
  return 0;
}

/**
 * 局面ごとの共通情報を一度だけ計算し、各手の自然さを返す関数を作る。
 * 重みは[NATURALNESS_MIN, NATURALNESS_MAX]に収め、弱い手も完全には除外しない。
 */
export function createNaturalnessEvaluator(sfen, { moveHistory = [], ply } = {}) {
  const { board, turn: me } = parseSfenState(sfen);
  const opp = opponentOf(me);
  const kingSquare = findKing(board, me);
  const inCheck = isKingAttacked(board, me);
  const checkers = inCheck && kingSquare
    ? new Set(attackersOf(board, kingSquare, opp).map(({ square }) => square))
    : new Set();
  const currentPly = Number.isInteger(ply) ? ply : moveHistory.length;
  const lastOpponent = parseUsiMove(moveHistory.at(-1) ?? "");
  const previousOwn = parseUsiMove(moveHistory.at(-2) ?? "");
  const direction = castleDirection(board, me);
  const kingCastled = kingSquare && kingSquare !== initialKingSquare(me);
  let hangingBefore;

  return (usi) => {
    const parsed = parseUsiMove(usi);
    const applied = parsed && applyUsiToBoard(board, usi, me);
    if (!applied) return { weight: 1, tags: [] };
    const after = applied.board;
    const { to, from, drop } = parsed;
    const moverKind = applied.moved.kind;
    const originalKind = drop ?? board.get(from).kind;
    const tags = [];
    let weight = 1;
    const apply = (factor, tag) => {
      weight *= factor;
      tags.push(tag);
    };

    const givesCheck = isKingAttacked(after, opp);
    const destAttackers = attackersOf(after, to, opp);
    const destDefenders = attackersOf(after, to, me);
    const hangingAfter = moverKind !== "K" && destAttackers.length > 0 && (
      destDefenders.length === 0
      || Math.min(...destAttackers.map(({ kind }) => pieceValue(kind))) < pieceValue(moverKind)
    );

    if (applied.captured) {
      const capturedValue = pieceValue(applied.captured.kind);
      const net = capturedValue - (hangingAfter ? pieceValue(moverKind) : 0);
      let factor;
      if (destAttackers.length === 0) {
        factor = 3.0;
        tags.push("free-capture");
      } else if (net > 0) {
        factor = 2.5;
        tags.push("winning-capture");
      } else if (net === 0 || capturedValue >= pieceValue(originalKind)) {
        factor = 1.5;
        tags.push("even-trade");
      } else {
        factor = 0.4;
        tags.push("losing-capture");
      }
      if (lastOpponent && lastOpponent.to === to) {
        factor = Math.max(factor, net >= 0 ? 3.0 : 1.0);
        tags.push("recapture");
      }
      weight *= factor;
    }

    if (inCheck) {
      if (applied.captured && checkers.has(to)) apply(2.5, "capture-checker");
      else if (moverKind === "K") apply(1.5, "king-escape");
      else if (drop) apply(1.2, "drop-block");
      else apply(1.5, "move-block");
    }

    if (!drop && moverKind !== "K" && isHanging(board, from) && !hangingAfter) {
      apply(2.0, "escape");
    }
    if (!drop && moverKind !== "K" && relativeRank(to, me) < relativeRank(from, me)) {
      apply(1.2, "advance");
    }
    if (parsed.promote) apply(2.0, "promote");
    if (!drop && BIG_PIECES.has(originalKind)) {
      const gain = attackedSquares(after, to).length - attackedSquares(board, from).length;
      if (gain >= 2) apply(1.2, "activate");
    }

    if (!drop && (originalKind === "G" || originalKind === "S") && kingSquare && !applied.captured) {
      const before = chebyshev(from, kingSquare);
      const afterDistance = chebyshev(to, kingSquare);
      if (currentPly <= CASTLE_BUILD_PLY && afterDistance < before && afterDistance <= 2) {
        apply(1.3, "castle-build");
      } else if (kingCastled && before <= 2 && afterDistance > before) {
        apply(0.5, "castle-break");
      }
    }

    if (moverKind === "K" && !inCheck && !applied.captured) {
      const fileStep = relativeFile(to, me) - relativeFile(from, me);
      const towardCastle = direction !== 0 && Math.sign(fileStep) === direction
        && relativeRank(to, me) >= 8;
      if (towardCastle && currentPly <= CASTLE_BUILD_PLY) {
        apply(1.3, "castle-build");
      } else if (currentPly < OPENING_KING_PLY) {
        const forward = relativeRank(to, me) < relativeRank(from, me);
        const central = Math.abs(relativeFile(to, me) - 5) < Math.abs(relativeFile(from, me) - 5);
        apply(forward || central ? 0.1 : 0.2, "early-king");
      }
    }

    if (drop && !inCheck) {
      const threatensPiece = attackedSquares(after, to).some((square) => {
        const target = after.get(square);
        return target?.color === opp && target.kind !== "K" && pieceValue(target.kind) >= 3;
      });
      hangingBefore ??= countHanging(board, me);
      const defends = countHanging(after, me) < hangingBefore;
      if (!givesCheck && !threatensPiece && !defends) {
        if (relativeRank(to, me) >= 7) {
          const edge = [1, 9].includes(relativeFile(to, me));
          apply(edge ? 0.05 : 0.15, edge ? "corner-drop" : "idle-drop");
        } else {
          apply(0.3, "idle-drop");
        }
      }
    }

    if (!drop && previousOwn && !previousOwn.drop
      && previousOwn.to === from && previousOwn.from === to) {
      apply(0.2, "shuffle");
    }

    if (!applied.captured && hangingAfter && !givesCheck) {
      if (BIG_PIECES.has(moverKind)) apply(0.05, "sacrifice");
      else if (moverKind === "P") apply(0.4, "sacrifice");
      else apply(0.1, "sacrifice");
    }

    return {
      weight: Math.min(NATURALNESS_MAX, Math.max(NATURALNESS_MIN, weight)),
      tags,
    };
  };
}

/** 1手だけ評価する簡易版。 */
export function moveNaturalness(sfen, usi, context = {}) {
  return createNaturalnessEvaluator(sfen, context)(usi).weight;
}
