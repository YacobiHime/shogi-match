import { Position } from "tsshogi";
import { enumerateLegalMoves } from "../game-state";
import { findMateLine } from "./problem-solver";
import {
  attackedSquares, attackersOf, breakthroughSquares, findKing, isKingAttacked,
  opponentOf, parseUsiMove, pieceValue,
} from "./piece-movement.mjs";
import { captureMoves, captureSearch, material, playLight, stateFromSfen, value } from "./logic-position.mjs";

/** 直前の着手を戻した盤。当該手の移動前からの当たりと、新しい当たりを区別する。 */
function beforeLastMove(board, lastMove, opponent) {
  const parsed = parseUsiMove(lastMove ?? "");
  const moved = parsed && board.get(parsed.to);
  if (!moved || moved.color !== opponent) return null;
  const before = new Map(board);
  before.delete(parsed.to);
  if (!parsed.drop) before.set(parsed.from, {
    color: opponent, kind: parsed.promote ? moved.kind.replace(/^\+/, "") : moved.kind,
  });
  return before;
}

/**
 * 局面の脅威と機会。確率は扱わず、両方のAIが同じ盤上の事実を見る。
 * @param {string} sfen
 * @param {{moveHistory?: string[], legalMoves?: string[], maxTimeMs?: number, captureThreatsOnly?: boolean}} [options]
 * @returns {{me: "black" | "white", threats: Array<{kind: "capture" | "breakthrough" | "check" | "mate-threat", square: string, value: number, salience: "last-move-major" | "last-move-minor" | "other", attackers: string[]}>, chances: Array<{kind: "free-capture" | "winning-capture" | "fork" | "promote" | "check" | "mate", moves: string[], value: number}>}}
 */
export function analyzePosition(sfen, { moveHistory = [], legalMoves, maxTimeMs = 120, captureThreatsOnly = false } = {}) {
  const deadline = Date.now() + Math.max(0, maxTimeMs);
  const state = stateFromSfen(sfen);
  const { board, turn: me } = state;
  const opp = opponentOf(me);
  const threats = [];
  const chances = [];
  const before = beforeLastMove(board, moveHistory.at(-1), opp);
  const enemy = { ...state, turn: opp };
  const baseline = material(enemy, opp);
  for (const capture of captureMoves(board, opp, false)) {
    if (capture.king) continue;
    const child = playLight(enemy, capture.usi);
    if (!child || isKingAttacked(child.board, opp)) continue;
    const gain = -captureSearch(child, 3, -Infinity, Infinity, deadline) - baseline;
    if (gain <= 0) continue;
    const square = parseUsiMove(capture.usi).to;
    const kind = board.get(square).kind;
    const newlyAttacked = before && attackersOf(before, square, opp).length === 0;
    const salience = newlyAttacked && ["R", "B", "+R", "+B"].includes(kind) ? "last-move-major"
      : newlyAttacked && kind !== "P" ? "last-move-minor" : "other";
    const existing = threats.find((threat) => threat.kind === "capture" && threat.square === square);
    if (existing) { existing.value = Math.max(existing.value, gain); continue; }
    threats.push({ kind: "capture", square, value: gain, salience, attackers: attackersOf(board, square, opp).map(({ square }) => square) });
  }
  // ロジックAIは当たりの目立ち方だけを参照し、機会・成り込み・詰みは自分の候補の読みで調べる。
  if (captureThreatsOnly) return { me, threats, chances };
  for (const square of breakthroughSquares(board, me)) {
    const attackers = attackersOf(board, square, opp).filter(({ kind }) => kind !== "K");
    const gain = Math.max(0, ...attackers.map(({ kind }) => value(`+${kind}`) - value(kind)));
    threats.push({ kind: "breakthrough", square, value: gain, salience: "other", attackers: attackers.map(({ square }) => square) });
  }
  const king = findKing(board, me);
  if (king && isKingAttacked(board, me)) threats.push({ kind: "check", square: king, value: 20000, salience: "other", attackers: attackersOf(board, king, opp).map(({ square }) => square) });
  else if (king && Date.now() < deadline) {
    const fields = sfen.split(" ");
    fields[1] = me === "black" ? "w" : "b";
    const line = findMateLine(fields.join(" "), 1, { nodeLimit: 3000, maxTimeMs: Math.min(60, deadline - Date.now()) });
    if (line) threats.push({ kind: "mate-threat", square: king, value: 20000, salience: "other", attackers: [line[0]] });
  }
  const moves = legalMoves ?? enumerateLegalMoves(Position.newBySFEN(sfen)).map(({ usi }) => usi);
  for (const usi of moves) {
    const child = playLight(state, usi);
    if (!child) continue;
    const { to, promote } = parseUsiMove(usi);
    if (child.captured) {
      const gain = -captureSearch(child, 3, -Infinity, Infinity, deadline) - material(state, me);
      const free = attackersOf(child.board, to, opp).length === 0;
      if (free || gain > 0) chances.push({ kind: free ? "free-capture" : "winning-capture", moves: [usi], value: Math.max(0, gain) });
    }
    const targets = attackedSquares(child.board, to).filter((square) => {
      const target = child.board.get(square);
      return target?.color === opp && target.kind !== "K" && pieceValue(target.kind) >= 3;
    });
    if (targets.length >= 2) chances.push({ kind: "fork", moves: [usi], value: Math.min(...targets.map((square) => value(child.board.get(square).kind))) });
    if (promote) chances.push({ kind: "promote", moves: [usi], value: value(child.board.get(to).kind) - value(board.get(parseUsiMove(usi).from).kind) });
    if (isKingAttacked(child.board, opp)) chances.push({ kind: "check", moves: [usi], value: 0 });
  }
  if (chances.some(({ kind }) => kind === "check") && Date.now() < deadline) {
    const line = findMateLine(sfen, 1, { nodeLimit: 3000, maxTimeMs: Math.min(60, deadline - Date.now()) });
    if (line) chances.push({ kind: "mate", moves: [line[0]], value: 20000 });
  }
  return { me, threats, chances };
}

/** 最も目立つ当たりで、その局面のhangingの気づく確率を決める。 */
export function perceptionForPosition(perception, awareness) {
  const saliences = awareness.threats.map(({ salience }) => salience);
  const key = saliences.includes("last-move-major") ? "hangingLastMoveMajor"
    : saliences.includes("last-move-minor") ? "hangingLastMoveMinor" : "hanging";
  return { ...perception, hanging: perception[key] ?? perception.hanging };
}
