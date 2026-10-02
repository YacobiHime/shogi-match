import { describe, expect, it } from "vitest";
import { referenceDexEntries, referenceEntryKifu } from "./reference-dex.mjs";
import {
  KIFU_ANALYSIS_LEVELS,
  analysisComment,
  analysisHighlights,
  findTurningPoint,
  formatAnalysisMove,
  formatNodeCount,
  formatPrincipalVariation,
  kifuAnalysisBudget,
  kifuAnalysisPlan,
} from "./reference-kifu-analysis.mjs";
import { STAGED_ANALYSIS_PLANS } from "./kifu-analysis-pipeline.mjs";
import { getStrengthSearchSettings } from "./strength-settings.mjs";
import { STANDARD_SFEN } from "../game-state";

const koyama = referenceEntryKifu(referenceDexEntries("world").find(({ id }) => id === "koyama"));

describe("reference kifu analysis", () => {
  it("formats the best move and principal variation with turn marks", () => {
    expect(formatAnalysisMove("7g7f", STANDARD_SFEN)).toBe("▲7六歩");
    expect(formatPrincipalVariation(["7g7f", "3c3d", "8h2b+"], STANDARD_SFEN)).toBe("▲7六歩 → △3四歩 → ▲2二角成");
    // 指せない手が出たら、そこまでで打ち切る。
    expect(formatPrincipalVariation(["7g7f", "7g7f"], STANDARD_SFEN)).toBe("▲7六歩");
  });

  it("finds the turning point after which the winner keeps the lead to the end", () => {
    const points = [0, 300, 700, 200, 600, 900, 1200].map((graphValue, ply) => ({ ply, graphValue }));
    // 700で一度優勢になっても200へ戻ったので、600から先を分かれ目にする。
    expect(findTurningPoint(points, "black")).toBe(4);
    expect(findTurningPoint(points, "white")).toBeNull();
    expect(findTurningPoint(points, "")).toBeNull();
    // 勝った側の優勢をAIが最後まで認めないときは、分かれ目を出さない。
    expect(findTurningPoint(points.map((point) => ({ ...point, graphValue: -point.graphValue })), "black")).toBeNull();
  });

  it("picks the turning point and the clearest good moves as highlights", () => {
    const good = (ply, kind, bestGap) => ({ ply, graphValue: 800, annotation: { kind, label: kind === "good" ? "好手" : "神の一手", mover: "black", bestGap } });
    const points = [
      { ply: 0, graphValue: 0, annotation: null },
      good(1, "good", 400),
      good(2, "brilliant", 1500),
      good(3, "good", 360),
      good(4, "good", 900),
      { ply: 5, graphValue: 900, annotation: { kind: "mistake", label: "悪手", mover: "white" } },
    ];
    expect(analysisHighlights(points, "black")).toEqual([
      { ply: 1, label: "形勢の分かれ目" },
      { ply: 2, label: "神の一手" },
      { ply: 4, label: "好手" },
    ]);
  });

  it("lets Yakobihime explain the turning point and the judged moves", () => {
    const names = { black: "小山怜央 アマ", white: "横山友紀 四段" };
    const point = { ply: 45, annotation: { kind: "mistake", label: "悪手", mover: "white" } };
    expect(analysisComment(point, { moveLabel: "△３五歩", names })).toBe("AIの見立てでは、横山友紀 四段の△３五歩は「悪手」。ここで形勢が大きく動いたよ。");
    expect(analysisComment({ ply: 45, annotation: null }, { moveLabel: "▲４五桂", names, winner: "black", turningPly: 45 }))
      .toContain("この▲４五桂から小山怜央 アマがはっきり優勢");
    expect(analysisComment({ ply: 3, annotation: null }, { moveLabel: "▲２五歩", names })).toBe("");
    expect(analysisComment({ ply: 0, annotation: null }, {})).toBe("");
  });

  it("deepens the analysis in three levels up to the Fujii Sota level search", () => {
    expect(KIFU_ANALYSIS_LEVELS.map(({ label }) => label)).toEqual(["標準", "深い", "藤井聡太並み"]);
    const nodes = KIFU_ANALYSIS_LEVELS.map((_, level) => kifuAnalysisBudget(level).nodes);
    expect(nodes).toEqual([...nodes].sort((left, right) => left - right));
    // いちばん深い段は、CPUの「藤井聡太並み」と同じ探索量。
    expect(nodes.at(-1)).toBe(getStrengthSearchSettings(480000).nodes);
    // スマホでは標準だけ軽くし、時間の上限は長めに取る。
    expect(kifuAnalysisBudget(0, true).nodes).toBeLessThan(kifuAnalysisBudget(0).nodes);
    expect(kifuAnalysisBudget(2, true).maxTimeMs).toBeGreaterThan(kifuAnalysisBudget(2).maxTimeMs);
    expect(kifuAnalysisBudget(9)).toEqual(kifuAnalysisBudget(2));
    // 標準は対局後の解析と同じ段階解析で、深い段ほど読み直し・深読みの探索量も増やす。
    expect(kifuAnalysisPlan(0)).toBe(STAGED_ANALYSIS_PLANS.desktop);
    expect(kifuAnalysisPlan(0, true)).toBe(STAGED_ANALYSIS_PLANS.mobile);
    const plans = KIFU_ANALYSIS_LEVELS.map((_, level) => kifuAnalysisPlan(level));
    for (const stage of ["scan", "review", "focus"]) {
      const stageNodes = plans.map((plan) => plan[stage].nodes);
      expect(stageNodes, stage).toEqual([...stageNodes].sort((left, right) => left - right));
    }
    expect(kifuAnalysisPlan(2).scan).toMatchObject({ nodes: 720000, multiPv: 2 });
    expect(kifuAnalysisPlan(2).review.lossThreshold).toBe(STAGED_ANALYSIS_PLANS.desktop.review.lossThreshold);
    expect(formatNodeCount(12000)).toBe("1.2万");
    expect(formatNodeCount(480000)).toBe("48万");
    expect(formatNodeCount(600)).toBe("600");
  });
});
