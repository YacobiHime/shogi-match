import { describe, expect, it } from "vitest";
import {
  ALL_OPENING_PLANS,
  OPENING_CASTLE_PLANS,
  OPENING_PLANS,
  OPENING_PLAN_GROUPS,
  OPENING_PLAN_LESSONS,
  OPENING_PLAN_TIERS,
  OPENING_STYLE_LABELS,
  openingPlanById,
  openingPlanFor,
} from "./opening-catalog.mjs";
import { OPENING_CASTLES, OPENING_STRATEGIES, isStandaloneOpening } from "./opening-guide.mjs";
import { openingExplanation } from "./opening-explanations.mjs";
import { buildFormationStart } from "./learning-setup.mjs";
import { TUTORIAL_VOLUMES } from "./tutorial-curriculum.mjs";

const strategyIds = new Set(OPENING_STRATEGIES.map(({ id }) => id));
const castleIds = new Set(OPENING_CASTLES.map(({ id }) => id));

describe("作戦カードの目録", () => {
  it("すべての戦法・囲いのidがやこび姫補助の定義にある", () => {
    for (const plan of ALL_OPENING_PLANS) {
      if (plan.strategyId) expect(strategyIds.has(plan.strategyId), plan.id).toBe(true);
      for (const castleId of plan.castles) expect(castleIds.has(castleId), `${plan.id}:${castleId}`).toBe(true);
    }
  });

  it("idは重ならず、群・段・札・難しさがそろっている", () => {
    const ids = ALL_OPENING_PLANS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(OPENING_PLAN_GROUPS.map(({ id }) => id));
    const tiers = new Set(OPENING_PLAN_TIERS.map(({ id }) => id));
    for (const plan of ALL_OPENING_PLANS) {
      expect(groups.has(plan.group), plan.id).toBe(true);
      expect(tiers.has(plan.tier), plan.id).toBe(true);
      expect(OPENING_STYLE_LABELS[plan.style], plan.id).toBeTruthy();
      expect([1, 2, 3]).toContain(plan.difficulty);
    }
  });

  it("入門の作戦は棒銀・四間飛車・中飛車の3枚", () => {
    expect(OPENING_PLANS.filter(({ tier }) => tier === "entry").map(({ id }) => id).sort())
      .toEqual(["bougin", "nakabisha", "shiken"]);
  });

  it("カードに一言を出せる（解説の一言か、カードに書いた一言）", () => {
    for (const plan of ALL_OPENING_PLANS) {
      const text = plan.catch ?? openingExplanation(plan.strategyId || plan.castles[0])?.overview;
      expect(text, plan.id).toBeTruthy();
    }
  });

  it("戦法と一体の囲いを持つ戦法には、囲いを組み合わせない", () => {
    for (const plan of OPENING_PLANS) {
      if (isStandaloneOpening(plan.strategyId, "strategy")) expect(plan.castles, plan.id).toEqual([]);
    }
    for (const plan of OPENING_CASTLE_PLANS) {
      expect(isStandaloneOpening(plan.castles[0], "castle"), plan.id).toBe(false);
    }
  });

  it("教室の練習レッスンは、教室の第4巻にある", () => {
    const lessonIds = new Set(TUTORIAL_VOLUMES.flatMap((volume) => volume.chapters.flatMap((chapter) => chapter.lessons.map(({ id }) => id))));
    for (const [planId, lessonId] of Object.entries(OPENING_PLAN_LESSONS)) {
      expect(openingPlanById(planId), planId).toBeTruthy();
      expect(lessonIds.has(lessonId), lessonId).toBe(true);
    }
  });

  it("戦法と囲いの組から、近いカードを引ける", () => {
    expect(openingPlanFor("shiken", "mino")?.id).toBe("shiken");
    expect(openingPlanFor("ibisha", "yagura")?.id).toBe("yagura");
    expect(openingPlanFor("ibisha", "funagakoi")?.id).toBe("ibisha");
    expect(openingPlanFor("", "mino")?.id).toBe("castle:mino");
    expect(openingPlanFor("", "")).toBeNull();
  });

  // 相手の応手しだいの戦法(戦法だけでも完成局面まで指し進められないもの)は、組も確かめられないため除く。
  // パックマンは相手が歩を取るかで成否が決まり、待つだけの相手では囲いまで進めない。
  it("合う囲いの組は、先手・後手で完成局面まで指せる", () => {
    let checked = 0;
    for (const color of ["black", "white"]) {
      for (const plan of OPENING_PLANS) {
        if (!plan.castles.length || plan.id === "pacman") continue;
        if (!buildFormationStart({ [color]: { strategyId: plan.strategyId, castleId: "" } }).ok) continue;
        for (const castleId of plan.castles) {
          const result = buildFormationStart({ [color]: { strategyId: plan.strategyId, castleId } });
          expect(result.ok, `${color} ${plan.id}+${castleId}: ${result.message ?? ""}`).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(60);
  }, 120_000);

  it("囲いだけのカードは、先手・後手で完成局面まで指せる", () => {
    for (const color of ["black", "white"]) {
      for (const plan of OPENING_CASTLE_PLANS) {
        const result = buildFormationStart({ [color]: { strategyId: "", castleId: plan.castles[0] } });
        expect(result.ok, `${color} ${plan.id}: ${result.message ?? ""}`).toBe(true);
      }
    }
  }, 120_000);
});
