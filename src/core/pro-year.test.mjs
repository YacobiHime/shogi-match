import { describe, expect, it } from 'vitest';
import {
  PRO_EVENTS, PRO_USER_ID, PRO_YEAR_KEY, TITLE_EVENTS, addDays, advanceToNextGame, createProYear, dateLabel, dayView, eventView,
  fiscalYearOf, gameLabel, loadProYear, monthView, packProYear, previewNextGame, proYearRelayGame, proYearSeason, proYearTalk, proYearView, recordProGame, saveProYear,
  startNextYear, unpackProYear, weekdayOf, yearEnd, yearStart,
} from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { HANANE } from './ryuo-story.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key), data };
};
const start = (seed = 7, overrides = {}) => createProYear({
  seed, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび', ...overrides,
});

/** 1年度を同じ結果で最後まで指す。 */
function playYear(state, outcome = 'auto') {
  let current = state;
  const played = [];
  for (let step = 0; step < 200; step += 1) {
    current = advanceToNextGame(current);
    if (current.yearDone) break;
    played.push(current.games[current.pending.gameId]);
    current = recordProGame(current, typeof outcome === 'function' ? outcome(current) : outcome).state;
  }
  return { state: current, played };
}

describe('暦', () => {
  it('年度は4月はじまりで、曜日は本物の暦', () => {
    expect(PRO_YEAR_KEY).toBe('yacobihime:shogi-match:pro-year:v1');
    expect(yearStart(2026)).toBe('2026-04-01');
    expect(yearEnd(2026)).toBe('2027-03-31');
    expect(fiscalYearOf('2027-03-31')).toBe(2026);
    expect(fiscalYearOf('2027-04-01')).toBe(2027);
    expect(dateLabel('2026-06-12')).toBe('6月12日(金)');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('棋戦の段階は時期の順で、タイトル戦は番勝負で終わる', () => {
    expect(PRO_EVENTS).toHaveLength(12);
    expect(TITLE_EVENTS).toEqual(['eio', 'meijin', 'kisei', 'oi', 'oza', 'ryuo', 'osho', 'kio']);
    for (const event of PRO_EVENTS) {
      event.stages.forEach((stage, index) => {
        expect(stage.from, `${event.id} ${stage.id}`).toBeLessThanOrEqual(stage.to);
        if (index > 0) expect(stage.from, `${event.id} ${stage.id}`).toBeGreaterThanOrEqual(event.stages[index - 1].from);
      });
      if (event.kind === 'title') expect(event.stages.at(-1)).toMatchObject({ type: 'series', title: true });
    }
  });
});

describe('デビュー', () => {
  const state = start();

  it('4月1日の新四段として始まり、デビュー前の期は名簿の棋士だけで進んでいる', () => {
    expect(state.date).toBe('2026-04-01');
    expect(state.pending).toBeNull();
    expect(state.players[PRO_USER_ID]).toMatchObject({ dan: '四段', name: 'やこび', you: true });
    expect(Object.keys(state.year.records)).toEqual([]);
    const before = Object.values(state.cycles).filter((cycle) => cycle.base === 2025);
    expect(before.length).toBe(PRO_EVENTS.length);
    expect(before.every((cycle) => !cycle.withUser)).toBe(true);
    // 前の年度に始まった棋王戦は、今年度の番勝負を待っている。
    expect(state.cycles['kio-2025'].done).toBe(true);
  });

  it('タイトル保持者は名簿の棋士で、プレイヤーと羽音ではない', () => {
    const hanane = Object.values(state.players).find((member) => member.story === HANANE);
    for (const event of TITLE_EVENTS) {
      expect(state.titles[event], event).toBeTruthy();
      expect([PRO_USER_ID, hanane.id]).not.toContain(state.titles[event]);
    }
  });

  it('羽音は同じ年度の新四段で、順位戦はプレイヤーと同じクラス', () => {
    const hanane = Object.values(state.players).find((member) => member.story === HANANE);
    expect(hanane.dan).toBe('四段');
    expect(state.junni[state.user.cls]).toContain(hanane.id);
    for (const [cls, ids] of Object.entries(state.junni)) if (cls !== state.user.cls) expect(ids).not.toContain(hanane.id);
  });

  it('JT杯は招待なので出られず、新人王戦には出られる', () => {
    expect(state.cycles['jt-2026'].withUser).toBe(false);
    expect(state.cycles['shinjin-2026'].withUser).toBe(true);
    expect(state.cycles['kio-2026'].withUser).toBe(true);
  });

  it('羽音はデビュー前に始まった期には出ない', () => {
    const hanane = Object.values(state.players).find((member) => member.story === HANANE);
    const before = Object.values(state.games).filter((game) => state.cycles[game.cycle]?.base === 2025);
    expect(before.length).toBeGreaterThan(0);
    expect(before.some((game) => [game.a, game.b].includes(hanane.id))).toBe(false);
  });

  it('同じ種なら同じ1年になる', () => {
    const a = advanceToNextGame(start(3));
    const b = advanceToNextGame(start(3));
    expect(a.pending).toEqual(b.pending);
    expect(start(3)).toEqual(start(3));
  });
});

describe('対局', () => {
  it('次の対局日まで進むと、プレイヤーの対局で止まる', () => {
    const state = advanceToNextGame(start());
    const game = state.games[state.pending.gameId];
    expect(game.user).toBe(true);
    expect([game.a, game.b]).toContain(PRO_USER_ID);
    expect(state.date).toBe(game.date);
    expect(game.date >= '2026-04-01').toBe(true);
    expect(state.pending.label).toBe(gameLabel(state, game));
    expect(state.pending.label).toMatch(/戦|杯/);
    expect(state.pending.level).toBeGreaterThanOrEqual(0);
    expect(state.pending.level).toBeLessThanOrEqual(49);
    expect(['black', 'white']).toContain(state.pending.color);
    // 止まっているあいだは先へ進まない。
    expect(advanceToNextGame(state)).toEqual(state);
  });

  it('対局画面の期の形は、相手に保存しないLvを付ける', () => {
    const state = advanceToNextGame(start());
    const season = proYearSeason(state);
    expect(season.players[state.pending.opponentId].level).toBe(state.pending.level);
    expect(state.players[state.pending.opponentId].level).toBeUndefined();
  });

  it('勝ちと負けを記録し、千日手は先後を入れ替えて指し直す', () => {
    const state = advanceToNextGame(start());
    const draw = recordProGame(state, 'draw');
    expect(draw.replay).toBe(true);
    expect(draw.state.pending.gameId).toBe(state.pending.gameId);
    expect(draw.state.pending.color).not.toBe(state.pending.color);
    const won = recordProGame(state, 'win');
    expect(won.won).toBe(true);
    expect(won.state.pending).toBeNull();
    expect(won.state.year.records[PRO_USER_ID]).toMatchObject({ w: 1, l: 0 });
    const lost = recordProGame(state, 'loss');
    expect(lost.won).toBe(false);
    expect(lost.state.year.records[PRO_USER_ID]).toMatchObject({ w: 0, l: 1 });
    const auto = recordProGame(state, 'auto');
    expect(auto.state.games[state.pending.gameId].auto).toBe(true);
  });

  it('負けたらその日に「敗退」を残し、やこび姫が結果と次の対局日を言う', () => {
    let state = start(8);
    let lost = null;
    for (let step = 0; step < 40 && !lost; step += 1) {
      state = advanceToNextGame(state);
      const def = state.games[state.pending.gameId];
      const result = recordProGame(state, 'loss');
      if (def.event !== 'meijin') lost = result;
      state = result.state;
    }
    expect(lost.milestones.some((item) => item.kind === 'out' && /で敗退$/.test(item.text))).toBe(true);
    const view = proYearView(lost.state);
    // 棋戦の一覧も、段階の終わりを待たずに「敗退」。
    const out = view.events.find((event) => event.id === lost.game.event);
    expect(out.status).toMatchObject({ alive: false, text: expect.stringMatching(/で敗退$/) });
    expect(view.lastGame).toMatchObject({ won: false, auto: false });
    expect(proYearTalk(view, previewNextGame(lost.state))).toMatch(/敗退。次は\d+月\d+日の/);
    // 分身に任せたら、分身の勝ち負けを言う。
    const next = advanceToNextGame(lost.state);
    const auto = recordProGame(next, 'auto');
    const autoView = proYearView(auto.state);
    expect(autoView.lastGame.auto).toBe(true);
    if (!auto.milestones.length) expect(proYearTalk(autoView, null)).toMatch(/^分身が(勝った|負けちゃった)よ。/);
  });

  it('次の対局日の見込みは、進めた結果と同じ', () => {
    const state = start(6);
    const preview = previewNextGame(state);
    const next = advanceToNextGame(state);
    expect(preview).toMatchObject({ date: next.pending.date, label: next.pending.label });
    expect(previewNextGame(next)).toBeNull();
  });

  it('節目と優勝を返し、羽音との通算を数える', () => {
    let state = start(9);
    const milestones = [];
    const champions = [];
    for (let step = 0; step < 200; step += 1) {
      state = advanceToNextGame(state);
      if (state.yearDone) break;
      const hanane = state.players[state.pending.opponentId].story === HANANE;
      const before = state.user.vsHanane?.wins ?? 0;
      const result = recordProGame(state, 'win');
      if (hanane) expect(result.state.user.vsHanane.wins).toBe(before + 1);
      milestones.push(...result.milestones);
      champions.push(...result.champions);
      state = result.state;
    }
    expect(milestones.some((item) => item.kind === 'advance' && /突破/.test(item.text))).toBe(true);
    expect(champions.map((item) => item.short)).toEqual(expect.arrayContaining(['棋王', '新人王']));
    expect(champions.find((item) => item.short === '棋王')).toMatchObject({ title: true, fy: 2026 });
    expect(state.user.vsHanane.wins).toBeGreaterThan(0);
  });

  it('1年の対局は年度の中の平日(NHK杯の本戦は日曜)で、同じ日に2局は指さない', () => {
    const { state, played } = playYear(start(5));
    expect(state.yearDone).toBe(true);
    expect(played.length).toBeGreaterThan(15);
    const days = new Set();
    for (const game of played) {
      expect(game.date >= yearStart(2026) && game.date <= yearEnd(2026), game.date).toBe(true);
      const day = weekdayOf(game.date);
      if (game.event === 'nhk' && game.stage === 1) expect(day).toBe(0);
      else expect([0, 6], `${game.date} ${game.label}`).not.toContain(day);
      expect(days.has(game.date), game.date).toBe(false);
      days.add(game.date);
      if (game.twoDay) days.add(addDays(game.date, -1));
    }
    const summary = state.summary;
    expect(summary.wins + summary.losses).toBe(played.length);
    // 順位戦はC級2組の10局。
    expect(played.filter((game) => game.event === 'meijin' && game.stage === 0)).toHaveLength(10);
    expect(summary.junni).toMatchObject({ cls: 'C2' });
    expect(summary.rival).toMatchObject({ name: expect.any(String) });
  });
});

describe('年度', () => {
  const allWins = playYear(start(9), 'win').state;

  it('全部勝つと、新人王戦と棋王を取り、順位戦は昇級する', () => {
    const summary = allWins.summary;
    expect(summary.losses).toBe(0);
    expect(summary.titles).toContain('棋王');
    // 同じ10勝の棋士がいれば、前の期の順位で並ぶ(昇級の枠の中)。
    expect(summary.junni).toMatchObject({ cls: 'C2', promoted: true, wins: 10, losses: 0 });
    expect(summary.awards).toEqual(expect.arrayContaining(['連勝賞']));
    const view = proYearView(allWins);
    expect(view.events.find((event) => event.id === 'shinjin').status).toMatchObject({ won: true });
    expect(view.titles).toContain('棋王');
  });

  it('次の年度へ: 昇級・シード・成績の持ち越し', () => {
    const next = startNextYear(allWins);
    expect(next.fy).toBe(2027);
    expect(next.date).toBe('2027-04-01');
    expect(next.yearDone).toBe(false);
    expect(next.user.cls).toBe('C1');
    expect(next.history.at(-1).fy).toBe(2026);
    expect(Object.keys(next.year.records)).toEqual([]);
    // 本戦に入った棋戦は、次の期は1つ上の段階から。
    expect(Object.values(next.user.seeds).some((index) => index > 0)).toBe(true);
    const seeded = Object.entries(next.user.seeds).find(([, index]) => index > 0)[0];
    expect(next.cycles[`${seeded}-2027`].entry).toBeGreaterThan(0);
    // タイトル保持者はJT杯に招かれる。
    expect(next.cycles['jt-2027'].withUser).toBe(true);
    // 終わった期の古い対局は消える。
    expect(Object.values(next.games).every((game) => game.date >= yearStart(2027) || !next.cycles[game.cycle]?.done)).toBe(true);
    const later = advanceToNextGame(next);
    expect(later.pending).toBeTruthy();
    expect(later.date >= '2027-04-01').toBe(true);
  });

  it('年度が終わる前は次の年度へ進めない', () => {
    const state = start();
    expect(startNextYear(state)).toEqual(state);
  });
});

describe('画面の形', () => {
  const state = advanceToNextGame(start());
  const game = state.games[state.pending.gameId];

  it('1年の画面: 次の対局・棋戦の一覧・成績', () => {
    const view = proYearView(state);
    expect(view.fy).toBe(2026);
    expect(view.pending).toMatchObject({ gameId: game.id, dateText: dateLabel(game.date) });
    expect(view.pending.opponent.name).toBeTruthy();
    expect(view.events).toHaveLength(PRO_EVENTS.length);
    const kio = view.events.find((event) => event.id === 'kio');
    expect(kio.holder.name).toBeTruthy();
    expect(kio.status).toBeTruthy();
    expect(view.events.find((event) => event.id === 'jt').status).toBeNull();
  });

  it('月のカレンダー: 7列で、自分の対局の日に印', () => {
    const [year, month] = game.date.split('-').map(Number);
    const view = monthView(state, year, month);
    expect(view.title).toBe(`${year}年${month}月`);
    expect(view.weeks.every((week) => week.length === 7)).toBe(true);
    const cell = view.weeks.flat().find((entry) => entry.date === game.date);
    expect(cell.today).toBe(true);
    expect(cell.items.some((item) => item.kind === 'user' && item.game === game.id)).toBe(true);
    expect(view.weeks[0][0].date <= `${year}-${String(month).padStart(2, '0')}-01`).toBe(true);
  });

  it('デビューの日から、自分の予定とタイトル戦の予定がカレンダーに出る', () => {
    const fresh = start();
    const april = monthView(fresh, 2026, 4).weeks.flat().flatMap((cell) => cell.items);
    expect(april.some((item) => item.kind === 'plan' && item.event === 'kio')).toBe(true);
    expect(april.some((item) => item.kind === 'title' && item.plan)).toBe(true);
    const june = monthView(fresh, 2026, 6).weeks.flat().flatMap((cell) => cell.items);
    expect(june.some((item) => item.kind === 'plan' && item.short === '順位')).toBe(true);
    // 見込みの日は、進めて組まれた日と同じ(棋王戦の予選の1回戦)。
    const planned = monthView(fresh, 2026, 4).weeks.flat().find((cell) => cell.items.some((item) => item.kind === 'plan' && item.event === 'kio'));
    const next = advanceToNextGame(fresh);
    expect(next.pending.date).toBe(planned.date);
  });

  it('その日: 自分の対局が先頭', () => {
    const view = dayView(state, game.date);
    expect(view.games[0]).toMatchObject({ id: game.id, user: true });
    expect(view.games[0].a.name && view.games[0].b.name).toBeTruthy();
  });

  it('棋戦の表: 段階ごとの時期と、始まった段階の中身', () => {
    const view = eventView(state, game.event);
    expect(view.name).toBeTruthy();
    const cycle = view.cycles.find((entry) => entry.withUser);
    expect(cycle.stages[0].period).toMatch(/月.*日〜/);
    const started = cycle.stages.find((stage) => stage.started);
    expect(started).toBeTruthy();
    // 前の年度に始まった名人戦の七番勝負は、今年度の4〜6月(観戦)。
    const meijin = eventView(state, 'meijin').cycles.find((entry) => entry.id === 'meijin-2025');
    expect(meijin.withUser).toBe(false);
    expect(meijin.stages.at(-1)).toMatchObject({ label: '名人戦七番勝負', period: '4月1日〜6月30日' });
    // 今年度に始まった期の番勝負は来年度。
    const next = eventView(state, 'meijin').cycles.find((entry) => entry.id === 'meijin-2026');
    expect(next.stages.at(-1).period).toBe('来年度 4月1日〜6月30日');
  });
});

describe('棋戦の表と観戦(10章)', () => {
  // 何局か進めて、自分の予選のブロックと、タイトル戦の番勝負が動いた状態。
  let state = start(12);
  for (let step = 0; step < 6; step += 1) {
    state = advanceToNextGame(state);
    state = recordProGame(state, 'win').state;
  }

  it('自分のいるブロックは、竜王戦と同じトーナメント表になる', () => {
    const kio = eventView(state, 'kio').cycles.find((cycle) => cycle.withUser && cycle.id.endsWith('2026'));
    const stage = kio.stages.find((entry) => entry.started && entry.brackets?.length);
    expect(stage).toBeTruthy();
    const mine = stage.brackets[0];
    expect(mine.you).toBe(true);
    expect(mine.view.matches.length).toBeGreaterThan(0);
    expect(mine.view.rounds.at(-1).label).toBe('ブロック決勝');
    // 自分の勝った試合は、自分が勝者の札。
    const userMatch = mine.view.matches.find((match) => match.userIn && match.winner);
    expect(userMatch.userWon).toBe(true);
    // 記録を作らないブロックは、名前の行だけ。
    expect(stage.others.length).toBeGreaterThan(0);
  });

  it('決着した棋士どうしの対局は、中継の項目になる(自分の対局はならない)', () => {
    const games = Object.values(state.games);
    const watchable = games.find((game) => !game.user && game.winner && game.rec);
    expect(watchable).toBeTruthy();
    const entry = proYearRelayGame(state, watchable.id);
    expect(entry).toMatchObject({ event: 'pro-year', label: gameLabel(state, watchable) });
    expect(entry.black.name && entry.white.name).toBeTruthy();
    expect(['black', 'white']).toContain(entry.winner);
    expect(entry.story).toHaveLength(3);
    const own = games.find((game) => game.user && game.winner);
    expect(proYearRelayGame(state, own.id)).toBeNull();
    // 保存しても、観戦の記録は残る。
    const restored = unpackProYear(JSON.parse(JSON.stringify(packProYear(state))), roster);
    expect(proYearRelayGame(restored, watchable.id)).toEqual(entry);
  });

  it('番勝負は、局ごとの星と先後', () => {
    const meijin = eventView(state, 'meijin').cycles.find((cycle) => cycle.id === 'meijin-2025');
    const series = meijin.stages.at(-1).series;
    expect(series.maxGames).toBe(7);
    expect(series.games.length).toBeGreaterThan(0);
    for (const game of series.games) {
      expect(['black', 'white']).toContain(game.aColor);
      expect(['a', 'b', null]).toContain(game.winner);
    }
    const tally = series.games.filter((game) => game.winner === 'a').length;
    expect(series.wins[0]).toBe(tally);
  });
});

describe('保存', () => {
  it('保存して戻すと同じ1年(棋風は名簿から付け直す)', () => {
    const { state } = playYear(start(4));
    const next = advanceToNextGame(startNextYear(state));
    const restored = unpackProYear(JSON.parse(JSON.stringify(packProYear(next))), roster);
    expect(restored).toEqual(next);
    const storage = memory();
    saveProYear(storage, next);
    expect(loadProYear(storage, roster)).toEqual(next);
    // 1年たっても小さい。
    expect(storage.data.get(PRO_YEAR_KEY).length).toBeLessThan(150000);
    saveProYear(storage, null);
    expect(loadProYear(storage, roster)).toBeNull();
  });

  it('壊れた保存は読まない', () => {
    const storage = memory();
    storage.setItem(PRO_YEAR_KEY, '{');
    expect(loadProYear(storage, roster)).toBeNull();
    storage.setItem(PRO_YEAR_KEY, JSON.stringify({ version: 99 }));
    expect(loadProYear(storage, roster)).toBeNull();
  });
});
