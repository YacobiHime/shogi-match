import { describe, expect, it } from "vitest";
import { EXHIBIT_KEEP_KEYS, clearExhibitRecords, isAppStorageKey } from "./exhibit-reset.mjs";

function memoryStorage(entries) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()].sort(),
  };
}

describe("展示の「最初から」", () => {
  it("このゲームの記録をすべて消し、展示する人の設定とほかのサイトの保存は残す", () => {
    const storage = memoryStorage({
      "yacobihime:shogi-match:tutorial:v1": "{}",
      "yacobihime:shogi-match:player-rating": "{}",
      "yacobihime:shogi-match:ryuo-roster": "{}",
      "shogi-match:problem-set:v1": "{}",
      "shogi-match-analysis-level": "2",
      "shogiMatchBackGuard": "1",
      "yacobihime:shogi-match:sound": "on",
      "shogi-match-board-theme": "dark",
      "shogi-match-piece-theme": "gothic",
      "other-site": "keep",
    });
    const removed = clearExhibitRecords(storage);
    expect(removed).toHaveLength(6);
    expect(storage.keys()).toEqual([...EXHIBIT_KEEP_KEYS, "other-site"].sort());
  });

  it("鍵の見分け", () => {
    expect(isAppStorageKey("yacobihime:shogi-match:welcome:v1")).toBe(true);
    expect(isAppStorageKey("shogi-match-opening-book-draft-v1")).toBe(true);
    expect(isAppStorageKey("shogi")).toBe(false);
    expect(isAppStorageKey(null)).toBe(false);
  });

  it("保存が使えなくても止まらない", () => {
    expect(clearExhibitRecords(null)).toEqual([]);
    const broken = { get length() { throw new Error("blocked"); } };
    expect(clearExhibitRecords(/** @type {any} */ (broken))).toEqual([]);
  });
});
