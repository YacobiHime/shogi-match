import { describe, expect, it } from "vitest";
import { ALL_OPENING_PLANS, openingPlanById } from "./opening-catalog.mjs";
import {
  ADVANCED_UNLOCK_BASIC_PLANS,
  OPENING_PLANS_ALL_KEY,
  OPENING_PLANS_SEEN_KEY,
  recommendPlan,
  loadSeenPlans,
  loadShowAllPlans,
  newlyUnlockedPlans,
  openingUnlocks,
  planCompletedCount,
  saveSeenPlans,
  saveShowAllPlans,
} from "./opening-unlocks.mjs";

const done = (...labels) => Object.fromEntries(labels.map((label) => [label, { count: 1 }]));
const tierIds = (unlocks, tier) => ALL_OPENING_PLANS.filter((plan) => plan.tier === tier).map(({ id }) => id)
  .filter((id) => unlocks.unlocked.has(id));
const memoryStorage = () => {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
};

describe("作戦カードの解放", () => {
  it("はじめは入門の3枚だけが使える", () => {
    const unlocks = openingUnlocks();
    expect(unlocks.all).toBe(false);
    expect([...unlocks.unlocked].sort()).toEqual(["bougin", "nakabisha", "shiken"]);
    expect(unlocks.condition("bougin")).toBe("");
    expect(unlocks.condition("sangen")).toContain("入門の作戦");
    expect(unlocks.condition("sangen")).toContain("教室の第4巻");
    expect(unlocks.condition("gokigen")).toContain(`${ADVANCED_UNLOCK_BASIC_PLANS}種類`);
    expect(unlocks.condition("onigoroshi")).toContain("竜王戦");
  });

  it("入門の作戦を完成させると基本が、基本を2種類完成させると応用が開く", () => {
    const basic = openingUnlocks({ formations: done("ノーマル四間飛車") });
    expect(tierIds(basic, "basic").length).toBe(ALL_OPENING_PLANS.filter(({ tier }) => tier === "basic").length);
    expect(tierIds(basic, "advanced")).toEqual([]);
    const one = openingUnlocks({ formations: done("ノーマル四間飛車", "ノーマル三間飛車") });
    expect(tierIds(one, "advanced")).toEqual([]);
    const two = openingUnlocks({ formations: done("ノーマル四間飛車", "ノーマル三間飛車", "金矢倉") });
    expect(two.unlocked.has("gokigen")).toBe(true);
    expect(two.unlocked.has("castle:mino")).toBe(true);
    expect(two.unlocked.has("onigoroshi")).toBe(false);
  });

  it("矢倉のカードは囲いの名前で、ほかの戦法のカードは戦法の名前で数える", () => {
    const formations = done("金矢倉");
    expect(planCompletedCount(openingPlanById("yagura"), formations)).toBe(1);
    expect(planCompletedCount(openingPlanById("ibisha"), formations)).toBe(0);
    expect(planCompletedCount(openingPlanById("castle:yagura"), formations)).toBe(1);
  });

  it("竜王戦に出るとびっくり作戦が開く", () => {
    const unlocks = openingUnlocks({ ryuoPlayed: true });
    expect(tierIds(unlocks, "surprise").length).toBe(ALL_OPENING_PLANS.filter(({ tier }) => tier === "surprise").length);
  });

  it("教室の第4巻で練習した戦法は、その戦法だけ使える", () => {
    const unlocks = openingUnlocks({ tutorialProgress: { lessons: { "v4-sangen": { status: "cleared" } } } });
    expect(unlocks.unlocked.has("sangen")).toBe(true);
    expect(unlocks.unlocked.has("mukai")).toBe(false);
  });

  it("完成させた作戦と、占いで出た作戦は、段が開いていなくても使える", () => {
    expect(openingUnlocks({ formations: done("ゴキゲン中飛車") }).unlocked.has("gokigen")).toBe(true);
    expect(openingUnlocks({ extraIds: ["mukai"] }).unlocked.has("mukai")).toBe(true);
  });

  it("慣れた人(案内で「ふだん指している」・初段相当以上・スイッチ)は全部使える", () => {
    for (const records of [{ welcomeChoice: "player" }, { strong: true }, { showAll: true }]) {
      const unlocks = openingUnlocks(records);
      expect(unlocks.all).toBe(true);
      expect(unlocks.unlocked.size).toBe(ALL_OPENING_PLANS.length);
      expect(unlocks.condition("onigoroshi")).toBe("");
    }
  });

  it("新しく使えるようになった作戦を見つける", () => {
    const before = openingUnlocks();
    const after = openingUnlocks({ formations: done("棒銀") });
    const added = newlyUnlockedPlans(before, after).map(({ id }) => id);
    expect(added).toContain("hayaguri-gin");
    expect(added).not.toContain("bougin");
  });
});

describe("やこび姫のおすすめ", () => {
  const plans = ALL_OPENING_PLANS;

  it("囲いだけとびっくり作戦は選ばず、やさしい作戦を勧める", () => {
    const picked = recommendPlan({ plans });
    expect(["castle", "surprise"]).not.toContain(picked.group);
    expect(picked.difficulty).toBe(1);
  });

  it("何度聞いても同じ作戦を勧める(押すたびに変わらない)", () => {
    const first = recommendPlan({ plans });
    for (let index = 0; index < 5; index += 1) expect(recommendPlan({ plans }).id).toBe(first.id);
  });

  it("相手が振り飛車なら居飛車の作戦から選ぶ", () => {
    expect(recommendPlan({ plans, opponentRanging: true }).group).toBe("static");
  });

  it("まだ完成させたことのない作戦を選ぶ", () => {
    const entry = plans.filter(({ tier }) => tier === "entry");
    const formations = done("棒銀", "ノーマル四間飛車");
    expect(recommendPlan({ plans: entry, formations }).id).toBe("nakabisha");
  });

  it("同じやさしさなら目録の順で選び、局面からの近さでは変えない(対局準備と対局中でそろえる)", () => {
    const entry = plans.filter(({ tier }) => tier === "entry");
    const first = recommendPlan({ plans: entry });
    expect(first.id).toBe(entry.filter(({ group, difficulty }) => group !== "castle" && group !== "surprise" && difficulty === first.difficulty)[0].id);
    // 前の作戦が今の局面から組めなければ(渡されなければ)、次の作戦にする。
    expect(recommendPlan({ plans: entry.filter(({ id }) => id !== first.id) }).id).not.toBe(first.id);
  });

  it("選べる作戦がなければnull", () => {
    expect(recommendPlan({ plans: [] })).toBeNull();
  });
});

describe("作戦カードの保存", () => {
  it("スイッチと見た作戦を保存して読み戻す", () => {
    const storage = memoryStorage();
    expect(loadShowAllPlans(storage)).toBe(false);
    saveShowAllPlans(storage, true);
    expect(storage.getItem(OPENING_PLANS_ALL_KEY)).toBe("on");
    expect(loadShowAllPlans(storage)).toBe(true);
    expect(loadSeenPlans(storage)).toBeNull();
    saveSeenPlans(storage, new Set(["bougin", "shiken"]));
    expect(JSON.parse(storage.getItem(OPENING_PLANS_SEEN_KEY))).toEqual(["bougin", "shiken"]);
    expect([...loadSeenPlans(storage)]).toEqual(["bougin", "shiken"]);
  });

  it("読めない保存でも止まらない", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadShowAllPlans(broken)).toBe(false);
    expect(loadSeenPlans(broken)).toBeNull();
    expect(() => saveShowAllPlans(broken, true)).not.toThrow();
    expect(() => saveSeenPlans(broken, ["bougin"])).not.toThrow();
    expect(loadSeenPlans({ getItem: () => "{oops" })).toBeNull();
  });
});
