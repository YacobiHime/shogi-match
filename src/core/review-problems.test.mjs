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
import { judgeProblemMove, problemHint, problemQuestion, problemSectionId } from './problem-set.mjs';

const MATE_1 = '4k4/9/4P4/9/9/9/9/9/4K4 b G 1';
/** 3手詰め。▲7四金から(読み筋)と、▲8四飛からの2通りで詰む。 */
const ALT_3 = '9/9/9/k1G6/1L7/9/PP7/9/L8 b Rr2b3g4s4n2l16p 1';

describe('振り返りの局面から作る問題', () => {
  it('3手詰めまでの見逃した詰みを、詰ませる問題にする', () => {
    const problem = buildReviewProblem({ sfen: MATE_1, mateLength: 1, at: 5 });
    expect(problem).toMatchObject({ kind: 'mate', depth: 1, sfen: MATE_1, title: 'あなたの対局から（1手詰め）' });
    expect(isReviewProblemId(problem.id)).toBe(true);
    // 読み筋のない長い詰みは、詰み探索だけでは判定しきれないので問題にしない。
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

  it('解析の読み筋が詰みまで確かめられたら、n手詰めの問題にして、その手順で判定する', () => {
    const problem = buildReviewProblem({ sfen: ALT_3, mateLength: 3, line: ['7d8d', '9d9e', '9g9f', '9e9d'], at: 3 });
    expect(problem).toMatchObject({ kind: 'line', source: 'game', plies: 3, depth: 3, line: ['7d8d', '9d9e', '9g9f'], title: 'あなたの対局から（3手詰め）' });
    expect(problemSectionId(problem)).toBe('game');
    const first = judgeProblemMove(problem, '7d8d');
    expect(first).toMatchObject({ correct: true, solved: false, line: ['7d8d', '9d9e'] });
    expect(judgeProblemMove(problem, '9g9f', first.next.sfen, first.next.step)).toMatchObject({ correct: true, solved: true });
    // 詰まない読み筋や、長すぎる詰みは問題にしない(短ければ、答えを書かない詰み探索の問題にする)。
    expect(buildReviewProblem({ sfen: ALT_3, mateLength: 3, line: ['7d8d', '9d9e', '9g9e'] })).toMatchObject({ kind: 'mate' });
    expect(buildReviewProblem({ sfen: ALT_3, mateLength: 5, line: ['7d8d', '9d9e', '9g9f'] })).toBeNull();
    expect(buildReviewProblem({ sfen: ALT_3, mateLength: 17, line: [] })).toBeNull();
  });

  it('読み筋と違っても、詰む王手なら正解にして、詰み探索で続ける(別の正しい答えを不正解にしない)', () => {
    const problem = buildReviewProblem({ sfen: ALT_3, mateLength: 3, line: ['7d8d', '9d9e', '9g9f'] });
    const other = judgeProblemMove(problem, 'R*8d');
    expect(other).toMatchObject({ correct: true, solved: false });
    expect(other.speech).toContain('対局の読み筋とは違うけど');
    // 違う詰み方に進んだあとのヒントは、いまの局面から探す。
    expect(problemHint(problem, other.next.sfen, other.next.step)?.text).toBeTruthy();
    expect(other.line).toEqual(['R*8d', '9d9c']);
    const mate = judgeProblemMove(problem, '8d8c+', other.next.sfen, other.next.step);
    expect(mate.solved).toBe(true);
    // 詰まない王手は、逃げ方を見せる。王手でない手は、王手を促す。
    expect(judgeProblemMove(problem, 'R*9b')).toMatchObject({ correct: false });
    expect(judgeProblemMove(problem, '9g9f').speech).toContain('王手になっていない');
  });

  it('保存して読み直せ、壊れた保存や長い詰みは読まない', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    const problem = buildReviewProblem({ sfen: MATE_1, mateLength: 1, at: 1 });
    saveReviewProblems(storage, [problem]);
    expect(loadReviewProblems(storage)).toEqual([problem]);
    const lined = buildReviewProblem({ sfen: ALT_3, mateLength: 3, line: ['7d8d', '9d9e', '9g9f'], at: 2 });
    saveReviewProblems(storage, [problem, lined]);
    expect(loadReviewProblems(storage)).toEqual([problem, lined]);
    data.set(REVIEW_PROBLEMS_KEY, JSON.stringify([{ ...problem, depth: 9 }, { id: 'x', sfen: MATE_1, kind: 'mate', depth: 1 }, { ...lined, line: ['7d8d'] }]));
    expect(loadReviewProblems(storage)).toEqual([]);
    data.set(REVIEW_PROBLEMS_KEY, '{broken');
    expect(loadReviewProblems(storage)).toEqual([]);
  });
});
