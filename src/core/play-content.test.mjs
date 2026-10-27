import { describe, expect, it } from 'vitest';
import { CONTENT_DIFFICULTY, MIN_CONTENT_EVENTS, contentEstimate, contentEvents } from './play-content.mjs';

// 先手の飛車(5八)と後手の飛車(5五)がにらみ合う。先手は飛車をタダで取れる(取れる駒)。先手の飛車は玉が守っている。
const BEFORE = '4k4/9/9/9/4r4/9/9/4R4/4K4 b - 1';
const TOOK = '4k4/9/9/9/4R4/9/9/9/4K4 w R 1';
// 玉が端にいて、飛車に守りがない形。
const LOOSE = '4k4/9/9/9/4r4/9/9/4R4/8K b - 1';
const LEFT = '4k4/9/9/9/4r4/9/9/3R5/8K w - 1';
const point = (ply, extra) => ({ ply, score: { type: 'cp', value: 0 }, ...extra });

describe('対局の場面採点', () => {
  it('取れる駒の場面で、損をしなかったかを数える。守られている駒は「守る駒」にしない', () => {
    const took = contentEvents({
      points: [point(0, { bestMove: '5h5e' }), point(1, { moveMeasure: { mover: 'black', loss: 0, measureLoss: 0, standing: 50 } })],
      sfens: [BEFORE, TOOK], moves: ['5h5e'], color: 'black',
    });
    expect(took.map(({ kind, correct }) => [kind, correct])).toEqual([['take', true], ['safe', true]]);
    expect(took[0].b).toBe(CONTENT_DIFFICULTY.take);
    // 取らずに飛車を横へ逃げた: 取れる駒を逃した(損が大きい)が、駒損はしていない。
    const missed = contentEvents({
      points: [point(0, { bestMove: '5h5e' }), point(1, { moveMeasure: { mover: 'black', loss: 1500, measureLoss: 1200, standing: 50 } })],
      sfens: [LOOSE, LEFT], moves: ['5h6h'], color: 'black',
    });
    expect(missed.find(({ kind }) => kind === 'take')?.correct).toBe(false);
    expect(missed.find(({ kind }) => kind === 'safe')?.correct).toBe(true);
    // 玉の守りがなければ、何もしないと飛車を取られる(守る駒)。
    const loose = contentEvents({
      points: [point(0, { bestMove: '5h5e' }), point(1, { moveMeasure: { mover: 'black', loss: 0, measureLoss: 0, standing: 50 } })],
      sfens: [LOOSE, '4k4/9/9/9/4R4/9/9/9/8K w R 1'], moves: ['5h5e'], color: 'black',
    });
    expect(loose.map(({ kind }) => kind)).toEqual(['take', 'save', 'safe']);
    // 相手の手は数えない。
    expect(contentEvents({ points: [point(0, {}), point(1, { moveMeasure: { mover: 'white', loss: 0, standing: 0 } })], sfens: [BEFORE, TOOK], moves: ['5h5e'], color: 'black' })).toEqual([]);
  });

  it('詰みがある場面では、逃さなかったかだけを数える(難しさは手数で決める)', () => {
    const mate = (afterScore) => contentEvents({
      points: [point(0, { score: { type: 'mate', value: 3 } }), point(1, { score: afterScore, moveMeasure: { mover: 'black', loss: 0, standing: 30000 } })],
      sfens: [BEFORE, TOOK], moves: ['5h5e'], color: 'black',
    });
    expect(mate({ type: 'mate', value: 2 })).toEqual([{ kind: 'mate', ply: 1, b: CONTENT_DIFFICULTY.mate[3], correct: true }]);
    expect(mate({ type: 'cp', value: 400 })[0].correct).toBe(false);
  });

  it('場面が少なければ中身の強さは出さない。多ければ、できた割合で強さが変わる', () => {
    const events = (correctRate, n = 30) => Array.from({ length: n }, (_, index) => ({ kind: 'safe', ply: index, b: 10, correct: index < correctRate * n }));
    expect(contentEstimate(events(1, MIN_CONTENT_EVENTS - 1))).toBeNull();
    const good = contentEstimate(events(0.95));
    const poor = contentEstimate(events(0.5));
    expect(good.level).toBeGreaterThan(poor.level);
    expect(good.counts.safe).toEqual({ n: 30, hit: 29 });
  });
});
