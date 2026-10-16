import { describe, expect, it } from 'vitest';
import {
  REVIEW_PROBLEMS_KEY,
  addReviewProblems,
  buildReviewProblem,
  isReviewProblemId,
  loadReviewProblems,
  reviewProblemById,
  reviewProblemId,
  saveReviewProblems,
} from './review-problems.mjs';
import { judgeProblemMove, problemQuestion } from './problem-set.mjs';

const MATE_1 = '4k4/9/4P4/9/9/9/9/9/4K4 b G 1';

describe('振り返りの局面から作る問題', () => {
  it('3手詰めまでの見逃した詰みを、詰ませる問題にする', () => {
    const problem = buildReviewProblem({ sfen: MATE_1, mateLength: 1, at: 5 });
    expect(problem).toMatchObject({ kind: 'mate', depth: 1, sfen: MATE_1, title: 'あなたの対局から（1手詰め）' });
    expect(isReviewProblemId(problem.id)).toBe(true);
    expect(buildReviewProblem({ sfen: MATE_1, mateLength: 5 })).toBeNull();
    expect(buildReviewProblem({ sfen: '', mateLength: 1 })).toBeNull();
  });

  it('問題集の詰み探索で、そのまま正誤を判定できる', () => {
    const problem = buildReviewProblem({ sfen: MATE_1, mateLength: 1 });
    expect(judgeProblemMove(problem, 'G*5b').correct).toBe(true);
    expect(judgeProblemMove(problem, 'G*4b').correct).toBe(false);
    // 問題集の一覧にないので、番号を付けずに問いかける。
    expect(problemQuestion(problem)).toBe(problem.question);
  });

  it('同じ局面は同じIDになり、足すときは置き換える', () => {
    expect(reviewProblemId(MATE_1)).toBe(reviewProblemId(`sfen ${MATE_1.replace(/ 1$/, ' 37')}`));
    const a = buildReviewProblem({ sfen: MATE_1, mateLength: 1, at: 1 });
    const b = buildReviewProblem({ sfen: MATE_1, mateLength: 1, at: 2 });
    const list = addReviewProblems([a], [b, null]);
    expect(list).toHaveLength(1);
    expect(list[0].at).toBe(2);
    expect(reviewProblemById(list, a.id)).toEqual(b);
    expect(reviewProblemById(list, 'review:none')).toBeNull();
  });

  it('保存して読み直せ、壊れた保存や長い詰みは読まない', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    const problem = buildReviewProblem({ sfen: MATE_1, mateLength: 1, at: 1 });
    saveReviewProblems(storage, [problem]);
    expect(loadReviewProblems(storage)).toEqual([problem]);
    data.set(REVIEW_PROBLEMS_KEY, JSON.stringify([{ ...problem, depth: 9 }, { id: 'x', sfen: MATE_1, kind: 'mate', depth: 1 }]));
    expect(loadReviewProblems(storage)).toEqual([]);
    data.set(REVIEW_PROBLEMS_KEY, '{broken');
    expect(loadReviewProblems(storage)).toEqual([]);
  });
});
