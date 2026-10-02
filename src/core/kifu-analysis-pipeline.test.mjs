import { describe, expect, it } from "vitest";
import { referenceDexEntries, referenceEntryKifu } from "./reference-dex.mjs";
import {
  STAGED_ANALYSIS_PLANS,
  analysisPointsFromResults,
  analyzeKifuStaged,
  moveFacts,
  selectReviewPlies,
} from "./kifu-analysis-pipeline.mjs";

const koyama = referenceEntryKifu(referenceDexEntries("world").find(({ id }) => id === "koyama"));
const cp = (value) => ({ type: "cp", value });

/** 局面ごとに決めた候補を返す探索関数。呼ばれた局面と探索量を記録する。 */
function fakeLane(steps, candidatesFor, calls) {
  return async (sfen, options) => {
    const ply = steps.findIndex((step) => step.sfen === sfen);
    calls.push({ ply, ...options });
    return { candidates: candidatesFor(ply, options) };
  };
}

describe("staged kifu analysis", () => {
  it("reads every position once in the scan with MultiPV 2, from the end of each lane's range", async () => {
    const steps = koyama.steps.slice(0, 9);
    const calls = [];
    const candidates = (ply) => [{ rank: 1, move: "1a1b", score: cp(ply % 2 ? -30 : 30) }];
    const lanes = [fakeLane(steps, candidates, calls), fakeLane(steps, candidates, calls)];
    const results = await analyzeKifuStaged({ steps, lanes, stages: ["scan"] });
    expect(results).toHaveLength(9);
    expect(calls.map(({ ply }) => ply).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(calls.every(({ multiPv, nodes }) => multiPv === 2 && nodes === STAGED_ANALYSIS_PLANS.desktop.scan.nodes)).toBe(true);
    // 2つの区間(0〜4と5〜8)を、それぞれ終局側から読む。
    expect(calls.filter(({ ply }) => ply <= 4).map(({ ply }) => ply)).toEqual([4, 3, 2, 1, 0]);
  });

  it("turns engine scores into black-side graph points and judges each played move", () => {
    const steps = koyama.steps.slice(0, 4);
    // 手番側から見た評価値。2手目の後だけ後手が大きく損をした形にする。
    const results = [50, -40, 1000, -900].map((value) => ({
      reads: [{ nodes: 100, multiPv: 2, candidates: [
        { rank: 1, move: "7g7f", pv: ["7g7f", "3c3d"], score: cp(value) },
        { rank: 2, move: "2g2f", score: cp(value - 10) },
      ] }],
    }));
    const points = analysisPointsFromResults(steps, results);
    // 後手番の局面は符号を反転し、先手から見た値にそろえる。
    expect(points.map(({ graphValue }) => graphValue)).toEqual([50, 40, 1000, 900]);
    expect(points[0].label).toBe("開始局面");
    expect(points[1].label).toBe(`1手目 ${steps[1].label}`);
    expect(points[0].annotation).toBeNull();
    // 先手有利+40から+1000へ変わった2手目（後手の手）は、後手の大きな損として判定する。
    expect(points[2].annotation).toMatchObject({ kind: "mistake", mover: "white" });
  });

  it("measures the loss of a move from the two positions around it", () => {
    const steps = koyama.steps.slice(0, 3);
    const results = [
      { deep: [{ rank: 1, move: steps[1].lastMove, score: cp(100) }] },
      // 後手番から見て+300は、先手から見て-300。先手は100から-300へ400損した。
      { deep: [{ rank: 1, move: "1a1b", score: cp(300) }] },
    ];
    expect(moveFacts(steps, results, 1)).toEqual({ loss: 400, playedBest: true, mate: false });
  });

  it("compares a move's loss only between reads of the same depth", () => {
    const steps = koyama.steps.slice(0, 2);
    const results = [
      { reads: [
        { nodes: 100, multiPv: 2, candidates: [{ rank: 1, move: steps[1].lastMove, score: cp(100) }] },
        { nodes: 1000, multiPv: 2, candidates: [{ rank: 1, move: steps[1].lastMove, score: cp(900) }] },
      ] },
      // 後手番の局面は浅い読みしかない。先手の深い読み(+900)と比べると損に見えるが、浅い読みどうしなら損はない。
      { reads: [{ nodes: 100, multiPv: 1, candidates: [{ rank: 1, move: "1a1b", score: cp(-100) }] }] },
    ];
    expect(moveFacts(steps, results, 1)).toMatchObject({ loss: 0, playedBest: true });
    const points = analysisPointsFromResults(steps, results);
    // グラフは最も深い読みを使う。
    expect(points[0].graphValue).toBe(900);
    expect(points[1].annotation).toBeNull();
  });

  it("re-reads lossy moves and best moves, with MultiPV 2 before each move", () => {
    const steps = koyama.steps.slice(0, 5);
    const results = [
      { deep: [{ rank: 1, move: steps[1].lastMove, score: cp(50) }] },
      { deep: [{ rank: 1, move: "1a1b", score: cp(-40) }] },
      { deep: [{ rank: 1, move: "1a1b", score: cp(40) }] },
      // 3手目で先手が約300損した。
      { deep: [{ rank: 1, move: "1a1b", score: cp(260) }] },
      { deep: [{ rank: 1, move: "1a1b", score: cp(-250) }] },
    ];
    const plies = selectReviewPlies(steps, results, []);
    expect([...plies].sort(([a], [b]) => a - b)).toEqual([[0, 2], [1, 1], [2, 2], [3, 1]]);
  });

  it("finds a god move: deep best with a large gap that the shallow read misses", async () => {
    const steps = koyama.steps.slice(0, 3);
    const calls = [];
    const lane = fakeLane(steps, (ply, { multiPv, nodes }) => {
      const played = steps[ply + 1]?.lastMove ?? "1a1b";
      const best = steps[ply].sfen.split(" ")[1] === "w" ? -300 : 300;
      // 浅い読みでは別の手が最善に見える。
      if (nodes === STAGED_ANALYSIS_PLANS.desktop.shallow.nodes) return [{ rank: 1, move: "9g9f", score: cp(100) }];
      const first = { rank: 1, move: played, pv: [played], score: cp(best) };
      return multiPv >= 2 ? [first, { rank: 2, move: "9g9f", score: cp(best - 300) }] : [first];
    }, calls);
    const results = await analyzeKifuStaged({ steps, lanes: [lane] });
    const points = analysisPointsFromResults(steps, results);
    expect(points[1].annotation).toMatchObject({ kind: "brilliant", label: "神の一手" });
    // 神の一手の候補は、最後に深い読み(focus)で読み直している。
    expect(results[0].reads.map(({ nodes }) => nodes)).toContain(STAGED_ANALYSIS_PLANS.desktop.focus.nodes);
    expect(calls.some(({ nodes, multiPv }) => nodes === STAGED_ANALYSIS_PLANS.desktop.shallow.nodes && multiPv === 3)).toBe(true);
  });

  it("keeps reads of every depth and skips positions already read deeply enough", async () => {
    const steps = koyama.steps.slice(0, 6);
    let calls = 0;
    const lane = async () => {
      calls += 1;
      return { candidates: [{ rank: 1, move: "1a1b", score: cp(0) }] };
    };
    const results = [];
    results[2] = { reads: [{ nodes: 9e9, multiPv: 2, candidates: [{ rank: 1, move: "1a1b", score: cp(10) }] }], shallow: null };
    await analyzeKifuStaged({ steps, lanes: [lane], stages: ["scan"], results });
    expect(results[2].reads).toHaveLength(1);
    expect(calls).toBe(5);
    expect(results[3].reads).toEqual([
      { nodes: STAGED_ANALYSIS_PLANS.desktop.scan.nodes, multiPv: 2, candidates: [{ rank: 1, move: "1a1b", score: cp(0) }] },
    ]);

    calls = 0;
    await analyzeKifuStaged({ steps, lanes: [lane], isCancelled: () => calls >= 2 });
    expect(calls).toBe(2);
  });
});
