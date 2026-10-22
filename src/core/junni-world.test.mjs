import { describe, expect, it } from 'vitest';
import { applyMeijinSeasonToRoster, autoJunniYear, ensureJunniWorld, joinJunni } from './junni-world.mjs';
import { MEIJIN_CLASSES, applyMeijinSeason, createLeague, createMeijinCareer, createMeijinSeason, recordMeijinGame } from './meijin.mjs';
import { USER_ID, createRng } from './ryuo.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { JUNNI_SIZES, junniClassOf } from './ryuo-league.mjs';
import { HANANE, storyMemberId } from './ryuo-story.mjs';

const settings = { difficulty: 9, scale: 'mini', coachLevel: 'detailed', hintLimit: 3, undoLimit: 3 };

function playOut(season, outcome = () => 'win') {
  let current = season;
  for (let guard = 0; current.pending && guard < 50; guard += 1) current = recordMeijinGame(current, outcome(current));
  return current;
}

/** 世界のどこに何回いるか(クラス・フリークラス・名人)。 */
function appearances(world, id) {
  return MEIJIN_CLASSES.reduce((sum, cls) => sum + world.classes[cls].filter((other) => other === id).length, 0)
    + world.free.filter((other) => other === id).length + (world.holder === id ? 1 : 0);
}

/** 世界と控え(member.junni・名簿の名人)が食い違っていないか。 */
function expectConsistent(roster) {
  const world = roster.junni;
  for (const member of Object.values(roster.players)) {
    if (member.kind !== 'pro') continue;
    expect(appearances(world, member.id), member.name).toBe(1);
    const cls = junniClassOf(world, member.id);
    expect(member.junni, member.name).toBe(cls === 'meijin' ? 'A' : cls);
  }
  expect(roster.titles.meijin ?? null).toBe(world.holder);
}

describe('順位戦の世界(名簿に1つ)', () => {
  it('名簿を作ると、順位戦の世界もできる。A級は名人の外に10名、ほかのクラスも定員どおり。プレイヤーはまだいない', () => {
    const roster = createRoster({ seed: 41 });
    const world = roster.junni;
    expect(world).toMatchObject({ no: 0, userJoined: false });
    for (const [cls, size] of Object.entries(JUNNI_SIZES)) expect(world.classes[cls]).toHaveLength(size);
    expect(world.holder).toBeTruthy();
    expect(appearances(world, USER_ID)).toBe(0);
    expectConsistent(roster);
  });

  it('名人戦に出る前は、棋界の1年で名人戦の1期が自動で進む。名人は1人で、獲得期数と履歴が残る', () => {
    let roster = createRoster({ seed: 42 });
    const hanane = storyMemberId(roster, HANANE);
    const classes = [];
    for (let year = 1; year <= 4; year += 1) {
      const before = roster.junni.holder;
      const { roster: next, result } = autoJunniYear(roster, createRng(year));
      roster = next;
      expect(roster.junni.no).toBe(year);
      expect(result.holder).toBe(roster.junni.holder);
      expect(roster.titleHistory.filter(({ title, no }) => title === 'meijin' && no === year)).toHaveLength(1);
      if (result.holder === before) expect(result.changed).toBe(false);
      classes.push(junniClassOf(roster.junni, hanane));
      expectConsistent(roster);
    }
    const holder = roster.players[roster.junni.holder];
    expect(holder.titleCounts.meijin).toBeGreaterThanOrEqual(1);
    expect(holder.dan).toBe('九段');
    // 羽音も、ほかの棋士と同じように動く(C級2組のまま、昇級、など。クラスのどこかにいる)。
    expect(classes.every(Boolean)).toBe(true);
  });

  it('プレイヤーが名人戦に出たら、C級2組の最後に入り、棋界の1年は順位戦を進めない', () => {
    const roster = joinJunni(createRoster({ seed: 43 }));
    expect(roster.junni.userJoined).toBe(true);
    expect(roster.junni.classes.C2.at(-1)).toBe(USER_ID);
    expect(joinJunni(roster)).toBe(roster);
    const { roster: same, result } = autoJunniYear(roster, createRng(1));
    expect(same).toBe(roster);
    expect(result).toBeNull();
  });

  it('名人戦の期が終わると、世界を1期進めて名簿へ書き戻す。期の途中の引退も直し、対戦成績を名人戦として数える', () => {
    let roster = joinJunni(createRoster({ seed: 44 }));
    const season = playOut(createMeijinSeason({ no: roster.junni.no + 1, league: roster.junni, roster, settings, userLevel: 30, seed: 5 }));
    expect(season.phase).toBe('done');
    // 期の途中で、C級1組の棋士が1人引退した。
    const retired = roster.junni.classes.C1[4];
    delete roster.players[retired];
    roster = applyMeijinSeasonToRoster(roster, season);
    expect(roster.junni.no).toBe(season.no);
    expect(appearances(roster.junni, USER_ID)).toBe(1);
    expect(appearances(roster.junni, retired)).toBe(0);
    expectConsistent(roster);
    // 全勝で昇級(C級2組の上位3名)。
    expect(junniClassOf(roster.junni, USER_ID)).toBe('C1');
    const opponent = season.userGames[0].opponentId;
    if (roster.players[opponent]) expect(roster.vsUser[opponent].byEvent.meijin.wins).toBeGreaterThanOrEqual(1);
    // 同じ期を2度書き戻さない。
    expect(applyMeijinSeasonToRoster(roster, season)).toBe(roster);
    // キャリアには、プレイヤーの歩みだけが残る(世界は持たない)。
    const career = applyMeijinSeason(createMeijinCareer(), season);
    expect(career.league).toBeUndefined();
    expect(career.history.at(-1).next).toBe('C1');
  });

  it('前の保存: 名人戦のキャリアの世界(league)があれば、それを正にして名簿へ移す。なければ名簿から作る', () => {
    const base = createRoster({ seed: 45 });
    // 前の名簿には、順位戦の世界がなかった。
    const old = structuredClone(base);
    delete old.junni;
    const league = createLeague(base);
    league.classes.C2 = league.classes.C2.filter((id) => id !== USER_ID);
    league.classes.C1.push(USER_ID);
    const career = { ...createMeijinCareer(), no: 3, league };
    const moved = ensureJunniWorld(old, career);
    expect(moved.changed).toBe(true);
    expect(moved.career.league).toBeUndefined();
    expect(moved.roster.junni).toMatchObject({ no: 3, userJoined: true, holder: league.holder });
    expect(junniClassOf(moved.roster.junni, USER_ID)).toBe('C1');
    expectConsistent(moved.roster);
    expect(old.junni).toBeUndefined();

    const fresh = ensureJunniWorld(old, createMeijinCareer());
    expect(fresh.roster.junni).toMatchObject({ userJoined: false });
    expect(appearances(fresh.roster.junni, USER_ID)).toBe(0);
    expectConsistent(fresh.roster);
    // もう世界があれば、何もしない。
    expect(ensureJunniWorld(fresh.roster, fresh.career).changed).toBe(false);
  });
});
