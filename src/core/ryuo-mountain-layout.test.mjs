import { describe, expect, it } from 'vitest';
import { MOUNTAIN_WIDTH, STEP_RISE, SUMMIT_RISE, mountainLayers, mountainLayout, steppedOutline } from './ryuo-mountain-layout.mjs';

describe('竜王への道の山の地図の配置', () => {
  it('下の段から頂上へ、一定の高さずつ登る。頂上(竜王)は真ん中', () => {
    const { width, height, points } = mountainLayout(9);
    expect(width).toBe(MOUNTAIN_WIDTH);
    expect(points).toHaveLength(9);
    for (let index = 1; index < points.length - 1; index += 1) {
      expect(points[index - 1].y - points[index].y).toBe(STEP_RISE);
    }
    // 頂上の下だけは、金屏風と将棋盤の分だけ広くあける。
    expect(points.at(-2).y - points.at(-1).y).toBe(SUMMIT_RISE);
    expect(points.at(-1)).toEqual({ x: MOUNTAIN_WIDTH / 2, y: points.at(-1).y });
    // 段は図の中に収まり、下に将棋会館と名前を描く余白がある。
    for (const { x, y } of points) {
      expect(x).toBeGreaterThan(40);
      expect(x).toBeLessThan(MOUNTAIN_WIDTH - 40);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height - 60);
    }
    // 左右に振って、つづら折りにする(隣り合う段が同じ横の位置にならない)。
    for (let index = 1; index < points.length - 1; index += 1) expect(points[index].x).not.toBe(points[index - 1].x);
  });

  it('防衛戦(2段)でも描ける', () => {
    const { points, height } = mountainLayout(2);
    expect(points).toHaveLength(2);
    expect(height).toBeGreaterThan(points[0].y);
  });

  it('山の輪郭は、水平な段の階段になる', () => {
    const outline = steppedOutline([[0, 100], [32, 68]], 8).split(' ').map((pair) => pair.split(',').map(Number));
    // 2点ずつ同じ高さ(水平)で、高さは8の倍数。
    for (let index = 0; index + 1 < outline.length - 1; index += 2) {
      expect(outline[index][1]).toBe(outline[index + 1][1]);
      expect(outline[index][1] % 8).toBe(0);
    }
    expect(mountainLayers(700)).toHaveLength(4);
  });
});
