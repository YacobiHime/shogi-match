import { describe, expect, it } from 'vitest';
import { HOW_LABELS, classifyWin, simulateMemberGame } from './ryuo-simulation.mjs';
import { createRng } from './ryuo-random.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { winProbability } from './ryuo-strength.mjs';

const flat = (rating, abilities = {}, traits = []) => ({ rating, character: { attack: 0, traits, abilities }, repertoire: null });

function rate(a, b, games = 6000, options = {}, seed = 1) {
  const rng = createRng(seed);
  let wins = 0;
  for (let index = 0; index < games; index += 1) if (simulateMemberGame(rng, a, b, options).aWins) wins += 1;
  return wins / games;
}

describe('3つの局面のまね(自動対局)', () => {
  it('能力が平らなら、勝率はElo式とほぼ同じ', () => {
    expect(rate(flat(1500), flat(1500))).toBeCloseTo(0.5, 1);
    expect(Math.abs(rate(flat(1700), flat(1500)) - winProbability(1700, 1500))).toBeLessThan(0.03);
    expect(Math.abs(rate(flat(1500), flat(1900)) - winProbability(1500, 1900))).toBeLessThan(0.03);
  });

  it('名簿の棋士どうしでも、レーティングの差ごとの勝率はElo式から大きくずれない(配分は強さを変えない)', () => {
    const roster = createRoster({ seed: 5 });
    const pros = Object.values(roster.players).filter(({ kind }) => kind === 'pro');
    const rng = createRng(3);
    const bins = new Map();
    for (let index = 0; index < 20000; index += 1) {
      const a = pros[Math.floor(rng.next() * pros.length)];
      const b = pros[Math.floor(rng.next() * pros.length)];
      if (a === b) continue;
      const diff = a.rating - b.rating;
      const key = Math.max(-3, Math.min(3, Math.round(diff / 100)));
      const bin = bins.get(key) ?? { n: 0, wins: 0, expected: 0 };
      bin.n += 1;
      bin.expected += winProbability(a.rating, b.rating);
      if (simulateMemberGame(rng, a, b).aWins) bin.wins += 1;
      bins.set(key, bin);
    }
    for (const [key, bin] of bins) {
      if (bin.n < 400) continue;
      expect(Math.abs(bin.wins / bin.n - bin.expected / bin.n), `diff ${key * 100}`).toBeLessThan(0.05);
    }
  });

  it('序盤型は序盤のリードで、終盤型は逆転で勝つことが多い', () => {
    const openingType = flat(1600, { opening: 30, ending: -30 });
    const endingType = flat(1600, { opening: -30, ending: 30 });
    const rng = createRng(7);
    const hows = { opening: {}, ending: {} };
    for (let index = 0; index < 6000; index += 1) {
      const result = simulateMemberGame(rng, openingType, endingType);
      const side = result.aWins ? 'opening' : 'ending';
      hows[side][result.how] = (hows[side][result.how] ?? 0) + 1;
    }
    const share = (side, how) => (hows[side][how] ?? 0) / Object.values(hows[side]).reduce((sum, n) => sum + n, 0);
    expect(share('opening', 'opening')).toBeGreaterThan(share('ending', 'opening'));
    expect(share('ending', 'comeback')).toBeGreaterThan(share('opening', 'comeback'));
    expect(Object.keys(HOW_LABELS)).toEqual(expect.arrayContaining(['opening', 'middle', 'ending', 'comeback', 'recover']));
    expect(classifyWin([150, 200, 100])).toBe('opening');
    expect(classifyWin([0, -100, 10])).toBe('comeback');
  });

  it('大舞台に強い棋士は、決勝・番勝負だけ強い。逆転の名手は劣勢から取り返す', () => {
    const big = flat(1600, {}, [{ id: 'big-stage', degree: 2 }]);
    const plain = flat(1600);
    expect(rate(big, plain, 6000, { big: false })).toBeCloseTo(0.5, 1);
    expect(rate(big, plain, 6000, { big: true })).toBeGreaterThan(0.55);
    expect(rate(flat(1600, {}, [{ id: 'comeback', degree: 1 }]), plain)).toBeGreaterThan(0.53);
  });

  it('安定感の低い棋士どうしは、番狂わせが増える', () => {
    const steadyStrong = flat(1700, { stability: 30 });
    const steadyWeak = flat(1500, { stability: 30 });
    const shakyStrong = flat(1700, { stability: -30 });
    const shakyWeak = flat(1500, { stability: -30 });
    expect(rate(steadyStrong, steadyWeak)).toBeGreaterThan(rate(shakyStrong, shakyWeak) + 0.03);
  });

  it('先後を指定でき、先手が少し有利。使用率から戦法を選ぶ', () => {
    expect(rate(flat(1500), flat(1500), 8000, { aColor: 'black' })).toBeGreaterThan(rate(flat(1500), flat(1500), 8000, { aColor: 'white' }));
    const roster = createRoster({ seed: 2 });
    const [a, b] = Object.values(roster.players).filter(({ kind }) => kind === 'pro');
    const result = simulateMemberGame(createRng(1), a, b, { aColor: 'white' });
    expect(result.aColor).toBe('white');
    expect(result.openings.a).toBeTruthy();
    expect(result.openings.b).toBeTruthy();
  });
});
