import { describe, expect, it } from 'vitest';
import {
  GRAPH_MATE_VALUE,
  GRAPH_MIN_AXIS_LIMIT,
  graphAxisLimit,
  graphScoreRatio,
  graphTickValues,
  isMateGraphValue,
  nearestPlyFromPlotPoint,
} from './evaluation-graph-selection.mjs';

describe('棋譜解析グラフの縦軸', () => {
  it('縦軸の上限を棋譜の最大評価値に合わせ、キリの良い値へ切り上げる', () => {
    expect(graphAxisLimit([0, 120, -340])).toBe(GRAPH_MIN_AXIS_LIMIT);
    expect(graphAxisLimit([0, 1200, -800])).toBe(1500);
    expect(graphAxisLimit([2600])).toBe(3000);
    expect(graphAxisLimit([-7200])).toBe(8000);
    // 固定の上限はなく、大差の棋譜ではさらに広がる。
    expect(graphAxisLimit([15000])).toBe(15000);
    expect(graphAxisLimit([23000])).toBe(30000);
  });

  it('詰みは縦軸の上限の計算に含めず、端に置く', () => {
    expect(isMateGraphValue(GRAPH_MATE_VALUE)).toBe(true);
    expect(isMateGraphValue(-GRAPH_MATE_VALUE)).toBe(true);
    expect(graphAxisLimit([900, GRAPH_MATE_VALUE])).toBe(GRAPH_MIN_AXIS_LIMIT);
    expect(graphScoreRatio(GRAPH_MATE_VALUE, 3000)).toBe(1);
    expect(graphScoreRatio(-GRAPH_MATE_VALUE, 3000)).toBe(-1);
  });

  it('互角を中央、先手・後手の優勢を上下対称に置き、上限で端になる', () => {
    expect(graphScoreRatio(0, 3000)).toBe(0);
    expect(graphScoreRatio(1000, 3000)).toBeCloseTo(-graphScoreRatio(-1000, 3000));
    expect(graphScoreRatio(3000, 3000)).toBeCloseTo(1);
  });

  it('大差の値も区別でき、1回の大差で序盤の変化がつぶれない', () => {
    // 上限10000でも、3000と6000ははっきり離れる。
    expect(graphScoreRatio(6000, 10000) - graphScoreRatio(3000, 10000)).toBeGreaterThan(0.15);
    // 上限10000でも、評価値500は中央から十分に離れる。
    expect(graphScoreRatio(500, 10000)).toBeGreaterThan(0.15);
    // 上限1000の棋譜では、ほぼ評価値に比例する。
    expect(graphScoreRatio(500, 1000)).toBeGreaterThan(0.5);
    expect(graphScoreRatio(500, 1000)).toBeLessThan(0.6);
  });

  it('目盛りは0と上限を先に、内側の値を上限未満だけ並べる', () => {
    expect(graphTickValues(1000).slice(0, 3)).toEqual([0, 1000, -1000]);
    expect(graphTickValues(1000)).toContain(500);
    expect(graphTickValues(1000)).not.toContain(3000);
    expect(graphTickValues(8000)).toEqual(expect.arrayContaining([0, 8000, -8000, 1000, 3000, 5000]));
    expect(graphTickValues(8000)).not.toContain(10000);
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
