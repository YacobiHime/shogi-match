import { describe, expect, it } from 'vitest';
import { matchStakes, seasonGoalLine } from './ryuo-stakes.mjs';
import { createSeason, entryGoalLine, pendingStakes, recordUserGame } from './ryuo.mjs';

const settings = (overrides = {}) => ({ difficulty: 9, scale: 3, revival: true, ...overrides });

describe('この一局に賭けているもの', () => {
  it('ランキング戦: 勝てば次の回戦、組の決勝で勝てば組優勝・昇級。負ければ敗者復活戦か、ここまで', () => {
    expect(matchStakes({ phase: 'ranking', group: 6, round: 1, rounds: 5, promote: 2, revivalEnabled: true, revivalReachable: true })).toEqual({
      win: '2回戦へ', lose: '敗者復活戦へ', goal: '6組優勝まであと5勝・昇級まであと4勝', boss: false,
    });
    expect(matchStakes({ phase: 'ranking', group: 6, round: 3, rounds: 5, promote: 2 }).win).toBe('準決勝へ');
    expect(matchStakes({ phase: 'ranking', group: 6, round: 4, rounds: 5, promote: 2 }).win).toBe('組の決勝へ');
    const final = matchStakes({ phase: 'ranking', group: 6, round: 5, rounds: 5, promote: 2 });
    expect(final).toMatchObject({ win: '6組優勝・昇級！', lose: '準優勝で昇級', boss: true });
    expect(matchStakes({ phase: 'ranking', group: 5, round: 2, rounds: 4, promote: 1, revivalEnabled: false }).lose).toBe('竜王戦はここまで');
    expect(matchStakes({ phase: 'ranking', group: 1, round: 3, rounds: 3, promote: 2, groupSlots: 3 })).toMatchObject({
      win: '1組優勝・決勝トーナメントへ', lose: '準優勝で決勝トーナメントへ', goal: '1組優勝まであと1勝',
    });
  });

  it('敗者復活戦: 小さな規模では、勝ち抜いても降級をまぬがれるだけ', () => {
    expect(matchStakes({ phase: 'revival', group: 5, round: 2, rounds: 2, revivalPromotes: true })).toMatchObject({ win: '昇級！', goal: '昇級まであと1勝' });
    expect(matchStakes({ phase: 'revival', group: 5, round: 1, rounds: 2, revivalPromotes: false })).toMatchObject({ win: '決勝へ', goal: '残留まであと2勝' });
    expect(matchStakes({ phase: 'revival', group: 1, round: 1, rounds: 1 }).win).toBe('決勝トーナメントへ');
  });

  it('決勝トーナメント: 勝ち抜けば挑戦者決定三番勝負', () => {
    expect(matchStakes({ phase: 'main', group: 6, round: 4, rounds: 5 })).toMatchObject({ win: '挑戦者決定三番勝負へ', goal: '挑戦者決定戦まであと1勝' });
    expect(matchStakes({ phase: 'main', group: 6, round: 1, rounds: 5 }).goal).toBe('挑戦者決定戦まであと4勝');
  });

  it('番勝負: あと何勝か、王手のときは竜王・挑戦者・防衛', () => {
    expect(matchStakes({ phase: 'finals', group: 1, need: 4, winsUser: 3, winsOpponent: 3 })).toEqual({
      win: '竜王に！', lose: '竜王はならず', goal: '竜王まであと1勝', boss: true,
    });
    expect(matchStakes({ phase: 'finals', mode: 'defense', group: 1, need: 4, winsUser: 1, winsOpponent: 0 })).toMatchObject({
      win: '防衛まであと2勝', lose: '相手はあと3勝', goal: '防衛まであと3勝',
    });
    expect(matchStakes({ phase: 'playoff', group: 1, need: 2, winsUser: 1, winsOpponent: 0 }).win).toBe('竜王への挑戦者に！');
  });

  it('期の目標の1行', () => {
    expect(seasonGoalLine({ mode: 'challenge', group: 6, promote: 2, groupSlots: 1 })).toBe('6組で2位以内なら昇級。優勝すれば決勝トーナメントへ');
    expect(seasonGoalLine({ mode: 'challenge', group: 1, promote: 2, groupSlots: 3 })).toBe('1組で3位以内なら決勝トーナメントへ。勝ち抜けば竜王への挑戦者');
    expect(seasonGoalLine({ mode: 'defense', group: 1, promote: 2, groupSlots: 1 })).toMatch(/4勝/);
    expect(entryGoalLine({ mode: 'challenge', group: 6, scale: 3 })).toBe('6組で2位以内なら昇級。優勝すれば決勝トーナメントへ');
  });

  it('実際の期: 1局目は2回戦へ。負けたときは組と規模で変わる。勝ち進むと組の決勝が山場', () => {
    // 規模「中」の6組は、昇級枠が2で、降級がないので、敗者復活戦がない。5組にはある(降級をまぬがれる戦い)。
    let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 20, seed: 11 });
    expect(pendingStakes(season)).toMatchObject({ win: '2回戦へ', lose: '竜王戦はここまで' });
    const fifth = createSeason({ no: 1, mode: 'challenge', group: 5, settings: settings(), userLevel: 20, seed: 11 });
    expect(pendingStakes(fifth).lose).toBe('敗者復活戦へ');
    expect(pendingStakes(recordUserGame(fifth, 'loss'))).toMatchObject({ goal: expect.stringMatching(/^残留まであと/) });
    let guard = 0;
    while (season.pending?.phase === 'ranking' && guard < 10) {
      const stakes = pendingStakes(season);
      if (stakes.win.startsWith('6組優勝')) {
        expect(stakes.boss).toBe(true);
        break;
      }
      season = recordUserGame(season, 'win');
      guard += 1;
    }
    expect(pendingStakes(season).win).toMatch(/6組優勝/);
  });
});
