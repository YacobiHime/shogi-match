// 棋士の1年: ほかの棋士の成績(pro-year-design.md 25章)。
import { describe, expect, it } from 'vitest';
import {
  advanceToNextGame, clearProYearResults, createProYear, packProYear, playerCareerView, playersView, PRO_USER_ID,
  recordProGame, startNextYear, TITLE_EVENTS, unpackProYear,
} from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';

function playYear(state, outcome = 'win') {
  for (let step = 0; step < 300; step += 1) {
    state = advanceToNextGame(state);
    if (state.yearDone) break;
    state = clearProYearResults(recordProGame(state, outcome).state);
  }
  return state;
}

const roster = createRoster({ seed: 11, userGroup: 6 });
const start = createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });
const first = playYear(start);

describe('通算は名簿から始める', () => {
  it('名簿の通算の勝ち負けとタイトルの期数を写し、あなたと羽音は0から', () => {
    const member = Object.values(roster.players).find((entry) => entry.kind === 'pro' && entry.record?.total?.wins > 0 && entry.story !== 'hanane');
    expect(start.players[member.id].career.w).toBe(member.record.total.wins);
    expect(start.players[PRO_USER_ID].career).toMatchObject({ w: 0, l: 0 });
    const hanane = Object.values(start.players).find((entry) => entry.story === 'hanane');
    expect(hanane.career).toMatchObject({ w: 0, l: 0 });
  });

  it('いまのタイトル保持者は、そのタイトルを1期以上の経験に数える', () => {
    for (const event of TITLE_EVENTS) {
      const holder = start.titles[event];
      if (holder) expect(start.players[holder].career.titles[event]).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('成績の一覧(25章)', () => {
  it('今年度の勝ち数の順に並び、勝ち負けは年度の記録と同じ', () => {
    const { rows } = playersView(first, { sort: 'year' });
    expect(rows.length).toBeGreaterThan(50);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i - 1].year.w).toBeGreaterThanOrEqual(rows[i].year.w);
    const top = rows[0];
    expect(top.year.w).toBe(first.year.records[top.id].w);
    expect(rows.some((row) => row.you)).toBe(true);
  });

  it('勝率は対局の少ない棋士を下に回す', () => {
    const { rows } = playersView(first, { sort: 'rate' });
    const firstFew = rows.findIndex((row) => row.year.games < 5);
    if (firstFew >= 0) expect(rows.slice(firstFew).every((row) => row.year.games < 5)).toBe(true);
  });

  it('タイトルの順は、いま持っている数が先', () => {
    const { rows } = playersView(first, { sort: 'titles' });
    for (let i = 1; i < rows.length; i += 1) expect(rows[i - 1].held.length).toBeGreaterThanOrEqual(rows[i].held.length);
    expect(rows[0].held.length).toBeGreaterThan(0);
  });
});

describe('年度をまたぐ(25章)', () => {
  const second = playYear(startNextYear(first), 'loss');

  it('年度が替わると、前の年度の勝ち負けが通算に入る', () => {
    const id = Object.keys(first.year.records).find((key) => key !== PRO_USER_ID);
    const before = first.players[id].career;
    const after = startNextYear(first).players[id].career;
    expect(after.w).toBe(before.w + first.year.records[id].w);
    expect(after.l).toBe(before.l + first.year.records[id].l);
  });

  it('期が終わると、優勝した棋士にタイトルの期数か棋戦優勝が足される', () => {
    const done = Object.values(second.cycles).filter((cycle) => cycle.done && cycle.champion && cycle.base >= 2026);
    expect(done.length).toBeGreaterThan(0);
    for (const cycle of done) {
      const career = second.players[cycle.champion].career;
      const box = TITLE_EVENTS.includes(cycle.event) ? career.titles : career.cups;
      expect(box[cycle.event]).toBeGreaterThanOrEqual(1);
    }
  });

  it('くわしい成績: 保持中のタイトル・経験・あなたとの対戦', () => {
    const holder = Object.values(second.titles).find((id) => id && id !== PRO_USER_ID);
    const view = playerCareerView(second, holder);
    expect(view.held.length).toBeGreaterThan(0);
    expect(view.titles.some((entry) => entry.held)).toBe(true);
    expect(view.career.w).toBeGreaterThanOrEqual(view.year.w);
    const opponent = Object.keys(second.user.vs ?? {})[0];
    const vs = playerCareerView(second, opponent).vs;
    expect(vs.w + vs.l).toBeGreaterThan(0);
  });

  it('保存して戻しても通算は同じ。前の保存は名簿から始める', () => {
    const restored = unpackProYear(JSON.parse(JSON.stringify(packProYear(second))), roster);
    const id = Object.keys(second.players).find((key) => second.players[key].career?.w > 0 && key !== PRO_USER_ID);
    expect(restored.players[id].career).toEqual(second.players[id].career);
    const old = packProYear(second);
    for (const entry of Object.values(old.players)) { delete entry.c; delete entry.h; delete entry.u; }
    const legacy = unpackProYear(JSON.parse(JSON.stringify(old)), roster);
    const member = Object.values(roster.players).find((entry) => entry.kind === 'pro' && entry.record?.total?.wins > 0);
    expect(legacy.players[member.id].career.w).toBe(member.record.total.wins);
  });
});
