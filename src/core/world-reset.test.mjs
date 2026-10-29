import { describe, expect, it } from 'vitest';
import { USER_ID } from './ryuo.mjs';
import { USER_HOLDER, createRoster } from './ryuo-roster.mjs';
import { junniClassOf } from './ryuo-league.mjs';
import { joinJunni } from './junni-world.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';
import { resetRoster, worldResetBlocker } from './world-reset.mjs';

/** 何期か進んだような名簿(年齢と段位をずらし、プレイヤーを順位戦のクラスに入れる)。 */
function agedRoster(cls = 'B2') {
  const roster = joinJunni(createRoster({ seed: 7, userGroup: 4 }));
  for (const member of Object.values(roster.players)) member.age += 10;
  const world = roster.junni;
  world.classes.C2 = world.classes.C2.filter((id) => id !== USER_ID);
  if (cls === 'meijin') world.holder = USER_ID;
  else world.classes[cls].push(USER_ID);
  return roster;
}

describe('棋士の世界を最初に戻す(player-world-note-designの7章)', () => {
  it('棋士の年齢・段位は最初の名簿に戻り、羽音と善彦もいる', () => {
    const before = agedRoster();
    const after = resetRoster(before, { seed: 11, userGroup: 4 });
    const fresh = createRoster({ seed: 11, userGroup: 4 });
    const ages = (roster) => Object.values(roster.players).map(({ age }) => age).sort((a, b) => a - b);
    expect(ages(after)).toEqual(ages(fresh));
    expect(after.season).toBe(0);
    expect(after.vsUser).toEqual({});
    const stories = Object.values(after.players).map(({ story }) => story).filter(Boolean);
    expect(stories).toEqual(expect.arrayContaining([HANANE, YOSHIHIKO]));
    expect(Object.values(after.players).find(({ story }) => story === HANANE).age).toBe(17);
  });

  it('プレイヤーの順位戦のクラスはそのまま(名人なら名人のまま、新しい名人はA級へ)', () => {
    const after = resetRoster(agedRoster('B2'), { seed: 11, userGroup: 4 });
    expect(junniClassOf(after.junni, USER_ID)).toBe('B2');
    expect(after.junni.userJoined).toBe(true);
    const meijin = resetRoster(agedRoster('meijin'), { seed: 11, userGroup: 4 });
    expect(meijin.junni.holder).toBe(USER_ID);
    const father = Object.values(meijin.players).find(({ story }) => story === YOSHIHIKO);
    expect(junniClassOf(meijin.junni, father.id)).toBe('A');
    // 順位戦に出ていなければ、出ていないまま。
    const fresh = resetRoster(createRoster({ seed: 3, userGroup: 6 }), { seed: 11, userGroup: 6 });
    expect(fresh.junni.userJoined).toBe(false);
  });

  it('プレイヤーが竜王なら、新しい世界でも竜王のまま', () => {
    const before = { ...createRoster({ seed: 5, userGroup: 1, userIsChampion: true }), holder: USER_HOLDER };
    expect(resetRoster(before, { seed: 9, userGroup: 1 }).holder).toBe(USER_HOLDER);
  });

  it('期・挑戦の途中は戻せない(理由を返す)', () => {
    expect(worldResetBlocker({})).toBeNull();
    expect(worldResetBlocker({ ryuoSeason: { phase: 'done' }, meijinSeason: { phase: 'done' } })).toBeNull();
    expect(worldResetBlocker({ ryuoSeason: { phase: 'ranking' } })).toMatch(/竜王戦/);
    expect(worldResetBlocker({ meijinSeason: { phase: 'league' } })).toMatch(/名人戦/);
    expect(worldResetBlocker({ shoreikaiRun: { phase: 'league' } })).toMatch(/奨励会/);
    expect(worldResetBlocker({ kenshukaiRun: { phase: 'league' } })).toMatch(/研修会/);
  });
});
