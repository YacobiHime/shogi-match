import { describe, expect, it } from "vitest";
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import {
  PROBLEMS,
  PROBLEM_SECTIONS,
  TSUME_SET,
  ZUKOU_SET,
  judgeProblemMove,
  problemHint,
  sectionProblems,
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

/** 指したあとの局面が詰みか。 */
function matesAfter(sfen, usi) {
  const record = createGameRecord(sfen);
  return appendUsiMove(record, usi) && record.position.checked && enumerateLegalMoves(record.position).length === 0;
}

/**
 * 手順を指し進め、攻め方の手がすべて王手で、最後に詰むかを確かめる。
 * 最後に合駒が残る場合は、どの合駒も取り返して詰む無駄合いであることを確かめ、その問題のidを返す。
 */
function checkMateLine(problem) {
  const record = createGameRecord(problem.sfen);
  expect(record.position.color, problem.id).toBe("black");
  problem.line.forEach((usi, index) => {
    expect(appendUsiMove(record, usi), `${problem.id} ${index + 1}手目 ${usi}`).toBe(true);
    if (index % 2 === 0) expect(record.position.checked, `${problem.id} ${index + 1}手目は王手`).toBe(true);
  });
  expect(record.position.checked, problem.id).toBe(true);
  const replies = enumerateLegalMoves(record.position);
  if (!replies.length) return null;
  const finalSfen = record.position.sfen;
  for (const reply of replies) {
    expect(reply.usi, `${problem.id} 合駒だけが残る`).toMatch(/^[A-Z]\*/);
    const after = createGameRecord(finalSfen);
    appendUsiMove(after, reply.usi);
    const recaptures = enumerateLegalMoves(after.position).map(({ usi }) => usi);
    expect(recaptures.some((usi) => matesAfter(after.position.sfen, usi)), `${problem.id} ${reply.usi}は取って詰む`).toBe(true);
  }
  return problem.id;
}

describe("将棋問題集の区分", () => {
  it("練習問題・詰め将棋・詰将棋図巧の3区分で、詰め将棋は1・3・5・7手詰めが30問ずつ、図巧は全100問", () => {
    expect(PROBLEM_SECTIONS.map(({ label }) => label)).toEqual(["練習問題", "詰め将棋", "詰将棋図巧"]);
    expect(sectionProblems("practice")).toEqual([...PROBLEMS]);
    const tsume = PROBLEM_SECTIONS.find(({ id }) => id === "tsume");
    expect(tsume.groups.map(({ label, problems }) => [label, problems.length]))
      .toEqual([["1手詰め", 30], ["3手詰め", 30], ["5手詰め", 30], ["7手詰め", 30]]);
    expect(ZUKOU_SET).toHaveLength(100);
    expect(new Set(ZUKOU_SET.map(({ number }) => number)).size).toBe(100);
    // 図巧は手数の短い順。最短は第50番の9手。
    expect(ZUKOU_SET[0]).toMatchObject({ id: "zukou-050", plies: 9, title: "第50番（9手）" });
    expect(ZUKOU_SET.every((problem, index, list) => index === 0 || list[index - 1].plies <= problem.plies)).toBe(true);
    const ids = [...PROBLEMS, ...TSUME_SET, ...ZUKOU_SET].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("詰め将棋と図巧の手順は、どれも王手の連続で最後に詰む（図巧の3問は無駄合いが残る）", () => {
    const futile = [];
    for (const problem of [...TSUME_SET, ...ZUKOU_SET]) {
      expect(problem.plies % 2, problem.id).toBe(1);
      const id = checkMateLine(problem);
      if (id) futile.push(id);
    }
    expect(futile.sort()).toEqual(["zukou-026", "zukou-073", "zukou-093"]);
  });

  it("無駄合いが残る作意の最後の手も、正解にする", () => {
    const problem = ZUKOU_SET.find(({ id }) => id === "zukou-026");
    let sfen = problem.sfen;
    let step = 0;
    let result;
    for (let index = 0; index < problem.line.length; index += 2) {
      result = judgeProblemMove(problem, problem.line[index], sfen, step);
      expect(result.correct, `${index + 1}手目`).toBe(true);
      if (result.next) ({ sfen, step } = result.next);
    }
    expect(result).toMatchObject({ solved: true, next: null });
    expect(result.speech).toContain("間に駒を打っても、取れば詰むよ。");
  });

  // 3手詰め以上も探索で一致を確かめたが（2026-10-07）、重くほかのテストを遅らせるため、ここでは1手詰めだけを確かめる。
  it("1手詰めは、探索でもデータの初手だけが正解になる", () => {
    for (const problem of TSUME_SET.filter(({ plies }) => plies === 1)) {
      const result = analyzeProblem(
        { sfen: problem.sfen, kind: "mate", depth: problem.plies },
        { nodeLimit: 3000000, maxTimeMs: 20000 },
      );
      expect(result.exhausted, problem.id).toBe(false);
      expect(result.verdicts.filter(({ correct }) => correct).map(({ usi }) => usi), problem.id).toEqual([problem.line[0]]);
    }
  }, 30000);
});

describe("手順で判定する問題（詰め将棋・図巧）", () => {
  /** 作意手順のとおりに指し、毎回の判定を返す。 */
  function playLine(problem) {
    let sfen = problem.sfen;
    let step = 0;
    const results = [];
    for (let index = 0; index < problem.line.length; index += 2) {
      const result = judgeProblemMove(problem, problem.line[index], sfen, step);
      results.push(result);
      expect(result.correct, `${problem.id} ${index + 1}手目`).toBe(true);
      if (result.next) ({ sfen, step } = result.next);
    }
    return results;
  }

  it("詰め将棋は、作意手順どおりに指すと相手が応じ、最後の手で正解になる", () => {
    const problem = TSUME_SET.find(({ plies }) => plies === 3);
    const results = playLine(problem);
    expect(results.map(({ solved }) => solved)).toEqual([false, true]);
    expect(results[0].line).toEqual(problem.line.slice(0, 2));
    expect(results[1].speech).toMatch(/^正解！ .+で詰みだよ。3手詰め、クリア！$/);
  });

  it("図巧は、作意手順どおりに解ききれ、途中で何手目かを伝える", () => {
    const problem = ZUKOU_SET[0];
    const results = playLine(problem);
    expect(results.at(-1)).toMatchObject({ correct: true, solved: true, next: null });
    expect(results[0].speech).toContain("（2/9手）");
    expect(results.at(-1).speech).toMatch(/第50番（9手）を解ききったね！$/);
  });

  it("手順と違う王手は、詰め将棋では逃げ方を見せ、図巧では作者の手順と違うと伝える", () => {
    /** 作意の初手とは違い、詰まない王手。 */
    const otherCheck = (problem) => enumerateLegalMoves(createGameRecord(problem.sfen).position).map(({ usi }) => usi).find((usi) => {
      if (usi === problem.line[0]) return false;
      const next = createGameRecord(problem.sfen);
      return appendUsiMove(next, usi) && next.position.checked && enumerateLegalMoves(next.position).length > 0;
    });
    const tsumeWithOtherCheck = TSUME_SET.find((problem) => problem.plies === 3 && otherCheck(problem));
    for (const problem of [tsumeWithOtherCheck, ZUKOU_SET[0]]) {
      const other = otherCheck(problem);
      expect(other, problem.id).toBeTruthy();
      const result = judgeProblemMove(problem, other);
      expect(result).toMatchObject({ correct: false, solved: false, next: null });
      if (problem.source === "zukou") {
        expect(result.speech).toContain("作者の手順とは違う手");
      } else {
        expect(result.line).toHaveLength(2);
        expect(result.speech).toMatch(/と逃げられちゃう/);
      }
    }
    // 王手でない手は、そう伝える。
    const tsume = TSUME_SET[0];
    const quiet = enumerateLegalMoves(createGameRecord(tsume.sfen).position).map(({ usi }) => usi).find((usi) => {
      const next = createGameRecord(tsume.sfen);
      return appendUsiMove(next, usi) && !next.position.checked;
    });
    expect(judgeProblemMove(tsume, quiet).speech).toContain("王手になっていない");
  });

  it("その場で詰ませる手は、作意手順と違っても正解にする", () => {
    // 作意は銀打からの3手詰めとしても、金を5二に打てばすぐ詰む。
    const problem = {
      id: "test", kind: "line", source: "tsume", title: "テスト", plies: 3,
      sfen: "4k4/9/4P4/9/9/9/9/9/9 b GS 1", line: ["S*5b", "5a4b", "G*4c"],
    };
    expect(judgeProblemMove(problem, "G*5b")).toMatchObject({ correct: true, solved: true, line: ["G*5b"] });
  });

  it("ヒントは、次に動かす駒を伝え、盤上の駒を動かすならそのマスを示す", () => {
    const drop = TSUME_SET.find(({ line }) => line[0].includes("*"));
    expect(problemHint(drop).text).toMatch(/^持ち駒の.+を打つ手だよ。/);
    expect(problemHint(drop).square).toBeUndefined();
    const move = TSUME_SET.find(({ line }) => !line[0].includes("*"));
    expect(problemHint(move)).toMatchObject({ square: move.line[0].slice(0, 2) });
    expect(problemHint(move).text).toContain("緑のマスの駒");
    // 練習問題のヒントは1手目だけ。
    expect(problemHint(headGold)).toEqual({ text: headGold.hint, square: headGold.hintSquare });
    expect(problemHint(headGold, headGold.sfen, 1)).toBeNull();
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
