import { describe, expect, it } from 'vitest';
import { MOUNTAIN_WIDTH, STEP_RISE, SUMMIT_RISE, WIDE_HEIGHT, WIDE_STEP_GAP, mountainLayers, mountainLayersWide, mountainLayout, mountainLayoutWide, steppedOutline } from './ryuo-mountain-layout.mjs';

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

  it('横長の図は、左の麓から右の頂上へ、段が右へ進むほど高くなる', () => {
    const { width, height, points } = mountainLayoutWide(12);
    expect(height).toBe(WIDE_HEIGHT);
    expect(points).toHaveLength(12);
    for (let index = 1; index < points.length; index += 1) expect(points[index].x).toBeGreaterThan(points[index - 1].x);
    expect(points[1].x - points[0].x).toBe(WIDE_STEP_GAP);
    // 頂上がいちばん高く、麓より上。図の中に収まる。
    const summit = points.at(-1);
    expect(Math.min(...points.map(({ y }) => y))).toBe(summit.y);
    expect(points.at(-2).y).toBeLessThan(points[0].y);
    for (const { x, y } of points) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height);
    }
    expect(mountainLayersWide(width, summit.x)).toHaveLength(4);
  });

  it('横長の図は、防衛戦の2段でも頂上が右にある', () => {
    const { width, points } = mountainLayoutWide(2);
    expect(points[1].x).toBeGreaterThan(points[0].x);
    expect(points[1].y).toBeLessThan(points[0].y);
    expect(width).toBeGreaterThan(points[1].x);
  });
});
