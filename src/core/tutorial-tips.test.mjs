import { describe, expect, it } from "vitest";

import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import { isPieceLoose, unsafeDestinations } from "./board-insight.mjs";
import { attackersOf, parseSfenState } from "./piece-movement.mjs";
import { problemById } from "./problem-set.mjs";
import { TIPS_LESSONS, TIPS_VOLUMES, TUTORIAL_COURSES, TUTORIAL_LESSONS, tutorialLesson } from "./tutorial-curriculum.mjs";
import { emptyTutorialProgress, isLessonUnlocked, loadTutorialProgress, nextLesson, saveTutorialProgress, tutorialCourse, withTutorialCourse } from "./tutorial-progress.mjs";
import { tutorialMap } from "./tutorial-map.mjs";
import { attemptTutorialMove, createStepState } from "./tutorial-runner.mjs";

const stepOf = (lessonId, type, nth = 0) => tutorialLesson(lessonId).steps.filter((step) => step.type === type)[nth];
const legal = (sfen) => enumerateLegalMoves(createGameRecord(sfen).position).map(({ usi }) => usi);

function memoryStorage() {
  const data = {};
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); } };
}

describe("すぐ使えるコツ(21-4・21-5)", () => {
  it("コツは12枚・3章で、じっくり基礎の一覧には入らず、tutorialLessonで探せる", () => {
    expect(TIPS_LESSONS).toHaveLength(12);
    expect(TIPS_VOLUMES[0].chapters.map(({ id }) => id)).toEqual(["tips-opening", "tips-middle", "tips-endgame"]);
    const basics = new Set(TUTORIAL_LESSONS.map(({ id }) => id));
    for (const lesson of TIPS_LESSONS) {
      expect(basics.has(lesson.id)).toBe(false);
      expect(lesson.free).toBe(true);
      expect(tutorialLesson(lesson.id)?.id).toBe(lesson.id);
    }
    expect(TUTORIAL_COURSES.map(({ id }) => id)).toEqual(["basics", "tips"]);
  });

  it("コツはどのカードからでも遊べる(鍵なし)。地図でも鍵がかからない", () => {
    const progress = emptyTutorialProgress();
    for (const lesson of TIPS_LESSONS) expect(isLessonUnlocked(TIPS_LESSONS, progress, lesson.id)).toBe(true);
    const map = tutorialMap(TIPS_VOLUMES, TIPS_LESSONS, progress);
    expect(map.rows.filter(({ type, state }) => type === "lesson" && state === "locked")).toEqual([]);
    expect(map.rows.filter(({ type, skippable }) => type === "chapter" && skippable)).toEqual([]);
    expect(nextLesson(TIPS_LESSONS, progress)?.id).toBe("tip-rook-pawn");
  });

  it("コースは記録に残り、読めない値はじっくり基礎", () => {
    const storage = memoryStorage();
    expect(tutorialCourse(emptyTutorialProgress())).toBe("basics");
    saveTutorialProgress(storage, withTutorialCourse(emptyTutorialProgress(), "tips"));
    expect(tutorialCourse(loadTutorialProgress(storage))).toBe("tips");
    expect(withTutorialCourse(emptyTutorialProgress(), "warp").course).toBeUndefined();
    saveTutorialProgress(storage, { lessons: {}, course: "warp" });
    expect(tutorialCourse(loadTutorialProgress(storage))).toBe("basics");
  });

  it("味方の利きがあるマスへ: 前に進む手のうち、答えだけが取られて損をしない", () => {
    const step = stepOf("tip-supported", "find-move");
    const forward = legal(step.sfen).filter((usi) => usi.startsWith("5f") && usi.charCodeAt(3) < "f".charCodeAt(0));
    const unsafe = new Set(unsafeDestinations(step.sfen, "5f"));
    const safe = forward.filter((usi) => !unsafe.has(usi.slice(2, 4)));
    expect(safe).toEqual(step.answers);
    expect(forward.length - safe.length).toBeGreaterThanOrEqual(2);
    // 答えのマスは、後ろの飛車が守っている。
    const { board } = parseSfenState(step.sfen);
    board.delete("5f");
    expect(attackersOf(board, "5e", "black").map(({ kind }) => kind)).toContain("R");
  });

  it("タダの駒: 答えで取る銀はだれにも守られていない", () => {
    const step = stepOf("tip-free-piece", "find-move");
    const { board } = parseSfenState(step.sfen);
    expect(isPieceLoose(board, "2d")).toBe(true);
    expect(attemptTutorialMove(step, createStepState(step), "2h2d").outcome).toBe("correct");
  });

  it("両取り: 桂を打つと飛車と金の両方に利き、打ったマスは取られない", () => {
    const step = stepOf("tip-fork", "find-move");
    const record = createGameRecord(step.sfen);
    expect(appendUsiMove(record, "N*5e")).toBe(true);
    const { board } = parseSfenState(record.position.sfen);
    expect(attackersOf(board, "6c", "black").some(({ square }) => square === "5e")).toBe(true);
    expect(attackersOf(board, "4c", "black").some(({ square }) => square === "5e")).toBe(true);
    expect(attackersOf(board, "5e", "white")).toEqual([]);
  });

  it("金の両取り(21-14-5): 答えは▲5四金打だけで、飛車と角の両方に利き、どちらも金を取れない", () => {
    const step = stepOf("tip-fork", "find-move", 1);
    const forks = legal(step.sfen).filter((usi) => usi.startsWith("G*")).filter((usi) => {
      const record = createGameRecord(step.sfen);
      appendUsiMove(record, usi);
      const { board } = parseSfenState(record.position.sfen);
      return ["4c", "6d"].every((target) => attackersOf(board, target, "black").some(({ square }) => square === usi.slice(2, 4)));
    });
    expect(forks).toEqual(step.answers);
    const record = createGameRecord(step.sfen);
    appendUsiMove(record, "G*5d");
    expect(attackersOf(parseSfenState(record.position.sfen).board, "5d", "white")).toEqual([]);
  });

  it("玉は下段に落とせ(21-14-5): 3手で詰み、詰む1手目は▲2四金だけ。上や横からの王手では逃げられる", async () => {
    const { analyzeProblem } = await import("./problem-solver.ts");
    const step = stepOf("tip-bottom", "mate");
    const { verdicts, exhausted } = analyzeProblem({ sfen: step.sfen, kind: "mate", depth: 3 });
    expect(exhausted).toBe(false);
    expect(verdicts.filter(({ correct }) => correct).map(({ usi }) => usi)).toEqual([step.solution[0]]);
    // 2四の金のあと、玉の逃げ場は奥の段(二段目)だけ。
    const record = createGameRecord(step.sfen);
    appendUsiMove(record, step.solution[0]);
    const kingMoves = enumerateLegalMoves(record.position).filter(({ usi }) => usi.startsWith("2c")).map(({ usi }) => usi);
    expect(kingMoves).toContain(step.solution[1]);
    expect(kingMoves.every((usi) => usi[3] === "b")).toBe(true);
    // 上(2二)から王手すると、詰まない。
    expect(verdicts.find(({ usi }) => usi === "G*2b")?.reason).toBe("escapes");
    // 手順どおりに指すと詰む。
    let state = createStepState(step);
    let result = attemptTutorialMove(step, state, step.solution[0]);
    expect(result.outcome).toBe("continue");
    result = attemptTutorialMove(step, result.state, step.solution[2]);
    expect(result.outcome).toBe("correct");
  });

  it("垂れ歩: 手順どおりに指すと、2三にと金ができる", () => {
    const step = stepOf("tip-pawn-hand", "find-move");
    const record = createGameRecord(step.sfen);
    for (const usi of step.line) expect(appendUsiMove(record, usi)).toBe(true);
    expect(parseSfenState(record.position.sfen).board.get("2c")).toMatchObject({ kind: "+P", color: "black" });
  });

  it("7七銀と7八金: お手本の2手で組め、相手の△8六歩を取り返せる形になる", () => {
    const step = stepOf("tip-vs-ibisha", "build");
    let state = createStepState(step);
    let result;
    for (const usi of step.moves) {
      result = attemptTutorialMove(step, state, usi);
      state = result.state;
    }
    expect(result.outcome).toBe("correct");
    const after = stepOf("tip-vs-ibisha", "explain");
    const { board } = parseSfenState(after.sfen);
    // 8六のマスを、先手の駒が2枚以上見張っている(8七の歩と7七の銀)。
    expect(attackersOf(board, "8f", "black").length).toBeGreaterThanOrEqual(2);
  });

  it("終盤は速さ: 捨て駒の3手詰めは問題集の問題で、1手目の駒を相手が取る", () => {
    const step = stepOf("tip-speed", "problem");
    const problem = problemById(step.problemId);
    expect(problem).toBeTruthy();
    const line = typeof problem.line === "string" ? problem.line.split(/\s+/) : problem.line;
    expect(line).toHaveLength(3);
    expect(line[1].slice(2, 4)).toBe(line[0].replace("+", "").slice(-2));
    // じっくり基礎では出さない問題(同じ問題を2回解かせない)。
    expect(TUTORIAL_LESSONS.some(({ steps }) => steps.some(({ problemId }) => problemId === step.problemId))).toBe(false);
  });
});

describe("じっくり基礎の寄り道(21-6)", async () => {
  const { TUTORIAL_PLACEMENTS, earnedVolumeTitles, tutorialMap: map } = await import("./tutorial-map.mjs");
  const { TUTORIAL_VOLUMES } = await import("./tutorial-curriculum.mjs");
  const { lessonsProgress, recordLessonCleared, skipAheadTargets } = await import("./tutorial-progress.mjs");
  const SIDE = ["v1-setup", "v2-watch-opening", "v2-watch-endgame", "v2-double-check", "v3-watch-attack", "v5-evaluation"];

  it("寄り道は決めた6つで、はじめての札の始めるレッスンは寄り道でない", () => {
    expect(TUTORIAL_LESSONS.filter(({ side }) => side).map(({ id }) => id)).toEqual(SIDE);
    for (const { start } of TUTORIAL_PLACEMENTS) expect(tutorialLesson(start).side).toBeFalsy();
  });

  it("寄り道を遊ばなくても、次のレッスンが開き、巻の称号ももらえる", () => {
    let progress = emptyTutorialProgress();
    const volume1 = TUTORIAL_LESSONS.filter(({ volumeId }) => volumeId === "v1");
    for (const lesson of volume1) if (!lesson.side) progress = recordLessonCleared(progress, lesson.id, 3);
    expect(nextLesson(TUTORIAL_LESSONS, progress)?.volumeId).toBe("v2");
    expect(earnedVolumeTitles(TUTORIAL_VOLUMES, TUTORIAL_LESSONS, progress).map(({ id }) => id)).toContain("tutorial-v1");
    // 寄り道は、前のレッスンを終えれば遊べる(鍵はかからない)。
    expect(isLessonUnlocked(TUTORIAL_LESSONS, progress, "v1-setup")).toBe(true);
    // 進み具合のメーターに数えない。
    expect(lessonsProgress(volume1, progress).done).toBe(lessonsProgress(volume1, progress).total);
  });

  it("寄り道は地図で印が付き、章をとばす対象・飛び級の対象にならない", () => {
    const rows = map(TUTORIAL_VOLUMES, TUTORIAL_LESSONS, emptyTutorialProgress()).rows;
    expect(rows.filter(({ side }) => side).map(({ id }) => id)).toEqual(SIDE);
    // 観戦だけの章(全部が寄り道)は、とばすボタンを出さない。
    expect(rows.find(({ id }) => id === "v2-c2").skippable).toBe(false);
    const targets = skipAheadTargets(TUTORIAL_LESSONS, emptyTutorialProgress(), "v2-c3-boss");
    for (const id of SIDE) {
      expect(targets.tested).not.toContain(id);
      expect(targets.skipped).not.toContain(id);
    }
  });

  it("腕だめしは、寄り道のレッスンの内容(両王手・評価値)を問わない", () => {
    const texts = TUTORIAL_LESSONS.filter(({ boss }) => boss)
      .flatMap(({ steps }) => steps.map((step) => `${step.question ?? ""}${step.speech ?? ""}${(step.options ?? []).join("")}`));
    for (const text of texts) {
      expect(text).not.toMatch(/両王手/);
      expect(text).not.toMatch(/評価値/);
    }
  });
});
