import { describe, expect, it } from 'vitest';
import { createSeason, recordUserGame, scaleById } from './ryuo.mjs';
import { applySeason, createCareer, nextEntry } from './ryuo-career.mjs';
import { ROSTER_STORAGE_KEY, ROSTER_VERSION, applySeasonToRoster, createRoster, loadRoster, migrateRoster } from './ryuo-roster.mjs';
import { STORY_PEOPLE, YOSHIHIKO, storyCharacter, storyMemberId } from './ryuo-story.mjs';
import { ABILITY_KEYS } from './player-abilities.mjs';

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

/** 版2の名簿(能力と使用率がなく、善彦は52歳)に戻したもの。 */
function asVersion2(roster) {
  const old = structuredClone(roster);
  old.version = 2;
  for (const member of Object.values(old.players)) {
    delete member.repertoire.usage;
    delete member.character.abilities;
    if (member.story === YOSHIHIKO) Object.assign(member, { age: 55, rating: 1950 });
  }
  return old;
}

describe('名簿の能力値と使用率', () => {
  it('新しい名簿の棋士は、能力の配分・使用率を持ち、保存の大きさは250KBに収まる', () => {
    const roster = createRoster({ seed: 12 });
    expect(roster.version).toBe(ROSTER_VERSION);
    for (const member of Object.values(roster.players)) {
      expect(Object.keys(member.character.abilities).sort(), member.name).toEqual([...ABILITY_KEYS].sort());
      expect(member.repertoire.usage.black, member.name).toBeTruthy();
    }
    expect(JSON.stringify(roster).length).toBeLessThan(250_000);
  });

  it('版2の名簿は、作り直さずに移す。同じ名簿からは同じ能力になる。善彦は人物の決まりにそろえる', () => {
    const roster = createRoster({ seed: 13 });
    const old = asVersion2(roster);
    const loaded = loadRoster(memoryStorage({ [ROSTER_STORAGE_KEY]: JSON.stringify(old) }));
    expect(loaded.version).toBe(ROSTER_VERSION);
    expect(Object.keys(loaded.players)).toEqual(Object.keys(old.players));
    expect(loaded.titles).toEqual(old.titles);
    for (const member of Object.values(loaded.players)) {
      expect(member.character.abilities, member.name).toBeTruthy();
      expect(member.repertoire.usage, member.name).toBeTruthy();
    }
    expect(migrateRoster(old)).toEqual(loaded);
    const father = loaded.players[storyMemberId(loaded, YOSHIHIKO)];
    // 名簿に加わってから3年たっていた(52歳→55歳)ので、43歳から3年で46歳。
    expect(father.age).toBe(STORY_PEOPLE[YOSHIHIKO].age + 3);
    expect(father.rating).toBe(2050);
    expect(father.character).toEqual(storyCharacter(YOSHIHIKO));
    // 版1以前は今までどおり作り直す。
    expect(loadRoster(memoryStorage({ [ROSTER_STORAGE_KEY]: JSON.stringify({ ...old, version: 1 }) }))).toBeNull();
  });

  it('期を終えると、先後・戦法ごとの成績と勝ち方が残る', () => {
    const roster = createRoster({ seed: 14 });
    const career = createCareer();
    let season = createSeason({ ...nextEntry(career), settings: { difficulty: 9, scale: 3, revival: true }, userLevel: 20, career, roster, seed: 14 });
    for (let guard = 0; season.phase !== 'done' && guard < 400; guard += 1) season = recordUserGame(season, 'loss');
    const applied = applySeason(career, season);
    const next = applySeasonToRoster(roster, season, { userGroup: applied.career.group, promote: scaleById(3).promote });
    const pros = Object.values(next.players).filter(({ kind, record }) => kind === 'pro' && record.season.games > 0);
    const withDetail = pros.filter(({ record }) => record.season.byColor && record.season.byOpening);
    expect(withDetail.length / pros.length).toBeGreaterThan(0.9);
    const member = withDetail[0];
    const colorGames = member.record.season.byColor.black[0] + member.record.season.byColor.black[1]
      + member.record.season.byColor.white[0] + member.record.season.byColor.white[1];
    expect(colorGames).toBeLessThanOrEqual(member.record.season.games);
    expect(colorGames).toBeGreaterThan(member.record.season.games * 0.8);
    expect(pros.some(({ record }) => Object.keys(record.season.hows ?? {}).length > 0)).toBe(true);
    // 竜王戦の表の結果に、勝ち方と先手が残る。
    const node = Object.values(season.ranking.nodes).find((entry) => entry.game?.how);
    expect(node.game.black).toBeTruthy();
  });
});
