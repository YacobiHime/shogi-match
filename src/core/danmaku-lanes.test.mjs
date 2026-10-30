import { describe, expect, it } from 'vitest';
import { collides, createDanmaku, estimateTextWidth, placeComment } from './danmaku-lanes.mjs';

const W = 400;

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

describe('placeComment(ニコニコ動画の置き方をもとに、探し始める高さを無作為にする。45章)', () => {
  const H = 300;
  const area = { duration: 4000, areaWidth: W, areaHeight: H, height: 20, gap: 20 };
  /** 決まった順の乱数(テストで同じ結果にする)。 */
  const seq = (...values) => { let index = 0; return () => values[index++ % values.length]; };
  const overlapY = (a, b) => a.top < b.top + 20 && b.top < a.top + 20;

  it('空いていれば、無作為に選んだ高さにそのまま置く', () => {
    const state = createDanmaku();
    expect(placeComment(state, { ...area, start: 0, width: 100, random: seq(0.5) })).toEqual({ top: 140, start: 0, crowded: false });
  });
  it('ぶつかるコメントがあれば、そのすぐ下へずらす。下の端まで行けば上の端へ回る', () => {
    const state = createDanmaku();
    placeComment(state, { ...area, start: 0, width: 100, random: seq(0.5) });
    const next = placeComment(state, { ...area, start: 0, width: 100, random: seq(0.5) });
    expect(next.top).toBe(160);
    // 下の端の近くから探して空きがなければ、上の端(0)に置く。
    const bottom = createDanmaku();
    placeComment(bottom, { ...area, start: 0, width: 100, random: seq(1) });
    expect(placeComment(bottom, { ...area, start: 0, width: 100, random: seq(1) }).top).toBe(0);
  });
  it('流れているあいだにぶつからないコメントとは、同じ高さに置いてよい(先のコメントが出きったあとなど)', () => {
    const state = createDanmaku();
    placeComment(state, { ...area, start: 0, width: 100, random: seq(0.5) });
    expect(placeComment(state, { ...area, start: 3500, width: 100, random: seq(0.5) }).top).toBe(140);
  });
  it('どこにも空きがなければ(弾幕)、待たずに無作為の高さに置く', () => {
    const state = createDanmaku();
    const small = { ...area, areaHeight: 40 };
    placeComment(state, { ...small, start: 0, width: 100, random: seq(0) });
    placeComment(state, { ...small, start: 0, width: 100, random: seq(0) });
    const crowded = placeComment(state, { ...small, start: 0, width: 100, random: seq(0.25) });
    expect(crowded).toMatchObject({ start: 0, crowded: true });
    expect(crowded.top).toBeGreaterThanOrEqual(0);
    expect(crowded.top).toBeLessThanOrEqual(20);
  });
  it('0.4秒ずつ流す60個のコメントは、欄の上下に散らばり(上半分と下半分の両方に2割以上)、1つも重ならない', () => {
    const state = createDanmaku();
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const placed = [];
    for (let index = 0; index < 60; index += 1) {
      const width = 60 + (index * 37) % 260;
      const result = placeComment(state, { ...area, start: index * 400, width, random });
      placed.push({ ...result, width, duration: 4000 });
    }
    const upper = placed.filter(({ top }) => top < H / 2).length;
    expect(upper / placed.length).toBeGreaterThan(0.2);
    expect(upper / placed.length).toBeLessThan(0.8);
    expect(placed.every(({ crowded }) => !crowded)).toBe(true);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        if (overlapY(placed[i], placed[j])) expect(collides(placed[i], placed[j], W, 0)).toBe(false);
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
