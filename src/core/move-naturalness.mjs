import {
  applyUsiToBoard,
  attackedSquares,
  attackersOf,
  breakthroughSquares,
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
/** 歩以外の駒を、取り返しの見込みなく相手に渡す手に付けるタグ。 */
export const PIECE_SACRIFICE_TAG = "piece-sacrifice";
/**
 * 誰でも気付く当たり前の手とみなすタグ。神の一手の判定と、CPUの危険の見積もり(正解が当たり前の手なら間違えない)で使う。
 */
export const OBVIOUS_MOVE_TAGS = new Set([
  "free-capture", "winning-capture", "even-trade", "recapture", "escape", "capture-checker", "threaten",
]);
/** これ未満の重みを「人間が指しにくい手」として集計する。 */
export const LOW_NATURALNESS_THRESHOLD = 0.3;

const OPENING_KING_PLY = 30;
const CASTLE_BUILD_PLY = 40;
const BIG_PIECES = new Set(["B", "R", "+B", "+R"]);
/** 優勢側が駒の交換を好み始める評価値。 */
const SIMPLIFY_ADVANTAGE = 300;
/** 狙いの分かる手のタグ。これらを持たない手を「目的のない手」とみなす。 */
const PURPOSEFUL_TAGS = new Set([
  "free-capture", "winning-capture", "even-trade", "losing-capture", "recapture",
  "capture-checker", "king-escape", "drop-block", "move-block", "escape", "promote", "activate",
  "castle-build", "pawn-tension", "rook-pawn-push", "threaten", "open-line", "develop", "guard", "desperado", "plan",
]);

/** toの歩の後ろ(自陣側)に、間に駒を挟まず自分の飛車・竜がいるか。 */
function rookBehind(board, to, color) {
  const step = color === "black" ? 1 : -1;
  for (let rank = to.charCodeAt(1) - 96 + step; rank >= 1 && rank <= 9; rank += step) {
    const piece = board.get(`${to[0]}${String.fromCharCode(96 + rank)}`);
    if (!piece) continue;
    return piece.color === color && (piece.kind === "R" || piece.kind === "+R");
  }
  return false;
}

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
/**
 * simplicity(0〜1)は、弱いCPUほど分かりやすい手を好む度合い。0なら従来どおりの自然さだけを返す。
 * advantageは手番側から見た評価値で、優勢なら駒の交換を好む(局面を単純にする)のに使う。
 */
/** @param {string} sfen
 * @param {{moveHistory?: string[], ply?: number, simplicity?: number, advantage?: number, planMoves?: string[]}} [options] */
export function createNaturalnessEvaluator(sfen, { moveHistory = [], ply, simplicity = 0, advantage, planMoves = [] } = {}) {
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
  let ownBigPieces;
  let bigPieceReach;
  let breakthroughsBefore;

  return (usi) => {
    const parsed = parseUsiMove(usi);
    const applied = parsed && applyUsiToBoard(board, usi, me);
    if (!applied) return { weight: 1, tags: [], purposeful: false, check: false };
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
    const wasHanging = !drop && isHanging(board, from);
    if (planMoves.includes(usi)) tags.push("plan");
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
      } else if (wasHanging) {
        factor = 1.5;
        tags.push("desperado");
      } else {
        factor = 0.4 + 0.6 * simplicity;
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

    if (!drop && moverKind !== "K" && wasHanging && !hangingAfter) {
      apply(2.0, "escape");
    }
    if (!drop && moverKind !== "K" && relativeRank(to, me) < relativeRank(from, me)) {
      const targets = attackedSquares(after, to);
      const planned = tags.includes("plan");
      const lancePurpose = targets.some((square) => after.get(square)?.color === opp)
        || (kingSquare && relativeRank(kingSquare, me) >= 8
          && [1, 9].includes(relativeFile(from, me))
          && chebyshev(kingSquare, `${from[0]}${me === "black" ? "i" : "a"}`) <= 2);
      const knightPurpose = relativeRank(to, me) <= 5 || targets.some((square) => {
        const target = after.get(square);
        return target?.color === opp && target.kind !== "K" && pieceValue(target.kind) >= 3;
      });
      if (originalKind !== "G" && (originalKind !== "L" || lancePurpose || planned)
        && (originalKind !== "N" || knightPurpose || planned)) {
        apply(1.2, "advance");
        if (!(moverKind === "P" && [1, 9].includes(relativeFile(to, me)))) tags.push("develop");
      }
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

    hangingBefore ??= countHanging(board, me);
    breakthroughsBefore ??= breakthroughSquares(board, me).length;
    // 侵入駒へ安い駒を当てる受けも拾う。例: 棒銀の2四銀に対する2三歩。
    // 利きが同数の地点への成り込みでは、突破マスの個数だけではこの受けを検出できない。
    const countersIntruder = attackedSquares(after, to).some((square) => {
      const target = after.get(square);
      return target?.color === opp && target.kind !== "K" && relativeRank(square, me) >= 6
        && pieceValue(target.kind) >= 3 && isHanging(after, square) && !isHanging(board, square);
    });
    const defends = !tags.includes("escape") && (countHanging(after, me) < hangingBefore
      || breakthroughSquares(after, me).length < breakthroughsBefore || countersIntruder);
    if (defends) apply(1.5, "guard");

    if (drop && !inCheck) {
      const threatensPiece = attackedSquares(after, to).some((square) => {
        const target = after.get(square);
        return target?.color === opp && target.kind !== "K" && pieceValue(target.kind) >= 3;
      });
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

    {
      const simple = (strength, tag) => apply(1 + strength * simplicity, tag);
      // 歩と歩がぶつかったら、まず取る。
      if (moverKind === "P" && !drop && applied.captured?.kind === "P") simple(3, "pawn-tension");
      if (tags.includes("recapture")) simple(1, "simple-recapture");
      if (Number.isFinite(advantage) && advantage >= SIMPLIFY_ADVANTAGE
        && (tags.includes("even-trade") || tags.includes("recapture"))) {
        simple(1.5, "simplify");
      }
      // 飛車の前の歩を伸ばす、相手の駒に当てるといった、狙いの見える攻めの手。
      if (!drop && moverKind === "P" && !applied.captured && rookBehind(after, to, me)) simple(0.8, "rook-pawn-push");
      if (!applied.captured && !hangingAfter && attackedSquares(after, to).some((square) => {
        const target = after.get(square);
        return target?.color === opp && target.kind !== "K" && pieceValue(target.kind) >= 3
          && !attackedSquares(board, from ?? to).includes(square);
      })) simple(1, "threaten");
      // 角道を開けるなど、自分の飛車・角の利きを広げる手。
      if (!drop && !BIG_PIECES.has(originalKind)) {
        ownBigPieces ??= [...board].filter(([, piece]) => piece.color === me && BIG_PIECES.has(piece.kind));
        const reach = (position) => ownBigPieces
          .reduce((sum, [square]) => sum + attackedSquares(position, square).length, 0);
        bigPieceReach ??= reach(board);
        if (reach(after) - bigPieceReach >= 2) simple(0.5, "open-line");
      }
      // 取る・逃げる・成る・王手・囲い・攻めのどれでもない、目的の見えない手は避ける。
      if (simplicity > 0 && !givesCheck && !tags.some((tag) => PURPOSEFUL_TAGS.has(tag))) {
        apply(1 - 0.6 * simplicity, "aimless");
      }
    }

    // 歩以外の駒を、取り返しの見込みなく相手に渡す手。王手や成りの加点で打ち消さない。
    const lostValue = hangingAfter
      ? pieceValue(originalKind) - (applied.captured ? pieceValue(applied.captured.kind) : 0)
        - (applied.captured && wasHanging ? pieceValue(originalKind) : 0)
      : 0;
    if (originalKind !== "P" && lostValue >= 2) {
      tags.push(PIECE_SACRIFICE_TAG);
      weight = Math.min(weight, BIG_PIECES.has(originalKind) ? 0.05 : 0.1);
    }

    return {
      weight: Math.min(NATURALNESS_MAX, Math.max(NATURALNESS_MIN, weight)),
      tags,
      // 王手かどうか。棋風(攻めの手か)の判定に使う。
      check: givesCheck,
      purposeful: givesCheck || tags.some((tag) => PURPOSEFUL_TAGS.has(tag)),
    };
  };
}

/** 1手だけ評価する簡易版。 */
export function moveNaturalness(sfen, usi, context = {}) {
  return createNaturalnessEvaluator(sfen, context)(usi).weight;
}
