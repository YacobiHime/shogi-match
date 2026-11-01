import { describe, expect, it } from 'vitest';
import {
  REVEAL_MAX_PLY, REVEAL_MIN_PLY, TEAM_HANANE_ID, TEAM_MOMOKA_ID, chooseTeamPlayer, createTeamRun, currentTeamMatch, decisionOrder,
  draftCandidates, hananeNextPlayer, markTeamFinaleSeen, recordTeamGame, teamRunView,
} from './team-battle.mjs';
import {
  FINALE_GRACE, FINALE_ROW_MS, FINALE_TICK_MS, finaleBoardSettled, finaleBoards, finaleClock, finaleLines, finaleRevealMs, teamFinaleView,
} from './team-finale.mjs';
import { peekBoards } from './team-peek.mjs';
import { teamNews } from './match-presence.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const school = (seed = 5, overrides = {}) => createTeamRun({
  format: 'school', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20, ...overrides,
});
const pro = (seed = 5) => createTeamRun({
  format: 'pro', seed, settings: { world: 20 }, roster, userName: 'やこび', userLevel: 20, draftPick: draftCandidates(roster)[0].id,
});
const NO_KEIGO = /です|ます|ございます|ください|！/;

describe('仲間の局を知らせる手数(docs/team-battle-design.mdの19章の1)', () => {
  it('仲間の局は28〜80手目のどこかで知らせる(自分の対局のあいだに届くように)', () => {
    const reveals = [];
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const board of school(seed).pending.teamBoards) reveals.push(board.reveal);
    }
    expect(Math.min(...reveals)).toBeGreaterThanOrEqual(REVEAL_MIN_PLY);
    expect(Math.max(...reveals)).toBeLessThanOrEqual(REVEAL_MAX_PLY);
    expect(new Set(reveals).size).toBeGreaterThan(20);
  });
});

describe('決めた局の順番(19章の4)', () => {
  // 主将(仲間・40手目に勝ち)、副将(自分・勝ち)、三将(仲間・60手目に負け)。
  const rows = [{ won: true, reveal: 40 }, { user: true, won: true }, { won: false, reveal: 60 }];

  it('仲間が2人とも先に終わっていれば、2勝目の自分の局が決める', () => {
    expect(decisionOrder(rows, { userPly: 100 })).toEqual({ order: [0, 2, 1], decidedBy: 1, teamWon: true });
  });

  it('自分が仲間の間に終わっても、2勝目が自分なら自分が決める', () => {
    expect(decisionOrder(rows, { userPly: 50 })).toEqual({ order: [0, 1, 2], decidedBy: 1, teamWon: true });
  });

  it('自分が先に終われば、あとで2勝目になった仲間の局が決める', () => {
    expect(decisionOrder(rows, { userPly: 30 })).toEqual({ order: [1, 0, 2], decidedBy: 0, teamWon: true });
  });

  it('知らせる手数と同じ手数で自分が終わったら、仲間の局はまだ終わっていない', () => {
    expect(decisionOrder(rows, { userPly: 40 }).order).toEqual([1, 0, 2]);
  });

  it('手数がなければ、仲間はみな先に終わった(前の決め方)。負けも同じ順番で決める', () => {
    expect(decisionOrder(rows).decidedBy).toBe(1);
    const losing = [{ won: false, reveal: 40 }, { user: true, won: false }, { won: true, reveal: 60 }];
    expect(decisionOrder(losing, { userPly: 50 })).toMatchObject({ decidedBy: 1, teamWon: false });
  });

  it('プロは指した順', () => {
    const games = [true, true, false, true, true, true].map((won, index) => ({ won, user: index === 5 }));
    expect(decisionOrder(games, { format: 'pro', need: 5 })).toMatchObject({ decidedBy: 5, teamWon: true });
  });
});

describe('結果発表の記録(19章の5・7・8)', () => {
  it('高校は自分の局のあとにいつも結果発表を作り、決勝点は知らせた順で決める', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const run = school(seed);
      const match = currentTeamMatch(run);
      const userIndex = match.games.findIndex((game) => game.user);
      for (const ply of [20, 60, 120]) {
        const result = recordTeamGame(run, 'win', { ply });
        const finale = result.run.finale;
        expect(finale).toMatchObject({ id: match.id, format: 'school', label: match.label, userPly: ply, seen: false });
        expect(finale.rows).toHaveLength(3);
        const order = decisionOrder(finale.rows, { userPly: ply });
        expect(finale.decidedBy).toBe(order.decidedBy);
        expect(result.clinched).toBe(order.decidedBy === userIndex && order.teamWon === true);
      }
    }
  });

  it('結果発表の画面の形: 席の行・チームの星・まだ対局中だった仲間・次のこと', () => {
    const run = school(3);
    const result = recordTeamGame(run, 'loss', { ply: 20 });
    const view = teamFinaleView(result.run, { playerName: 'やこび' });
    expect(view.rows.map((row) => row.label)).toEqual(['主将', '副将', '三将']);
    const user = view.rows.find((row) => row.user);
    expect(user).toMatchObject({ won: false, us: { name: 'やこび', you: true } });
    // 20手で終われば、仲間は2人ともまだ対局中(28手目より前)。
    expect(view.rows.filter((row) => row.pending)).toHaveLength(2);
    expect(view.watch).toBe(true);
    expect(view.scoreText).toBe(`${view.score.us}勝${view.score.them}敗`);
    expect(view.verdict).toMatch(/の勝ち$/);
    expect(view.after).toMatch(/^次は|ベスト|敗退|へ進む/);
    expect(view.lines.map((line) => line.who)).toEqual(['hanane', 'momoka']);
    // 見たら消える。
    const seen = markTeamFinaleSeen(result.run);
    expect(teamFinaleView(seen)).toBeNull();
    expect(markTeamFinaleSeen(seen)).toBe(seen);
  });

  it('長く指して仲間が先に終わっていれば、見守る盤はない', () => {
    const result = recordTeamGame(school(4), 'win', { ply: 150 });
    expect(teamFinaleView(result.run).watch).toBe(false);
    expect(finaleBoards(result.run)).toEqual([]);
  });

  it('見守る盤は、対局中のチラ見と同じ鍵(作った棋譜を使い回す)で、まだ対局中だった局だけ', () => {
    const run = school(6);
    const during = peekBoards(run);
    const result = recordTeamGame(run, 'win', { ply: 20 });
    const after = finaleBoards(result.run);
    expect(after.map((board) => board.spec.key)).toEqual(during.map((board) => board.spec.key));
    expect(after.map((board) => board.won)).toEqual(during.map((board) => board.won));
  });

  it('大会の進み方を最後の一言で言う(地区大会を抜けたら県大会へ)', () => {
    let current = school(8);
    const afters = [];
    for (let step = 0; step < 6 && current.phase !== 'done'; step += 1) {
      current = recordTeamGame(current, 'win', { ply: 100 }).run;
      afters.push(current.finale.after);
    }
    expect(afters.some((text) => /^地区大会を(1位|2位)で通過。県大会へ進む$/.test(text))).toBe(true);
  });

  it('プロは、仲間の局で試合が決まっても結果発表を作る(局ごとの行)', () => {
    let current = pro(7);
    for (let step = 0; step < 40 && !current.finale; step += 1) {
      current = current.pending ? recordTeamGame(current, 'win').run : chooseTeamPlayer(current, hananeNextPlayer(current)).run;
    }
    const view = teamFinaleView(current);
    expect(view.format).toBe('pro');
    expect(view.rows[0].label).toBe('第1局');
    expect(Math.max(view.score.us, view.score.them)).toBe(5);
    expect(view.watch).toBe(false);
    expect(view.lines.map((line) => line.who)).toEqual(['hanane']);
    expect(teamRunView(current).id).toBe(current.id);
  });
});

describe('羽音と百花の一言(19章の7)', () => {
  const row = (id, won, extra = {}) => ({ us: { id }, won, user: id === 'user', ...extra });

  it('決めた人で言い分け、羽音は敬語と「！」なし、百花は「！」あり', () => {
    const rows = [row(TEAM_HANANE_ID, true), row('user', true), row(TEAM_MOMOKA_ID, false)];
    const byUser = finaleLines({ format: 'school', teamWon: true, rows, decisive: rows[1], userWon: true, playerName: 'やこび' });
    expect(byUser[0].text).toMatch(/決めたのは君/);
    expect(byUser[1].text).toMatch(/やこびさん、すごい/);
    const byMomoka = finaleLines({ format: 'school', teamWon: true, rows: [row(TEAM_HANANE_ID, false), row('user', true), row(TEAM_MOMOKA_ID, true)], decisive: { us: { id: TEAM_MOMOKA_ID } }, userWon: true });
    expect(byMomoka[1].text).toMatch(/私の勝ちで決まった/);
    const lost = finaleLines({ format: 'school', teamWon: false, rows, decisive: rows[2], userWon: false });
    expect(lost[0].text).toMatch(/次の一局/);
    const all = [byUser, byMomoka, lost].flat();
    for (const line of all.filter(({ who }) => who === 'hanane')) expect(line.text).not.toMatch(NO_KEIGO);
    for (const line of all.filter(({ who }) => who === 'momoka')) expect(line.text).toMatch(/！/);
  });
});

describe('見守る盤の時計と、結果発表の長さ(19章の6・7)', () => {
  it('時計は1.2秒で1つ進み、知らせる手数で終わる。盤を作れなければ待ちすぎないで結果を出す', () => {
    expect(finaleClock({ userPly: 30, elapsedMs: FINALE_TICK_MS * 10 })).toBe(40);
    expect(finaleClock({ userPly: 30, elapsedMs: -5 })).toBe(30);
    expect(finaleBoardSettled({ clock: 39, reveal: 40, ended: true })).toBe(false);
    expect(finaleBoardSettled({ clock: 40, reveal: 40, ended: true })).toBe(true);
    expect(finaleBoardSettled({ clock: 40, reveal: 40, ended: false })).toBe(false);
    expect(finaleBoardSettled({ clock: 40, reveal: 40, ended: false, failed: true })).toBe(true);
    expect(finaleBoardSettled({ clock: 40 + FINALE_GRACE, reveal: 40, ended: false })).toBe(true);
  });

  it('結果発表は3秒ほどで出し終える(プロは行が多いので短い間)', () => {
    expect(finaleRevealMs({ format: 'school', rows: [1, 2, 3] })).toBe(FINALE_ROW_MS.school * 4);
    expect(finaleRevealMs({ format: 'pro', rows: new Array(9).fill(0) })).toBeLessThanOrEqual(2600);
  });
});

describe('対局中の速報の札(19章の2)', () => {
  it('知らせる順に、席・名前・勝ち負けと、3つの席の○●(自分の席は「自分」)を持つ', () => {
    const run = school(9);
    const news = teamNews(run);
    expect(news).toHaveLength(2);
    const userSeat = [0, 1, 2].find((seat) => !run.pending.teamBoards.some((board) => board.seat === seat));
    expect(news[0].marks.find((mark) => mark.seat === userSeat).state).toBe('you');
    expect(news[0].marks.filter((mark) => mark.state === 'playing')).toHaveLength(1);
    expect(news[1].marks.filter((mark) => mark.state === 'playing')).toHaveLength(0);
    expect(news[0]).toMatchObject({ seat: expect.any(Number), seatName: expect.stringMatching(/^(主将|副将|三将)$/), won: expect.any(Boolean) });
    expect(['hanane', 'momoka']).toContain(news[0].who);
  });
});
