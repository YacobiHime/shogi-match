import { describe, expect, it } from 'vitest';
import { MAX_DIAGNOSED_LEVEL, MAX_MEASURE_GAMES, estimateSkill, levelForAverageLoss, measurableMoves, measureStatistics, nextMeasureLevel } from './skill-estimate.mjs';
import { ladderLevelForSource } from './level-ladder.mjs';

const movesWithLoss = (loss, count, mover = 'black', standing = 0) => (
  Array.from({ length: count }, () => ({ moveMeasure: { mover, loss, standing } }))
);

describe('skill estimate', () => {
  it('maps average loss to levels monotonically within the measured range', () => {
    expect(levelForAverageLoss(5000)).toBe(0);
    // 回帰はもとの校正のLvで測った(上端はLv36)。段級位の作り直し(2026-10-22)のあとは、同じ強さの新しい表のLvで返す。
    expect(MAX_DIAGNOSED_LEVEL).toBeCloseTo(ladderLevelForSource(36), 6);
    expect(levelForAverageLoss(1)).toBeCloseTo(MAX_DIAGNOSED_LEVEL, 6);
    // もとの校正での測定値(Lv16=約228、Lv26=約119)は、今の表の5級(Lv20)〜3級(Lv22)のあたり。
    expect(levelForAverageLoss(228)).toBeGreaterThan(19);
    expect(levelForAverageLoss(228)).toBeLessThan(21.5);
    expect(levelForAverageLoss(119)).toBeGreaterThan(21);
    expect(levelForAverageLoss(119)).toBeLessThan(23);
    // 15級(もとの11.93、平均損失約310)より損が大きい人は、24級〜16級のあいだに並ぶ(約710より大きいとLv0)。
    expect(levelForAverageLoss(500)).toBeGreaterThan(1);
    expect(levelForAverageLoss(500)).toBeLessThan(10);
    let previous = Infinity;
    for (const loss of [80, 100, 150, 200, 300, 500, 900]) {
      const level = levelForAverageLoss(loss);
      expect(level).toBeLessThan(previous);
      previous = level;
    }
  });

  it('estimates rating and a kyu/dan label from the player moves only', () => {
    const points = [...movesWithLoss(134, 30), ...movesWithLoss(900, 30, 'white')];
    const estimate = estimateSkill(points, 'black');
    expect(estimate.insufficient).toBe(false);
    expect(estimate).toMatchObject({ count: 30, averageLoss: 134, rating: 1256, label: '4級程度', reliability: 'estimate' });
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

  it('carries measurable moves over from a short measuring game and pools them', () => {
    // 1局目は早く大差が付いて6手しか測れない。持ち越して、2局目の6手と合わせて診断する。
    const first = [...movesWithLoss(100, 6), ...movesWithLoss(10, 20, 'black', 2500), ...movesWithLoss(500, 6, 'white')];
    const carried = measurableMoves(first, 'black');
    expect(carried).toEqual(Array.from({ length: 6 }, () => ({ loss: 100, standing: 0 })));
    expect(estimateSkill(movesWithLoss(200, 6), 'black')).toEqual({ insufficient: true, count: 6 });
    const pooled = estimateSkill(movesWithLoss(200, 6), 'black', carried);
    expect(pooled).toMatchObject({ insufficient: false, count: 12, averageLoss: 150 });
  });

  it('moves the next measuring opponent toward the player within the diagnosed range', () => {
    expect(nextMeasureLevel({ level: 10, outcome: 'win' })).toBe(16);
    expect(nextMeasureLevel({ level: 10, outcome: 'loss' })).toBe(4);
    // Lv0は練習相手なので、測定はLv1(24級)から。上は診断の上端まで。
    expect(nextMeasureLevel({ level: 4, outcome: 'loss' })).toBe(1);
    expect(nextMeasureLevel({ level: 34, outcome: 'win' })).toBe(Math.floor(MAX_DIAGNOSED_LEVEL));
    expect(nextMeasureLevel({ level: 15, outcome: 'draw' })).toBe(15);
    expect(MAX_MEASURE_GAMES).toBeGreaterThanOrEqual(2);
  });
});
