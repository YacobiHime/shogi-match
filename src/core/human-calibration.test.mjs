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
  it("申告の表示名をLvにする。同じ表示名が複数あるときは真ん中", () => {
    expect(nominalLevel("10級")).toBe(15);
    // 段級位の作り直し(2026-10-22)の前の名前も読む。
    expect(nominalLevel("十級")).toBe(15);
    expect(nominalLevel("五級")).toBe(20);
    expect(nominalLevel("二十級")).toBe(5);
    expect(nominalLevel("アマ初段")).toBe(26);
    expect(nominalLevel("アマ初段程度")).toBe(26);
    expect(nominalLevel("アマ七段")).toBe(43.5);
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

  it("Lv差約6.7(R400)でオッズ10倍のモデルに合う", () => {
    // Lv15に10勝1敗なら、勝率50%のLvは15 + 400/60。
    expect(estimateEvenLevel([{ level: 15, wins: 10, losses: 1, draws: 0 }]).theta).toBeCloseTo(15 + 400 / 60, 6);
  });

  it("全勝・全敗は範囲の端で止める", () => {
    expect(estimateEvenLevel([{ level: 10, wins: 5, losses: 0, draws: 0 }])).toMatchObject({ theta: 60, bounded: true });
    expect(estimateEvenLevel([{ level: 10, wins: 0, losses: 5, draws: 0 }])).toMatchObject({ theta: -10, bounded: true });
    expect(estimateEvenLevel([])).toBeNull();
  });

  it("対局が足りないか誤差の内なら判断せず、はっきりずれたら強い・弱いと言う", () => {
    const report = calibrationReport([
      {
        declaredLevels: {
          // 10級の人が、10級(Lv15)のCPUに40勝10敗: 表示名のLvは表示より弱い。
          '10級': { 15: { wins: 40, losses: 10, draws: 0 } },
          // 3級の人が、3級(Lv22)のまわりで互角。
          '3級': { 21: { wins: 15, losses: 13, draws: 2 }, 23: { wins: 13, losses: 15, draws: 2 } },
          // 1級の人が、1級(Lv24)のCPUに2勝8敗: 対局が少ない。
          '1級': { 24: { wins: 2, losses: 8, draws: 0 } },
        },
      },
    ]);
    expect(report.map((row) => row.label)).toEqual(["10級", "3級", "1級"]);
    const [tenKyu, sanKyu, ikkyu] = report;
    expect(tenKyu.verdict).toBe("表示名より弱い");
    expect(tenKyu.offset).toBeGreaterThan(0);
    expect(sanKyu.verdict).toBe("表示名どおり");
    expect(ikkyu.verdict).toBe("判断できない");
    expect(ikkyu.offset).toBeLessThan(0);
  });

  it("報告をMarkdownの表にする", () => {
    const text = formatCalibrationReport(calibrationReport([
      { declaredLevels: { '10級': { 15: { wins: 40, losses: 10, draws: 0 } }, '1級': { 24: { wins: 3, losses: 0, draws: 0 } } } },
    ]));
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/^\| 申告 \|/);
    expect(lines).toHaveLength(4);
    expect(lines[2]).toMatch(/^\| 10級 \| 15\.0 \| 50 \| 19\.0 \|.*\| \+4\.0 \| 表示名より弱い \|$/);
    expect(lines[3]).toMatch(/^\| 1級 \| 24\.0 \| 3 \| ≧60\.0 \|/);
  });
});
