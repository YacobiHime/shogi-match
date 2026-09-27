import { describe, expect, it } from "vitest";
import {
  clearMatchSnapshot,
  loadMatchSnapshot,
  matchSnapshotKey,
  MATCH_SNAPSHOT_MAX_AGE_MS,
  persistedResult,
  recordAndFormationsFromMoves,
  savedMatchNumber,
  saveMatchSnapshot,
} from "./match-persistence.mjs";
import { Color } from "tsshogi";
import { STANDARD_SFEN } from "../game-state";
import hiraganaFormationMaster from "../data/hiragana_suisho_formations.json";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("match persistence", () => {
  it("isolates standalone and embedded matches", () => {
    expect(matchSnapshotKey({ pathname: "/game.html" }))
      .not.toBe(matchSnapshotKey({ pathname: "/game.html", matchId: "chapter:1" }));
  });

  it("round-trips a compatible snapshot", () => {
    const storage = memoryStorage();
    const key = matchSnapshotKey();
    const snapshot = { initialSfen: "start", mode: "cpu", moves: ["7g7f"] };
    expect(saveMatchSnapshot(storage, key, snapshot, 100)).toBe(true);
    expect(loadMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" }, 200))
      .toMatchObject(snapshot);
  });

  it("round-trips the board flip state", () => {
    const storage = memoryStorage();
    const key = matchSnapshotKey();
    const snapshot = { initialSfen: "start", mode: "cpu", boardFlipOverride: true };
    expect(saveMatchSnapshot(storage, key, snapshot, 100)).toBe(true);
    expect(loadMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" }, 200))
      .toMatchObject({ boardFlipOverride: true });
  });

  it("removes incompatible, expired, and malformed snapshots", () => {
    const storage = memoryStorage();
    const key = matchSnapshotKey();
    saveMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" }, 100);
    expect(loadMatchSnapshot(storage, key, { initialSfen: "other", mode: "cpu" }, 200)).toBeNull();

    saveMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" }, 100);
    expect(loadMatchSnapshot(
      storage,
      key,
      { initialSfen: "start", mode: "cpu" },
      100 + MATCH_SNAPSHOT_MAX_AGE_MS + 1,
    )).toBeNull();

    storage.setItem(key, "{");
    expect(loadMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" })).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("clears a saved match", () => {
    const storage = memoryStorage();
    const key = matchSnapshotKey();
    saveMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" });
    expect(clearMatchSnapshot(storage, key)).toBe(true);
    expect(storage.getItem(key)).toBeNull();
  });

  it("rejects a snapshot saved in the future", () => {
    const storage = memoryStorage();
    const key = matchSnapshotKey();
    saveMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" }, 300);
    expect(loadMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" }, 200)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("rejects a different snapshot version or mode", () => {
    const storage = memoryStorage();
    const key = matchSnapshotKey();
    saveMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" }, 100);
    expect(loadMatchSnapshot(storage, key, { initialSfen: "start", mode: "local" }, 200)).toBeNull();
    storage.setItem(key, JSON.stringify({ version: 2, savedAt: 100, initialSfen: "start", mode: "cpu" }));
    expect(loadMatchSnapshot(storage, key, { initialSfen: "start", mode: "cpu" }, 200)).toBeNull();
  });

  it("clears an older snapshot if saving throws", () => {
    const values = new Map([["match", "old"]]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: () => { throw new Error("quota exceeded"); },
      removeItem: (key) => values.delete(key),
    };
    expect(saveMatchSnapshot(storage, "match", { initialSfen: "start", mode: "cpu" })).toBe(false);
    expect(storage.getItem("match")).toBeNull();
  });

  it("normalizes numeric counters within their saved bounds", () => {
    expect(savedMatchNumber(4.8, 0, 0, 3)).toBe(3);
    expect(savedMatchNumber(-2, 0, 0, 3)).toBe(0);
    expect(savedMatchNumber("2", 1, 0, 3)).toBe(1);
  });

  it("reconstructs a record and formations from saved moves", () => {
    const restored = recordAndFormationsFromMoves(
      STANDARD_SFEN,
      ["7g7f", "3c3d"],
      hiraganaFormationMaster,
    );
    expect(restored.nextRecord.position.sfen).toContain(" b ");
    expect(restored.nextRecord.moves).toHaveLength(3);
    expect(restored.nextFormationState).toBeTruthy();
    expect(() => recordAndFormationsFromMoves(
      STANDARD_SFEN,
      ["invalid"],
      hiraganaFormationMaster,
    )).toThrow("保存棋譜に不正な指し手があります。");
  });

  it("accepts only a result matching the restored record", () => {
    const moves = ["7g7f"];
    const finalSfen = "final";
    const result = {
      outcome: "black-win",
      winner: Color.BLACK,
      reason: "resignation",
      moveCount: 1,
      moves,
      finalSfen,
    };
    expect(persistedResult(result, moves, finalSfen)).toBe(result);
    expect(() => persistedResult({ ...result, moveCount: 2 }, moves, finalSfen))
      .toThrow("保存された終局結果が棋譜と一致しません。");
  });
});
