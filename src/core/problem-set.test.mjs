import { describe, expect, it } from "vitest";
import {
  PROBLEMS,
  judgeProblemMove,
  loadProblemProgress,
  problemAnalysis,
  problemAnswers,
  problemById,
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
    expect(judgeProblemMove(escapeFromGold, "5h6i").speech).toBe(
      "正解！ 6九玉なら、もう詰まないよ。どうして大丈夫なのか、続きを指して確かめよう。相手が5八金打と王手してきたら、どう逃げる？",
    );
  });

  it("逃げる問題は、正解のあと、まちがえた逃げ方を詰ませていた王手をされても逃げられることを確かめる", () => {
    // 第2問: 5九玉なら詰んでいた5八金打を、6九玉なら7九玉でかわせる。
    const results = playThrough(escapeFromGold, ["5h6i", "G*5h", "6i7i"]);
    expect(results.map(({ solved }) => solved)).toEqual([true, true]);
    expect(results[1].speech).toMatch(/^そのとおり！ 7九玉で逃げられるね。6九なら、/);
  });

  /**
   * 正解の手順を順に指し、相手の応手と最後の判定を確かめる。movesには自分と相手の手を交互に並べる。
   * 自分の手ごとの判定を返す。
   */
  function playThrough(problem, moves) {
    let sfen = problem.sfen;
    let step = 0;
    const results = [];
    for (let index = 0; index < moves.length; index += 2) {
      const result = judgeProblemMove(problem, moves[index], sfen, step);
      results.push(result);
      expect(result.correct, `${problem.id} ${moves[index]}`).toBe(true);
      if (index + 1 < moves.length) {
        expect(result.line, problem.id).toEqual([moves[index], moves[index + 1]]);
        ({ sfen, step } = result.next);
      }
    }
    expect(results.at(-1).next, problem.id).toBeNull();
    expect(results.at(-1).solved, problem.id).toBe(true);
    return results;
  }

  it("第3問は、4八玉・4七金打・3九玉と逃げきり、続きの4八金打も2九玉でかわす", () => {
    const problem = problemById("escape-twice");
    expect(problemAnswers(problem)).toEqual(["5g4h"]);
    expect(judgeProblemMove(problem, "5g4h").speech).toBe("いいね！ 4八玉なら大丈夫。でも、相手は4七金打と王手してきたよ。次はどう逃げる？");
    const { sfen, step } = judgeProblemMove(problem, "5g4h").next;
    expect(problemAnswers(problem, sfen, step)).toEqual(["4h3i"]);
    expect(judgeProblemMove(problem, "4h4i", sfen, step)).toMatchObject({ correct: false, next: null });
    const results = playThrough(problem, ["5g4h", "G*4g", "4h3i", "G*4h", "3i2i"]);
    // 正解は3九玉まで。そのあとの2九玉は、なぜ詰まないかを確かめる続き。
    expect(results.map(({ solved }) => solved)).toEqual([false, true, true]);
    expect(results[1].speech).toMatch(/^正解！ 3九玉なら、もう詰まないよ。/);
  });

  it("第4問は、8五に歩を打って王手をさえぎり、歩を角に取られても逃げられる", () => {
    const problem = problemById("block-with-pawn");
    expect(problemAnswers(problem)).toEqual(["P*8e"]);
    // 角が8五へ来ると、8四の飛車の利きが止まって、8六・8七へ逃げられる。
    const { sfen, step } = judgeProblemMove(problem, "P*8e").next;
    expect(problemAnswers(problem, sfen, step)).toEqual(["9f8f", "9f8g"]);
    playThrough(problem, ["P*8e", "7d8e", "9f8g"]);
  });

  it("3手詰めの問題は、相手の応手のあとにもう一度指して詰ませる", () => {
    const lines = {
      "take-knight-and-drop": ["5e3c+", "3b3c", "N*6c"],
      "where-to-drop-bishop": ["B*3c", "1a1b", "3c2b+"],
      "two-rooks": ["8a4a+", "3b4a", "G*2b"],
      "rook-and-bishop": ["1e3c+", "1a2a", "1h1a+"],
      "kings-face-to-face": ["G*2c", "2b2a", "2c2b"],
    };
    for (const [id, moves] of Object.entries(lines)) {
      const problem = problemById(id);
      expect(problemAnswers(problem), id).toContain(moves[0]);
      expect(playThrough(problem, moves).at(-1).speech, id).toMatch(/^正解！ .+で詰みだよ。/);
    }
    // 第6問は、3三以外に角を打つと、3五の銀に防がれる。
    expect(problemAnswers(problemById("where-to-drop-bishop"))).toEqual(["B*3c"]);
  });

  it("第10問は、飛車を取らずに2三桂打で詰ます", () => {
    const problem = problemById("mate-over-rook");
    expect(problemAnswers(problem)).toEqual(["N*2c"]);
    expect(judgeProblemMove(problem, "5e8b+").speech).toContain("王手になっていない");
  });

  it("どの問題も、正解が1つ以上あり、探索の上限内で読み切れる", () => {
    for (const problem of PROBLEMS) {
      const { verdicts, exhausted } = problemAnalysis(problem);
      expect(exhausted, problem.id).toBe(false);
      expect(verdicts.some(({ correct }) => correct), problem.id).toBe(true);
      expect(problemQuestion(problem)).toMatch(/^第\d+問 /);
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
