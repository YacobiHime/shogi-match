import { describe, expect, it } from "vitest";
import { declarableGrades } from "./player-rating.mjs";
import {
  aggregateDeclaredResults,
  calibrationReport,
  estimateEvenLevel,
  formatCalibrationReport,
  nominalLevel,
} from "./human-calibration.mjs";

describe("表示名のずれの推定", () => {
  it("申告の表示名をLvにする。同じ表示名が2つあるときは真ん中", () => {
    expect(nominalLevel("十級")).toBe(17);
    expect(nominalLevel("五級")).toBe(22.5);
    expect(nominalLevel("アマ初段")).toBe(32);
    expect(nominalLevel("アマ初段程度")).toBe(32);
    expect(nominalLevel("名人")).toBeNull();
    // やこびノートで申告できる段級位は、すべてLvに直せる。
    for (const { label } of declarableGrades()) expect(nominalLevel(label), label).not.toBeNull();
  });

  it("何人分の戦績も申告ごと・Lvごとに足し、対局のない行は捨てる", () => {
    const rows = aggregateDeclaredResults([
      { declaredLevels: { 三級: { 26: { wins: 2, losses: 1, draws: 0 }, 27: { wins: 0, losses: 0, draws: 0 } } } },
      { declaredLevels: { 三級: { 26: { wins: 1, losses: 1, draws: 1 } }, 十級: { x: { wins: 1 } } } },
      null,
    ]);
    expect(rows).toEqual([{ label: "三級", levels: [{ level: 26, wins: 3, losses: 2, draws: 1 }] }]);
  });

  it("勝ち負けが半々のLvを、勝率50%のLvと推定する", () => {
    const estimate = estimateEvenLevel([{ level: 20, wins: 10, losses: 10, draws: 0 }]);
    expect(estimate.theta).toBeCloseTo(20, 6);
    expect(estimate.bounded).toBe(false);
    expect(estimate.games).toBe(20);
    expect(estimate.standardError).toBeGreaterThan(0);
  });

  it("Lv差5でオッズ10倍のモデルに合う", () => {
    // Lv15に10勝1敗なら、勝率50%のLvは15 + 5 = 20。
    expect(estimateEvenLevel([{ level: 15, wins: 10, losses: 1, draws: 0 }]).theta).toBeCloseTo(20, 6);
  });

  it("全勝・全敗は範囲の端で止める", () => {
    expect(estimateEvenLevel([{ level: 10, wins: 5, losses: 0, draws: 0 }])).toMatchObject({ theta: 50, bounded: true });
    expect(estimateEvenLevel([{ level: 10, wins: 0, losses: 5, draws: 0 }])).toMatchObject({ theta: -10, bounded: true });
    expect(estimateEvenLevel([])).toBeNull();
  });

  it("対局が足りないか誤差の内なら判断せず、はっきりずれたら強い・弱いと言う", () => {
    const report = calibrationReport([
      {
        declaredLevels: {
          // 十級の人が、十級(Lv17)のCPUに40勝10敗: 表示名のLvは表示より弱い。
          十級: { 17: { wins: 40, losses: 10, draws: 0 } },
          // 三級の人が、三級(Lv26.5)付近で互角。
          三級: { 26: { wins: 15, losses: 13, draws: 2 }, 27: { wins: 13, losses: 15, draws: 2 } },
          // 一級の人が、一級のCPUに2勝8敗: 対局が少ない。
          一級: { 30: { wins: 2, losses: 8, draws: 0 } },
        },
      },
    ]);
    expect(report.map((row) => row.label)).toEqual(["十級", "三級", "一級"]);
    const [tenKyu, sanKyu, ikkyu] = report;
    expect(tenKyu.verdict).toBe("表示名より弱い");
    expect(tenKyu.offset).toBeGreaterThan(0);
    expect(sanKyu.verdict).toBe("表示名どおり");
    expect(ikkyu.verdict).toBe("判断できない");
    expect(ikkyu.offset).toBeLessThan(0);
  });

  it("報告をMarkdownの表にする", () => {
    const text = formatCalibrationReport(calibrationReport([
      { declaredLevels: { 十級: { 17: { wins: 40, losses: 10, draws: 0 } }, 一級: { 30: { wins: 3, losses: 0, draws: 0 } } } },
    ]));
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/^\| 申告 \|/);
    expect(lines).toHaveLength(4);
    expect(lines[2]).toMatch(/^\| 十級 \| 17\.0 \| 50 \| 20\.0 \|.*\| \+3\.0 \| 表示名より弱い \|$/);
    expect(lines[3]).toMatch(/^\| 一級 \| 30\.5 \| 3 \| ≧50\.0 \|/);
  });
});
