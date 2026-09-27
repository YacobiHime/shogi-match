import { describe, expect, it } from 'vitest';
import { graphScoreRatio, nearestPlyFromPlotPoint } from './evaluation-graph-selection.mjs';

describe('棋譜解析グラフの縦軸', () => {
  it('互角を中央、先手・後手の優勢を上下対称に置く', () => {
    expect(graphScoreRatio(0)).toBe(0);
    expect(graphScoreRatio(1000)).toBeCloseTo(-graphScoreRatio(-1000));
  });

  it('実戦で多い±2000までを広く使い、大差は端へ寄せる', () => {
    expect(graphScoreRatio(500)).toBeGreaterThan(0.35);
    expect(graphScoreRatio(2000)).toBeGreaterThan(0.9);
    expect(graphScoreRatio(6000)).toBeLessThanOrEqual(1);
    expect(graphScoreRatio(6000) - graphScoreRatio(3000)).toBeLessThan(0.05);
  });
});

describe('棋譜解析グラフのクリック位置', () => {
  it('画面上のプロット領域に合わせて最寄りの手数を選ぶ', () => {
    expect(nearestPlyFromPlotPoint(250, 100, 600, 120)).toBe(30);
    expect(nearestPlyFromPlotPoint(400, 100, 600, 120)).toBe(60);
    expect(nearestPlyFromPlotPoint(550, 100, 600, 120)).toBe(90);
  });

  it('プロット外のクリックを開始局面と最終局面へ丸める', () => {
    expect(nearestPlyFromPlotPoint(50, 100, 600, 120)).toBe(0);
    expect(nearestPlyFromPlotPoint(750, 100, 600, 120)).toBe(120);
  });

  it('横幅や画面上の位置が変わっても同じ割合を選ぶ', () => {
    expect(nearestPlyFromPlotPoint(300, 200, 400, 81)).toBe(20);
    expect(nearestPlyFromPlotPoint(450, 150, 1200, 81)).toBe(20);
  });

  it('0手の棋譜は常に開始局面を選ぶ', () => {
    expect(nearestPlyFromPlotPoint(400, 100, 600, 0)).toBe(0);
  });
});
