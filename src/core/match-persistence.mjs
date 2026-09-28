import { Color } from "tsshogi";
import { appendUsiMove, createGameRecord } from "../game-state";
import {
  createFormationState,
  detectFormationSnapshot,
  updateFormationState,
} from "./formation-tracker.mjs";

export const MATCH_SNAPSHOT_VERSION = 1;
export const MATCH_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function matchSnapshotKey({ pathname = "/", matchId = "" } = {}) {
  const scope = matchId || "standalone";
  return `yacobihime:shogi-match:${encodeURIComponent(pathname)}:${encodeURIComponent(scope)}`;
}

export function saveMatchSnapshot(storage, key, snapshot, now = Date.now()) {
  if (!storage || !key || !snapshot) return false;
  try {
    storage.setItem(key, JSON.stringify({
      ...snapshot,
      version: MATCH_SNAPSHOT_VERSION,
      savedAt: now,
    }));
    return true;
  } catch {
    try { storage.removeItem(key); } catch { /* Storage is unavailable. */ }
    return false;
  }
}

export function loadMatchSnapshot(storage, key, expected, now = Date.now()) {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    const valid = snapshot
      && typeof snapshot === "object"
      && snapshot.version === MATCH_SNAPSHOT_VERSION
      && typeof snapshot.savedAt === "number"
      && snapshot.savedAt <= now
      && now - snapshot.savedAt <= MATCH_SNAPSHOT_MAX_AGE_MS
      && snapshot.initialSfen === expected.initialSfen
      && snapshot.mode === expected.mode;
    if (valid) return snapshot;
    storage.removeItem(key);
    return null;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be unavailable in private browsing or a restricted embed.
    }
    return null;
  }
}

export function clearMatchSnapshot(storage, key) {
  if (!storage || !key) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function savedMatchNumber(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.trunc(value)))
    : fallback;
}

export function recordAndFormationsFromMoves(initialSfen, moves, formationMaster) {
  const nextRecord = createGameRecord(initialSfen);
  let nextFormationState = createFormationState();
  nextFormationState = updateFormationState(
    nextFormationState,
    detectFormationSnapshot(nextRecord.position.sfen, formationMaster),
  );
  for (const move of moves) {
    if (!appendUsiMove(nextRecord, move)) throw new Error("保存棋譜に不正な指し手があります。");
    nextFormationState = updateFormationState(
      nextFormationState,
      detectFormationSnapshot(nextRecord.position.sfen, formationMaster),
    );
  }
  return { nextRecord, nextFormationState };
}

export function persistedResult(value, moves, finalSfen) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object") throw new Error("保存された終局結果が不正です。");
  const outcomes = ["black-win", "white-win", "draw"];
  const reasons = ["checkmate", "resignation", "repetition", "perpetual-check"];
  const validWinner = value.winner === Color.BLACK
    || value.winner === Color.WHITE
    || value.winner === null;
  const sameMoves = Array.isArray(value.moves)
    && value.moves.length === moves.length
    && value.moves.every((move, index) => move === moves[index]);
  if (
    !outcomes.includes(value.outcome)
    || !reasons.includes(value.reason)
    || !validWinner
    || value.moveCount !== moves.length
    || value.finalSfen !== finalSfen
    || !sameMoves
  ) throw new Error("保存された終局結果が棋譜と一致しません。");
  return value;
}
