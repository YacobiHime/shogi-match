import { describe, expect, it } from "vitest";
import { PROFILE_STORAGE_KEY } from "./player-profile.mjs";
import { RATING_STORAGE_KEY } from "./player-rating.mjs";
import { PROBLEM_PROGRESS_KEY } from "./problem-set.mjs";
import { CAREER_STORAGE_KEY, SEASON_STORAGE_KEY } from "./ryuo-career.mjs";
import { ROSTER_STORAGE_KEY } from "./ryuo-roster.mjs";
import { TUTORIAL_PROGRESS_KEY } from "./tutorial-progress.mjs";
import { matchSnapshotKey } from "./match-persistence.mjs";
import { WELCOME_CHOICES, WELCOME_MEASURE_CHOICES, WELCOME_MEASURE_LEVEL, WELCOME_SEEN_KEY, markWelcomeSeen, shouldShowWelcome } from "./welcome.mjs";

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

describe("はじめての案内", () => {
  it("何も記録のない端末では案内し、閉じたら二度と出さない", () => {
    const storage = memoryStorage();
    expect(shouldShowWelcome(storage)).toBe(true);
    markWelcomeSeen(storage, "beginner", 1);
    expect(shouldShowWelcome(storage)).toBe(false);
    expect(JSON.parse(storage.getItem(WELCOME_SEEN_KEY))).toEqual({ choice: "beginner", at: 1 });
  });

  it("このアプリの記録が1つでもある端末(案内を作る前から遊んでいる人)には出さない", () => {
    for (const key of [
      TUTORIAL_PROGRESS_KEY,
      PROBLEM_PROGRESS_KEY,
      RATING_STORAGE_KEY,
      PROFILE_STORAGE_KEY,
      CAREER_STORAGE_KEY,
      SEASON_STORAGE_KEY,
      ROSTER_STORAGE_KEY,
      matchSnapshotKey({ pathname: "/game.html" }),
      "shogi-match-guided-review-speed",
    ]) {
      expect(shouldShowWelcome(memoryStorage({ [key]: "{}" })), key).toBe(false);
    }
  });

  it("端末の設定(音・盤と駒の見た目)だけなら、遊んだ記録に数えない(展示の「最初から」のあとにも案内を出す)", () => {
    expect(shouldShowWelcome(memoryStorage({ "shogi-match-piece-theme": "x", "shogi-match-board-theme": "x", "yacobihime:shogi-match:sound": "off" }))).toBe(true);
    expect(shouldShowWelcome(memoryStorage({ "shogi-match-piece-theme": "x", [RATING_STORAGE_KEY]: "{}" }))).toBe(false);
  });

  it("ほかのアプリの記録は気にしない", () => {
    expect(shouldShowWelcome(memoryStorage({ "other-app": "1" }))).toBe(true);
  });

  it("保存できない環境では出さない", () => {
    expect(shouldShowWelcome(null)).toBe(false);
    const broken = { get length() { throw new Error("denied"); }, getItem: () => { throw new Error("denied"); } };
    expect(shouldShowWelcome(broken)).toBe(false);
  });

  it("はじめて・ルールは分かる・少し指せる・よく指している、の4つを易しい順に並べる(docs/first-play-design.mdの3章)", () => {
    expect(WELCOME_CHOICES.map(({ id }) => id)).toEqual(["beginner", "rules", "some", "player"]);
    expect(WELCOME_CHOICES.map(({ label }) => label)).toEqual(["はじめて", "ルールは分かる", "少し指せる", "よく指している"]);
    // 少し指せる・よく指しているは、1級くらいの相手との棋力測定から。
    expect(WELCOME_MEASURE_CHOICES).toEqual(["some", "player"]);
    expect(WELCOME_MEASURE_LEVEL).toBe(15);
  });
});
