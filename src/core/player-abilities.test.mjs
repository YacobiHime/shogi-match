import { describe, expect, it } from 'vitest';
import {
  ABILITIES, ABILITY_KEYS, ABILITY_SIM_WEIGHTS, MAX_DEV, abilityBase, abilityRank, abilityTypeLabel, abilityValues, balanceDevs, createAbilities, styleAttackOf,
} from './player-abilities.mjs';
import { abilityEffect, applyCharacter, createCharacter, specialAbilityChips } from './player-character.mjs';
import { createRng } from './ryuo-random.mjs';
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from './strength-settings.mjs';

const weightedSum = (devs) => ABILITY_KEYS.reduce((sum, key) => sum + ABILITY_SIM_WEIGHTS[key] * devs[key], 0);

describe('能力値', () => {
  it('8つの能力。ランクはS〜Gで、レーティングから平均が決まる', () => {
    expect(ABILITIES.map(({ label }) => label)).toEqual(['序盤', '中盤', '終盤', '攻め', '受け', '読み', '詰み', '安定感']);
    expect(abilityRank(95)).toBe('S');
    expect(abilityRank(80)).toBe('A');
    expect(abilityRank(55)).toBe('D');
    expect(abilityRank(19)).toBe('G');
    // プロの平均はC〜D、1組の平均はA、善彦(R2050)はS。
    expect(abilityBase(1350)).toBeCloseTo(50, 5);
    expect(abilityRank(abilityBase(1380))).toBe('D');
    expect(abilityRank(abilityBase(1760))).toBe('A');
    expect(abilityRank(abilityBase(2050))).toBe('S');
    const values = abilityValues({ rating: 1350, character: { abilities: { opening: 30, ending: -60 } } });
    expect(values.opening).toBe(80);
    expect(values.ending).toBe(1);
    expect(values.middle).toBe(50);
  });

  it('配分は、自動対局の重みで平均すると0(強さ全体はレーティングのまま)。上限で丸める', () => {
    const devs = balanceDevs({ opening: 50, middle: 10, ending: 0, attack: 0, defense: 0, reading: 0, mate: 0, stability: 20 });
    expect(Math.abs(weightedSum(devs))).toBeLessThan(ABILITY_KEYS.length);
    expect(Math.max(...Object.values(devs))).toBeLessThanOrEqual(MAX_DEV);
    // 安定感は重み0なので、そのまま。
    expect(devs.stability).toBe(20);
  });

  it('特徴に合わせて寄せ、とがらせる。若手は読み、ベテランは序盤が高い', () => {
    const rng = createRng(4);
    const sample = (character, age, n = 300) => {
      const total = Object.fromEntries(ABILITY_KEYS.map((key) => [key, 0]));
      for (let index = 0; index < n; index += 1) {
        const devs = createAbilities(rng, { age, character });
        for (const key of ABILITY_KEYS) total[key] += devs[key] / n;
      }
      return total;
    };
    expect(sample({ attack: 0, traits: [{ id: 'deep-reading', degree: 2 }] }, 30).reading).toBeGreaterThan(10);
    expect(sample({ attack: 0, traits: [{ id: 'weak-defense', degree: 1 }] }, 30).defense).toBeLessThan(-6);
    expect(sample({ attack: 0.8, traits: [] }, 30).attack).toBeGreaterThan(5);
    const young = sample({ attack: 0, traits: [] }, 20);
    const old = sample({ attack: 0, traits: [] }, 55);
    expect(young.reading).toBeGreaterThan(old.reading);
    expect(old.opening).toBeGreaterThan(young.opening);
    // 一人ひとりは、とがっている(いちばん高い能力といちばん低い能力の差が大きい)。
    const spreads = Array.from({ length: 200 }, () => {
      const devs = createAbilities(rng, { age: 30, character: { attack: 0, traits: [] } });
      return Math.max(...Object.values(devs)) - Math.min(...Object.values(devs));
    });
    expect(spreads.reduce((sum, value) => sum + value, 0) / spreads.length).toBeGreaterThan(25);
  });

  it('棋風は攻めと受けの差で決まり、作った個性の棋風と一致する', () => {
    expect(styleAttackOf({ attack: 20, defense: -20 })).toBe(1);
    expect(styleAttackOf({ attack: -8, defense: 8 })).toBe(-0.4);
    const rng = createRng(11);
    for (let index = 0; index < 50; index += 1) {
      const character = createCharacter(rng, { rating: 1600, age: 30, style: { id: 'aigakari', rook: 'static' } });
      expect(character.attack).toBe(styleAttackOf(character.abilities));
    }
    expect(abilityTypeLabel({ character: { abilities: { opening: 20, middle: 0 } } })).toBe('序盤型');
    expect(abilityTypeLabel({ character: { abilities: { opening: 3, middle: 0 } } })).toBe('バランス型');
  });

  it('強い棋士ほど、金の特殊能力を持ちやすい', () => {
    const rng = createRng(21);
    const gold = (rating) => Array.from({ length: 300 }, () => createCharacter(rng, { rating, age: 32, style: null }))
      .filter((character) => specialAbilityChips(character).some(({ tier }) => tier === 'gold')).length;
    expect(gold(1500)).toBe(0);
    expect(gold(1950)).toBeGreaterThan(60);
  });
});

describe('対局で効く(CPUの強さ設定のつまみ)', () => {
  const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === 25);
  const base = getStrengthSearchSettings(preset.value);
  const situation = (phase) => ({ phase, kingDanger: false, attackChance: false, opponentRook: 'static', advantage: 0 });
  const withDevs = (abilities) => ({ attack: styleAttackOf(abilities), traits: [], abilities });

  it('その局面の能力が高いほど手の選び方が鋭く、低いと鈍い', () => {
    const opening = withDevs({ opening: 30, ending: -30 });
    const early = applyCharacter(base, opening, situation('opening'), { skill: preset.skill });
    const late = applyCharacter(base, opening, situation('ending'), { skill: preset.skill });
    expect(early.bestMoveRate).toBeGreaterThan(base.bestMoveRate);
    expect(late.bestMoveRate).toBeLessThan(base.bestMoveRate);
  });

  it('読みは探索量、詰みは詰みを見つける確率、安定感は悪手の上限', () => {
    expect(abilityEffect({ reading: 30 }, situation('middle')).nodes).toBeCloseTo(2 ** 0.5, 5);
    const deep = applyCharacter(base, withDevs({ reading: 30, mate: 15, stability: 25 }), situation('middle'), { skill: preset.skill });
    expect(deep.nodes).toBeGreaterThan(base.nodes);
    expect(deep.mateFinding.center).toBeGreaterThan(applyCharacter(base, null, situation('middle'), { skill: preset.skill }).mateFinding.center);
    expect(deep.moveLossCap).toBeLessThan(base.moveLossCap);
    const shaky = applyCharacter(base, withDevs({ reading: -30, mate: -15, stability: -20 }), situation('middle'), { skill: preset.skill });
    expect(shaky.nodes).toBeLessThan(base.nodes);
    expect(shaky.moveLossCap).toBeGreaterThan(base.moveLossCap);
  });

  it('Lv40は上限なので変えない', () => {
    const top = CPU_STRENGTH_PRESETS.at(-1);
    const strength = getStrengthSearchSettings(top.value);
    const next = applyCharacter(strength, withDevs({ reading: 35, middle: 35 }), situation('middle'), { skill: top.skill });
    expect(next.nodes).toBe(strength.nodes);
    expect(next.bestMoveRate).toBe(strength.bestMoveRate);
  });

  it('金の特殊能力は、場面と効き方の1行つきの札になる', () => {
    const chips = specialAbilityChips({ traits: [{ id: 'weak-defense', degree: 1 }, { id: 'grand-view', degree: 1 }, { id: 'tsume', degree: 2 }] });
    expect(chips.map(({ tier }) => tier)).toEqual(['gold', 'blue', 'red']);
    expect(chips[0]).toMatchObject({ label: '大局観' });
    expect(chips.every(({ hint }) => hint.length > 0)).toBe(true);
  });
});
