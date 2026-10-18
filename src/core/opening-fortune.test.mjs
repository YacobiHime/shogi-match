import { describe, expect, it } from "vitest";
import {
  FORTUNE_NODES,
  FORTUNE_PLAN_IDS,
  FORTUNE_RESULTS,
  OPENING_FORTUNE_KEY,
  fortuneLayout,
  loadFortunePlans,
  recordFortunePlan,
  walkFortune,
} from "./opening-fortune.mjs";
import { openingPlanById } from "./opening-catalog.mjs";
import { openingUnlocks } from "./opening-unlocks.mjs";

/** すべての答え方(0と1の並び)を、結果に着くまでたどる。 */
function allPaths(prefix = []) {
  const walked = walkFortune(prefix);
  if (walked.result) return [{ answers: prefix, ...walked }];
  if (!walked.node) return [];
  return [0, 1].flatMap((index) => allPaths([...prefix, index]));
}

describe("戦法占い", () => {
  it("すべての道が8つの作戦のどれかに着き、8つすべてにたどり着ける", () => {
    const paths = allPaths();
    expect(paths).toHaveLength(8);
    expect(paths.map(({ result }) => result).sort()).toEqual([...FORTUNE_PLAN_IDS].sort());
  });

  it("どの道も3問で終わる", () => {
    for (const { answers, path } of allPaths()) {
      expect(answers).toHaveLength(3);
      expect(path).toHaveLength(3);
    }
  });

  it("結果は作戦カードにあり、やこび姫の一言がある", () => {
    for (const planId of FORTUNE_PLAN_IDS) {
      expect(openingPlanById(planId), planId).toBeTruthy();
      expect(FORTUNE_RESULTS[planId]?.type, planId).toMatch(/タイプ$/);
      expect(FORTUNE_RESULTS[planId]?.line, planId).toBeTruthy();
    }
  });

  it("答えの言葉は、はい・いいえではなく、選んだ中身が分かる", () => {
    for (const node of Object.values(FORTUNE_NODES)) {
      for (const answer of node.answers) expect(answer.label).not.toMatch(/^(はい|いいえ)$/);
    }
  });

  it("答えの途中では、次の質問と、ここまでの道を返す", () => {
    const start = walkFortune();
    expect(start.node?.id).toBe("rook");
    expect(start.path).toEqual([]);
    const second = walkFortune([0]);
    expect(second.node?.id).toBe("ranging");
    expect(second.path[0]).toMatchObject({ nodeId: "rook", index: 0, answer: "動かしてみたい！" });
    expect(walkFortune([0, 0, 0]).result).toBe("shiken");
    expect(walkFortune([1, 1, 0]).result).toBe("yagura");
  });

  it("木の図は、結果を左から右へ並べ、質問を子の真ん中に置く", () => {
    const layout = fortuneLayout();
    expect(layout.leaves.map(({ x }) => x)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(layout.depth).toBe(3);
    const root = layout.nodes.find(({ id }) => id === "rook");
    expect(root).toMatchObject({ depth: 0, x: 3.5 });
    expect(layout.edges).toHaveLength(Object.keys(FORTUNE_NODES).length - 1);
  });

  it("占いで出た作戦を残し、まだ使えない段でも使えるようにする", () => {
    const map = new Map();
    const storage = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
    expect(loadFortunePlans(storage)).toEqual([]);
    recordFortunePlan(storage, "mukai");
    recordFortunePlan(storage, "mukai");
    expect(recordFortunePlan(storage, "sangen")).toEqual(["mukai", "sangen"]);
    expect(JSON.parse(map.get(OPENING_FORTUNE_KEY)).last).toBe("sangen");
    const unlocks = openingUnlocks({ extraIds: loadFortunePlans(storage) });
    expect(unlocks.unlocked.has("mukai")).toBe(true);
    expect(unlocks.unlocked.has("hayaguri-gin")).toBe(false);
    expect(loadFortunePlans({ getItem: () => "{oops" })).toEqual([]);
    expect(() => recordFortunePlan({ getItem: () => null, setItem: () => { throw new Error("full"); } }, "yagura")).not.toThrow();
  });
});
