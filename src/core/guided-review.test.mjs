import { describe, expect, test } from 'vitest';

import { buildGuidedReview, guidedReviewSummary, winRateFor } from './guided-review.mjs';

const cp = (value) => ({ type: 'cp', value });
const mate = (value) => ({ type: 'mate', value });
const point = (ply, score, extra = {}) => ({ ply, score, bestMove: `best${ply}`, pv: [`best${ply}`], ...extra });
const annotated = (kind, mover) => ({ annotation: { kind, label: kind, mover } });
const movesOf = (count) => Array.from({ length: count }, (_, index) => `move${index + 1}`);

describe('振り返りの台本', () => {
  test('勝率は指した側から見る', () => {
    expect(winRateFor(cp(0), 'black')).toBe(0.5);
    expect(winRateFor(cp(600), 'black')).toBeGreaterThan(0.7);
    expect(winRateFor(cp(600), 'white')).toBeLessThan(0.3);
    expect(winRateFor(mate(3), 'white')).toBe(0);
  });

  test('プレイヤーの敗着の前で止まって考えさせる', () => {
    const points = [
      point(0, cp(0)), point(1, cp(50)), point(2, cp(30)),
      point(3, cp(-1500), annotated('mistake', 'black')), point(4, cp(-1600)),
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', winner: 'white', moves: movesOf(4) });
    expect(review.losingPly).toBe(3);
    const quiz = review.steps.get(2)?.quiz;
    expect(quiz?.type).toBe('losing');
    expect(quiz?.question).toContain('敗着');
    expect(quiz?.question).toContain('他の手は無かったかな');
    expect(quiz?.bestMove).toBe('best2');
    expect(review.steps.get(3)?.comment).toContain('敗着');
  });

  test('見逃した詰みは手数を伝えて考えさせる', () => {
    const points = [point(0, cp(0)), point(1, cp(100)), point(2, mate(5)), point(3, cp(400)), point(4, cp(500))];
    const review = buildGuidedReview(points, { playerColor: 'black', winner: 'black', moves: movesOf(4) });
    const quiz = review.steps.get(2)?.quiz;
    expect(quiz?.type).toBe('mate');
    expect(quiz?.question).toBe('ここで5手詰めがあったよ！詰ませ方を探してみよう。');
  });

  test('最善手で詰ませたなら詰みの見逃しにしない', () => {
    const points = [point(0, cp(0)), point(1, cp(100)), point(2, mate(5)), point(3, mate(4))];
    const review = buildGuidedReview(points, { playerColor: 'black', winner: 'black', moves: ['m1', 'm2', 'best2'] });
    expect(review.steps.get(2)?.quiz).toBeUndefined();
  });

  test('勝った側の好手を決め手として止まる', () => {
    const points = [
      point(0, cp(0)), point(1, cp(100)), point(2, cp(80)),
      point(3, cp(1200), annotated('good', 'black')), point(4, cp(1300)), point(5, cp(2000)),
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', winner: 'black', moves: movesOf(5) });
    expect(review.decisivePly).toBe(3);
    expect(review.steps.get(3)).toMatchObject({ comment: 'この手が勝負の決め手になったね！', pause: true });
  });

  test('相手の手では考えさせず、説明だけする', () => {
    const points = [
      point(0, cp(0)), point(1, cp(30)), point(2, cp(1500), annotated('blunder', 'white')), point(3, cp(1600)),
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', winner: 'black', moves: movesOf(3) });
    expect(review.steps.get(1)?.quiz).toBeUndefined();
    expect(review.steps.get(2)).toMatchObject({ pause: true });
    expect(review.steps.get(2)?.comment).toContain('相手のこの手が敗着');
  });

  test('考えさせる局面は上限までに絞り、敗着は必ず残す', () => {
    const points = [point(0, cp(0))];
    let value = 0;
    for (let ply = 1; ply <= 20; ply += 1) {
      // 先手（プレイヤー）が毎手少しずつ悪手を指す。
      if (ply % 2 === 1) value -= ply === 9 ? 1200 : 100;
      points.push(point(ply, cp(value), ply % 2 === 1 ? annotated('mistake', 'black') : {}));
    }
    const review = buildGuidedReview(points, { playerColor: 'black', winner: 'white', moves: movesOf(20), quizLimit: 3 });
    const quizzes = [...review.steps.values()].filter((step) => step.quiz);
    expect(quizzes).toHaveLength(3);
    expect(review.losingPly).toBe(9);
    expect(review.steps.get(8)?.quiz?.type).toBe('losing');
  });

  test('敗着の直後の手は決め手にしない', () => {
    const points = [
      point(0, cp(0)), point(1, cp(30)), point(2, cp(20)),
      point(3, cp(-1500), annotated('blunder', 'black')), point(4, cp(-1500)), point(5, cp(-1600)), point(6, cp(-1700)),
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', winner: 'white', moves: movesOf(6) });
    expect(review.losingPly).toBe(3);
    expect(review.decisivePly).toBeNull();
  });

  test('最後の一言', () => {
    expect(guidedReviewSummary({ quizCount: 0 })).toContain('いい将棋');
    expect(guidedReviewSummary({ quizCount: 3, solved: 1 })).toContain('3問のうち、1問');
  });
});
