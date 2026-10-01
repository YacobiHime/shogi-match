import { describe, expect, it } from "vitest";
import { referenceDexEntries, referenceEntryKifu } from "./reference-dex.mjs";
import {
  KIFU_ANALYSIS_LEVELS,
  analysisComment,
  analysisHighlights,
  analyzeKifuSteps,
  findTurningPoint,
  formatAnalysisMove,
  formatNodeCount,
  formatPrincipalVariation,
  kifuAnalysisBudget,
  mergeAnalysisPoints,
} from "./reference-kifu-analysis.mjs";
import { STANDARD_SFEN } from "../game-state";

const koyama = referenceEntryKifu(referenceDexEntries("world").find(({ id }) => id === "koyama"));

describe("reference kifu analysis", () => {
  it("turns engine scores into black-side graph points and judges each played move", async () => {
    const steps = koyama.steps.slice(0, 4);
    const searched = [];
    // 手番側から見た評価値を返す。2手目の後だけ後手が大きく損をした形にする。
    const scores = [50, -40, 1000, -900];
    const points = await analyzeKifuSteps({
      steps,
      search: async (sfen, depth) => {
        // 浅い読みは神の一手の判定だけに使うので、ここでは候補を返さない。
        if (depth === "shallow") return { candidates: [] };
        const ply = searched.push(sfen) - 1;
        return {
          candidates: [
            { rank: 1, move: "7g7f", pv: ["7g7f", "3c3d"], score: { type: "cp", value: scores[ply] } },
            { rank: 2, move: "2g2f", pv: ["2g2f"], score: { type: "cp", value: scores[ply] - 10 } },
          ],
        };
      },
    });
    expect(searched).toEqual(steps.map(({ sfen }) => sfen));
    // 後手番の局面は符号を反転し、先手から見た値にそろえる。
    expect(points.map(({ graphValue }) => graphValue)).toEqual([50, 40, 1000, 900]);
    expect(points[0].label).toBe("開始局面");
    expect(points[1].label).toBe("1手目 ▲２六歩");
    expect(points[0].annotation).toBeNull();
    // 先手有利+40から+1000へ変わった2手目（後手の手）は、後手の大きな損として判定する。
    expect(points[2].annotation).toMatchObject({ kind: "mistake", mover: "white" });
  });

  it("marks a best move that the shallow search misses as a god move", async () => {
    const steps = koyama.steps.slice(0, 3);
    const points = await analyzeKifuSteps({
      steps,
      search: async (sfen, depth) => {
        const ply = steps.findIndex((step) => step.sfen === sfen);
        const played = steps[ply + 1]?.lastMove ?? "7g7f";
        // 深い読みでは指した手が最善で、次善手より勝率で約12ポイント良い。浅い読みでは別の手が最善に見える。
        // 評価値は手番側視点なので、形勢が動かないよう局面ごとに±300を返す。
        const best = sfen.split(" ")[1] === "w" ? -300 : 300;
        return depth === "deep"
          ? { candidates: [
            { rank: 1, move: played, pv: [played], score: { type: "cp", value: best } },
            { rank: 2, move: "9g9f", pv: ["9g9f"], score: { type: "cp", value: best - 300 } },
          ] }
          : { candidates: [{ rank: 1, move: "9g9f", score: { type: "cp", value: 100 } }] };
      },
    });
    expect(points[1].annotation).toMatchObject({ kind: "brilliant", label: "神の一手" });
  });

  it("skips positions without a score and stops when cancelled", async () => {
    let calls = 0;
    const points = await analyzeKifuSteps({
      steps: koyama.steps,
      search: async (sfen, depth) => {
        if (depth === "shallow") return { candidates: [] };
        calls += 1;
        return { candidates: calls === 1 ? [] : [{ rank: 1, move: "7g7f", score: { type: "mate", value: 3 } }] };
      },
      isCancelled: () => calls >= 3,
    });
    expect(calls).toBe(3);
    expect(points.map(({ ply }) => ply)).toEqual([1]);
    expect(points[0].scoreLabel).toBe("後手に3手詰め");
    // 前の局面に点がないので、指した手の判定はしない。
    expect(points[0].annotation).toBeNull();
  });

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
    expect(nodes.at(-1)).toBe(480000);
    // スマホでは標準だけ軽くし、時間の上限は長めに取る。
    expect(kifuAnalysisBudget(0, true).nodes).toBeLessThan(kifuAnalysisBudget(0).nodes);
    expect(kifuAnalysisBudget(2, true).maxTimeMs).toBeGreaterThan(kifuAnalysisBudget(2).maxTimeMs);
    expect(kifuAnalysisBudget(9)).toEqual(kifuAnalysisBudget(2));
    expect(formatNodeCount(12000)).toBe("1.2万");
    expect(formatNodeCount(480000)).toBe("48万");
    expect(formatNodeCount(600)).toBe("600");
  });

  it("shows the previous result for positions the deeper analysis has not reached yet", () => {
    const point = (ply, graphValue, annotation = null) => ({ ply, graphValue, annotation });
    const god = (strength) => ({ kind: "brilliant", label: "神の一手", mover: "black", strength });
    const older = [point(0, 0), point(1, 100, god(20)), point(2, 200, god(30)), point(3, 300, god(25)), point(4, 400)];
    // 深く読み直した0〜1手目で、もっと強い神の一手が見つかった。
    const merged = mergeAnalysisPoints([point(0, 10), point(1, 150, god(40))], older);
    expect(merged.map(({ graphValue }) => graphValue)).toEqual([10, 150, 200, 300, 400]);
    expect(merged.filter(({ annotation }) => annotation?.kind === "brilliant").map(({ ply }) => ply)).toEqual([1, 2, 3]);
    // 前の結果が強い神の一手を消した場合も、3手に絞り直す。
    const extra = mergeAnalysisPoints([point(4, 400, god(50))], merged);
    expect(extra.filter(({ annotation }) => annotation?.kind === "brilliant").map(({ ply }) => ply)).toEqual([1, 2, 4]);
  });
});
