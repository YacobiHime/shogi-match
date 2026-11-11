import { describe, expect, it } from "vitest";
import {
  SAVE_FORMAT, SAVE_VERSION, applySave, collectSave, decodeSave, encodeSave, isTransferKey, saveFileName, summarizeSave, summaryLines,
} from "./save-transfer.mjs";

function memoryStorage(initial = {}, { limit = Infinity } = {}) {
  const map = new Map(Object.entries(initial));
  const size = () => [...map].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      const before = map.get(key);
      map.set(key, String(value));
      if (size() > limit) {
        if (before === undefined) map.delete(key); else map.set(key, before);
        throw new Error("QuotaExceededError");
      }
    },
    removeItem: (key) => map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

const Y = "yacobihime:shogi-match:";

describe("引き継ぎのまとめ", () => {
  it("このゲームの鍵だけを運び、端末ごとの番号と同意は運ばない", () => {
    const storage = memoryStorage({
      [`${Y}player-name:v1`]: JSON.stringify({ name: "やこび" }),
      [`${Y}skill-data-anon:v1`]: "abcdefghijklmnop",
      [`${Y}skill-data-consent:v1`]: "yes",
      "shogi-match-board-theme": "kaya",
      "other-site": "x",
    });
    const bundle = collectSave(storage, { now: 5 });
    expect(bundle).toMatchObject({ format: SAVE_FORMAT, v: SAVE_VERSION, at: 5 });
    expect(Object.keys(bundle.entries).sort()).toEqual([`${Y}player-name:v1`, "shogi-match-board-theme"].sort());
    expect(isTransferKey(`${Y}skill-data-anon:v1`)).toBe(false);
  });

  it("文字にして読み直すと同じ中身。ほかのサイトの鍵や新しい版は受け取らない", () => {
    const bundle = { format: SAVE_FORMAT, v: 1, at: 9, entries: { [`${Y}ryuo-career`]: "{}", "evil-key": "x" } };
    const decoded = decodeSave(encodeSave(bundle));
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && decoded.bundle.entries).toEqual({ [`${Y}ryuo-career`]: "{}" });
    expect(decodeSave("not json")).toEqual({ ok: false, reason: "broken" });
    expect(decodeSave(JSON.stringify({ format: "other", v: 1, entries: {} }))).toEqual({ ok: false, reason: "broken" });
    expect(decodeSave(JSON.stringify({ ...bundle, v: SAVE_VERSION + 1 }))).toEqual({ ok: false, reason: "newer" });
    expect(decodeSave(JSON.stringify({ ...bundle, entries: { "evil-key": "x" } }))).toEqual({ ok: false, reason: "empty" });
  });

  it("要約に名前・レーティング・竜王戦の期数を出す", () => {
    const summary = summarizeSave({
      at: new Date(2026, 10, 11, 14, 5).getTime(),
      entries: {
        [`${Y}player-name:v1`]: JSON.stringify({ name: "やこび" }),
        [`${Y}player-rating`]: JSON.stringify({ rating: 1520.4, games: 12 }),
        [`${Y}ryuo-career`]: JSON.stringify({ seasons: 3 }),
      },
    });
    expect(summary).toMatchObject({ name: "やこび", rating: 1520, games: 12, ryuoSeasons: 3, keys: 3 });
    expect(summaryLines(summary)).toEqual(["名前：やこび", "レーティング：R1520（12局）", "竜王戦：3期", "まとめた日時：2026年11月11日 14:05"]);
    expect(summaryLines(summarizeSave({ entries: {} }))[0]).toBe("名前：まだ決めていない");
  });

  it("置き換えると、まとめにない記録は消え、端末ごとの番号は残る", () => {
    const storage = memoryStorage({
      [`${Y}ryuo-season`]: "old",
      [`${Y}player-rating`]: "old",
      [`${Y}skill-data-anon:v1`]: "keepme1234567890",
    });
    const result = applySave(storage, { entries: { [`${Y}player-rating`]: "new", [`${Y}pro-year:v1`]: "py" } });
    expect(result).toEqual({ ok: true, written: 2 });
    expect(storage.dump()).toEqual({
      [`${Y}player-rating`]: "new",
      [`${Y}pro-year:v1`]: "py",
      [`${Y}skill-data-anon:v1`]: "keepme1234567890",
    });
  });

  it("容量を超えて書けないときは、置き換える前の記録に戻す", () => {
    const initial = { [`${Y}player-rating`]: "old", [`${Y}ryuo-season`]: "season" };
    const storage = memoryStorage(initial, { limit: 200 });
    const result = applySave(storage, { entries: { [`${Y}relay:v1`]: "x".repeat(500) } });
    expect(result.ok).toBe(false);
    expect(storage.dump()).toEqual(initial);
  });

  it("ファイルの名前に日付を入れる", () => {
    expect(saveFileName(new Date(2026, 10, 1).getTime())).toBe("yacobihime-shogi-20261101.json");
  });
});
