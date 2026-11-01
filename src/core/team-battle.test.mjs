import { describe, expect, it } from 'vitest';
import {
  RECOMMENDED_SCHOOL_SEAT, SCHOOL_BASE, SCHOOL_DISTRICTS, SCHOOL_NAME, SCHOOL_STAGES, TEAM_BATTLE_KEY, TEAM_FORMATS, TEAM_HANANE_ID,
  TEAM_MOMOKA_ID, TEAM_USER_ID, USER_TEAM, chooseTeamPlayer, createTeamRun, currentTeamMatch, draftCandidates, draftLeaders,
  emptyTeamCareer, finishTeamRun, hananeDraftPick, hananeNextPlayer, loadTeamBattle, recordTeamGame, saveTeamBattle, schoolOrder,
  teamEntryMembers, teamMemberStatus, teamRunView, teamUserLine, userMatches,
} from './team-battle.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { abilityValues } from './player-abilities.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), data };
};
/** 全国大会から始める高校の大会(前の版と同じ形。15章の前からあるテスト)。 */
const school = (seed = 5, overrides = {}) => createTeamRun({
  format: 'school', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20, startStage: 'national', ...overrides,
});
/** 地区大会から始める高校の大会(いまの形。15章)。 */
const schoolFull = (seed = 5, overrides = {}) => createTeamRun({
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
    if (games > 30) throw new Error('終わらない');
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
    // 予選は3勝で通過するまで(仲間が先に2勝しても、自分の局は指す)。羽音と百花が2人とも負けると試合を落とすので、予選は3〜4局。
    expect([7, 8]).toContain(games);
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

describe('対局画面とのつなぎ', () => {
  it('仲間の局の速報は、決めておいた手数で、席と勝ち負けとチームの星を知らせる', async () => {
    const { teamNews, newsDue } = await import('./match-presence.mjs');
    const run = school(3);
    const news = teamNews(run);
    expect(news).toHaveLength(2);
    expect(news[0].at).toBeLessThanOrEqual(news[1].at);
    expect(news[0].text).toMatch(/^速報：(主将|副将|三将)戦、/);
    expect(newsDue(news, news[0].at - 1, 0)).toBeNull();
    expect(newsDue(news, news[0].at, 0)).toBe(news[0]);
    expect(newsDue(news, 200, 2)).toBeNull();
  });

  it('優勝の賞状は団体優勝で、仲間の名前を添える。棄権は経歴に残る', async () => {
    const { teamAward, awardText, awardLine } = await import('./season-award.mjs');
    const award = teamAward({ id: 'team-school-1', name: '全国高校将棋団体戦', team: SCHOOL_NAME, members: ['天鷺羽音', '桜乃百花'], wins: 7, losses: 0 }, { playerName: 'やこび', at: 0 });
    expect(award).toMatchObject({ id: 'team-team-school-1', grade: 'gold', prize: '団体優勝' });
    expect(awardText(award).body).toMatch(/仲間とともに優勝/);
    expect(awardLine(award)).toBe('全国高校将棋団体戦 団体優勝（燈ヶ丘高校）');
    const { withdrawOptions } = await import('./tournament-withdraw.mjs');
    expect(withdrawOptions({ teamRun: school() }).map(({ id }) => id)).toEqual(['team']);
    const { withdrawTeamRun } = await import('./team-battle.mjs');
    const career = withdrawTeamRun({ ...emptyTeamCareer(), current: school() }, 5);
    expect(career.current).toBeNull();
    expect(career.history.at(-1)).toMatchObject({ label: '棄権', format: 'school' });
  });
});

describe('地区大会・県大会から全国へ(docs/team-battle-design.mdの15章)', () => {
  it('新しい大会は地区大会から。同じ地区の8校のトーナメントで、相手は全国の学校より弱い', () => {
    const run = schoolFull();
    expect(run.stage).toBe('district');
    expect(SCHOOL_STAGES.map((stage) => stage.id)).toEqual(['district', 'prefecture', 'national']);
    expect(Object.keys(run.teams)).toHaveLength(8);
    expect(currentTeamMatch(run).label).toBe('地区大会 1回戦');
    expect(run.pending).toMatchObject({ eventText: '全国高校将棋団体戦', label: '地区大会 1回戦 副将戦' });
    // 地区大会の決勝は大一番にしない(負けても県大会に出られる)。
    expect(run.pending.stakes.boss).toBe(false);
    const mean = (ids) => ids.reduce((sum, id) => sum + run.players[id].rating, 0) / ids.length;
    const districtPlayers = Object.values(run.teams).filter((team) => !team.you).flatMap((team) => team.members);
    const national = school();
    const nationalPlayers = Object.values(national.teams).filter((team) => !team.you).flatMap((team) => team.members);
    expect(mean(districtPlayers)).toBeLessThan(nationalPlayers.reduce((sum, id) => sum + national.players[id].rating, 0) / nationalPlayers.length);
    const view = teamRunView(run);
    expect(view.stage).toBe('district');
    expect(view.stages.map((stage) => stage.state)).toEqual(['current', 'next', 'next']);
    expect(view.tables.tabs.map((tab) => tab.id)).toEqual(['district']);
    expect(view.tables.current).toBe('district');
    expect(view.knockout).toBeNull();
  });

  it('全部勝てば、地区3局・県3局・全国7局の13局で優勝する。全国大会は48校', () => {
    const { run, games } = playSchool(schoolFull(), 'win');
    expect(games).toBe(13);
    expect(run.result).toEqual({ place: 1, label: '優勝' });
    expect(run.stageLog.map(({ id, advanced, label }) => ({ id, advanced, label }))).toEqual([
      { id: 'district', advanced: true, label: '1位で通過' },
      { id: 'prefecture', advanced: true, label: '優勝' },
    ]);
    expect(run.stageTeams.national).toHaveLength(48);
    expect(new Set(Object.values(run.teams).map((team) => team.name)).size).toBe(Object.keys(run.teams).length);
    const view = teamRunView(run);
    expect(view.stages.map((stage) => [stage.state, stage.label])).toEqual([['done', '1位で通過'], ['done', '優勝'], ['done', '優勝']]);
    expect(view.tables.tabs.map((tab) => tab.label)).toEqual(['地区大会', '県大会', '全国予選', '全国決勝T']);
    expect(view.tables.tabs[0].knockout.rounds.map((round) => round.name)).toEqual(['1回戦', '準決勝', '決勝']);
    expect(view.tables.tabs[1].knockout.rounds.map((round) => round.name)).toEqual(['準々決勝', '準決勝', '決勝']);
    // 全国の表は全国の48校だけ(地区・県の学校は入らない)。
    expect(view.swiss.table).toHaveLength(48);
  });

  it('県大会は4つの地区の1位・2位。地区の1位と別の地区の2位が当たり、同じ地区の2校は決勝まで当たらない', () => {
    const { run } = playSchool(schoolFull(7), (index) => (index < 3 ? 'win' : 'loss'));
    const slots = run.stageTeams.prefecture;
    expect(slots).toHaveLength(8);
    const district = (id) => (id === USER_TEAM ? `${SCHOOL_DISTRICTS[0]}地区` : run.teams[id].area);
    expect(district(slots[0])).toBe('中部地区');
    expect(district(slots[5])).toBe('中部地区');
    for (const [x, y] of [[1, 4], [2, 7], [3, 6]]) expect(district(slots[x])).toBe(district(slots[y]));
    // 上の山と下の山に、どの地区も1校ずつ。
    expect(new Set(slots.slice(0, 4).map(district)).size).toBe(4);
    expect(new Set(slots.slice(4).map(district)).size).toBe(4);
  });

  it('地区大会の決勝で負けても2位で県大会へ。県大会で負けたら終わり', () => {
    for (let seed = 1; seed < 80; seed += 1) {
      let run = schoolFull(seed);
      let lostFinal = false;
      for (let index = 0; index < 3 && run.stage === 'district' && run.phase !== 'done'; index += 1) {
        const finalMatch = currentTeamMatch(run);
        const result = recordTeamGame(run, index < 2 ? 'win' : 'loss');
        run = result.run;
        if (finalMatch.label === '地区大会 決勝' && result.decided && !result.teamWon) lostFinal = true;
      }
      if (!lostFinal) continue;
      expect(run.stage).toBe('prefecture');
      expect(run.stageLog[0]).toMatchObject({ id: 'district', advanced: true, label: '2位で通過' });
      expect(currentTeamMatch(run).label).toBe('県大会 準々決勝');
      // 県大会の決勝は大一番。県大会を全部負けると終わり、成績は県大会。
      const { run: done } = playSchool(run, 'loss');
      expect(done.phase).toBe('done');
      if (done.stage === 'prefecture') {
        expect(done.result.label).toMatch(/^県大会 (ベスト8|ベスト4|準優勝)$/);
        expect(done.result.place).toBeGreaterThan(100);
        expect(done.result.place).toBeLessThan(200);
      }
      return;
    }
    throw new Error('地区大会の決勝で負ける種が見つからない');
  });

  it('全部負けても大会は最後まで決まり、成績は負けた段階の言い方。最高成績は全国 < 県 < 地区の順', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { run } = playSchool(schoolFull(seed), 'loss');
      expect(run.phase).toBe('done');
      const { place, label } = run.result;
      if (label.startsWith('地区大会')) expect(place).toBeGreaterThan(200);
      else if (label.startsWith('県大会')) expect(place).toBeGreaterThan(100);
      else expect(place).toBeLessThan(100);
      const view = teamRunView(run);
      expect(view.stages.some((stage) => stage.state === 'out' || stage.label === '優勝')).toBe(true);
    }
    const district = finishTeamRun(emptyTeamCareer(), { format: 'school', result: { place: 204, label: '地区大会 ベスト4' }, teams: {} }, 1);
    const better = finishTeamRun(district, { format: 'school', result: { place: 102, label: '県大会 準優勝' }, teams: {} }, 2);
    expect(better.best.school).toEqual({ place: 102, label: '県大会 準優勝' });
    expect(finishTeamRun(better, { format: 'school', result: { place: 208, label: '地区大会 ベスト8' }, teams: {} }, 3).best.school.label).toBe('県大会 準優勝');
  });

  it('前の版の大会(段階を持たない)は全国大会のまま続く', () => {
    const legacy = school(4);
    delete legacy.stage;
    delete legacy.stageTeams;
    delete legacy.stageLog;
    const view = teamRunView(legacy);
    expect(view.stage).toBe('national');
    expect(view.stages.map((stage) => stage.state)).toEqual(['skipped', 'skipped', 'current']);
    expect(view.tables.tabs.map((tab) => tab.label)).toEqual(['予選', '決勝トーナメント']);
    const { run } = playSchool(legacy, 'win');
    expect(run.result).toEqual({ place: 1, label: '優勝' });
  });
});

describe('仲間のステータス(docs/team-battle-design.mdの16章)', () => {
  it('3人の席・成績・強さの目安・棋風と、能力の写し。羽音の一言は敬語と「！」なし、羽音のことは百花が言う', () => {
    const run = schoolFull(3);
    const view = teamRunView(run);
    expect(Object.keys(view.members)).toEqual([TEAM_HANANE_ID, TEAM_USER_ID, TEAM_MOMOKA_ID]);
    const hanane = view.members[TEAM_HANANE_ID];
    expect(hanane).toMatchObject({ seat: '主将', name: '天鷺羽音', you: false, story: 'hanane' });
    // 強さは段級位でなく、高校生の中での位置(世界の難易度で羽音が「22級」に見えないように)。
    expect(hanane.strength).toBe('高校生で飛び抜けて強い');
    expect(hanane.profile.character.abilities).toBeTruthy();
    expect(hanane.line).toMatch(/^百花「羽音ちゃんは/);
    const momoka = view.members[TEAM_MOMOKA_ID];
    // 百花は楽しそうに攻める初心者(いちばん得意は寄せ)。どの大会でも同じ。
    expect(momoka.line).toBe('羽音「百花は寄せがいい。大局観は、これから覚えればいい」');
    expect(momoka.line).not.toMatch(/です|ます|！/);
    const user = view.members[TEAM_USER_ID];
    expect(user).toMatchObject({ seat: '副将', you: true, profile: null, line: '' });
    // 自分の局の前は、仲間の結果を数えない(速報で知らせるまで伏せる)。
    expect(hanane.record).toEqual({ wins: 0, losses: 0 });
    expect(hanane.recordText).toBe('この大会は、まだ指していない');
    const after = recordTeamGame(run, 'win').run;
    const status = teamMemberStatus(after, TEAM_USER_ID);
    expect(status.record).toEqual({ wins: 1, losses: 0 });
    expect(status.recordText).toBe('この大会 1勝0敗');
    expect(teamMemberStatus(after, TEAM_HANANE_ID).record.wins + teamMemberStatus(after, TEAM_HANANE_ID).record.losses).toBe(1);
    expect(teamMemberStatus(after, 'nobody')).toBeNull();
  });

  it('プロはリーダー(自分)・羽音・ドラフトの棋士。ドラフトの棋士への一言は羽音', () => {
    const run = pro();
    const view = teamRunView(run);
    const ids = run.teams[USER_TEAM].members;
    expect(view.members[ids[0]].seat).toBe('リーダー');
    expect(view.members[ids[2]].strength).toMatch(/^竜王戦\d組くらい$/);
    expect(view.members[ids[0]].strength).toMatch(/くらい$/);
    expect(view.members[ids[2]].line).toMatch(new RegExp(`^羽音「${run.players[ids[2]].name}さんは`));
    expect(view.members[ids[2]].line).not.toMatch(/です|ます|！/);
    expect(view.members[TEAM_HANANE_ID].line).toMatch(/^羽音「私？/);
  });

  it('出場の前でも3人のステータスが見られ、大会の羽音と百花と同じ人物', () => {
    const preview = teamEntryMembers({ format: 'school', roster, userSeat: 0, userName: 'やこび', userLevel: 20, world: 20 });
    expect(preview.map((member) => [member.id, member.seat])).toEqual([[TEAM_USER_ID, '主将'], [TEAM_HANANE_ID, '副将'], [TEAM_MOMOKA_ID, '三将']]);
    expect(preview.every((member) => member.recordText === 'この大会は、まだ指していない')).toBe(true);
    const run = schoolFull(9, { userSeat: 0 });
    const status = teamMemberStatus(run, TEAM_MOMOKA_ID);
    expect(preview[2].repertoire).toBe(status.repertoire);
    expect(preview[2].line).toBe(status.line);
    // 百花は、どの大会でも同じ(種で変わらない)。
    expect(teamMemberStatus(schoolFull(10), TEAM_MOMOKA_ID).repertoire).toBe(status.repertoire);
    const pick = draftCandidates(roster)[2].id;
    const pros = teamEntryMembers({ format: 'pro', roster, draftPick: pick, userLevel: 20 });
    expect(pros.map((member) => member.seat)).toEqual(['リーダー', '', '']);
    expect(pros[2].name).toBe(roster.players[pick].name);
  });

  it('自分への一言は、自分の能力のいちばん得意と苦手から', () => {
    expect(teamUserLine({ best: { label: '読み' }, worst: { label: '受け' } })).toBe('羽音「君は読みが得意。受けは、私たちで補うから」');
    expect(teamUserLine({ best: { label: '読み' }, worst: null })).toBe('羽音「君は読みが得意。そこで勝負すればいい」');
    expect(teamUserLine(null)).toBe('羽音「君の将棋は、これから見せてもらう」');
    for (const text of [teamUserLine(null), teamUserLine({ best: { label: '読み' }, worst: { label: '受け' } })]) expect(text).not.toMatch(/です|ます|！/);
  });
});
