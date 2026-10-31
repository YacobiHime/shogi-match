import { describe, expect, it } from "vitest";
import { loadProblemProgress, recordProblemSolved, saveProblemProgress, solveTimeResult, solveTimeText } from "./problem-progress.mjs";

describe("問題集の解いた記録と時間(docs/problem-set-timing-design.md)", () => {
  it("一発正解は一度でも取れたら残り、時間はいちばん速い時間と前回の時間を残す", () => {
    let progress = { solved: {} };
    progress = recordProblemSolved(progress, "a", { firstTry: false, ms: 15000 });
    expect(progress.solved.a).toEqual({ firstTry: false, bestMs: 15000, lastMs: 15000 });
    progress = recordProblemSolved(progress, "a", { firstTry: true, ms: 9000 });
    expect(progress.solved.a).toEqual({ firstTry: true, bestMs: 9000, lastMs: 9000 });
    progress = recordProblemSolved(progress, "a", { firstTry: false, ms: 20000 });
    expect(progress.solved.a).toEqual({ firstTry: true, bestMs: 9000, lastMs: 20000 });
  });

  it("答えを見たあとに解いたとき(時間なし)は、前の時間を変えない", () => {
    let progress = recordProblemSolved({ solved: {} }, "a", { firstTry: true, ms: 9000 });
    progress = recordProblemSolved(progress, "a", { firstTry: false, ms: null });
    expect(progress.solved.a).toEqual({ firstTry: true, bestMs: 9000, lastMs: 9000 });
    // 前の版の記録(時間なし)も読める。
    progress = recordProblemSolved({ solved: { b: { firstTry: true } } }, "b", { firstTry: false });
    expect(progress.solved.b).toEqual({ firstTry: true });
  });

  it("時間の言い方と、自己ベストの一言", () => {
    expect(solveTimeText(12345)).toBe("12.3秒");
    expect(solveTimeText(65000)).toBe("1分05秒");
    expect(solveTimeText(3600000)).toBe("60分以上");
    expect(solveTimeResult(null, 12345)).toEqual({ text: "12.3秒", best: false });
    expect(solveTimeResult({ bestMs: 15000 }, 12345)).toEqual({ text: "12.3秒・自己ベスト！（前は15.0秒）", best: true });
    expect(solveTimeResult({ bestMs: 9000 }, 12345)).toEqual({ text: "12.3秒（ベストは9.0秒）", best: false });
    expect(solveTimeResult({ bestMs: 9000 }, null)).toEqual({ text: "", best: false });
  });

  it("保存と読み込み", () => {
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    saveProblemProgress(storage, recordProblemSolved({ solved: {} }, "a", { firstTry: true, ms: 5000 }));
    expect(loadProblemProgress(storage).solved.a).toEqual({ firstTry: true, bestMs: 5000, lastMs: 5000 });
  });
});
