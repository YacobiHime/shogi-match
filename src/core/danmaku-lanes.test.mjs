import { describe, expect, it } from 'vitest';
import { collides, createDanmaku, estimateTextWidth, placeComment } from './danmaku-lanes.mjs';

const W = 400;
const base = { duration: 5000, areaWidth: W, laneCount: 6, gap: 20 };

describe('collides', () => {
  it('同じ速さなら、入る時に離れていれば、ずっと重ならない', () => {
    expect(collides({ start: 0, width: 100, duration: 5000 }, { start: 2000, width: 100, duration: 5000 }, W, 20)).toBe(false);
    // 0.2秒後では、前のコメントの後ろの端がまだ右の端の外に残っている。
    expect(collides({ start: 0, width: 100, duration: 5000 }, { start: 200, width: 100, duration: 5000 }, W, 20)).toBe(true);
  });
  it('長いコメントは速いので、短いコメントのすぐ後ろに入ると追いつく', () => {
    const short = { start: 0, width: 40, duration: 5000 };
    const long = { start: 900, width: 360, duration: 5000 };
    // 入る時には離れているが、左の端に着く前に追いつく。
    expect(collides(short, long, W, 0)).toBe(true);
    // 逆に、長いのが先なら短いのは追いつかない。
    expect(collides({ start: 0, width: 360, duration: 5000 }, { start: 3000, width: 40, duration: 5000 }, W, 20)).toBe(false);
  });
  it('先のコメントが出きったあとは重ならない', () => {
    expect(collides({ start: 0, width: 100, duration: 1000 }, { start: 1500, width: 100, duration: 1000 }, W, 20)).toBe(false);
  });
});

describe('placeComment', () => {
  it('同じ時に来た6つのコメントは、上から別々の段に入る', () => {
    const state = createDanmaku();
    const lanes = Array.from({ length: 6 }, () => placeComment(state, { ...base, start: 0, width: 120 }).lane);
    expect(lanes).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('間をおいて来たコメントは、空いた上の段に戻る', () => {
    const state = createDanmaku();
    placeComment(state, { ...base, start: 0, width: 80 });
    expect(placeComment(state, { ...base, start: 2500, width: 80 })).toEqual({ lane: 0, start: 2500 });
  });
  it('大きな字は2段を使い、その2段のどちらにも重ならない', () => {
    const state = createDanmaku();
    placeComment(state, { ...base, start: 0, width: 100 });
    const big = placeComment(state, { ...base, start: 0, width: 200, span: 2 });
    expect(big.lane).toBe(1);
    expect(placeComment(state, { ...base, start: 0, width: 100 }).lane).toBe(3);
  });
  it('段が全部ふさがっていれば少し待ち、待ってもだめなら重なりの少ない段にする', () => {
    const state = createDanmaku();
    const two = { ...base, laneCount: 2 };
    placeComment(state, { ...two, start: 0, width: 100 });
    placeComment(state, { ...two, start: 0, width: 100 });
    const waited = placeComment(state, { ...two, start: 0, width: 100 });
    expect(waited.start).toBeGreaterThan(0);
    expect(waited.start).toBeLessThanOrEqual(1600);
    const crowded = createDanmaku();
    for (let index = 0; index < 4; index += 1) placeComment(crowded, { ...two, start: 0, width: 100, maxWait: 0 });
    const forced = placeComment(crowded, { ...two, start: 0, width: 100, maxWait: 0 });
    expect(forced.start).toBe(0);
  });
  it('20個のコメントを0.38秒ずつ流すと、8段なら1つも重ならない', () => {
    const state = createDanmaku();
    const placed = [];
    for (let index = 0; index < 20; index += 1) {
      const width = 60 + (index * 37) % 260;
      const result = placeComment(state, { ...base, laneCount: 8, start: index * 380, width });
      placed.push({ ...result, width, duration: 5000 });
    }
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        if (placed[i].lane === placed[j].lane) expect(collides(placed[i], placed[j], W, 0)).toBe(false);
      }
    }
  });
});

describe('estimateTextWidth', () => {
  it('全角は1字、半角は0.55字で見積もる', () => {
    expect(estimateTextWidth('角換わり', 20)).toBe(80);
    expect(estimateTextWidth('8888', 20)).toBeCloseTo(44);
  });
});
