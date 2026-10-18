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

describe("囲いの教え方（攻めくらべ・囲いを組もう）", async () => {
  const { tutorialLesson, TUTORIAL_LESSONS } = await import("./tutorial-curriculum.mjs");
  const { attemptAttackMove, attackResultLabel, attackStepHint, createAttackState } = await import("./tutorial-problem.mjs");
  const { buildLowerBound, buildNextMove } = await import("./tutorial-runner.mjs");
  const { kingEscapeMap } = await import("./board-insight.mjs");
  const { parseSfenState } = await import("./piece-movement.mjs");
  const stepOf = (lessonId, type, nth = 0) => tutorialLesson(lessonId).steps.filter((step) => step.type === type)[nth];

  it("攻めくらべは、どの局面も攻める側の駒が同じ（玉の形だけを変える）", () => {
    const attackers = TUTORIAL_LESSONS.flatMap(({ steps }) => steps.filter(({ type }) => type === "attack-test")).map(({ sfen }) => {
      const { board } = parseSfenState(sfen);
      const black = [...board].filter(([, piece]) => piece.color === "black").map(([square, piece]) => `${square}${piece.kind}`).sort();
      return `${black.join(",")}|${sfen.split(" ")[2]}`;
    });
    expect(attackers.length).toBeGreaterThanOrEqual(3);
    expect(new Set(attackers).size).toBe(1);
  });

  it("居玉は3手で詰み、王手でない手はまちがいに数えない", () => {
    const step = stepOf("v3-igyoku", "attack-test");
    let state = createAttackState(step);
    expect(attemptAttackMove(step, state, "5e4d").reason).toBe("not-check");
    let result = attemptAttackMove(step, state, "5e5c");
    expect(result.outcome).toBe("continue");
    expect(result.reply).toBeTruthy();
    state = result.state;
    const hint = attackStepHint(step, state);
    result = attemptAttackMove(step, state, hint);
    expect(result.outcome).toBe("correct");
    expect(result.mated).toBe(true);
    expect(attackResultLabel({ mated: true, checks: result.state.checks })).toBe("3手で詰み");
  });

  it("美濃囲いは、王手を続けても詰まずにクリアになる", () => {
    const step = stepOf("v3-castles", "attack-test");
    let state = createAttackState(step);
    let result;
    for (let turn = 0; turn < 8; turn += 1) {
      const usi = attackStepHint(step, state);
      if (!usi) break;
      result = attemptAttackMove(step, state, usi);
      expect(result.outcome).not.toBe("wrong");
      expect(result.mated).toBeFalsy();
      state = result.state;
      if (result.outcome === "correct") break;
    }
    expect(result.outcome).toBe("correct");
    expect(result.held).toBe(true);
  });

  it("居玉を詰ませた局面では、玉の逃げ道がない", () => {
    const step = tutorialLesson("v3-igyoku").steps.find(({ escapeMap }) => escapeMap);
    const map = kingEscapeMap(step.sfen, "white");
    expect(map.squares.filter(({ state }) => state === "open")).toEqual([]);
    expect(map.squares.some(({ state }) => state === "blocked")).toBe(true);
  });

  it("形勢のものさしの局面では、後手の玉の逃げ道が少なく、先手の玉は安全", () => {
    const step = tutorialLesson("v5-judgement").steps.find(({ escapeMap }) => escapeMap);
    const sfen = createStepState(step).sfen;
    const white = kingEscapeMap(sfen, "white");
    const black = kingEscapeMap(sfen, "black");
    const count = (map, state) => map.squares.filter((entry) => entry.state === state).length;
    // 台詞のとおり、後手の玉の逃げ道は1つで×もあり、先手の玉には相手の駒が利いていない。
    expect(count(white, "open")).toBe(1);
    expect(count(white, "covered")).toBeGreaterThan(0);
    expect(count(black, "covered")).toBe(0);
  });

  it("美濃囲いと舟囲いは、お手本の手順が最短", () => {
    expect(buildLowerBound(stepOf("v3-castles", "build"))).toBe(stepOf("v3-castles", "build").par);
    expect(buildLowerBound(stepOf("v3-castle-variety", "build"))).toBe(stepOf("v3-castle-variety", "build").par);
  });

  it("囲いを組もうは、囲いの駒だけを動かせて、そろうとクリア", () => {
    const step = stepOf("v3-castles", "build");
    let state = createStepState(step);
    expect(attemptTutorialMove(step, state, "6h6b+").reason ?? "").not.toBe("");
    expect(attemptTutorialMove(step, state, "7g7f").reason).toBe("not-castle-piece");
    // 手順と違う順で組んでも、次の手を教えられる。
    let result = attemptTutorialMove(step, state, "6i5h");
    expect(result.outcome).toBe("continue");
    state = result.state;
    for (let turn = 0; turn < 8 && result.outcome !== "correct"; turn += 1) {
      const next = buildNextMove(step, state.sfen);
      expect(next).toBeTruthy();
      result = attemptTutorialMove(step, state, next);
      state = result.state;
    }
    expect(result.outcome).toBe("correct");
    expect(result.movesUsed).toBe(step.par);
    expect(state.sfen.split(" ")[1]).toBe("b");
  });

  it("取られる場所へ動かしたら、相手の取り返しを添える", () => {
    const step = tutorialLesson("v2-kiki").steps.find(({ type }) => type === "find-move");
    const wrong = attemptTutorialMove(step, createStepState(step), "5e5d");
    expect(wrong.outcome).toBe("wrong");
    expect(wrong.refutation).toEqual({ reply: "5c5d", square: "5d" });
    expect(attemptTutorialMove(step, createStepState(step), "5e4f").outcome).toBe("correct");
  });

  it("相手の応手を決めた手順は、応手を返しながら進む", () => {
    const step = tutorialLesson("v2-three-moves").steps.find(({ line }) => line);
    let result = attemptTutorialMove(step, createStepState(step), step.line[0]);
    expect(result.outcome).toBe("continue");
    expect(result.reply).toBe(step.line[1]);
    // 飛車から取ると、取り返されてまちがい(取り返しを見せる)。
    const wrong = attemptTutorialMove(step, createStepState(step), "2h2d");
    expect(wrong.outcome).toBe("wrong");
    result = attemptTutorialMove(step, result.state, step.line[2]);
    expect(result.outcome).toBe("correct");
  });
});

describe("にがてをもう1回と駒を並べよう", async () => {
  const { TUTORIAL_LESSONS, tutorialLesson } = await import("./tutorial-curriculum.mjs");
  const progress = await import("./tutorial-progress.mjs");
  const { buildNextMove } = await import("./tutorial-runner.mjs");

  it("まちがえた課題を記録し、章の苦手だけを並べた復習を作る", () => {
    const lesson = tutorialLesson("v2-kiki");
    const taskIndexes = lesson.steps.map((step, index) => ({ step, index })).filter(({ step }) => step.type === "find-move").map(({ index }) => index);
    let weak = progress.recordLessonWeakSteps({}, "v2-kiki", [taskIndexes[0], 0]);
    // 説明のステップ(0)は、読み込むときに捨てる。
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    progress.saveWeakSteps(storage, weak);
    weak = progress.loadWeakSteps(storage, TUTORIAL_LESSONS);
    expect(weak).toEqual({ "v2-kiki": [taskIndexes[0]] });
    const review = progress.weakReviewLesson(TUTORIAL_LESSONS, weak, "v2-c1");
    expect(review.id).toBe("review:v2-c1");
    expect(review.chapterId).toBe("v2-c1");
    expect(review.steps).toHaveLength(1);
    expect(review.steps[0].origin).toEqual({ lessonId: "v2-kiki", index: taskIndexes[0] });
    expect(progress.weakReviewLesson(TUTORIAL_LESSONS, weak, "v1-c1")).toBeNull();
    // まちがえずに解いたら苦手から消え、レッスンをまちがえずに遊び直しても消える。
    expect(progress.clearWeakSteps(weak, [review.steps[0].origin])).toEqual({});
    expect(progress.recordLessonWeakSteps(weak, "v2-kiki", [])).toEqual({});
    expect(progress.loadWeakSteps({ getItem: () => "{broken" }, TUTORIAL_LESSONS)).toEqual({});
  });

  it("駒を並べようは、持ち駒を目的のマスへ打って並べる", () => {
    const step = tutorialLesson("v1-setup").steps.find(({ type }) => type === "build");
    let state = createStepState(step);
    // 盤の駒は動かせない。違うマスに打つとまちがいで、置く場所を返す。
    expect(attemptTutorialMove(step, state, "7g7f").reason).toBe("not-castle-piece");
    const wrong = attemptTutorialMove(step, state, "G*7i");
    expect(wrong.reason).toBe("wrong-square");
    expect(["6i", "4i"]).toContain(wrong.expected);
    let result;
    for (let turn = 0; turn < 12; turn += 1) {
      result = attemptTutorialMove(step, state, buildNextMove(step, state.sfen));
      expect(result.outcome).not.toBe("wrong");
      state = result.state;
      if (result.outcome === "correct") break;
    }
    expect(result.outcome).toBe("correct");
    expect(state.sfen.split(" ")[0]).toBe("lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL");
    expect(result.movesUsed).toBe(step.par);
  });

  it("定跡ドリルは、形ができたら先手の利きを見せる", () => {
    const lesson = tutorialLesson("v4-shiken");
    expect(lesson.steps.at(-2).kiki).toBe("black");
  });
});

describe("序盤・中盤・終盤の作戦（駒得まで指す・角打ちの隙・詰めろ・受け）", async () => {
  const { tutorialLesson } = await import("./tutorial-curriculum.mjs");
  const stepOf = (lessonId, predicate) => tutorialLesson(lessonId).steps.find(predicate);

  it("両取りのあと、相手が高いほうを逃がし、残った駒を取ると駒得で正解", () => {
    const step = stepOf("v2-fork", ({ untilGain }) => untilGain === 6);
    let result = attemptTutorialMove(step, createStepState(step), "4e5c");
    expect(result.outcome).toBe("continue");
    expect(result.next).toBe("gain");
    // 相手は飛車を逃がす(金より高い駒)。
    expect(result.reply.slice(0, 2)).toBe("6a");
    // 取らない手はまちがい(局面は戻さない)。
    const idle = attemptTutorialMove(step, result.state, "1i2h");
    expect(idle).toMatchObject({ outcome: "wrong", reason: "no-gain" });
    expect(tutorialHint(step, result.state, 2).arrows).toEqual(["5c4a+"]);
    result = attemptTutorialMove(step, result.state, "5c4a+");
    expect(result.outcome).toBe("correct");
    expect(result.swing).toBe(6);
  });

  it("相手が受けて取り返す形なら、取り返しまで見せて損得を数える", () => {
    const step = stepOf("v2-fork", ({ untilGain }) => untilGain === 1);
    let result = attemptTutorialMove(step, createStepState(step), "6e5d");
    result = attemptTutorialMove(step, result.state, "5d4c");
    expect(result.outcome).toBe("correct");
    expect(result.reply).toBeTruthy();
    expect(result.swing).toBe(1);
  });

  it("さそいの歩のあと、決めた両取りを指してから駒を取る", () => {
    const step = stepOf("v5-middle-plan", ({ plan }) => plan);
    let result = attemptTutorialMove(step, createStepState(step), "P*5c");
    expect(result).toMatchObject({ outcome: "continue", next: "plan", reply: "5b5c" });
    expect(attemptTutorialMove(step, result.state, "N*6e").outcome).toBe("wrong");
    result = attemptTutorialMove(step, result.state, "N*4e");
    expect(result.next).toBe("gain");
    result = attemptTutorialMove(step, result.state, "4e5c");
    expect(result.outcome).toBe("correct");
    expect(result.swing).toBe(5);
  });

  // 合法手ごとに相手の受けまで読むので重い。並列で動かすと5秒を超えることがある。
  it("角換わりの角打ちの隙が残る手は、相手の角打ちを見せてまちがいにする", () => {
    const step = stepOf("v5-opening-plan", ({ guardDrop }) => guardDrop);
    const wrong = attemptTutorialMove(step, createStepState(step), "9g9f");
    expect(wrong).toMatchObject({ outcome: "wrong", reason: "refuted", refutation: { reply: "B*3i", kind: "drop" } });
    expect(attemptTutorialMove(step, createStepState(step), "2h2i").outcome).toBe("correct");
  }, 30_000);

  it("詰めろは王手でない手で、受けは詰まされない手で正解", () => {
    const threat = stepOf("v5-endgame-plan", ({ threat: kind }) => kind === "mate");
    expect(attemptTutorialMove(threat, createStepState(threat), "2d2c+").outcome).toBe("correct");
    expect(attemptTutorialMove(threat, createStepState(threat), "9i9h")).toMatchObject({ outcome: "wrong", reason: "no-threat" });
    expect(attemptTutorialMove(threat, createStepState(threat), "G*3b")).toMatchObject({ outcome: "wrong", reason: "check-not-threat" });
    const defend = stepOf("v5-endgame-plan", ({ defend: kind }) => kind === "mate");
    expect(attemptTutorialMove(defend, createStepState(defend), "6i7h").outcome).toBe("correct");
    const wrong = attemptTutorialMove(defend, createStepState(defend), "6i5i");
    expect(wrong).toMatchObject({ outcome: "wrong", reason: "refuted", refutation: { reply: "G*8h", kind: "mate" } });
  });
});
