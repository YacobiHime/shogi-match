import { describe, expect, it } from 'vitest';
import { AXIS_MODELS, MY_ABILITY_MIN_MOVES, axisLevel, collectAxes, myAbilityProfile, worldRatingFor } from './my-abilities.mjs';
import { abilityBase } from './player-abilities.mjs';
import { GROUP_MEAN_RATING, recommendedDifficulty } from './ryuo-strength.mjs';

/** その能力のLvで、ちょうど表どおりに指した集計(手の数n)。 */
function axisAt(key, level, n) {
  const { kind, a, b } = AXIS_MODELS[key];
  const y = a + b * level;
  return kind === 'loss' ? { n, sum: Math.round((Math.exp(y) - 10) * n) } : { n, hit: Math.round((1 / (1 + Math.exp(-y))) * n) };
}
function gameAt(levels, n = 40) {
  const axes = Object.fromEntries(Object.keys(AXIS_MODELS).map((key) => [key, axisAt(key, levels[key] ?? levels.all, n)]));
  return { summary: { moves: n, sum: 0, big: 0, phases: {}, axes } };
}

describe('自分の能力', () => {
  it('表の値は、Lvに戻せる', () => {
    for (const key of Object.keys(AXIS_MODELS)) {
      const total = axisAt(key, 20, 1000);
      const value = 'sum' in total ? total.sum / total.n : total.hit / total.n;
      expect(axisLevel(key, { n: total.n, value })).toBeCloseTo(20, 0);
    }
    expect(axisLevel('opening', { n: 0, value: 0 })).toBeNull();
  });

  it('測れた手が足りなければ、出さずに残りを返す', () => {
    const profile = myAbilityProfile({ games: [gameAt({ all: 20 }, 10)], playerLevel: 20 });
    expect(profile).toMatchObject({ ready: false, games: 1, moves: 10, need: MY_ABILITY_MIN_MOVES - 10 });
  });

  it('どの能力も同じLvなら、平均のまま(バランス型)。全体の高さは竜王戦の世界の物差し', () => {
    const profile = myAbilityProfile({ games: Array.from({ length: 5 }, () => gameAt({ all: 20 })), playerLevel: 20 });
    expect(profile.ready).toBe(true);
    // 割合の能力(詰みは機会が少ない)は、手の数を整数に丸めた分だけずれる。
    for (const value of Object.values(profile.member.character.abilities)) expect(Math.abs(value)).toBeLessThanOrEqual(3);
    expect(profile.view.type).toBe('バランス型');
    const base = Math.round(abilityBase(profile.member.rating));
    for (const { value } of profile.view.abilities) expect(Math.abs(value - base)).toBeLessThanOrEqual(3);
  });

  it('終盤だけ強い人は終盤が高く、ほかが少し低い。いちばんの武器と伸びしろを返す', () => {
    const games = Array.from({ length: 8 }, () => gameAt({ all: 15, ending: 30, defense: 8 }));
    const profile = myAbilityProfile({ games, playerLevel: 15 });
    const devs = profile.member.character.abilities;
    expect(devs.ending).toBeGreaterThanOrEqual(15);
    expect(devs.defense).toBeLessThan(0);
    expect(profile.best).toMatchObject({ key: 'ending', label: '終盤' });
    expect(profile.worst).toMatchObject({ key: 'defense' });
    expect(profile.worst.hint).toMatch(/玉/);
    expect(profile.view.type).toBe('終盤型');
  });

  it('詰みを逃さなかっただけでは、詰みを大きくは上げない(割合が1に張りつくため)', () => {
    const games = Array.from({ length: 8 }, () => {
      const game = gameAt({ all: 20 });
      game.summary.axes.mate = { n: 6, hit: 6 };
      return game;
    });
    expect(myAbilityProfile({ games, playerLevel: 20 }).member.character.abilities.mate).toBeLessThanOrEqual(8);
  });

  it('前の要約(axesなし)は、序盤・中盤・終盤と安定感だけを数える', () => {
    const old = { summary: { moves: 40, sum: 4000, big: 4, phases: { opening: { n: 15, sum: 900, big: 0 }, middle: { n: 20, sum: 2000, big: 2 }, ending: { n: 5, sum: 1100, big: 2 } } } };
    const { totals, moves, games } = collectAxes([old, { summary: null }]);
    expect({ moves, games }).toEqual({ moves: 40, games: 1 });
    expect(totals.opening).toEqual({ n: 15, sum: 900 });
    expect(totals.stability).toEqual({ n: 40, hit: 4 });
    expect(totals.attack.n).toBe(0);
    const profile = myAbilityProfile({ games: [old], playerLevel: 15 });
    expect(profile.missing).toEqual(['攻め', '受け', '読み', '詰み']);
  });

  it('おすすめの難易度なら、6組の平均の棋士に7割勝てる強さ。難しい難易度ほど、世界の中では低い', () => {
    const recommended = recommendedDifficulty(20);
    expect(worldRatingFor(20, recommended)).toBe(worldRatingFor(20, null));
    expect(worldRatingFor(20, recommended) - GROUP_MEAN_RATING[6]).toBeGreaterThan(140);
    expect(worldRatingFor(20, recommended + 2)).toBe(worldRatingFor(20, recommended) - 120);
  });
});
