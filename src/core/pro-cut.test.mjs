import { describe, expect, it } from 'vitest';
import { CUT_PLIES, cutSpec, pickCutPly, sfenAfter } from './pro-cut.mjs';
import { autoWeeks, createProYear } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { relayPlan, relayTarget } from './relay-game.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const pendingYear = (seed = 7) => {
  let state = createProYear({ seed, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });
  state = { ...state, goals: { fy: 2026, ids: ['wins', 'rate', 'money'], target: { wins: 15 }, done: {} } };
  return autoWeeks(state);
};

describe('勝負どころから指す(13-3の6)', () => {
  it('公式戦の対局待ちで、あなたの手番になる手数と、相手の作戦の局の設定を作る', () => {
    const state = pendingYear();
    expect(state.pending?.gameId).toBeTruthy();
    const cut = cutSpec(state, { userName: 'やこび' });
    expect(cut).not.toBeNull();
    expect(cut.plies).toBeGreaterThanOrEqual(CUT_PLIES.min);
    expect(cut.plies).toBeLessThanOrEqual(CUT_PLIES.max);
    expect(cut.plies % 2 === 0).toBe(cut.color === 'black');
    expect(cut.spec[cut.color].name).toBe('やこび');
    expect(cut.spec[cut.color === 'black' ? 'white' : 'black'].id).toBe(state.pending.opponentId);
    // 同じ対局なら、同じ局の設定(作り直しても同じ局面になる)。
    expect(cutSpec(state, { userName: 'やこび' }).spec.seed).toBe(cut.spec.seed);
  });

  it('調子と対策の★の分だけ、形勢の筋書きをあなたに寄せる(止める手数までは±300の中)', () => {
    const state = pendingYear();
    const good = cutSpec({ ...state, pending: { ...state.pending, condition: 4, prep: { stars: 3, hit: true } } });
    const sign = good.color === 'black' ? 1 : -1;
    expect(good.spec.story[0] * sign).toBeGreaterThan(0);
    expect(good.spec.winner).toBe(good.color);
    const plan = relayPlan(good.spec);
    expect(Math.abs(relayTarget(plan, CUT_PLIES.max))).toBeLessThanOrEqual(300);
    const flat = cutSpec({ ...state, pending: { ...state.pending, condition: 2, prep: { stars: 0 } } });
    expect(flat.spec.story[0]).toBe(0);
  });

  it('研究会・指導対局・対局待ちでないときは作らない', () => {
    const state = pendingYear();
    expect(cutSpec({ ...state, pending: { ...state.pending, kind: 'study', gameId: null } })).toBeNull();
    expect(cutSpec({ ...state, pending: null })).toBeNull();
  });

  it('止める手数は、あなたの手番で形勢が±300以内の局面まで戻す', () => {
    const entries = Array.from({ length: 44 }, (_, index) => ({ eval: index >= 38 ? 900 : 100 }));
    expect(pickCutPly(entries, { plies: 42, color: 'black' })).toBe(38);
    expect(pickCutPly(entries, { plies: 43, color: 'white' })).toBe(37);
    // 作れた手が少なければ、作れたところまで。
    expect(pickCutPly(entries.slice(0, 30), { plies: 42, color: 'black' })).toBe(30);
    // ずっと傾いていたら、最初から指す。
    expect(pickCutPly(entries.map(() => ({ eval: -800 })), { plies: 40, color: 'black' })).toBeNull();
    expect(pickCutPly(entries.slice(0, 10), { plies: 40, color: 'black' })).toBeNull();
  });

  it('手を指したあとの局面を返し、指せない手があればnull', () => {
    const sfen = sfenAfter(['7g7f', '3c3d']);
    expect(sfen).toMatch(/^lnsgkgsnl\/1r5b1\/pppppp1pp\/6p2\/9\/2P6\/PP1PPPPPP\/1B5R1\/LNSGKGSNL b - /);
    expect(sfenAfter(['7g7f', '7g7f'])).toBeNull();
  });
});
