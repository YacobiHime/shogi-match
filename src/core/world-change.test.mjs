import { describe, expect, it } from 'vitest';
import { retuneSeasonWorld, currentDifficulty } from './world-change.mjs';
import { USER_ID, createSeason } from './ryuo.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { REAL_WORLD } from './ryuo-strength.mjs';
import { YOSHIHIKO } from './ryuo-story.mjs';
import { createShoreikaiRun, retuneShoreikaiWorld } from './shoreikai.mjs';
import { createKenshukaiRun, retuneKenshukaiWorld } from './kenshukai.mjs';
import { createTeamRun, retuneTeamWorld } from './team-battle.mjs';
import { createProYear, retuneProYearWorld, autoWeeks } from './pro-year.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const season0 = (world = 20) => createSeason({
  no: 1, mode: 'challenge', group: 6, userLevel: 20, roster, seed: 7,
  settings: { difficulty: 9, scale: 3, revival: true, world },
});
const others = (season) => Object.values(season.players).filter((player) => player.id !== USER_ID);

describe('大会の途中で難易度を変える(11章)', () => {
  it('竜王戦の期: 棋士の写しのLvが世界の差だけ動き、記録が残る', () => {
    const season = season0(20);
    const harder = retuneSeasonWorld(season, { difficulty: 11, world: 23, userLevel: 20 });
    expect(harder.settings).toMatchObject({ difficulty: 11, world: 23 });
    const pairs = others(season).map((player) => [player.level, harder.players[player.id].level]);
    expect(pairs.some(([a, b]) => b > a)).toBe(true);
    expect(pairs.every(([a, b]) => b >= a)).toBe(true);
    expect(harder.worldChanges).toEqual([expect.objectContaining({ from: 9, to: 11 })]);
    // もとの期は変えない。
    expect(season.settings.world).toBe(20);
    // 元へ戻すと、Lvも元へ戻る。
    const back = retuneSeasonWorld(harder, { difficulty: 9, world: 20, userLevel: 20 });
    expect(others(back).map((player) => player.level)).toEqual(others(season).map((player) => player.level));
    // 同じ難易度なら何もしない。
    expect(retuneSeasonWorld(season, { difficulty: 9, world: 20 })).toBe(season);
    expect(currentDifficulty(harder)).toBe(11);
  });

  it('本物の世界へ変えると、善彦はLv49', () => {
    const season = season0(20);
    const real = retuneSeasonWorld(season, { difficulty: 99, world: REAL_WORLD, userLevel: 20 });
    for (const player of others(real)) if (player.story === YOSHIHIKO) expect(player.level).toBe(49);
  });

  it('奨励会・研修会・団体戦・棋士の1年: 設定と次の相手のLvを直す', () => {
    const sho = createShoreikaiRun({ seed: 7, settings: { difficulty: 9, scale: 'mini', world: 20 }, examRank: 3, userName: 'やこび', userLevel: 20 });
    const sho2 = retuneShoreikaiWorld(sho, { difficulty: 12, world: 25, userLevel: 20 });
    expect(sho2.settings).toMatchObject({ difficulty: 12, world: 25 });
    if (sho.pending?.opponentId) expect(sho2.players[sho.pending.opponentId].level).toBeGreaterThan(sho.players[sho.pending.opponentId].level);

    const ken = createKenshukaiRun({ seed: 7, settings: { difficulty: 9, scale: 'mini', world: 20 }, entryClass: 4, userName: 'やこび', userLevel: 20, roster });
    const ken2 = retuneKenshukaiWorld(ken, { difficulty: 6, world: 15, userLevel: 20 });
    expect(ken2.settings.world).toBe(15);
    if (ken.pending?.opponentId) expect(ken2.players[ken.pending.opponentId].level).toBeLessThan(ken.players[ken.pending.opponentId].level);

    const team = createTeamRun({ format: 'pro', seed: 7, settings: { difficulty: 9, world: 20 }, roster, userName: 'やこび', userLevel: 20 });
    const team2 = retuneTeamWorld(team, { difficulty: 11, world: 23 });
    expect(team2.settings).toMatchObject({ difficulty: 11, world: 23 });
    expect(team.settings.world).toBe(20);

    let pro = createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { difficulty: 9, world: 20 }, userLevel: 20, userName: 'やこび' });
    for (let guard = 0; guard < 30 && !pro.pending?.gameId; guard += 1) pro = autoWeeks(pro);
    const pro2 = retuneProYearWorld(pro, { difficulty: 12, world: 25 });
    expect(pro2.settings.world).toBe(25);
    if (pro.pending?.gameId) expect(pro2.pending.level).toBeGreaterThan(pro.pending.level);
  });
});
