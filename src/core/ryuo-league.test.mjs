import { describe, expect, it } from 'vitest';
import { USER_ID, createSeason, recordUserGame, scaleById } from './ryuo.mjs';
import { applySeason, createCareer, nextEntry } from './ryuo-career.mjs';
import { applySeasonToRoster, createRoster } from './ryuo-roster.mjs';
import {
  AWARDS,
  DAN_ORDER,
  JUNNI_SIZES,
  OTHER_TITLES,
  WINS_TO_PROMOTE,
  applyDanRules,
  applyWinsRule,
  careerSummary,
  createRecord,
  heldTitles,
  memberWinProbability,
  ryuoSeasonGames,
  totalTitles,
} from './ryuo-league.mjs';
import { MATCHUP_ELO, matchupBonus, summarizeTraitMoments, traitMomentText } from './player-character.mjs';
import { formationFans, memberFormations, memberProfile, rosterBook, vsUserText } from './ryuo-book.mjs';
import { lastGameLines, opponentLines } from './ryuo-speech.mjs';
import { winProbability } from './ryuo-strength.mjs';

const pros = (roster) => Object.values(roster.players).filter(({ kind }) => kind === 'pro');
const index = (dan) => DAN_ORDER.indexOf(dan);

function runSeason(career, roster, seed, policy = () => 'loss') {
  let season = createSeason({ ...nextEntry(career), settings: { difficulty: 9, scale: 5, revival: true }, userLevel: 30, career, roster, seed });
  for (let guard = 0; season.phase !== 'done' && guard < 400; guard += 1) season = recordUserGame(season, policy(season));
  const applied = applySeason(career, season);
  return { career: applied.career, roster: applySeasonToRoster(roster, season, { userGroup: applied.career.group, promote: scaleById(5).promote }), season };
}

describe('initial history', () => {
  const roster = createRoster({ seed: 21 });

  it('gives every title a holder and a history, with titles gathered by a few strong players', () => {
    for (const { id } of OTHER_TITLES) expect(roster.players[roster.titles[id]]?.kind).toBe('pro');
    expect(roster.titleHistory.length).toBeGreaterThan(100);
    const titled = pros(roster).filter((member) => totalTitles(member) > 0).sort((a, b) => totalTitles(b) - totalTitles(a));
    // タイトル経験者は一部で、上位に集中する。
    expect(titled.length).toBeLessThan(pros(roster).length * 0.3);
    expect(totalTitles(titled[0])).toBeGreaterThan(totalTitles(titled[Math.floor(titled.length / 2)]) * 2);
    expect(pros(roster).every(({ record }) => record.total.wins + record.total.losses >= 0)).toBe(true);
    expect(pros(roster).some(({ record, age }) => age >= 50 && record.total.wins > 300)).toBe(true);
  });

  it('fills the Junni classes and raises dan by the rules', () => {
    for (const [cls, size] of Object.entries(JUNNI_SIZES)) expect(pros(roster).filter(({ junni }) => junni === cls)).toHaveLength(size);
    for (const member of pros(roster)) {
      if (member.junni === 'A') expect(index(member.dan)).toBeGreaterThanOrEqual(index('八段'));
      if (member.junni === 'B1') expect(index(member.dan)).toBeGreaterThanOrEqual(index('七段'));
      if (totalTitles(member) >= 3) expect(member.dan).toBe('九段');
      expect(member.record.sincePromotion).toBeLessThan(WINS_TO_PROMOTE[member.dan] ?? Infinity);
    }
  });

  it('summarizes a career for the profile card', () => {
    const top = [...pros(roster)].sort((a, b) => totalTitles(b) - totalTitles(a))[0];
    const summary = careerSummary(roster, top);
    expect(summary.totalTitles).toBe(totalTitles(top));
    expect(summary.titleCounts.length).toBeGreaterThan(0);
    expect(summary.junni).toMatch(/級|フリークラス/);
    expect(heldTitles(roster, roster.holder)[0]).toBe('竜王');
  });
});

describe('a league year', () => {
  it('records the games, plays the titles, gives the awards and keeps the classes', () => {
    const { roster, season } = runSeason(createCareer(), createRoster({ seed: 22 }), 500);
    const list = pros(roster);
    const games = list.map(({ record }) => record.season.games);
    const average = games.reduce((sum, value) => sum + value, 0) / games.length;
    expect(average).toBeGreaterThan(25);
    expect(average).toBeLessThan(50);
    for (const { record } of list) expect(record.season.wins + record.season.losses).toBe(record.season.games);
    expect(roster.titleHistory.filter(({ no }) => no === season.no)).toHaveLength(8);
    const awards = roster.awards.filter(({ no }) => no === season.no);
    expect(awards.map(({ id }) => id).sort()).toEqual(AWARDS.map(({ id }) => id).sort());
    const best = roster.players[awards.find(({ id }) => id === 'best-rate').holder];
    if (best) expect(best.record.season.games).toBeGreaterThanOrEqual(30);
    for (const [cls, size] of Object.entries(JUNNI_SIZES)) expect(list.filter(({ junni }) => junni === cls)).toHaveLength(size);
  });

  it('counts the Ryuo games of roster players, from every bracket and series', () => {
    const roster = createRoster({ seed: 23 });
    let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings: { difficulty: 9, scale: 3, revival: true }, userLevel: 30, roster, seed: 7 });
    while (season.phase !== 'done') season = recordUserGame(season, 'loss');
    const games = ryuoSeasonGames(season, (id) => Boolean(roster.players[id]));
    expect(games.length).toBeGreaterThan(60);
    expect(games.every(({ winner, loser }) => winner !== loser)).toBe(true);
    expect(games.some(({ loser }) => loser === USER_ID)).toBe(true);
  });

  it('keeps the head-to-head record with the player', () => {
    const { roster, season } = runSeason(createCareer(), createRoster({ seed: 24 }), 600, () => 'win');
    const opponents = season.userGames.map(({ opponentId }) => opponentId).filter((id) => roster.players[id]);
    expect(opponents.length).toBeGreaterThan(0);
    for (const id of opponents) expect(roster.vsUser[id]).toMatchObject({ losses: 0, lastNo: 1, lastWin: true });
    expect(roster.vsUser[opponents[0]].streak).toBeGreaterThan(0);
  });
});

describe('promotion rules', () => {
  const pro = (fields) => ({ kind: 'pro', dan: '四段', group: 6, junni: 'C2', titleCounts: {}, ryuo: 0, record: createRecord(), ...fields });

  it('promotes by the number of wins since the last promotion', () => {
    const member = pro({});
    member.record.sincePromotion = WINS_TO_PROMOTE['四段'] - 1;
    applyWinsRule(member);
    expect(member.dan).toBe('四段');
    member.record.sincePromotion += 1;
    applyWinsRule(member);
    expect(member.dan).toBe('五段');
    expect(member.record.sincePromotion).toBe(0);
  });

  it('promotes by Junni class, titles and the Ryuo rules, and never demotes', () => {
    const cases = [
      [{ junni: 'C1' }, '五段'], [{ junni: 'B2' }, '六段'], [{ junni: 'B1' }, '七段'], [{ junni: 'A' }, '八段'],
      [{ titleCounts: { oza: 1 } }, '七段'], [{ titleCounts: { oza: 2 } }, '八段'], [{ titleCounts: { oza: 2, kisei: 1 } }, '九段'],
      [{ titleCounts: { meijin: 1 } }, '九段'], [{ ryuo: 1 }, '八段'], [{ ryuo: 2 }, '九段'], [{ group: 2 }, '六段'], [{ group: 1 }, '七段'],
      [{ dan: '九段', junni: 'C2' }, '九段'],
    ];
    for (const [fields, dan] of cases) {
      const member = pro(fields);
      applyDanRules(member);
      expect(member.dan, JSON.stringify(fields)).toBe(dan);
    }
  });
});

describe('matchups in automatic games', () => {
  it('adds a bonus against the favoured rook style only', () => {
    const fan = { traits: [{ id: 'vs-ranging', degree: 2 }] };
    expect(matchupBonus(fan, 'ranging')).toBe(MATCHUP_ELO * 2);
    expect(matchupBonus(fan, 'static')).toBe(0);
    expect(matchupBonus(null, 'ranging')).toBe(0);
    const a = { rating: 1500, character: fan, repertoire: { styles: ['kakugawari'] } };
    const b = { rating: 1500, character: null, repertoire: { styles: ['sangen'] } };
    expect(memberWinProbability(a, b)).toBeCloseTo(winProbability(1500 + 2 * MATCHUP_ELO, 1500), 6);
    expect(memberWinProbability(b, a)).toBeCloseTo(1 - memberWinProbability(a, b), 6);
  });
});

describe('roster book and lines', () => {
  it('lists the holders, the awards and every group, with profiles', () => {
    const { roster } = runSeason(createCareer(), createRoster({ seed: 25 }), 700);
    const book = rosterBook(roster);
    expect(book.holders).toHaveLength(8);
    expect(book.holders[0].title).toBe('竜王');
    expect(book.awards.length).toBe(7);
    expect(book.groups.map(({ group }) => group)).toEqual([1, 2, 3, 4, 5, 6]);
    const all = book.groups.flatMap(({ members }) => members);
    expect(all).toHaveLength(Object.keys(roster.players).length);
    const top = book.groups[0].members[0];
    expect(top.held.length + top.totalTitles).toBeGreaterThan(0);
    const profile = memberProfile(roster, roster.players[top.id]);
    expect(profile.repertoire).toMatch(/党|オールラウンダー/);
    expect(profile.total).toMatch(/勝.*敗/);
    expect(rosterBook(null)).toBeNull();
    // 得意戦法から、定跡図鑑の戦法・囲いへつなぐ(基本の居飛車は使わない)。
    expect(memberFormations({ repertoire: { styles: ['shiken-mino', 'gangi'] } })).toEqual([
      { kind: 'strategy', id: 'shiken' }, { kind: 'castle', id: 'mino' }, { kind: 'castle', id: 'gangi' },
    ]);
    const someone = Object.values(roster.players).find((member) => memberFormations(member).length);
    const formation = memberFormations(someone)[0];
    const fans = formationFans(roster, formation, 50);
    expect(fans.some(({ id }) => id === someone.id)).toBe(true);
    expect(fans.map(({ group }) => group)).toEqual([...fans.map(({ group }) => group)].sort((a, b) => a - b));
    expect(formationFans(roster, formation)).toHaveLength(Math.min(3, fans.length));
    expect(formationFans(null, formation)).toEqual([]);
  });

  it('describes the head-to-head record', () => {
    expect(vsUserText(null)).toBe('まだ対戦していない');
    expect(vsUserText({ wins: 3, losses: 1, streak: 2 })).toBe('あなたの3勝1敗(あなたの2連勝中)');
    expect(vsUserText({ wins: 0, losses: 3, streak: -3 })).toContain('3連敗中');
  });

  it('mentions titles and rivalry before a game, and trait moments after it', () => {
    const lines = opponentLines({
      name: '佐藤蓮', dan: '九段', level: 30, style: { label: '相掛かり', rook: 'static' },
      repertoire: { party: 'static', styles: ['aigakari', 'kakugawari-kg'] },
      profile: { held: ['名人', '王位'], former: [], totalTitles: 12 },
      vsUser: { wins: 0, losses: 1, streak: -1, lastWin: false },
    }, 30, null);
    expect(lines[0]).toContain('「相掛かり」や「角換わり腰掛け銀」');
    expect(lines.join('')).toContain('二冠');
    expect(lines.join('')).toContain('リベンジ');
    const moments = summarizeTraitMoments([
      { ply: 10, kind: 'style', traits: ['middle-strong'] },
      { ply: 95, kind: 'oversight', traits: ['endgame-collapse'] },
      { ply: 99, kind: 'oversight', traits: ['endgame-collapse'] },
      { ply: 120, kind: 'mate', traits: ['tsume'] },
    ]);
    expect(moments).toEqual([{ id: 'endgame-collapse', ply: 95 }, { id: 'tsume', ply: 120 }]);
    expect(traitMomentText(moments[0])).toMatch(/^96手目、/);
    expect(lastGameLines({ opponent: { name: '佐藤蓮' }, traitMoments: moments })).toHaveLength(3);
    expect(lastGameLines({ traitMoments: [] })).toEqual([]);
  });
});
