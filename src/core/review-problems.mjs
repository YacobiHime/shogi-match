/**
 * 振り返りで見つけた局面を、問題集の問題にする(段階4の「間をあけた出し直し」の続き)。
 * 対局で見逃した短い詰みを「あなたの対局から」の詰ませる問題として残し、復習の箱から日をあけて出す。
 *
 * 正解は書かず、問題集の詰み探索(core/problem-solver.ts)で決める。実戦の局面は駒が多く、
 * 長い詰みは探索の時間の上限にかかるので、3手詰めまでに絞る。
 * 問題集の重いモジュールを読まずに保存できるよう、このモジュールは軽く保つ(対局画面からも使う)。
 */

export const REVIEW_PROBLEMS_KEY = 'yacobihime:shogi-match:review-problems:v1';
/** 問題にする詰みの手数の上限。 */
export const REVIEW_PROBLEM_MAX_PLIES = 3;
/** 覚えておく問題の数。古いものから消す。 */
const MAX_STORED = 30;
const ID_PREFIX = 'review:';

/** 局面から、問題のIDを作る(同じ局面は同じID)。 */
export function reviewProblemId(sfen) {
  const text = String(sfen).replace(/^sfen\s+/, '').split(' ').slice(0, 3).join(' ');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return `${ID_PREFIX}${hash.toString(36)}`;
}

export function isReviewProblemId(id) {
  return typeof id === 'string' && id.startsWith(ID_PREFIX);
}

/**
 * 見逃した詰みの局面から、詰ませる問題を作る。手数が長すぎるときはnull。
 * @param {{ sfen: string, mateLength: number, at?: number }} found sfenは詰ませる側の手番の局面
 */
export function buildReviewProblem({ sfen, mateLength, at = Date.now() }) {
  if (!sfen || !Number.isInteger(mateLength) || mateLength < 1 || mateLength > REVIEW_PROBLEM_MAX_PLIES) return null;
  return {
    id: reviewProblemId(sfen),
    kind: 'mate',
    depth: mateLength,
    title: `あなたの対局から（${mateLength}手詰め）`,
    sfen,
    question: `あなたの対局に出てきた局面だよ。${mateLength}手で詰ませてみよう！`,
    explanation: '対局では見逃しちゃった詰みだね。もう見つけられるようになったよ！',
    at,
  };
}

/** 問題を足す。同じ局面は新しいほうで置き換え、古いものから消す。 */
export function addReviewProblems(list, problems) {
  const byId = new Map(list.map((problem) => [problem.id, problem]));
  for (const problem of problems) if (problem) byId.set(problem.id, problem);
  return [...byId.values()].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)).slice(-MAX_STORED);
}

export function reviewProblemById(list, id) {
  return list.find((problem) => problem.id === id) ?? null;
}

export function loadReviewProblems(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(REVIEW_PROBLEMS_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((problem) => problem && isReviewProblemId(problem.id) && typeof problem.sfen === 'string'
        && problem.kind === 'mate' && Number.isInteger(problem.depth) && problem.depth <= REVIEW_PROBLEM_MAX_PLIES)
      : [];
  } catch {
    return [];
  }
}

export function saveReviewProblems(storage, list) {
  try {
    storage?.setItem(REVIEW_PROBLEMS_KEY, JSON.stringify(list));
  } catch {
    // 保存できない環境では、問題にしない。
  }
}
