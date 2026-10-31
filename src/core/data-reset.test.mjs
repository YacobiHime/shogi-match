import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RESET_GROUPS, isMatchSnapshotKey, resetData, resetGroup } from "./data-reset.mjs";
import { EXHIBIT_KEEP_KEYS } from "./exhibit-reset.mjs";
import { matchSnapshotKey } from "./match-persistence.mjs";

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    keys: () => [...map.keys()].sort(),
  };
}

/**
 * どの種類でも消さない鍵(端末の設定・画面の覚え書き・名前など)。「すべて」でだけ消える(音・見た目はそれでも残る)。
 * 新しい保存の鍵を足したら、どれかの種類か、ここへ入れる(docs/data-reset-design.mdの2章)。
 */
const SETTING_KEYS = new Set([
  "yacobihime:shogi-match:sound", "shogi-match-board-theme", "shogi-match-piece-theme", "shogi-match-analysis-level",
  "shogi-match-check-explained", "shogi-match-guided-review-speed", "shogi-match-opening-book-draft-v1", "shogi-match-opening-book-library-v1",
  "yacobihime:shogi-match:broadcast:v1", "yacobihime:shogi-match:danger-sensor:v1", "yacobihime:shogi-match:material-guide:v1",
  "yacobihime:shogi-match:note-album-page", "yacobihime:shogi-match:note-tab", "yacobihime:shogi-match:opening-plans-all:v1",
  "yacobihime:shogi-match:opening-plans-seen:v1", "yacobihime:shogi-match:plan-ghosts:v1", "yacobihime:shogi-match:tutorial-voice:v1",
  "yacobihime:shogi-match:welcome:v1", "yacobihime:shogi-match:player-name:v1", "yacobihime:shogi-match:player-profile",
  "yacobihime:shogi-match:seen-features:v1", "yacobihime:shogi-match:skill-data-anon:v1", "yacobihime:shogi-match:skill-data-consent:v1",
]);

/** ソースに書かれた保存の鍵(「…_KEY = '…'」の形)。 */
function sourceKeys() {
  const root = new URL("../", import.meta.url);
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
      if (entry.isDirectory()) walk(url);
      else if (/\.(mjs|ts|vue)$/.test(entry.name) && !entry.name.includes(".test.")) files.push(url);
    }
  };
  walk(root);
  const keys = new Set();
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(/const [A-Z_]*KEY[A-Z_]* = ["']((?:yacobihime:shogi-match:|shogi-match:|shogi-match-)[^"']+)["']/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

describe("データリセットの種類(docs/data-reset-design.md)", () => {
  it("ソースの保存の鍵は、どれかの種類か設定に入っている(新しい鍵の入れ忘れを見つける)", () => {
    const grouped = new Set(RESET_GROUPS.flatMap((group) => group.keys));
    const missing = [...sourceKeys()].filter((key) => !grouped.has(key) && !SETTING_KEYS.has(key));
    expect(missing).toEqual([]);
  });

  it("1つの鍵は1つの種類にだけ入り、設定とは重ならない", () => {
    const all = RESET_GROUPS.flatMap((group) => group.keys);
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((key) => SETTING_KEYS.has(key))).toEqual([]);
  });

  it("大会だけ消すと、大会の鍵と大会の中断した対局だけが消え、ほかは残る", () => {
    const tournamentSnapshot = matchSnapshotKey({ pathname: "/game.html", matchId: "" });
    const freeSnapshot = matchSnapshotKey({ pathname: "/other.html", matchId: "" });
    expect(isMatchSnapshotKey(tournamentSnapshot)).toBe(true);
    const storage = memoryStorage({
      "yacobihime:shogi-match:ryuo-season": "{}",
      "yacobihime:shogi-match:ryuo-roster": "{}",
      "yacobihime:shogi-match:awards": "[]",
      "yacobihime:shogi-match:player-rating": "{}",
      [tournamentSnapshot]: JSON.stringify({ ryuoGame: { opponentId: "a" } }),
      [freeSnapshot]: JSON.stringify({ ryuoGame: null }),
    });
    const removed = resetData(storage, "tournament");
    expect(removed.sort()).toEqual(["yacobihime:shogi-match:ryuo-roster", "yacobihime:shogi-match:ryuo-season", tournamentSnapshot].sort());
    expect(storage.keys()).toEqual(["yacobihime:shogi-match:awards", "yacobihime:shogi-match:player-rating", freeSnapshot].sort());
  });

  it("最近の対局・レーティング・問題集はそれぞれの鍵だけ消す", () => {
    const storage = memoryStorage({
      "yacobihime:shogi-match:recent-games:v1": "[]",
      "yacobihime:shogi-match:play-insight:v1": "{}",
      "yacobihime:shogi-match:player-rating": "{}",
      "shogi-match:problem-set:v1": "{}",
    });
    resetData(storage, "recent");
    expect(storage.keys()).toEqual(["shogi-match:problem-set:v1", "yacobihime:shogi-match:player-rating"]);
    resetData(storage, "rating");
    expect(storage.keys()).toEqual(["shogi-match:problem-set:v1"]);
    resetData(storage, "problems");
    expect(storage.keys()).toEqual([]);
  });

  it("すべては展示の「最初から」と同じ(音・盤と駒の見た目は残す)", () => {
    const storage = memoryStorage({
      "yacobihime:shogi-match:player-name:v1": "{}",
      "yacobihime:shogi-match:sound": "on",
      "shogi-match-board-theme": "dark",
      "other-site": "1",
    });
    resetData(storage, "all");
    expect(storage.keys()).toEqual([...EXHIBIT_KEEP_KEYS.filter((key) => key !== "shogi-match-piece-theme"), "other-site"].sort());
  });

  it("種類は「すべて」が最後で、どれも消えるもの・残るものの文がある", () => {
    expect(RESET_GROUPS.at(-1)?.id).toBe("all");
    for (const group of RESET_GROUPS) {
      expect(group.erases.length, group.id).toBeGreaterThan(0);
      expect(group.keeps.length, group.id).toBeGreaterThan(0);
    }
    expect(resetGroup("nothing")).toBeNull();
    expect(resetData(memoryStorage(), "nothing")).toEqual([]);
  });
});
