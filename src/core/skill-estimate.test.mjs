import { describe, expect, it } from 'vitest';
import {
  CONFIRM_SPREAD, LOG_LOSS_TABLES, MAX_DIAGNOSED_LEVEL, MAX_MEASURE_GAMES, estimateSkill, levelForAverageLoss, measurableMoves,
  measureFollowUp, measureStatistics, nextMeasureLevel, restoredMeasureState,
} from './skill-estimate.mjs';

const movesWithLoss = (loss, count, mover = 'black', standing = 0) => (
  Array.from({ length: count }, () => ({ moveMeasure: { mover, loss, standing } }))
);

describe('skill estimate', () => {
  it('maps the recent average loss (R内容) to levels monotonically along the measured table', () => {
    // 強さの分かっているCPUの対局から作った表(docs/skill-measure-design.mdの7章)。損が大きいほど弱い。
    expect(levelForAverageLoss(5000)).toBe(0);
    expect(levelForAverageLoss(1)).toBe(46);
    expect(levelForAverageLoss(226)).toBeCloseTo(20, 6);
    expect(levelForAverageLoss(150)).toBeCloseTo(26, 6);
    let previous = Infinity;
    for (const loss of [100, 120, 150, 200, 300, 400, 460]) {
      const level = levelForAverageLoss(loss);
      expect(level).toBeLessThan(previous);
      previous = level;
    }
  });

  it('keeps the loss tables decreasing with level, and diagnoses up to the strongest measured CPU', () => {
    for (const phases of Object.values(LOG_LOSS_TABLES)) {
      expect(Object.keys(phases)).toEqual(['opening', 'middle', 'ending']);
      for (const table of Object.values(phases)) {
        for (let index = 1; index < table.length; index += 1) {
          expect(table[index][0]).toBeGreaterThan(table[index - 1][0]);
          expect(table[index][1]).toBeLessThanOrEqual(table[index - 1][1]);
        }
      }
    }
    expect(MAX_DIAGNOSED_LEVEL).toBe(47);
  });

  it('estimates a stronger level from smaller losses, with a range and a kyu/dan label', () => {
    const weak = estimateSkill(movesWithLoss(200, 30), 'black');
    const middle = estimateSkill(movesWithLoss(40, 30), 'black');
    const strong = estimateSkill([...movesWithLoss(0, 24), ...movesWithLoss(60, 6)], 'black');
    expect(weak.level).toBeLessThan(middle.level);
    expect(middle.level).toBeLessThan(strong.level);
    expect(middle).toMatchObject({ insufficient: false, count: 30, averageLoss: 40 });
    expect(middle.label).toMatch(/級|段/);
    expect(middle.ratingLow).toBeLessThanOrEqual(middle.rating);
    expect(middle.ratingHigh).toBeGreaterThanOrEqual(middle.rating);
    // 相手の手(white)は数えない。
    expect(estimateSkill([...movesWithLoss(40, 30), ...movesWithLoss(900, 30, 'white')], 'black').level).toBeCloseTo(middle.level, 6);
  });

  it('compares each move with the table of its phase (opening moves are easy for everyone)', () => {
    // 同じ小さな損でも、序盤の手だけなら強くは出ない(序盤はだれでも損が小さい)。中盤で同じ損なら強く出る。
    const at = (ply, loss) => ({ ply, moveMeasure: { mover: 'black', loss, standing: 0 } });
    const opening = Array.from({ length: 15 }, (_, index) => at(index * 2 + 1, 30));
    const middle = Array.from({ length: 15 }, (_, index) => at(41 + index * 2, 30));
    expect(estimateSkill(middle, 'black').level).toBeGreaterThan(estimateSkill(opening, 'black').level + 3);
    // 手数の分からない古い持ち越しの手は、中盤として数える。
    expect(estimateSkill([], 'black', middle.map(({ moveMeasure }) => ({ loss: moveMeasure.loss, standing: 0 }))).level)
      .toBeCloseTo(estimateSkill(middle, 'black').level, 6);
    expect(measurableMoves(middle, 'black')[0]).toEqual({ loss: 30, standing: 0, ply: 41 });
  });

  it('offers a confirming game near the estimate when the estimate is still wide', () => {
    const wide = { insufficient: false, level: 33.6, spread: CONFIRM_SPREAD + 1 };
    expect(measureFollowUp({ estimate: wide, games: 1, opponent: 24, outcome: 'win' })).toEqual({ kind: 'confirm', level: 34 });
    expect(measureFollowUp({ estimate: { ...wide, spread: CONFIRM_SPREAD - 1 }, games: 1, opponent: 24, outcome: 'win' })).toBeNull();
    // 測れる手が足りないときは、勝ち負けで相手を動かす(前と同じ)。
    expect(measureFollowUp({ estimate: { insufficient: true }, games: 1, opponent: 24, outcome: 'loss' })).toEqual({ kind: 'more', level: 18 });
    // 最初の1局を含めて3局まで。推定のLvは測れる範囲に収める。
    expect(measureFollowUp({ estimate: wide, games: MAX_MEASURE_GAMES, opponent: 24, outcome: 'win' })).toBeNull();
    expect(measureFollowUp({ estimate: { ...wide, level: 49 }, games: 2, opponent: 40, outcome: 'win' })?.level).toBe(MAX_DIAGNOSED_LEVEL);
    // 1局だけの推定はたいてい幅が広く、2局分の手と勝ち負けを合わせると狭くなる。
    const game = (loss) => movesWithLoss(loss, 20);
    const one = estimateSkill(game(60), 'black', [], { results: [{ opponent: 24, score: 1 }] });
    const two = estimateSkill(game(60), 'black', measurableMoves(game(60), 'black'), { results: [{ opponent: 24, score: 1 }, { opponent: 30, score: 1 }] });
    expect(two.spread).toBeLessThan(one.spread);
  });

  it('uses the same-read loss (measureLoss) when the analysis has it', () => {
    // 読みのぶれで損120に見える最善手も、診断の損は0。
    const noisy = Array.from({ length: 20 }, () => ({ moveMeasure: { mover: 'black', loss: 120, measureLoss: 0, standing: 0 } }));
    expect(estimateSkill(noisy, 'black').averageLoss).toBe(0);
    expect(measurableMoves(noisy, 'black')[0]).toMatchObject({ loss: 0, standing: 0 });
  });

  it('moves the estimate with the game result against the opponent level', () => {
    const points = movesWithLoss(60, 25);
    const alone = estimateSkill(points, 'black').level;
    const won = estimateSkill(points, 'black', [], { results: [{ opponent: 30, score: 1 }] }).level;
    const lost = estimateSkill(points, 'black', [], { results: [{ opponent: 30, score: 0 }] }).level;
    expect(won).toBeGreaterThan(alone);
    expect(lost).toBeLessThan(alone);
    // 勝ち負けを合わせると、推定の幅は狭くなる。
    const range = (estimate) => estimate.ratingHigh - estimate.ratingLow;
    expect(range(estimateSkill(points, 'black', [], { results: [{ opponent: 30, score: 1 }] }))).toBeLessThanOrEqual(range(estimateSkill(points, 'black')));
  });

  it('reads the shallower phone analysis with its own table', () => {
    const points = movesWithLoss(25, 30);
    expect(estimateSkill(points, 'black', [], { plan: 'compact' }).level)
      .not.toBeCloseTo(estimateSkill(points, 'black', [], { plan: 'desktop' }).level, 1);
  });

  it('skips decided positions and reports too few moves', () => {
    const decided = movesWithLoss(10, 50, 'black', 3000);
    expect(estimateSkill(decided, 'black')).toEqual({ insufficient: true, count: 0 });
    expect(estimateSkill(movesWithLoss(100, 9), 'black')).toEqual({ insufficient: true, count: 9 });
  });

  it('caps a single huge blunder and marks a wide estimate as reference', () => {
    const points = [...movesWithLoss(50, 11), { moveMeasure: { mover: 'black', loss: 90000, standing: 0 } }];
    const estimate = estimateSkill(points, 'black');
    expect(estimate.averageLoss).toBe(Math.round((50 * 11 + 1000) / 12));
    expect(['reference', 'estimate']).toContain(estimate.reliability);
    expect(estimateSkill(movesWithLoss(0, 60), 'black', [], { results: [{ opponent: 40, score: 1 }, { opponent: 46, score: 1 }] }).reliability).not.toBe('reference');
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
    expect(carried).toEqual(Array.from({ length: 6 }, () => ({ loss: 100, standing: 0, ply: undefined })));
    expect(estimateSkill(movesWithLoss(200, 6), 'black')).toEqual({ insufficient: true, count: 6 });
    const pooled = estimateSkill(movesWithLoss(200, 6), 'black', carried, { results: [{ opponent: 20, score: 0 }, { opponent: 14, score: 1 }] });
    expect(pooled).toMatchObject({ insufficient: false, count: 12, averageLoss: 150 });
  });

  it('moves the next measuring opponent toward the player within the diagnosed range', () => {
    expect(nextMeasureLevel({ level: 10, outcome: 'win' })).toBe(16);
    expect(nextMeasureLevel({ level: 10, outcome: 'loss' })).toBe(4);
    // Lv0は練習相手なので、測定はLv1(24級)から。上は診断の上端まで。
    expect(nextMeasureLevel({ level: 4, outcome: 'loss' })).toBe(1);
    expect(nextMeasureLevel({ level: 34, outcome: 'win' })).toBe(40);
    expect(nextMeasureLevel({ level: 44, outcome: 'win' })).toBe(Math.floor(MAX_DIAGNOSED_LEVEL));
    expect(nextMeasureLevel({ level: 15, outcome: 'draw' })).toBe(15);
    expect(MAX_MEASURE_GAMES).toBeGreaterThanOrEqual(2);
  });

  it('restores the saved measuring state and drops broken parts', () => {
    expect(restoredMeasureState(null)).toBeNull();
    const restored = restoredMeasureState({
      carry: { moves: [{ loss: 30, standing: 10 }, { loss: 'x', standing: 0 }], games: 1, results: [{ opponent: 24, score: 1 }, { opponent: 3, score: 2 }] },
      welcome: 'player',
      settingsBefore: { coachLevel: 'detailed' },
    });
    expect(restored).toEqual({
      carry: { moves: [{ loss: 30, standing: 10 }], games: 1, results: [{ opponent: 24, score: 1 }] },
      welcome: 'player',
      settingsBefore: { coachLevel: 'detailed' },
    });
    expect(restoredMeasureState({ carry: { games: 0 }, welcome: 'x', settingsBefore: [] })).toEqual({ carry: null, welcome: '', settingsBefore: null });
  });
});
