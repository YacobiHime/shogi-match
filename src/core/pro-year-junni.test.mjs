// 棋士の1年: 順位戦の5つのクラスを回戦ごとに進め、表で見せる(pro-year-design.md 26章)。
import { describe, expect, it } from 'vitest';
import { advanceToNextGame, clearProYearResults, createProYear, eventView, recordProGame, PRO_USER_ID } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const start = createProYear({ seed: 7, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

function playUntil(state, done) {
  for (let step = 0; step < 300 && !done(state); step += 1) {
    state = advanceToNextGame(state);
    if (state.yearDone) break;
    state = clearProYearResults(recordProGame(state, 'win').state);
  }
  return state;
}
const junniStage = (state, id) => eventView(state, 'meijin').cycles.find((cycle) => cycle.id === id).stages[0];

describe('あなたのいない期(デビュー前)', () => {
  const state = playUntil(start, (s) => s.cycles['meijin-2025'].stages[0]?.done);
  const view = junniStage(state, 'meijin-2025');

  it('5つのクラスの順位表があり、A級の1位が名人戦の挑戦者', () => {
    expect(view.leagues.map((league) => league.cls)).toEqual(['A', 'B1', 'B2', 'C1', 'C2']);
    const a = view.leagues[0];
    expect(a.done).toBe(true);
    expect(a.played).toBe(a.rounds);
    expect(a.rows[0].mark).toMatchObject({ id: 'challenger', text: '挑戦者' });
    expect(view.winners[0].id).toBe(a.rows[0].id);
  });

  it('名人はA級を指さず、総当たりのA級は全員が同じ局数', () => {
    const a = view.leagues[0];
    expect(a.rows.some((row) => row.id === start.titles.meijin)).toBe(false);
    const games = a.rows.map((row) => row.wins + row.losses);
    expect(new Set(games).size).toBe(1);
  });

  it('デビュー前の期は年間成績と順位戦の世界を変えない', () => {
    expect(state.junni.C2.length).toBe(start.junni.C2.length);
  });

  it('組み合わせの控えは期の終わりに消す(保存を小さく)', () => {
    for (const league of Object.values(state.cycles['meijin-2025'].stages[0].leagues)) {
      expect(league.schedule).toBeUndefined();
      expect(league.met).toBeUndefined();
    }
  });
});

describe('あなたのいる期', () => {
  const mid = playUntil(start, (s) => (s.cycles['meijin-2026']?.stages[0]?.rounds.length ?? 0) >= 4);
  const midView = junniStage(mid, 'meijin-2026');

  it('あなたのクラスが先頭で、ほかの4つのクラスも同じ日に進む', () => {
    expect(midView.leagues[0].you).toBe(true);
    expect(midView.leagues).toHaveLength(5);
    const played = midView.leagues.map((league) => league.played);
    expect(Math.min(...played)).toBeGreaterThan(0);
    // 途中は「昇級圏」「首位」(まだ決まっていない印)。
    const marks = midView.leagues.flatMap((league) => league.rows.map((row) => row.mark?.id)).filter(Boolean);
    expect(marks).toContain('top');
    expect(marks.some((mark) => mark === 'up-zone')).toBe(true);
    expect(marks.some((mark) => mark === 'up' || mark === 'challenger')).toBe(false);
  });

  it('ほかのクラスの対局も年間成績に数える', () => {
    const a = mid.cycles['meijin-2026'].stages[0].leagues.A;
    const someone = a.members.find((id) => a.wins[id] + a.losses[id] > 0);
    expect(mid.year.records[someone].w + mid.year.records[someone].l).toBeGreaterThan(0);
  });

  it('期が終わると、ほかのクラスの昇級を順位戦の世界に写す', () => {
    const end = playUntil(mid, (s) => s.cycles['meijin-2026'].stages[0]?.done);
    const stage = end.cycles['meijin-2026'].stages[0];
    const c1 = junniStage(end, 'meijin-2026').leagues.find((league) => league.cls === 'C1');
    const up = c1.rows.filter((row) => row.mark?.id === 'up').map((row) => row.id);
    expect(up.length).toBeGreaterThan(0);
    for (const id of up) {
      expect(end.junni.B2).toContain(id);
      expect(end.junni.C1).not.toContain(id);
    }
    expect(stage.leagues.C1.schedule).toBeUndefined();
    expect(end.junni.A.includes(PRO_USER_ID)).toBe(false);
  });
});
