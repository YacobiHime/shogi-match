// ホームのまなぶ・しらべるの札に出す「いまどこまでか」を、保存の記録から数える(docs/home-roadmap-design.mdの8章)。
// 教室の目録・問題集・用語辞典の大きなデータを読むので、対局画面からは静的にimportせず、タブを開いたときに import() で読む。
// 新しい保存は作らない。今ある記録を読むだけ。

import { TIPS_LESSONS, TUTORIAL_LESSONS, TUTORIAL_VOLUMES } from "./tutorial-curriculum.mjs";
import { learnedTips, lessonsProgress, loadTutorialProgress, nextLesson } from "./tutorial-progress.mjs";
import { chapterMedal } from "./tutorial-map.mjs";
import { JISSEN_SET, PROBLEMS, TSUME_SET, ZUKOU_SET } from "./problem-set.mjs";
import { loadProblemProgress } from "./problem-progress.mjs";
import { loadReviewProblems } from "./review-problems.mjs";
import { dayKey, loadBrainRecord } from "./brain-training.mjs";
import { todayPick, weekCounts, weekStrip } from "./brain-habit.mjs";
import { loadCollection } from "./collection.mjs";
import { WAZA_TESUJI_NAMES } from "./move-waza.mjs";
import { GLOSSARY_ENTRIES } from "../data/shogi-glossary.mjs";
import { loadResearchBook } from "./research-record.mjs";

/**
 * 教室の次のレッスンと進み具合。
 * @param {any} progress 教室の記録(loadTutorialProgress)
 */
export function tutorialStats(progress) {
  const next = nextLesson(TUTORIAL_LESSONS, progress);
  let nextInfo = null;
  if (next) {
    const volume = TUTORIAL_VOLUMES.find(({ id }) => id === next.volumeId);
    const chapterIndex = volume ? volume.chapters.findIndex(({ id }) => id === next.chapterId) : -1;
    nextInfo = {
      volume: next.volumeNumber,
      chapter: chapterIndex + 1,
      chapterTitle: chapterIndex >= 0 ? volume.chapters[chapterIndex].title : "",
      title: next.title,
    };
  }
  const meter = lessonsProgress(TUTORIAL_LESSONS, progress);
  const chapters = TUTORIAL_VOLUMES.flatMap((volume) => volume.chapters.map(({ id }) => id));
  const gold = chapters.filter((id) => chapterMedal(TUTORIAL_LESSONS, progress, id)?.tier === "gold").length;
  return { next: nextInfo, done: meter.done, total: meter.total, tips: learnedTips(progress).length, tipsTotal: TIPS_LESSONS.length, gold };
}

/**
 * 問題集の解いた数(練習問題・詰将棋・実戦詰将棋・図巧)と、あなたの対局の問題の数。
 * @param {{ solved: Record<string, unknown> }} progress
 * @param {unknown[]} review あなたの対局の問題
 */
export function problemStats(progress, review = []) {
  const all = [...PROBLEMS, ...TSUME_SET, ...JISSEN_SET, ...ZUKOU_SET];
  const solved = progress?.solved ?? {};
  return { solved: all.filter(({ id }) => solved[id]).length, total: all.length, review: review.length };
}

/**
 * 脳トレの今日の部屋と今週の判子。
 * @param {any} record 脳トレの記録(loadBrainRecord)
 * @param {string} day 今日(dayKey)
 */
export function brainStats(record, day) {
  const strip = weekStrip(record, day).map((cell) => ({ weekday: cell.weekday, on: Boolean(cell.calc || cell.memory), today: cell.today }));
  const counts = weekCounts(record, day);
  const pick = todayPick({ record, day });
  return { pick, strip, days: strip.filter((cell) => cell.on).length, target: counts.calc.target };
}

/**
 * しらべるの札の数(使った手筋・組んだ戦法と囲い・用語・研究帳)。
 * @param {any} collection コレクションの記録(loadCollection)
 * @param {{ items: unknown[] }} researchBook 研究帳
 */
export function dexStats(collection, researchBook) {
  const tesujiIds = Object.keys(WAZA_TESUJI_NAMES);
  return {
    tesuji: tesujiIds.filter((id) => collection?.tesuji?.[id]).length,
    tesujiTotal: tesujiIds.length,
    formations: Object.keys(collection?.formations ?? {}).length,
    glossary: GLOSSARY_ENTRIES.length,
    research: researchBook?.items?.length ?? 0,
  };
}

/**
 * ホームのまなぶ・しらべるの札に出す数を、まとめて読む。
 * @param {Storage | null | undefined} storage
 * @param {string} [day] 今日(dayKey)。テストで日を決めるときに渡す。
 */
export function homeTabStats(storage, day = dayKey()) {
  return {
    tutorial: tutorialStats(loadTutorialProgress(storage)),
    problems: problemStats(loadProblemProgress(storage), loadReviewProblems(storage)),
    brain: brainStats(loadBrainRecord(storage), day),
    dex: dexStats(loadCollection(storage), loadResearchBook(storage)),
  };
}
