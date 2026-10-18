import { describe, expect, it } from "vitest";
import {
  attemptTutorialMove,
  captureBestMove,
  captureMinMoves,
  captureTargets,
  createStepState,
  tutorialHint,
  tutorialStepMarks,
} from "./tutorial-runner.mjs";
import {
  attemptProblemMove,
  createProblemState,
  problemStepHint,
  recordTutorialProblem,
  tutorialProblemSpeech,
} from "./tutorial-problem.mjs";
import { PROBLEM_PROGRESS_KEY, TSUME_SET } from "./problem-set.mjs";

describe("駒取りゲーム", () => {
  // 飛車1枚で、歩3枚を取る。
  const step = { type: "capture", sfen: "9/9/2p3p2/9/4R4/9/9/9/2p6 b - 1", from: "5e", par: 4, speech: "" };

  it("残っている相手の駒をねらう駒(赤)で示し、最短の手数を数える", () => {
    expect(captureTargets(step.sfen).sort()).toEqual(["3c", "7c", "7i"]);
    expect(tutorialStepMarks(step).filter(({ tone }) => tone === "target")).toHaveLength(3);
    expect(captureMinMoves(step.sfen, "5e")).toBe(4);
  });

  it("盤の1つの駒だけを動かし、相手の駒を全部取ったら正解", () => {
    let state = createStepState(step);
    expect(attemptTutorialMove(step, state, "5e4e").outcome).toBe("continue");
    let result = attemptTutorialMove(step, state, "5e5c");
    expect(result).toMatchObject({ outcome: "continue", captured: false });
    expect(result.state.sfen.split(" ")[1]).toBe("b");
    result = attemptTutorialMove(step, result.state, "5c3c");
    expect(result).toMatchObject({ outcome: "continue", captured: true, left: 2 });
    result = attemptTutorialMove(step, result.state, "3c7c");
    result = attemptTutorialMove(step, result.state, "7c7i");
    expect(result).toMatchObject({ outcome: "correct", movesUsed: 4, par: 4 });
  });

  it("最短の手数は、成って動きが変わる道も数える", () => {
    // 香は5三で成ると金の動きになり、横の6三の歩に届く。
    const lance = { type: "capture", sfen: "9/9/3p5/9/9/9/9/9/4L4 b - 1", from: "5i", par: 2, speech: "" };
    expect(captureMinMoves(lance.sfen, "5i")).toBe(2);
    expect(attemptTutorialMove(lance, createStepState(lance), "5i5c").outcome).toBe("continue");
  });

  it("ヒントは動かす駒、2回目は最短の道の次の1手", () => {
    expect(tutorialHint(step, createStepState(step), 1).marks).toEqual([{ file: 5, rank: 5, tone: "key" }]);
    const best = tutorialHint(step, createStepState(step), 2).arrows[0];
    expect(best).toBe(captureBestMove(step.sfen, "5e"));
    expect(captureMinMoves(attemptTutorialMove(step, createStepState(step), best).state.sfen, best.slice(2, 4))).toBe(3);
  });
});

describe("問題集の問題を教室で解く", () => {
  it("練習問題を問題集と同じ判定で解き、相手の応手を返す", () => {
    const step = { type: "problem", problemId: "take-knight-and-drop" };
    expect(tutorialProblemSpeech(step)).toContain("3手で詰む");
    let state = createProblemState(step);
    expect(attemptProblemMove(step, state, "5e4d").outcome).toBe("wrong");
    const first = attemptProblemMove(step, state, "5e3c+");
    expect(first).toMatchObject({ outcome: "continue", reply: "3b3c" });
    state = first.state;
    expect(state.step).toBe(1);
    const last = attemptProblemMove(step, state, "N*6c");
    expect(last.outcome).toBe("correct");
    expect(last.speech).toContain("詰み");
  });

  it("詰将棋は手順で判定し、ヒントは動かす駒と、2回目に正解の矢印", () => {
    const problem = TSUME_SET.find(({ plies }) => plies === 1);
    const step = { type: "problem", problemId: problem.id };
    const state = createProblemState(step);
    expect(problemStepHint(step, state, 1).arrow).toBe("");
    expect(problemStepHint(step, state, 2).arrow).toBe(problem.line[0]);
    expect(attemptProblemMove(step, state, problem.line[0]).outcome).toBe("correct");
  });

  it("逃げる問題は、問題集と同じく、なぜ詰まないかを見せる続きの1手まで指す", () => {
    const step = { type: "problem", problemId: "escape-from-gold" };
    const state = createProblemState(step);
    expect(attemptProblemMove(step, state, "5h4i").outcome).toBe("wrong");
    const answered = attemptProblemMove(step, state, "5h6i");
    expect(answered).toMatchObject({ outcome: "continue", reply: expect.any(String) });
    expect(answered.speech).toContain("正解");
    // 続きの王手から、もう一度逃げると解き終わる。
    const replies = ["6i7i", "6i7h", "6i5i", "6i6h"];
    const finished = replies.map((usi) => attemptProblemMove(step, answered.state, usi)).find(({ outcome }) => outcome === "correct");
    expect(finished?.speech).toContain("逃げられる");
  });

  it("解いた問題を、問題集の記録にも付ける", () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    expect(recordTutorialProblem(storage, { type: "problem", problemId: "two-rooks" }, { firstTry: true })).toBe(true);
    expect(JSON.parse(values.get(PROBLEM_PROGRESS_KEY)).solved["two-rooks"]).toEqual({ firstTry: true });
  });
});
