import { describe, expect, it } from 'vitest';
import { createSeason, describeSeason, recordUserGame } from './ryuo.mjs';
import { matchBracket, seasonStages, winsToPlayoff } from './ryuo-stages.mjs';

const settings = (overrides = {}) => ({ difficulty: 9, scale: 3, revival: true, ...overrides });
const fresh = (overrides = {}) => createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 20, seed: 11, ...overrides });
/** 勝ち続けて、指定の段階(phase)まで進める。 */
const winUntil = (season, phases) => {
  let next = season;
  for (let guard = 0; guard < 40 && next.pending && !phases.includes(next.phase); guard += 1) next = recordUserGame(next, 'win');
  return next;
};

describe('竜王戦の3つの段階', () => {
  it('ランキング戦は①、決勝トーナメントは②、番勝負は③。済んだ段階には勝敗が残る', () => {
    const start = fresh();
    expect(seasonStages(start).current).toBe(0);
    expect(seasonStages(start).stages.map(({ status }) => status)).toEqual(['current', 'upcoming', 'upcoming']);
    expect(seasonStages(start).stages[0].label).toBe('6組ランキング戦');

    const main = winUntil(start, ['main']);
    expect(main.phase).toBe('main');
    const atMain = seasonStages(main);
    expect(atMain.current).toBe(1);
    expect(atMain.stages.map(({ status }) => status)).toEqual(['done', 'current', 'upcoming']);
    expect(atMain.stages[0].wins).toBeGreaterThan(0);
    expect(atMain.stages[0].losses).toBe(0);
    // 組の決勝に勝って②に進んだ直後は、段階の道のりを光らせる。
    expect(atMain.arrived).toBe(true);

    const series = winUntil(main, ['playoff', 'finals']);
    expect(seasonStages(series).current).toBe(2);
  });

  it('防衛戦は③から。①②はほかの棋士の戦いを見るだけ', () => {
    const season = createSeason({ no: 2, mode: 'defense', group: 1, settings: settings(), userLevel: 30, seed: 5 });
    const { current, stages } = seasonStages(season);
    expect(current).toBe(2);
    expect(stages.map(({ status }) => status)).toEqual(['watch', 'watch', 'current']);
    expect(stages[0].label).toBe('各組のランキング戦');
    // 各組の表と決勝トーナメントは、もう決まっている。
    const view = describeSeason(season).stages;
    expect(view.group.length).toBeGreaterThan(0);
    expect(view.final.preview).toBe(false);
  });

  it('期が終われば、最後に指した段階を済みにする', () => {
    let season = fresh();
    for (let guard = 0; guard < 20 && season.pending; guard += 1) season = recordUserGame(season, 'loss');
    expect(season.phase).toBe('done');
    const { current, stages } = seasonStages(season);
    expect(current).toBe(0);
    expect(stages[0].status).toBe('done');
    expect(stages[1].status).toBe('upcoming');
  });
});

describe('試合の札の表', () => {
  it('1試合を1枚の札にし、上下の2人・勝者・次の対局・自分の札を持つ。札は回戦ごとに上から並ぶ', () => {
    const season = recordUserGame(fresh(), 'win');
    const view = describeSeason(season).stages.group.find(({ key }) => key === 'ranking').view;
    expect(view.rounds.map(({ label }) => label).at(-1)).toBe('決勝');
    expect(view.matches.length).toBe(Object.keys(season.ranking.nodes).length);
    for (const round of view.rounds) {
      const ys = view.matches.filter((match) => match.round === round.round).map(({ y }) => y);
      expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    }
    const pending = view.matches.filter((match) => match.pending);
    expect(pending).toHaveLength(1);
    expect(pending[0].userIn).toBe(true);
    expect(view.userNext).toBe(pending[0].round);
    // 1局勝った試合は、自分の側が勝者で、勝ち上がりの線を引く。
    const won = view.matches.find((match) => match.userIn && match.winner);
    expect(won.userWon).toBe(true);
    expect(won[won.winner].you).toBe(true);
    // まだ決まっていない行は「〜の勝者」と書く。
    expect(view.matches.some((match) => match.top.placeholder.endsWith('の勝者') || match.bottom.placeholder.endsWith('の勝者'))).toBe(true);
  });

  it('シードの棋士は、最初に出る試合の札にだけ出る(空の札を作らない)', () => {
    const bracket = {
      rounds: 2,
      root: { from: 'm2' },
      nodes: {
        m1: { id: 'm1', a: { pid: 'b' }, b: { pid: 'c' }, winner: null, round: 1 },
        m2: { id: 'm2', a: { pid: 'a' }, b: { from: 'm1' }, winner: null, round: 2 },
      },
    };
    const view = matchBracket(bracket, { brief: (pid) => ({ name: pid.toUpperCase(), dan: '' }), roundLabel: (round) => `${round}回戦` });
    expect(view.matches.map(({ id }) => id)).toEqual(['m1', 'm2']);
    expect(view.matches[1].top.name).toBe('A');
    expect(view.matches[1].bottom.placeholder).toBe('1回戦の勝者');
    expect(view.leafCount).toBe(3);
    expect(winsToPlayoff(bracket, 'a')).toBe(0);
    expect(winsToPlayoff(bracket, 'b')).toBe(1);
  });
});

describe('決勝トーナメントの下見と番勝負', () => {
  it('決勝トーナメントの前は、組の枠だけの下見。実物の規模では6組優勝は挑戦者決定戦まで5勝', () => {
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings({ scale: 5 }), userLevel: 20, seed: 3 });
    const { final } = describeSeason(season).stages;
    expect(final.preview).toBe(true);
    expect(final.hopeLabel).toBe('6組優勝');
    expect(final.hopeWins).toBe(5);
    // 出場者は11名(1組5・2組2・3〜6組1)。
    expect(final.leafCount).toBe(11);
    expect(final.matches.filter((match) => [match.top, match.bottom].some((slot) => slot.hope))).toHaveLength(1);
  });

  it('番勝負は、自分から見た星取りと次の局。七番勝負は7局まで', () => {
    const season = winUntil(fresh(), ['finals']);
    const finals = describeSeason(recordUserGame(season, 'win')).stages.series.find(({ key }) => key === 'finals');
    expect(finals.maxGames).toBe(7);
    expect(finals.me.id).toBe('user');
    expect(finals.wins.me).toBe(1);
    expect(finals.games[0]).toMatchObject({ no: 1, win: true });
    expect(finals.nextNo).toBe(2);
    const playoff = describeSeason(season).stages.series.find(({ key }) => key === 'playoff');
    expect(playoff.winner).toBe('me');
    expect(playoff.unplayed).toBe(3 - playoff.games.length);
  });
});
