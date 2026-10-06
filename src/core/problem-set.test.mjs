import { describe, expect, it } from "vitest";
import {
  PROBLEMS,
  judgeProblemMove,
  loadProblemProgress,
  problemAnalysis,
  problemAnswers,
  problemQuestion,
  recordProblemSolved,
  saveProblemProgress,
} from "./problem-set.mjs";
import { analyzeProblem } from "./problem-solver";

const [headGold, escapeFromGold] = PROBLEMS;

describe("将棋問題集の正誤判定（詰み探索）", () => {
  it("第1問は、金を5二に打つ手だけが1手詰め", () => {
    expect(problemAnswers(headGold)).toEqual(["G*5b"]);
    // 同じ場所に銀を打つと、玉は4二か6二へ逃げられる。
    const silver = judgeProblemMove(headGold, "S*5b");
    expect(silver.correct).toBe(false);
    expect(["4a4b", "6a6b", "5a4b", "5a6b"]).toContain(silver.line[1]);
    expect(silver.speech).toMatch(/^5二銀打だと、.+と逃げられちゃう/);
    // 王手でない手は、そう伝える。
    expect(judgeProblemMove(headGold, "G*9i").speech).toContain("王手になっていない");
    expect(judgeProblemMove(headGold, "G*5b")).toMatchObject({ correct: true, line: ["G*5b"] });
  });

  it("第2問は、6九へ逃げる手だけが詰まない", () => {
    expect(problemAnswers(escapeFromGold)).toEqual(["5h6i"]);
    const verdicts = Object.fromEntries(problemAnalysis(escapeFromGold).verdicts.map((verdict) => [verdict.usi, verdict]));
    // 5九・4九へ逃げると、金を打たれて1手で詰む。
    expect(verdicts["5h5i"]).toMatchObject({ correct: false, reason: "mated", line: ["5h5i", "G*5h"] });
    expect(verdicts["5h4i"]).toMatchObject({ correct: false, reason: "mated", line: ["5h4i", "G*4h"] });
    expect(judgeProblemMove(escapeFromGold, "5h5i").speech).toBe("5九玉だと、5八金打で詰んじゃう…。もう一度考えてみよう！");
    expect(judgeProblemMove(escapeFromGold, "5h6i").speech).toMatch(/^正解！ 6九玉なら、もう詰まないよ。/);
  });

  it("どの問題も、正解が1つ以上あり、探索の上限内で読み切れる", () => {
    for (const problem of PROBLEMS) {
      const { verdicts, exhausted } = problemAnalysis(problem);
      expect(exhausted, problem.id).toBe(false);
      expect(verdicts.some(({ correct }) => correct), problem.id).toBe(true);
      expect(problemQuestion(problem)).toMatch(/^第\d問 /);
    }
  });

  it("詰みの手数を深くしても、1手で詰む手は正解のまま", () => {
    const result = analyzeProblem({ sfen: "4k4/9/4P4/9/9/9/9/9/9 b GS 1", kind: "mate", depth: 3 });
    expect(result.verdicts.filter(({ correct }) => correct).map(({ usi }) => usi)).toContain("G*5b");
  });
});

describe("将棋問題集の進み具合", () => {
  it("一発で解けた記録を残し、保存と読み込みができる", () => {
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    let progress = loadProblemProgress(storage);
    expect(progress).toEqual({ solved: {} });
    progress = recordProblemSolved(progress, "a", { firstTry: true });
    progress = recordProblemSolved(progress, "a", { firstTry: false });
    saveProblemProgress(storage, progress);
    expect(loadProblemProgress(storage)).toEqual({ solved: { a: { firstTry: true } } });
    expect(loadProblemProgress({ getItem: () => "{壊れたデータ" })).toEqual({ solved: {} });
  });
});
