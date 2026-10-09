import { describe, expect, it } from 'vitest';
import { RADAR_AXES, aggregateSeasonStats, lossScore, materialBalance, summarizeGame } from './ryuo-stats.mjs';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

/** 手数の順に、(手を指した側, 損失)の点を作る。 */
function makePoints(entries, { standing = 0 } = {}) {
  return [{ ply: 0, score: { type: 'cp', value: 0 }, moveMeasure: null }, ...entries.map((entry, index) => ({
    ply: index + 1,
    label: `${index + 1}手目 ▲テスト`,
    score: entry.score ?? { type: 'cp', value: 0 },
    moveMeasure: { mover: entry.mover, loss: entry.loss, standing: entry.standing ?? standing },
    annotation: entry.kind ? { kind: entry.kind, mover: entry.mover, loss: entry.loss } : null,
  }))];
}
const alternate = (losses, first = 'black') => losses.map((loss, index) => ({
  mover: (index % 2 === 0) === (first === 'black') ? 'black' : 'white',
  loss,
}));

describe('material balance', () => {
  it('is zero at the start, counts hands and promoted pieces, and flips with the side', () => {
    expect(materialBalance(START)).toBe(0);
    expect(materialBalance('9/9/9/9/9/9/9/9/4K4 b 2P 1')).toBe(2);
    expect(materialBalance('9/9/9/9/9/9/9/9/4K4 b p 1')).toBe(-1);
    expect(materialBalance('4k4/9/9/9/9/9/9/9/+R3K4 b - 1')).toBe(12);
    expect(materialBalance('4k4/9/9/9/9/9/9/9/4K4 b R2Pb 1')).toBe(10 + 2 - 8);
  });
});

describe('loss score', () => {
  it('maps the average loss to 0..100', () => {
    expect(lossScore(30)).toBe(100);
    expect(lossScore(0)).toBe(100);
    expect(lossScore(300)).toBeCloseTo(0);
    expect(lossScore(2000)).toBe(0);
    expect(lossScore(165)).toBeCloseTo(50);
  });
});

describe('game summary', () => {
  it('splits the player moves into phases, counts big losses, skips decided positions and keeps the worst move', () => {
    const entries = [];
    for (let ply = 1; ply <= 100; ply += 1) {
      const mover = ply % 2 === 1 ? 'black' : 'white';
      let loss = 20;
      if (mover === 'black' && ply === 41) loss = 900;
      if (mover === 'black' && ply === 61) loss = 400;
      const standing = mover === 'black' && ply >= 95 ? 3000 : 0;
      entries.push({ mover, loss, standing, kind: mover === 'black' && ply === 41 ? 'mistake' : undefined });
    }
    const record = summarizeGame({ points: makePoints(entries), sfens: [START], color: 'black', win: true, opponentRook: 'static', plies: 100 });
    expect(record.phases.opening.n).toBe(15);
    expect(record.phases.middle.n).toBe(25);
    expect(record.phases.ending.n).toBe(7);
    expect(record.moves).toBe(47);
    expect(record.big).toBe(2);
    expect(record.worst).toMatchObject({ ply: 41, loss: 900 });
    expect(record.kinds.mistake).toBe(1);
    expect(record.opponentRook).toBe('static');
  });

  it('counts the opponent mistakes the player answered without losing the advantage', () => {
    const entries = alternate([10, 500, 20, 10, 10, 800, 400, 30]);
    // 相手(後手)の悪手: 2手目(500)→3手目は損20(咎めた)、6手目(800)→7手目は損400(咎めていない)
    const record = summarizeGame({ points: makePoints(entries), sfens: [], color: 'black', win: false, opponentRook: null, plies: 8 });
    expect(record.oppMistakes).toBe(2);
    expect(record.punished).toBe(1);
  });

  it('counts forced mates seen before a move and whether they were kept', () => {
    const mateForBlack = { type: 'mate', value: 3 };
    const entries = [
      { mover: 'black', loss: 0, score: { type: 'cp', value: 100 } },
      { mover: 'white', loss: 0, score: mateForBlack },
      { mover: 'black', loss: 0, score: { type: 'mate', value: 1 } },
      { mover: 'white', loss: 0, score: { type: 'mate', value: 1 } },
      { mover: 'black', loss: 0, score: { type: 'cp', value: 200 } },
    ];
    const record = summarizeGame({ points: makePoints(entries), sfens: [], color: 'black', win: true, opponentRook: null, plies: 5 });
    expect(record.mateChances).toBe(2);
    expect(record.mateKept).toBe(1);
  });

  it('measures material from the player side', () => {
    const rich = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b 3P 1';
    const sfens = Array(30).fill(rich);
    const black = summarizeGame({ points: makePoints([{ mover: 'black', loss: 0 }]), sfens, color: 'black', win: true, opponentRook: null, plies: 29 });
    const white = summarizeGame({ points: makePoints([{ mover: 'black', loss: 0 }]), sfens, color: 'white', win: true, opponentRook: null, plies: 29 });
    expect(black.material).toBe(3);
    expect(white.material).toBe(-3);
  });
});

describe('season statistics', () => {
  const game = (overrides = {}) => ({
    color: 'black', win: true, opponentRook: 'static', plies: 90, moves: 40, big: 2, sum: 40 * 80,
    phases: { opening: { n: 12, sum: 12 * 40 }, middle: { n: 20, sum: 20 * 80 }, ending: { n: 8, sum: 8 * 160 } },
    kinds: { blunder: 0, mistake: 1, dubious: 1, good: 2, brilliant: 1 },
    worst: { ply: 51, label: '51手目 ▲５二銀', loss: 700 },
    oppMistakes: 4, punished: 3, mateChances: 2, mateKept: 2, material: 2,
    ...overrides,
  });

  it('builds all nine radar axes, in order, within 0..100', () => {
    const records = { 0: game(), 1: game({ color: 'white', win: false, opponentRook: 'ranging', big: 6, sum: 40 * 200 }) };
    const stats = aggregateSeasonStats({ records, games: [{ win: true, color: 'black' }, { win: false, color: 'white' }] });
    expect(stats.radar.map(({ key }) => key)).toEqual(RADAR_AXES.map(({ key }) => key));
    expect(RADAR_AXES.map(({ label }) => label)).toEqual(['序盤', '中盤', '終盤', '安定感', '咎め', '詰将棋', '対振り飛車', '対居飛車', '駒得']);
    for (const { value } of stats.radar) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    const value = (key) => stats.radar.find((axis) => axis.key === key).value;
    expect(value('opening')).toBeGreaterThan(value('middle'));
    expect(value('middle')).toBeGreaterThan(value('ending'));
    expect(value('punish')).toBe(75);
    expect(value('mate')).toBe(100);
    expect(value('vsStatic')).toBeGreaterThan(value('vsRanging'));
  });

  it('summarizes the record, colors, styles, the worst move and the longest streak', () => {
    const records = { 0: game(), 1: game({ win: false, opponentRook: 'ranging', worst: { ply: 33, label: '33手目 △４四歩', loss: 950 } }), 2: game() };
    const games = [{ win: true, color: 'black' }, { win: false, color: 'white' }, { win: true, color: 'black' }];
    const { summary, commentary } = aggregateSeasonStats({ records, games });
    expect(summary).toMatchObject({
      games: 3, wins: 2, losses: 1, longestWinStreak: 1, analyzed: 3,
      black: { games: 2, wins: 2 }, white: { games: 1, wins: 0 },
      vsStatic: { games: 2, wins: 2 }, vsRanging: { games: 1, wins: 0 },
    });
    expect(summary.worst).toEqual({ game: 2, ply: 33, label: '33手目 △４四歩', loss: 950 });
    expect(summary.kinds).toMatchObject({ mistake: 3, good: 6, brilliant: 3 });
    expect(commentary.some(({ title }) => title.startsWith('光っていたところ'))).toBe(true);
    expect(commentary.some(({ title }) => title.startsWith('伸ばしたいところ'))).toBe(true);
    expect(commentary.some(({ title }) => title === '一番の悪手')).toBe(true);
    expect(commentary.some(({ title }) => title === '戦型ごとの成績')).toBe(true);
  });

  it('leaves axes without enough samples empty instead of guessing', () => {
    const records = { 0: game({ oppMistakes: 1, punished: 1, mateChances: 0, mateKept: 0, opponentRook: 'static', moves: 3, big: 0, sum: 100, phases: { opening: { n: 1, sum: 10 }, middle: { n: 1, sum: 10 }, ending: { n: 1, sum: 10 } } }) };
    const { radar } = aggregateSeasonStats({ records, games: [{ win: true, color: 'black' }] });
    const value = (key) => radar.find((axis) => axis.key === key).value;
    expect(value('punish')).toBeNull();
    expect(value('mate')).toBeNull();
    expect(value('stability')).toBeNull();
    expect(value('opening')).toBeNull();
    expect(value('vsRanging')).toBeNull();
    expect(value('vsStatic')).not.toBeNull();
  });

  it('still reports the record when no game could be analyzed, and says analysis is pending', () => {
    const games = [{ win: false, color: 'white' }];
    const none = aggregateSeasonStats({ records: {}, games, pending: 1 });
    expect(none.summary).toMatchObject({ games: 1, wins: 0, analyzed: 0 });
    expect(none.radar.every(({ value }) => value === null)).toBe(true);
    expect(none.commentary[0].text).toContain('解析しています');
    const failed = aggregateSeasonStats({ records: { 0: { failed: true, win: false, opponentRook: 'static', plies: 0 } }, games });
    expect(failed.summary.analyzed).toBe(0);
    expect(failed.commentary[0].text).toContain('解析できませんでした');
    expect(failed.radar.find(({ key }) => key === 'vsStatic').value).toBe(0);
  });
});
