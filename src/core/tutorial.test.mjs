import { describe, expect, it } from "vitest";
import { Position } from "tsshogi";
import { createGameRecord, enumerateLegalMoves } from "../game-state";
import { TUTORIAL_LESSONS, TUTORIAL_VOLUMES, tutorialLesson } from "./tutorial-curriculum.mjs";
import {
  attemptTutorialChoice,
  attemptTutorialMove,
  createStepState,
  isCheckmate,
  lessonStars,
  tutorialHint,
  tutorialStepSfen,
  withBlackToMove,
} from "./tutorial-runner.mjs";
import {
  TUTORIAL_PROGRESS_KEY,
  emptyTutorialProgress,
  isLessonUnlocked,
  lessonsProgress,
  loadTutorialProgress,
  nextLesson,
  recordLessonCleared,
  recordLessonSkipped,
  saveTutorialProgress,
} from "./tutorial-progress.mjs";
import { referenceDexEntries } from "./reference-dex.mjs";
import { buildFormationStart } from "./learning-setup.mjs";

const STEP_TYPES = ["explain", "move-piece", "find-move", "mate", "choose", "open-dex", "play"];
const legalMoves = (sfen) => enumerateLegalMoves(createGameRecord(sfen).position).map(({ usi }) => usi);

/** 指定した駒だけを動かして、maxMoves手以内に目的のマスへ届くか。 */
function reachable(sfen, from, target, maxMoves) {
  let frontier = [{ sfen, square: from }];
  for (let depth = 0; depth < maxMoves; depth += 1) {
    const next = [];
    for (const node of frontier) {
      for (const usi of legalMoves(node.sfen).filter((move) => move.slice(0, 2) === node.square)) {
        if (usi.slice(2, 4) === target) return true;
        const record = createGameRecord(node.sfen);
        record.append(record.position.createMoveByUSI(usi));
        next.push({ sfen: withBlackToMove(record.position.sfen), square: usi.slice(2, 4) });
      }
    }
    frontier = next;
  }
  return false;
}

describe("やこび姫の将棋教室のカリキュラム", () => {
  it("5巻の構成で、すべてのレッスンが一意のIDを持つ", () => {
    expect(TUTORIAL_VOLUMES.map(({ title }) => title)).toEqual([
      "将棋ってなあに？", "一局の流れをつかもう", "攻めと守りのひみつ", "戦法マスターへの道", "考えるって楽しい！",
    ]);
    expect(TUTORIAL_VOLUMES.flatMap(({ chapters }) => chapters)).toHaveLength(12);
    const ids = TUTORIAL_LESSONS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TUTORIAL_LESSONS.filter(({ comingSoon }) => !comingSoon).length).toBeGreaterThanOrEqual(40);
    for (const volume of TUTORIAL_VOLUMES) {
      for (const chapter of volume.chapters) expect(chapter.lessons.length, chapter.id).toBeGreaterThan(0);
    }
  });

  it("すべてのステップの盤面・正解・参照先が正しい", () => {
    const dexIds = {
      piece: new Set(referenceDexEntries("piece").map(({ id }) => id)),
      tesuji: new Set(referenceDexEntries("tesuji").map(({ id }) => id)),
      world: new Set(referenceDexEntries("world").map(({ id }) => id)),
    };
    for (const lesson of TUTORIAL_LESSONS.filter(({ comingSoon }) => !comingSoon)) {
      expect(lesson.steps.length, lesson.id).toBeGreaterThan(0);
      lesson.steps.forEach((step, index) => {
        const label = `${lesson.id}#${index} ${step.type}`;
        expect(STEP_TYPES, label).toContain(step.type);
        expect(step.speech ?? step.question, label).toEqual(expect.any(String));
        const sfen = tutorialStepSfen(step);
        if (sfen) {
          expect(() => createGameRecord(sfen), label).not.toThrow();
          const fields = sfen.split(" ");
          fields[1] = fields[1] === "b" ? "w" : "b";
          expect(Position.newBySFEN(fields.join(" "))?.checked, `${label}: 手番でない側が王手されている`).toBe(false);
        }
        if (["move-piece", "find-move", "mate"].includes(step.type)) {
          expect(sfen.split(" ")[1], `${label}: 先手番で始める`).toBe("b");
        }
        if (step.type === "find-move") {
          const legal = legalMoves(sfen);
          if (step.anyDropOf) expect(legal.some((usi) => usi.startsWith(`${step.anyDropOf}*`)), label).toBe(true);
          else {
            expect(step.answers?.length, label).toBeGreaterThan(0);
            for (const usi of step.answers) expect(legal, `${label}: ${usi}`).toContain(usi);
          }
        }
        if (step.type === "move-piece") {
          expect(reachable(sfen, step.from, step.target, step.maxMoves), label).toBe(true);
        }
        if (step.type === "mate") {
          let state = createStepState(step);
          for (let ply = 0; ply < step.solution.length; ply += 2) {
            const result = attemptTutorialMove(step, state, step.solution[ply]);
            expect(result.outcome, `${label}: ${step.solution[ply]}`).not.toBe("wrong");
            state = result.state;
          }
          expect(isCheckmate(state.sfen), `${label}: 詰みになる`).toBe(true);
        }
        if (step.type === "choose") {
          expect(step.options.length, label).toBeGreaterThanOrEqual(2);
          expect(step.answer, label).toBeGreaterThanOrEqual(0);
          expect(step.answer, label).toBeLessThan(step.options.length);
        }
        if (step.type === "open-dex" && step.kind !== "opening") {
          expect(dexIds[step.kind]?.has(step.id), label).toBe(true);
        }
        if (step.type === "play" && step.preset.startType === "formation") {
          const result = buildFormationStart({
            black: { strategyId: step.preset.playerStrategy, castleId: step.preset.playerCastle },
            white: { strategyId: step.preset.opponentStrategy, castleId: step.preset.opponentCastle },
          });
          expect(result.ok, `${label}: ${result.message}`).toBe(true);
        }
      });
    }
  });

  it("定跡の練習は、図鑑の手順を順番に指させる", () => {
    const lesson = tutorialLesson("v4-shiken");
    expect(lesson.steps.filter(({ type }) => type === "find-move").map(({ answers }) => answers[0]))
      .toEqual(["7g7f", "6g6f", "2h6h"]);
  });
});

describe("やこび姫の将棋教室の正誤判定", () => {
  it("駒を目的のマスまで動かすと正解、手数を使い切るとやり直し", () => {
    const step = tutorialLesson("v1-pawn").steps.find(({ type }) => type === "move-piece");
    let state = createStepState(step);
    let result = attemptTutorialMove(step, state, "5g5f");
    expect(result.outcome).toBe("continue");
    expect(result.state.sfen.split(" ")[1]).toBe("b");
    result = attemptTutorialMove(step, result.state, "5f5e");
    expect(result.outcome).toBe("correct");

    const knight = tutorialLesson("v1-knight").steps.find(({ type }) => type === "move-piece");
    state = createStepState(knight);
    result = attemptTutorialMove(knight, state, "5i6g");
    result = attemptTutorialMove(knight, result.state, "6g7e");
    expect(result.outcome).toBe("wrong");
    expect(result.state.square).toBe("5i");
    // ほかの駒（玉）を動かすのも不正解。
    expect(attemptTutorialMove(knight, createStepState(knight), "1i2h").outcome).toBe("wrong");
  });

  it("正解の一手と、持ち駒をどこに打ってもよい問題を判定する", () => {
    const promotion = tutorialLesson("v1-promotion").steps.find(({ type }) => type === "find-move");
    expect(attemptTutorialMove(promotion, createStepState(promotion), "4d4c").outcome).toBe("wrong");
    expect(attemptTutorialMove(promotion, createStepState(promotion), "4d4c+").outcome).toBe("correct");
    const drop = tutorialLesson("v1-hand").steps.find(({ anyDropOf }) => anyDropOf);
    expect(attemptTutorialMove(drop, createStepState(drop), "G*2e").outcome).toBe("correct");
    expect(attemptTutorialMove(drop, createStepState(drop), "5d5c").outcome).toBe("wrong");
  });

  it("詰将棋は詰みになる手を正解にする", () => {
    const step = tutorialLesson("v2-mate-head-gold").steps.find(({ type }) => type === "mate");
    expect(attemptTutorialMove(step, createStepState(step), "G*4b").outcome).toBe("wrong");
    expect(attemptTutorialMove(step, createStepState(step), "G*5b").outcome).toBe("correct");
  });

  it("選択肢・ヒント・★を判定する", () => {
    const choose = tutorialLesson("v1-board").steps.find(({ type }) => type === "choose");
    expect(attemptTutorialChoice(choose, choose.answer)).toBe("correct");
    expect(attemptTutorialChoice(choose, (choose.answer + 1) % choose.options.length)).toBe("wrong");
    const find = tutorialLesson("v1-turns").steps.find(({ type }) => type === "find-move");
    expect(tutorialHint(find, createStepState(find), 1).arrows).toEqual([]);
    expect(tutorialHint(find, createStepState(find), 2).arrows).toEqual(["7g7f"]);
    expect([lessonStars({}), lessonStars({ mistakes: 1, hints: 1 }), lessonStars({ mistakes: 3 })]).toEqual([3, 2, 1]);
  });
});

describe("やこび姫の将棋教室の進捗", () => {
  const lessons = TUTORIAL_LESSONS;

  it("前のレッスンを終えると次が解放され、スキップでも進める", () => {
    let progress = emptyTutorialProgress();
    expect(isLessonUnlocked(lessons, progress, lessons[0].id)).toBe(true);
    expect(isLessonUnlocked(lessons, progress, lessons[1].id)).toBe(false);
    progress = recordLessonCleared(progress, lessons[0].id, 2);
    expect(isLessonUnlocked(lessons, progress, lessons[1].id)).toBe(true);
    progress = recordLessonSkipped(progress, lessons[1].id);
    expect(isLessonUnlocked(lessons, progress, lessons[2].id)).toBe(true);
    expect(nextLesson(lessons, progress).id).toBe(lessons[2].id);
  });

  it("準備中のレッスンは解放の妨げにならない", () => {
    let progress = emptyTutorialProgress();
    const index = lessons.findIndex(({ comingSoon }) => comingSoon);
    for (const lesson of lessons.slice(0, index)) progress = recordLessonSkipped(progress, lesson.id);
    expect(isLessonUnlocked(lessons, progress, lessons[index + 1].id)).toBe(true);
  });

  it("★は最高記録を残し、スキップでクリア記録を消さない", () => {
    let progress = recordLessonCleared(emptyTutorialProgress(), "v1-board", 3);
    progress = recordLessonCleared(progress, "v1-board", 1);
    progress = recordLessonSkipped(progress, "v1-board");
    expect(progress.lessons["v1-board"]).toEqual({ status: "cleared", stars: 3 });
    const summary = lessonsProgress(lessons.slice(0, 2), progress);
    expect(summary).toMatchObject({ cleared: 1, total: 2, stars: 3, maxStars: 6 });
  });

  it("保存と読み込みで不正な記録を捨てる", () => {
    const storage = new Map();
    const fake = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    const progress = recordLessonCleared(emptyTutorialProgress(), "v1-board", 2);
    expect(saveTutorialProgress(fake, progress)).toBe(true);
    expect(loadTutorialProgress(fake)).toEqual(progress);
    storage.set(TUTORIAL_PROGRESS_KEY, JSON.stringify({ lessons: { a: { status: "cleared", stars: 9 }, b: { status: "skipped" } } }));
    expect(loadTutorialProgress(fake)).toEqual({ lessons: { b: { status: "skipped", stars: 0 } } });
    storage.set(TUTORIAL_PROGRESS_KEY, "{broken");
    expect(loadTutorialProgress(fake)).toEqual(emptyTutorialProgress());
  });
});
