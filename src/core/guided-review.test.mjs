import { describe, expect, test } from 'vitest';

import {
  GUIDED_REVIEW_COMMENT_MS,
  GUIDED_REVIEW_SPEEDS,
  GUIDED_REVIEW_STEP_MS,
  buildGuidedReview,
  guidedReviewDelay,
  guidedReviewSummary,
  nextGuidedReviewSpeed,
  normalizeCpuNotes,
  normalizeGuidedReviewSpeed,
  oversightReason,
  winRateFor,
} from './guided-review.mjs';

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
    expect(quiz?.question).toBe('ここに5手詰めがあったね。詰ませてみよう！');
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

describe('guided review speed', () => {
  test('keeps the current interval at the normal speed and shortens it when faster', () => {
    expect(guidedReviewDelay(false, 'normal')).toBe(GUIDED_REVIEW_STEP_MS);
    expect(guidedReviewDelay(true, 'normal')).toBe(GUIDED_REVIEW_COMMENT_MS);
    const delays = GUIDED_REVIEW_SPEEDS.map(({ id }) => guidedReviewDelay(false, id));
    expect(delays).toEqual([...delays].sort((a, b) => b - a));
    expect(guidedReviewDelay(true, 'fastest')).toBeLessThan(guidedReviewDelay(true, 'normal'));
  });

  test('falls back to normal for unknown ids and cycles through every speed', () => {
    expect(normalizeGuidedReviewSpeed(null)).toBe('normal');
    expect(normalizeGuidedReviewSpeed('warp')).toBe('normal');
    expect(guidedReviewDelay(false, 'warp')).toBe(GUIDED_REVIEW_STEP_MS);
    const seen = [];
    let id = 'slow';
    for (let i = 0; i < GUIDED_REVIEW_SPEEDS.length; i += 1) {
      seen.push(id);
      id = nextGuidedReviewSpeed(id);
    }
    expect(id).toBe('slow');
    expect(seen).toEqual(GUIDED_REVIEW_SPEEDS.map((speed) => speed.id));
  });
});

describe('CPUが間違えた理由(13-4)', () => {
  // CPU(先手)が▲3六歩と突き、後手の飛車(4二)に4八の金をタダで取られる形にする。プレイヤーは後手。
  const GOLD = '8k/5r3/9/9/9/9/2P3P2/2B2G3/K8 b - 1';
  const hanging = { kind: 'hanging', square: '4h', piece: 'G', attacker: 'R', hard: ['far'] };
  const reviewWith = (cpuNotes) => buildGuidedReview(
    [{ ply: 0, score: cp(0), bestMove: '4h3h' }, { ply: 1, score: cp(-600), bestMove: '4b4h+' }, { ply: 2, score: cp(-700), bestMove: '9i8h' }],
    { playerColor: 'white', moves: ['3g3f', '4b4h+'], initialSfen: GOLD, cpuNotes },
  );

  test('駒をタダで取られる形にした手に、気づかなかった当たりの理由を足す', () => {
    expect(reviewWith({}).steps.get(1)?.comment).toBe('相手の金がタダで取れる形になったよ！');
    expect(reviewWith({ 1: [hanging] }).steps.get(1)?.comment).toBe('相手の金がタダで取れる形になったよ！相手は、遠くの飛車の利きに気づかなかったみたい。');
    // 記録の升が盤の事実と合わなければ、言わない。
    expect(reviewWith({ 1: [{ ...hanging, square: '5h' }] }).steps.get(1)?.comment).toBe('相手の金がタダで取れる形になったよ！');
  });

  test('見えにくさごとの言い方', () => {
    const info = { leftFree: { square: '4h', name: '金' } };
    expect(oversightReason(info, null, [{ ...hanging, hard: ['away'] }])).toBe('相手は、離れた場所の金の当たりに気づかなかったみたい。');
    expect(oversightReason(info, null, [{ ...hanging, hard: [] }])).toBe('相手は、金の当たりに気づかなかったみたい。');
    expect(oversightReason({ allowedMate: true }, null, [{ kind: 'mate', plies: 7 }])).toBe('相手は、詰みの筋に気づかなかったみたい。');
    expect(oversightReason({ missedMate: 7 }, null, [{ kind: 'own-mate', plies: 7 }])).toBe('長い詰みは、相手にも見えにくかったみたい。');
    // 短い詰みの見逃しは、見逃しの一言で足りる。
    expect(oversightReason({ missedMate: 3 }, null, [{ kind: 'own-mate', plies: 3 }])).toBe('');
    const previous = { leftFree: { square: '5e', name: '銀' } };
    expect(oversightReason({ tookFree: null }, previous, [{ kind: 'free', square: '5e', piece: 'S', hard: ['back'] }])).toBe('後ろに下がって取る手は、見えにくいんだ。');
    expect(oversightReason({ tookFree: null }, previous, [{ kind: 'free', square: '5e', piece: 'S', hard: [] }])).toBe('');
  });

  test('保存から戻す記録は、形をそろえ、待ったで戻した手を捨てる', () => {
    expect(normalizeCpuNotes({ 1: [hanging, { kind: 'x' }], 3: [{ kind: 'mate', plies: 5 }], 9: [hanging], a: [hanging] }, 4))
      .toEqual({ 1: [hanging], 3: [{ kind: 'mate', plies: 5 }] });
    expect(normalizeCpuNotes(null, 4)).toEqual({});
    expect(normalizeCpuNotes({ 2: [{ ...hanging, square: 'zz' }] }, 4)).toEqual({});
  });
});
