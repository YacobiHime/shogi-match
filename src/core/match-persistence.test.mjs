import { describe, expect, it } from "vitest";
import {
  clearMatchSnapshot,
  loadMatchSnapshot,
  matchSnapshotKey,
  MATCH_SNAPSHOT_MAX_AGE_MS,
  saveMatchSnapshot,
} from "./match-persistence.mjs";

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
});
