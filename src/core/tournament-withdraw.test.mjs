import { describe, expect, it } from 'vitest';
import { USER_ID, createSeason, recordUserGame } from './ryuo.mjs';
import { createLeague, createMeijinSeason } from './meijin.mjs';
import { addVsUser, createRoster } from './ryuo-roster.mjs';
import { canWithdrawSeason, withdrawMeijinSeason, withdrawOptions, withdrawRyuoSeason } from './tournament-withdraw.mjs';

const settings = { difficulty: 9, scale: 3, revival: true };

describe('竜王戦の棄権', () => {
  const roster = createRoster({ seed: 21, userGroup: 6 });
  const fresh = createSeason({ no: 3, mode: 'challenge', group: 6, settings, userLevel: 28, seed: 5, roster });
  const midway = recordUserGame(fresh, 'win');

  it('残りの対局を不戦敗にして期を終え、結果に棄権の印を付ける。指した対局はそのまま', () => {
    const done = withdrawRyuoSeason(midway);
    expect(done.phase).toBe('done');
    expect(done.pending).toBeNull();
    expect(done.withdrawn).toBe(true);
    expect(done.result.withdrawn).toBe(true);
    expect(done.result.forfeits).toBeGreaterThan(0);
    expect(done.userGames[0]).toMatchObject({ win: true });
    expect(done.userGames[0].forfeit).toBeUndefined();
    expect(done.userGames.slice(1).every((game) => game.forfeit && !game.win)).toBe(true);
    // ほかの棋士どうしで最後まで決まり、竜王が決まっている。
    expect(done.champion).toBeTruthy();
    expect(done.champion).not.toBe(USER_ID);
    // もとの期は書き換えない。
    expect(midway.phase).not.toBe('done');
  });

  it('終わった期・自分の対局が残っていない期は、やめられない', () => {
    const done = withdrawRyuoSeason(midway);
    expect(canWithdrawSeason(done)).toBe(false);
    expect(withdrawRyuoSeason(done)).toBe(done);
    expect(canWithdrawSeason(null)).toBe(false);
  });
});

describe('名人戦の棄権', () => {
  const roster = createRoster({ seed: 31 });
  const season = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings: { difficulty: 9, scale: 'mini' }, userLevel: 12, seed: 7 });

  it('順位戦の残りを不戦敗にして期を終える', () => {
    const done = withdrawMeijinSeason(season);
    expect(done.phase).toBe('done');
    expect(done.result.withdrawn).toBe(true);
    expect(done.userGames.length).toBeGreaterThan(0);
    expect(done.userGames.every((game) => game.forfeit && !game.win)).toBe(true);
  });
});

describe('やめられる大会の一覧', () => {
  it('進行中の大会だけを出す。奨励会は会員なら退会、試験中なら受験をやめる', () => {
    expect(withdrawOptions({})).toEqual([]);
    const options = withdrawOptions({
      ryuoSeason: { no: 2, phase: 'ranking', pending: {} },
      meijinSeason: { no: 1, phase: 'done', pending: null },
      shoreikaiRun: { phase: 'reikai' },
      kenshukaiRun: { phase: 'reikai' },
    });
    expect(options.map(({ id }) => id)).toEqual(['ryuo', 'shoreikai', 'kenshukai']);
    expect(options[0].label).toBe('竜王戦 第2期');
    expect(options[1].action).toBe('退会する');
    expect(withdrawOptions({ shoreikaiRun: { phase: 'exam' } })[0].action).toBe('受験をやめる');
    expect(withdrawOptions({ shoreikaiRun: { phase: 'pro' } })).toEqual([]);
  });
});

describe('対戦成績', () => {
  it('不戦敗は、名鑑の対戦成績に数えない', () => {
    const roster = createRoster({ seed: 4, userGroup: 6 });
    const [a, b] = Object.keys(roster.players);
    addVsUser(roster, [{ opponentId: a, win: true }, { opponentId: b, win: false, forfeit: true }], { no: 1, event: 'ryuo' });
    expect(roster.vsUser[a]).toMatchObject({ wins: 1, losses: 0 });
    expect(roster.vsUser[b]).toBeUndefined();
  });
});
