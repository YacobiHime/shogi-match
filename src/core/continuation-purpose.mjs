import { Position } from "tsshogi";
import { isHanging, isKingAttacked, opponentOf, parseSfenState, parseUsiMove, pieceValue } from "./piece-movement.mjs";

/**
 * 取得済みの読み筋から、初手に依存する具体的な狙いだけを拾う。追加探索はしない。
 * 単に後の手に王手や取りがあるだけでは、無関係な初手の目的にはしない。
 * @param {string} sfen
 * @param {{move: string, pv?: string[], score?: {type: string, value: number}}} candidate
 * @returns {string | null}
 */
export function continuationPurpose(sfen, candidate) {
  const root = parseUsiMove(candidate.move);
  const pv = candidate.pv;
  if (!root || !pv?.length || pv[0] !== candidate.move) return null;
  const original = parseSfenState(sfen);
  const me = original.turn;
  const opp = opponentOf(me);
  const originalPiece = root.drop ? { color: me, kind: root.drop } : original.board.get(root.from);
  if (!originalPiece) return null;
  const position = Position.newBySFEN(sfen);
  if (!position) return null;
  let moverSquare = root.to;
  let ownTaken = 0;
  let enemyTaken = 0;
  let rootTaken = false;
  for (let ply = 0; ply < Math.min(7, pv.length); ply += 1) {
    const parsed = parseUsiMove(pv[ply]);
    const before = parseSfenState(position.sfen).board;
    const captured = parsed && before.get(parsed.to);
    const move = position.createMoveByUSI(pv[ply]);
    if (!move || !position.doMove(move)) return null;
    const after = parseSfenState(position.sfen).board;
    if (captured) {
      if (ply % 2 === 0) ownTaken += pieceValue(captured.kind);
      else enemyTaken += pieceValue(captured.kind);
    }
    if (ply === 0) {
      // mateスコアはエンジンが詰みまで確認した読み。着手選択の既存の詰み判定と揃える。
      if (candidate.score?.type === "mate" && candidate.score.value > 0) return "mate-plan";
      continue;
    }
    if (ply % 2 === 0) {
      if (parsed.from === moverSquare && !rootTaken) {
        moverSquare = parsed.to;
        if (captured?.color === opp || parsed.promote || isKingAttacked(after, opp)) return "attack-plan";
      }
      if (rootTaken && ownTaken >= enemyTaken && ownTaken >= pieceValue(originalPiece.kind)) return "combination";
    } else {
      if (parsed.to === moverSquare) rootTaken = true;
      if (rootTaken) continue;
      // 相手の実際の応手を置いたまま初手だけ戻し、受けや退避の効果を比較する。
      // 取る手・成る手は元から目的があり、この反実仮想の対象外。
      if (!original.board.has(root.to) && !root.promote && moverSquare === root.to) {
        const without = new Map(after);
        without.delete(root.to);
        if (!root.drop && !without.has(root.from)) without.set(root.from, originalPiece);
        if (isKingAttacked(without, me) && !isKingAttacked(after, me)) return "guard-plan";
        for (const [square, piece] of after) {
          if (piece.color !== me || !["B", "R", "+B", "+R"].includes(piece.kind) || square === root.to) continue;
          if (isHanging(without, square) && !isHanging(after, square)) return "guard-plan";
        }
      }
    }
  }
  return null;
}
