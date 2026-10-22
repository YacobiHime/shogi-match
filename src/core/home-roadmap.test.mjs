import { describe, expect, it } from "vitest";
import {
  ROADMAP_STEPS,
  VOLUME_1_LAST_LESSON,
  VOLUME_2_LAST_LESSON,
  homeRoadmap,
  roadmapTile,
  welcomeChoiceFrom,
} from "./home-roadmap.mjs";
import { TUTORIAL_VOLUMES } from "./tutorial-curriculum.mjs";
import { WELCOME_SEEN_KEY, markWelcomeSeen } from "./welcome.mjs";

const cleared = (...ids) => ({ lessons: Object.fromEntries(ids.map((id) => [id, { status: "cleared", stars: 3 }])) });

describe("ホームの強くなる道", () => {
  it("巻の終わりの判定に使うレッスンは、第1巻・第2巻の最後のレッスン", () => {
    const last = (volume) => volume.chapters.at(-1).lessons.at(-1).id;
    expect(last(TUTORIAL_VOLUMES[0])).toBe(VOLUME_1_LAST_LESSON);
    expect(last(TUTORIAL_VOLUMES[1])).toBe(VOLUME_2_LAST_LESSON);
  });

  it("はじめての人は1段目から、記録に合わせて段が進む", () => {
    expect(homeRoadmap().current).toBe(1);
    expect(homeRoadmap({ tutorialProgress: cleared(VOLUME_1_LAST_LESSON) }).current).toBe(2);
    expect(homeRoadmap({ tutorialProgress: cleared(VOLUME_1_LAST_LESSON), ratedGames: 1 }).current).toBe(3);
    expect(homeRoadmap({ ratedGames: 1, problemsSolved: 10, tutorialProgress: cleared(VOLUME_1_LAST_LESSON) }).current).toBe(4);
    const last = homeRoadmap({ ratedGames: 5, problemsSolved: 0, tutorialProgress: cleared(VOLUME_2_LAST_LESSON), ryuoPlayed: true });
    expect(last.current).toBe(5);
    expect(last.steps.map(({ done }) => done)).toEqual([true, true, true, true, false]);
    expect(last.steps.filter(({ current }) => current)).toHaveLength(1);
  });

  it("後の段を終えていれば、前の段も終えたことにする", () => {
    // 教室を通らずに竜王戦に出た人も、最後の段にいる。
    expect(homeRoadmap({ ryuoPlayed: true }).current).toBe(5);
    expect(homeRoadmap({ ratedGames: 3 }).current).toBe(3);
  });

  it("はじめての案内で選んだ道から始める", () => {
    expect(homeRoadmap({ welcomeChoice: "beginner" }).current).toBe(1);
    expect(homeRoadmap({ welcomeChoice: "rules" }).current).toBe(2);
    expect(homeRoadmap({ welcomeChoice: "player" }).current).toBe(2);
    expect(homeRoadmap({ welcomeChoice: "player", ratedGames: 1 }).current).toBe(4);
    // 少し指せる: 駒を覚える段は終え、測ったら初めての対局の段も終える(詰みは、ここから覚える)。
    expect(homeRoadmap({ welcomeChoice: "some" }).current).toBe(2);
    expect(homeRoadmap({ welcomeChoice: "some", measured: true }).current).toBe(3);
    // よく指している: 測ったら詰みの段まで終え、竜王戦へ。
    expect(homeRoadmap({ welcomeChoice: "player", measured: true }).current).toBe(4);
    // 案内なしで測っただけでは、段を飛ばさない。
    expect(homeRoadmap({ measured: true }).current).toBe(1);
  });

  it("2つ以上先の段の入口だけを薄くし、鍵はかけない", () => {
    expect(roadmapTile("tutorial", 1)).toEqual({ dim: false, recommended: true, after: "" });
    expect(roadmapTile("match", 1).dim).toBe(false);
    expect(roadmapTile("problems", 1)).toEqual({ dim: true, recommended: false, after: ROADMAP_STEPS[1].after });
    expect(roadmapTile("tournament", 2)).toEqual({ dim: true, recommended: false, after: ROADMAP_STEPS[2].after });
    expect(roadmapTile("problems", 1).after).toBe("1局指したら");
    expect(roadmapTile("tournament", 3).dim).toBe(false);
    expect(roadmapTile("tournament", 4).recommended).toBe(true);
    expect(roadmapTile("endgame", 5).recommended).toBe(true);
    expect(roadmapTile("dex", 1)).toEqual({ dim: false, recommended: false, after: "" });
  });

  it("はじめての案内で選んだ道を読む", () => {
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    expect(welcomeChoiceFrom(storage, WELCOME_SEEN_KEY)).toBe("");
    markWelcomeSeen(storage, "rules", 1);
    expect(welcomeChoiceFrom(storage, WELCOME_SEEN_KEY)).toBe("rules");
    expect(welcomeChoiceFrom({ getItem: () => "{" }, WELCOME_SEEN_KEY)).toBe("");
  });
});
