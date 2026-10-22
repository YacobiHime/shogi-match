import { describe, expect, it } from 'vitest';
import {
  CLASS_RULES, ETERNAL_MEIJIN, MEIJIN_CLASSES, advanceLeague, applyMeijinSeason, classOutcome, createLeague, createMeijinCareer,
  createMeijinSeason, higherDan, loadMeijinCareer, loadMeijinSeason, meijinDan, paramasLadder, promotionOutlook, recordMeijinGame,
  resumeMeijinSeason, saveMeijinCareer, saveMeijinSeason, seasonRecords, standings, syncLeague, userClass,
} from './meijin.mjs';
import { USER_ID } from './ryuo.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';

const roster = createRoster({ seed: 31 });
const settings = { difficulty: 9, scale: 'full', coachLevel: 'detailed', hintLimit: 3, undoLimit: 3 };

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

/** 期を、プレイヤーの対局をすべてoutcomeで終える。 */
function playOut(season, outcome = () => 'win') {
  let current = season;
  let guard = 0;
  while (current.pending && guard < 50) {
    current = recordMeijinGame(current, outcome(current));
    guard += 1;
  }
  return current;
}
/** プレイヤーをclsの最後に置いた世界。 */
function leagueWithUserIn(cls) {
  const league = createLeague(roster);
  for (const name of MEIJIN_CLASSES) league.classes[name] = league.classes[name].filter((id) => id !== USER_ID);
  league.classes[cls].push(USER_ID);
  return league;
}

describe('順位戦の世界(docs/meijin-design.mdの13-1)', () => {
  it('名簿の順位戦から作る。プレイヤーはC級2組の最後、羽音はその前。名人はクラスに入れない', () => {
    const league = createLeague(roster);
    expect(league.classes.C2.at(-1)).toBe(USER_ID);
    const hanane = Object.values(roster.players).find((member) => member.story === HANANE);
    expect(league.classes.C2.at(-2)).toBe(hanane.id);
    expect(league.holder).toBe(roster.titles.meijin);
    for (const cls of MEIJIN_CLASSES) expect(league.classes[cls]).not.toContain(league.holder);
    expect(league.classes.A.length).toBeGreaterThanOrEqual(9);
    expect(userClass(league)).toBe('C2');
  });

  it('期の始めに、引退した棋士を外し、新四段をC級2組の最後に足す', () => {
    const league = createLeague(roster);
    const gone = league.classes.B1[0];
    const smaller = structuredClone(roster);
    delete smaller.players[gone];
    smaller.players.rookie = { ...structuredClone(roster.players[league.classes.C2[0]]), id: 'rookie', junni: 'C2' };
    const synced = syncLeague(league, smaller);
    expect(synced.classes.B1).not.toContain(gone);
    expect(synced.classes.C2.at(-1)).toBe('rookie');
  });
});

describe('順位戦の期', () => {
  it('C級2組は10局。相手は毎回ちがい、羽音とは期の後半に1度当たる。全員が同じ数を指す', () => {
    const season = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings, userLevel: 12, seed: 7 });
    expect(season.cls).toBe('C2');
    expect(season.rounds).toBe(CLASS_RULES.C2.rounds);
    const opponents = season.schedule.map(({ opponent }) => opponent);
    expect(new Set(opponents).size).toBe(10);
    expect(season.players[opponents[6]].story).toBe(HANANE);
    expect(season.pending).toMatchObject({ kind: 'league', round: 0, opponentId: opponents[0], label: 'C級2組 1回戦' });
    const done = playOut(season);
    expect(done.phase).toBe('done');
    expect(done.userGames.at(-1).label).toBe('C級2組 最終局');
    for (const record of Object.values(seasonRecords(done))) {
      expect(record.wins + record.losses).toBe(10);
      expect(record.remaining).toBe(0);
    }
  });

  it('規模で対局数が変わる(みじかい: 5局)', () => {
    const season = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings: { ...settings, scale: 'mini' }, userLevel: 12, seed: 8 });
    expect(season.rounds).toBe(5);
  });

  it('全勝すれば昇級。順位表は勝ち数、同じなら順位(頭ハネ)', () => {
    const done = playOut(createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings, userLevel: 12, seed: 9 }));
    const table = standings(done);
    for (let index = 1; index < table.length; index += 1) {
      const [a, b] = [table[index - 1], table[index]];
      expect(a.wins > b.wins || (a.wins === b.wins && a.rank < b.rank)).toBe(true);
    }
    expect(done.result).toMatchObject({ cls: 'C2', wins: 10, losses: 0, outcome: 'promote' });
  });

  it('自力・他力: 全敗では可能性がなくなり、全勝なら最後は決まる', () => {
    let season = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings, userLevel: 12, seed: 10 });
    expect(['others', 'self']).toContain(promotionOutlook(season).status);
    for (let game = 0; game < 4; game += 1) season = recordMeijinGame(season, 'loss');
    // 4敗しても、ほかの全員の結果しだいでは、まだ可能性がある(他力)。全敗で終えれば、可能性はない。
    expect(promotionOutlook(season).status).toBe('others');
    expect(promotionOutlook(playOut(season, () => 'loss')).status).toBe('out');
    let winner = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings, userLevel: 12, seed: 10 });
    for (let game = 0; game < 9; game += 1) winner = recordMeijinGame(winner, 'win');
    expect(['clinched', 'self', 'others']).toContain(promotionOutlook(winner).status);
    expect(promotionOutlook(winner).rivals.length).toBeLessThan(10);
  });

  it('保存から読み直しても、同じ続きになる', () => {
    const season = createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings, userLevel: 12, seed: 11 });
    const storage = memoryStorage();
    saveMeijinSeason(storage, season);
    const loaded = resumeMeijinSeason(loadMeijinSeason(storage));
    expect(recordMeijinGame(loaded, 'win').pending).toEqual(recordMeijinGame(season, 'win').pending);
    saveMeijinSeason(storage, null);
    expect(loadMeijinSeason(storage)).toBeNull();
  });
});

describe('昇級・降級点・降級', () => {
  const row = (id, wins, losses) => ({ id, wins, losses });
  const table = (n, cls) => Array.from({ length: n }, (_, index) => row(`p${index}`, Math.max(0, 10 - Math.floor(index / 5)), Math.min(10, Math.floor(index / 5))));

  it('C級2組: 上位3名が昇級、下位5分の1に降級点。3点目は落ちずに消して再挑戦', () => {
    const outcome = classOutcome('C2', table(50, 'C2'), { points: { p49: 2 }, even: {} });
    expect(['p0', 'p1', 'p2'].map((id) => outcome[id].outcome)).toEqual(['promote', 'promote', 'promote']);
    expect(outcome.p3.outcome).toBe('stay');
    expect(outcome.p40.outcome).toBe('point');
    expect(outcome.p39.outcome).not.toBe('point');
    expect(outcome.p49).toEqual({ outcome: 'reset', points: 0, even: false });
  });

  it('C級1組は2点目で降級。勝ち越し・2期続けて5割で1つ消える', () => {
    const t = table(35, 'C1');
    const outcome = classOutcome('C1', t, { points: { p34: 1, p5: 1, p20: 1 }, even: { p20: true } });
    expect(outcome.p34.outcome).toBe('demote');
    expect(outcome.p5).toMatchObject({ outcome: 'clear', points: 0 });
    const evenTable = [row('x1', 9, 1), row('x2', 9, 1), row('a', 5, 5), row('b', 5, 5), ...Array.from({ length: 6 }, (_, i) => row(`y${i}`, 5, 5))];
    const even = classOutcome('C1', evenTable, { points: { a: 1, b: 1 }, even: { a: true } });
    expect(even.a).toMatchObject({ outcome: 'clear', points: 0 });
    expect(even.b).toMatchObject({ points: 1, even: true });
  });

  it('B級1組とA級は下位2名が降級。A級の1位は挑戦者', () => {
    const outcome = classOutcome('A', table(10, 'A'), { points: {}, even: {} });
    expect(outcome.p0.outcome).toBe('challenger');
    expect(outcome.p9.outcome).toBe('demote');
    expect(outcome.p8.outcome).toBe('demote');
    expect(outcome.p7.outcome).toBe('stay');
  });

  it('パラマス方式は、順位の下の者から', () => {
    expect(paramasLadder([{ id: 'a', rank: 0 }, { id: 'b', rank: 5 }, { id: 'c', rank: 2 }])).toEqual(['b', 'c', 'a']);
  });

  it('A級のプレーオフにプレイヤーが入れば、順に指す', () => {
    const season = createMeijinSeason({ no: 1, league: leagueWithUserIn('A'), roster, settings, userLevel: 30, seed: 12 });
    const npc = season.order.filter((id) => id !== USER_ID);
    const crafted = { ...structuredClone(season), pending: null, phase: 'playoff', playoff: { ladder: [npc[3], USER_ID, npc[0]], matches: [], winner: null } };
    let current = resumeMeijinSeason(crafted);
    // 1戦目(下位2人)は自動。勝った方とプレイヤーが当たる。
    expect(current.pending).toMatchObject({ kind: 'playoff', label: 'A級プレーオフ' });
    current = recordMeijinGame(current, 'win');
    expect(current.pending).toMatchObject({ kind: 'playoff', opponentId: npc[0] });
    current = recordMeijinGame(current, 'win');
    expect(current.challenger).toBe(USER_ID);
    expect(current.pending).toMatchObject({ kind: 'finals', label: '名人戦七番勝負 第1局' });
  });
});

describe('名人戦七番勝負と、次の期', () => {
  it('A級で全勝すれば挑戦、七番勝負に4勝で名人。次の期は防衛戦', () => {
    const done = playOut(createMeijinSeason({ no: 1, league: leagueWithUserIn('A'), roster, settings, userLevel: 30, seed: 13 }));
    expect(done.finals.winner).toBe(USER_ID);
    expect(done.result).toMatchObject({ outcome: 'meijin', titleWinner: USER_ID });
    const career = applyMeijinSeason(createMeijinCareer(), done);
    expect(career).toMatchObject({ no: 1, titles: 1, best: 'meijin' });
    // 順位戦の世界はキャリアに持たない(名簿のroster.junniへ書き戻す。junni-world.mjs)。
    expect(career.league).toBeUndefined();
    const league = advanceLeague(done);
    expect(league.holder).toBe(USER_ID);
    expect(userClass(league)).toBeNull();
    // 失冠した名人は、A級の順位1位。
    expect(league.classes.A[0]).toBe(done.league.holder);
    const defense = createMeijinSeason({ no: 2, league, roster, settings, userLevel: 30, seed: 14 });
    expect(defense.mode).toBe('defense');
    expect(defense.pending).toMatchObject({ kind: 'finals' });
    const kept = playOut(defense);
    expect(kept.result.outcome).toBe('defend');
    expect(applyMeijinSeason(career, kept).titles).toBe(2);
  });

  it('名人を通算5期で永世名人', () => {
    let career = { ...createMeijinCareer(), titles: ETERNAL_MEIJIN - 1 };
    const done = playOut(createMeijinSeason({ no: 1, league: leagueWithUserIn('A'), roster, settings, userLevel: 30, seed: 15 }));
    career = applyMeijinSeason(career, done);
    expect(career.eternal).toBe(true);
  });

  it('昇級したら次の期は1つ上のクラスの最後、降級してきた棋士はクラスの最初。棋士の数は変わらない', () => {
    const season = playOut(createMeijinSeason({ no: 1, league: createLeague(roster), roster, settings, userLevel: 12, seed: 16 }));
    const next = advanceLeague(season);
    // 昇級してきた3名は、C級1組の最後に今期の成績順で入る。
    expect(next.classes.C1.slice(-3)).toContain(USER_ID);
    const order = standings(season).slice(0, 3).map(({ id }) => id);
    expect(next.classes.C1.slice(-3)).toEqual(order);
    const count = (league) => MEIJIN_CLASSES.reduce((sum, cls) => sum + league.classes[cls].length, 0) + (league.holder ? 1 : 0);
    expect(count(next)).toBe(count(season.league));
    const demoted = MEIJIN_CLASSES.filter((cls) => cls !== 'C1').flatMap((cls) => season.league.classes[cls]).filter((id) => next.classes.C1.slice(0, 3).includes(id));
    expect(demoted.every((id) => season.league.classes.B2.includes(id))).toBe(true);
  });

  it('キャリアの段位と保存', () => {
    expect(meijinDan(createMeijinCareer())).toBe('四段');
    expect(meijinDan({ ...createMeijinCareer(), best: 'B2' })).toBe('六段');
    expect(meijinDan({ ...createMeijinCareer(), best: 'meijin' })).toBe('九段');
    expect(higherDan('六段', '七段')).toBe('七段');
    const storage = memoryStorage();
    const career = { ...createMeijinCareer(), no: 3, best: 'C1', league: createLeague(roster) };
    saveMeijinCareer(storage, career);
    expect(loadMeijinCareer(storage)).toMatchObject({ no: 3, best: 'C1' });
    expect(loadMeijinCareer(storage).league.classes.C2.at(-1)).toBe(USER_ID);
    storage.setItem('yacobihime:shogi-match:meijin-career', '{"version":1,"no":-2,"best":"X","league":{"classes":{}}}');
    expect(loadMeijinCareer(storage)).toMatchObject({ no: 0, best: 'C2', league: null });
  });
});
