import { describe, expect, it } from 'vitest';
import { estimateSkill, levelForAverageLoss, measureStatistics } from './skill-estimate.mjs';

const movesWithLoss = (loss, count, mover = 'black', standing = 0) => (
  Array.from({ length: count }, () => ({ moveMeasure: { mover, loss, standing } }))
);

describe('skill estimate', () => {
  it('maps average loss to levels monotonically, hitting the measured anchors', () => {
    expect(levelForAverageLoss(405)).toBeCloseTo(1);
    expect(levelForAverageLoss(168)).toBeCloseTo(10);
    expect(levelForAverageLoss(102)).toBeCloseTo(20);
    expect(levelForAverageLoss(5000)).toBe(0);
    expect(levelForAverageLoss(1)).toBe(40);
    let previous = Infinity;
    for (const loss of [20, 50, 80, 100, 150, 200, 300, 500, 900]) {
      const level = levelForAverageLoss(loss);
      expect(level).toBeLessThan(previous);
      previous = level;
    }
  });

  it('estimates rating and a kyu/dan label from the player moves only', () => {
    const points = [...movesWithLoss(134, 30), ...movesWithLoss(900, 30, 'white')];
    const estimate = estimateSkill(points, 'black');
    expect(estimate.insufficient).toBe(false);
    expect(estimate).toMatchObject({ count: 30, averageLoss: 134, rating: 1200, label: '十二級程度', reliability: 'estimate' });
    expect(estimate.ratingLow).toBeLessThanOrEqual(estimate.rating);
    expect(estimate.ratingHigh).toBeGreaterThanOrEqual(estimate.rating);
  });

  it('skips decided positions and reports too few moves', () => {
    const decided = movesWithLoss(10, 50, 'black', 3000);
    expect(estimateSkill(decided, 'black')).toEqual({ insufficient: true, count: 0 });
    expect(estimateSkill(movesWithLoss(100, 9), 'black')).toEqual({ insufficient: true, count: 9 });
  });

  it('caps a single huge blunder and marks short games as reference', () => {
    const points = [...movesWithLoss(50, 11), { moveMeasure: { mover: 'black', loss: 90000, standing: 0 } }];
    const estimate = estimateSkill(points, 'black');
    expect(estimate.averageLoss).toBe(Math.round((50 * 11 + 1000) / 12));
    expect(estimate.reliability).toBe('reference');
  });

  it('summarizes phases, move grades and the worst move for the notebook result', () => {
    const point = (ply, loss, extra = {}) => ({
      ply, label: `${ply}手目 ▲テスト`, moveMeasure: { mover: 'black', loss, standing: 0 }, ...extra,
    });
    const points = [
      point(1, 20), point(3, 40), point(31, 900, { annotation: { kind: 'mistake', mover: 'black', loss: 900 } }),
      point(33, 100, { annotation: { kind: 'good', mover: 'black' } }), point(81, 60),
      point(83, 3000, { moveMeasure: { mover: 'black', loss: 3000, standing: 2500 } }),
      { ply: 2, moveMeasure: { mover: 'white', loss: 500, standing: 0 } },
    ];
    const stats = measureStatistics(points, 'black');
    expect(stats.moves).toBe(6);
    expect(stats.measuredMoves).toBe(5);
    expect(stats.phases.map(({ count, averageLoss }) => [count, averageLoss])).toEqual([[2, 30], [2, 500], [1, 60]]);
    expect(stats.kinds).toMatchObject({ mistake: 1, good: 1, blunder: 0 });
    expect(stats.worst).toEqual({ ply: 31, label: '31手目 ▲テスト', loss: 900 });
    expect(measureStatistics([], 'black').worst).toBeNull();
  });
});
