/**
 * 将棋問題集の解いた記録。問題集の画面と、ホームの「強くなる道」(core/home-roadmap.mjs)で使う。
 * 対局画面から問題集の重いデータを読まないよう、問題集(problem-set.mjs)から分けている。
 */

export const PROBLEM_PROGRESS_KEY = "shogi-match:problem-set:v1";

export function loadProblemProgress(storage) {
  try {
    const value = JSON.parse(storage?.getItem(PROBLEM_PROGRESS_KEY) ?? "null");
    return value && typeof value.solved === "object" && value.solved ? { solved: { ...value.solved } } : { solved: {} };
  } catch {
    return { solved: {} };
  }
}

export function saveProblemProgress(storage, progress) {
  try {
    storage?.setItem(PROBLEM_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // 保存できない端末では、その場限りの記録にする。
  }
}

/** 解いた記録。一度でも一発で解けたら、その記録を残す。 */
export function recordProblemSolved(progress, id, { firstTry }) {
  const before = progress.solved[id];
  return { solved: { ...progress.solved, [id]: { firstTry: Boolean(before?.firstTry || firstTry) } } };
}
