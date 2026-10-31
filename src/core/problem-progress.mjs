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

/**
 * 解いた記録。一度でも一発で解けたら、その記録を残す。
 * msは解くのにかかった時間(問題を開いてから正解まで。画面を離れていたあいだは数えない。docs/problem-set-timing-design.md)。
 * 答えを見たあとに解いたときは時間を渡さない(nullか省く)。時間はいちばん速い時間(bestMs)と前回の時間(lastMs)を残す。
 * @param {{ solved: Record<string, { firstTry: boolean, bestMs?: number, lastMs?: number }> }} progress
 * @param {string} id
 * @param {{ firstTry: boolean, ms?: number | null }} options
 */
export function recordProblemSolved(progress, id, { firstTry, ms = null }) {
  const before = progress.solved[id];
  /** @type {{ firstTry: boolean, bestMs?: number, lastMs?: number }} */
  const entry = { firstTry: Boolean(before?.firstTry || firstTry) };
  const timed = typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
  const best = validMs(before?.bestMs);
  if (timed !== null) {
    entry.bestMs = best === null ? timed : Math.min(best, timed);
    entry.lastMs = timed;
  } else {
    if (best !== null) entry.bestMs = best;
    const last = validMs(before?.lastMs);
    if (last !== null) entry.lastMs = last;
  }
  return { solved: { ...progress.solved, [id]: entry } };
}

/** @param {unknown} value */
function validMs(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** 解く時間の言い方(「12.3秒」「1分05秒」)。60分を超えたら「60分以上」。 */
export function solveTimeText(ms) {
  if (!(typeof ms === "number" && Number.isFinite(ms) && ms >= 0)) return "";
  if (ms < 60000) return `${(Math.floor(ms / 100) / 10).toFixed(1)}秒`;
  if (ms >= 3600000) return "60分以上";
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, "0")}秒`;
}

/**
 * 正解したときの時間の一言(「12.3秒」「12.3秒・自己ベスト！（前は15.0秒）」)。前の記録(before)と今の時間から決める。
 * @param {{ bestMs?: number } | null | undefined} before
 * @param {number | null} ms
 * @returns {{ text: string, best: boolean }}
 */
export function solveTimeResult(before, ms) {
  if (!(typeof ms === "number" && Number.isFinite(ms) && ms > 0)) return { text: "", best: false };
  const previous = validMs(before?.bestMs);
  const time = solveTimeText(ms);
  if (previous === null) return { text: time, best: false };
  if (ms < previous) return { text: `${time}・自己ベスト！（前は${solveTimeText(previous)}）`, best: true };
  return { text: `${time}（ベストは${solveTimeText(previous)}）`, best: false };
}
