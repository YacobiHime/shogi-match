import { describe, expect, it } from 'vitest';
import {
  RECOMMENDED_SCHOOL_SEAT, SCHOOL_BASE, SCHOOL_NAME, TEAM_BATTLE_KEY, TEAM_FORMATS, TEAM_HANANE_ID, TEAM_MOMOKA_ID, TEAM_USER_ID,
  USER_TEAM, chooseTeamPlayer, createTeamRun, currentTeamMatch, draftCandidates, draftLeaders, emptyTeamCareer, finishTeamRun,
  hananeDraftPick, hananeNextPlayer, loadTeamBattle, recordTeamGame, saveTeamBattle, schoolOrder, teamRunView, userMatches,
} from './team-battle.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { abilityValues } from './player-abilities.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), data };
};
const school = (seed = 5, overrides = {}) => createTeamRun({
  format: 'school', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20, ...overrides,
});
const pro = (seed = 5, overrides = {}) => createTeamRun({
  format: 'pro', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20, draftPick: draftCandidates(roster)[0].id, ...overrides,
});

/** 高校の大会を、同じ結果で最後まで指す。 */
function playSchool(run, outcome) {
  let current = run;
  let games = 0;
  while (current.phase !== 'done') {
    expect(current.pending, `${games}局目の相手`).toBeTruthy();
    current = recordTeamGame(current, typeof outcome === 'function' ? outcome(games) : outcome).run;
    games += 1;
    if (games > 20) throw new Error('終わらない');
  }
  return { run: current, games };
}

/** プロの大会を、羽音に任せて最後まで指す(自分の局は同じ結果)。 */
function playPro(run, outcome) {
  let current = run;
  let userGames = 0;
  for (let step = 0; step < 200 && current.phase !== 'done'; step += 1) {
    if (current.pending) {
      current = recordTeamGame(current, outcome).run;
      userGames += 1;
      continue;
    }
    const next = chooseTeamPlayer(current, hananeNextPlayer(current));
    expect(next).toBeTruthy();
    current = next.run;
  }
  return { run: current, userGames };
}

describe('形式', () => {
  it('高校は3局のうち2勝、プロは9本勝負の5本先取', () => {
    expect(TEAM_FORMATS.school).toMatchObject({ games: 3, winsToTake: 2, swissRounds: 4, swissPass: 3, swissFail: 2, knockout: 16 });
    expect(TEAM_FORMATS.pro).toMatchObject({ games: 9, winsToTake: 5, perPlayerMax: 3, leagueSize: 3, knockout: 8 });
    expect(TEAM_BATTLE_KEY).toBe('yacobihime:shogi-match:team-battle:v1');
  });

  it('高校のオーダーは自分の席だけ選び、羽音は残りの上、百花は残りの下', () => {
    expect(schoolOrder(0)).toEqual([TEAM_USER_ID, TEAM_HANANE_ID, TEAM_MOMOKA_ID]);
    expect(schoolOrder(RECOMMENDED_SCHOOL_SEAT)).toEqual([TEAM_HANANE_ID, TEAM_USER_ID, TEAM_MOMOKA_ID]);
    expect(schoolOrder(2)).toEqual([TEAM_HANANE_ID, TEAM_MOMOKA_ID, TEAM_USER_ID]);
  });
});

describe('高校の団体戦', () => {
  it('48校。自分たちは燈ヶ丘高校の3人で、羽音は高校生の中で飛び抜けて強い', () => {
    const run = school();
    expect(Object.keys(run.teams)).toHaveLength(48);
    expect(run.teams[USER_TEAM]).toMatchObject({ name: SCHOOL_NAME, members: [TEAM_HANANE_ID, TEAM_USER_ID, TEAM_MOMOKA_ID] });
    expect(run.players[TEAM_HANANE_ID]).toMatchObject({ name: '天鷺羽音', story: 'hanane' });
    expect(run.players[TEAM_HANANE_ID].rating).toBeGreaterThan(SCHOOL_BASE + 300);
    expect(run.players[TEAM_MOMOKA_ID]).toMatchObject({ name: '桜乃百花' });
    // ほかの学校の席は実力順。
    for (const team of Object.values(run.teams).filter((entry) => !entry.you)) {
      const ratings = team.members.map((id) => run.players[id].rating);
      expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    }
  });

  it('始めるとすぐ予選1回戦の自分の局。相手は同じ席の選手で、Lvは世界の物差しで決まる', () => {
    const run = school();
    const match = currentTeamMatch(run);
    expect(match.label).toBe('予選1回戦');
    expect(run.pending).toMatchObject({ kind: 'team', eventText: '全国高校将棋団体戦', label: '予選1回戦 副将戦' });
    const opponent = run.players[run.pending.opponentId];
    expect(run.teams[match.b].members[1]).toBe(run.pending.opponentId);
    expect(opponent.level).toBeGreaterThanOrEqual(1);
    expect(opponent.level).toBeLessThanOrEqual(49);
    // 仲間の2局は決まっていて、速報の手数がある。
    expect(run.pending.teamBoards).toHaveLength(2);
    for (const board of run.pending.teamBoards) {
      expect(board.reveal).toBeGreaterThanOrEqual(30);
      expect(board.reveal).toBeLessThanOrEqual(110);
    }
  });

  it('全部勝てば、予選3勝と決勝トーナメント4勝の7局で優勝する', () => {
    const { run, games } = playSchool(school(), 'win');
    expect(run.result).toEqual({ place: 1, label: '優勝' });
    expect(run.champion).toBe(USER_TEAM);
    // 予選は3勝で通過するまで(仲間が先に2勝しても、自分の局は指す)。
    expect(games).toBe(7);
    expect(run.ko.size).toBe(16);
    expect(run.ko.rounds[0].filter((entry) => entry.match)).toHaveLength(8);
  });

  it('全部負けても大会は最後まで決まり、成績の言い方がある。決勝トーナメントは16校', () => {
    for (const seed of [1, 2, 3, 4]) {
      const { run, games } = playSchool(school(seed), 'loss');
      expect(run.phase).toBe('done');
      expect(run.champion).toBeTruthy();
      expect(run.result.label).toMatch(/優勝|準優勝|ベスト|予選敗退/);
      expect(games).toBeLessThanOrEqual(8);
      const qualifiers = run.ko.rounds[0].flatMap((entry) => entry.bye ? [entry.bye] : [run.matches[entry.match].a, run.matches[entry.match].b]);
      expect(new Set(qualifiers).size).toBe(16);
    }
  });

  it('引き分け(千日手)は先後を入れ替えて指し直す', () => {
    const run = school();
    const before = run.pending.color;
    const result = recordTeamGame(run, 'draw');
    expect(result.replay).toBe(true);
    expect(result.run.pending.color).not.toBe(before);
    expect(currentTeamMatch(result.run).id).toBe(currentTeamMatch(run).id);
  });

  it('仲間の2局が1勝1敗なら、自分の勝ちが決勝点になる', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const run = school(seed);
      const boards = run.pending.teamBoards;
      if (boards.filter((board) => board.won).length !== 1) continue;
      const result = recordTeamGame(run, 'win');
      expect(result).toMatchObject({ decided: true, teamWon: true, clinched: true });
      return;
    }
    throw new Error('1勝1敗の種が見つからない');
  });

  it('同じ種と同じ結果なら、同じ大会になる', () => {
    expect(playSchool(school(9), 'win').run).toEqual(playSchool(school(9), 'win').run);
  });
});

describe('プロの早指し団体戦', () => {
  it('リーダーは名簿の強い順の11人で、ドラフトの候補にリーダーと羽音はいない', () => {
    const leaders = draftLeaders(roster);
    expect(leaders).toHaveLength(11);
    const candidates = draftCandidates(roster);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((member) => leaders.includes(member))).toBe(false);
    expect(candidates.some((member) => member.story === 'hanane')).toBe(false);
  });

  it('羽音に任せると、プレイヤーのいちばん低い能力が高い棋士を選び、理由を敬語と「！」なしで言う', () => {
    const candidates = draftCandidates(roster);
    const mine = { opening: 60, judgment: 60, vision: 60, idea: 60, reading: 60, stability: 60, attack: 60, defense: 30 };
    const picked = hananeDraftPick(candidates, mine);
    const best = Math.max(...candidates.map((member) => abilityValues(member).defense));
    expect(abilityValues(candidates.find((member) => member.id === picked.id)).defense).toBe(best);
    expect(picked.reason).toMatch(/受け/);
    expect(picked.reason).not.toMatch(/です|ます|！/);
    expect(hananeDraftPick(candidates, null).id).toBe(candidates[0].id);
  });

  it('12チーム。自分のチームはプレイヤー・羽音・ドラフトの1人で、棋士は1つのチームにだけいる', () => {
    const run = pro();
    expect(Object.keys(run.teams)).toHaveLength(12);
    expect(run.teams[USER_TEAM].members.slice(0, 2)).toEqual([TEAM_USER_ID, TEAM_HANANE_ID]);
    expect(run.teams[USER_TEAM].members[2]).toBe(`p-${draftCandidates(roster)[0].id}`);
    const all = Object.values(run.teams).flatMap((team) => team.members);
    expect(new Set(all).size).toBe(all.length);
    expect(Object.values(run.teams).every((team) => team.members.length === 3)).toBe(true);
    expect(run.leagues).toHaveLength(4);
  });

  it('局ごとに出す棋士を選ぶ。1人最大3局で、5勝で試合が終わる', () => {
    let run = pro();
    const match = currentTeamMatch(run);
    expect(match.label).toBe('予選リーグA 第1試合');
    expect(run.pending).toBeNull();
    const first = chooseTeamPlayer(run, TEAM_USER_ID);
    expect(first.run.pending).toMatchObject({ kind: 'team', label: '予選リーグA 第1試合 第1局' });
    run = recordTeamGame(first.run, 'win').run;
    // 自分は3局まで。
    for (let index = 0; index < 2; index += 1) {
      run = recordTeamGame(chooseTeamPlayer(run, TEAM_USER_ID).run, 'win').run;
    }
    expect(chooseTeamPlayer(run, TEAM_USER_ID)).toBeNull();
    const view = teamRunView(run);
    expect(view.available).not.toContain(TEAM_USER_ID);
    // 仲間を出して、試合を最後まで。
    while (currentTeamMatch(run)?.id === match.id) {
      run = chooseTeamPlayer(run, hananeNextPlayer(run)).run;
    }
    const done = run.matches[match.id];
    expect(Math.max(done.score.a, done.score.b)).toBe(5);
    expect(done.games.length).toBeLessThanOrEqual(9);
    for (const side of ['a', 'b']) for (const count of Object.values(done.used[side])) expect(count).toBeLessThanOrEqual(3);
  });

  it('羽音に任せると、まだ指していない人から。どちらかが4勝なら、プレイヤーに回す', () => {
    const run = pro();
    expect(hananeNextPlayer(run)).toBe(TEAM_USER_ID);
    const after = recordTeamGame(chooseTeamPlayer(run, TEAM_USER_ID).run, 'win').run;
    expect(hananeNextPlayer(after)).toBe(TEAM_HANANE_ID);
    const clutch = structuredClone(after);
    currentTeamMatch(clutch).score = { a: 4, b: 2 };
    expect(hananeNextPlayer(clutch)).toBe(TEAM_USER_ID);
  });

  it('全部勝てば優勝し、全部負けても大会は最後まで決まる', () => {
    const won = playPro(pro(3), 'win');
    expect(won.run.phase).toBe('done');
    expect(won.run.result.label).toMatch(/優勝|準優勝|ベスト|予選敗退/);
    const lost = playPro(pro(4), 'loss');
    expect(lost.run.phase).toBe('done');
    expect(lost.run.champion).toBeTruthy();
    expect(userMatches(lost.run).length).toBeGreaterThanOrEqual(2);
  });
});

describe('保存', () => {
  it('経歴に大会の結果と最高成績を残す。読み込みに失敗しても空の経歴', () => {
    const storage = memory();
    const { run } = playSchool(school(), 'win');
    const career = finishTeamRun(emptyTeamCareer(), run, 100);
    expect(career.history).toEqual([{ format: 'school', place: 1, label: '優勝', at: 100, team: SCHOOL_NAME }]);
    expect(career.best.school).toEqual({ place: 1, label: '優勝' });
    saveTeamBattle(storage, { ...career, current: school(2) });
    const loaded = loadTeamBattle(storage);
    expect(loaded.current.pending).toBeTruthy();
    expect(loaded.history).toHaveLength(1);
    storage.setItem(TEAM_BATTLE_KEY, '{broken');
    expect(loadTeamBattle(storage)).toEqual(emptyTeamCareer());
  });
});
