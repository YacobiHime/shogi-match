import { describe, expect, it } from 'vitest';
import { STANDARD_SFEN } from '../game-state.ts';
import {
  BEHIND_SCORE,
  FAR_AHEAD_SCORE,
  TRAITS,
  activeTraits,
  ageCharacter,
  applyCharacter,
  attackStyleLabel,
  baseMateFinding,
  mateFindProbability,
  shiftProbability,
  characterSituation,
  createCharacter,
  describeCharacter,
  traitLabel,
} from './player-character.mjs';
import { chooseCpuMove, chooseMatingMove, chooseStyledMove } from './cpu-move-choice.mjs';
import { CPU_STRENGTH_PRESETS, TOP_NODES, getStrengthSearchSettings } from './strength-settings.mjs';
import { createRng } from './ryuo-random.mjs';

const preset = (level) => CPU_STRENGTH_PRESETS.find((entry) => entry.level === level);
const strengthAt = (level) => getStrengthSearchSettings(preset(level).value);
const skillAt = (level) => preset(level).skill;
const cp = (value) => ({ type: 'cp', value });
const mate = (value) => ({ type: 'mate', value });
const quiet = { phase: 'middle', kingDanger: false, attackChance: false, opponentRook: 'static' };
const withTrait = (id, degree = 1, attack = 0) => ({ attack, traits: [{ id, degree }] });

describe('finding mates', () => {
  it('finds short mates more often than long ones, and stronger levels find longer mates', () => {
    let previousCenter = 0;
    for (const { skill } of CPU_STRENGTH_PRESETS) {
      const finding = baseMateFinding(skill);
      expect(finding.center).toBeGreaterThanOrEqual(previousCenter);
      previousCenter = finding.center;
      for (let plies = 3; plies <= 15; plies += 2) {
        expect(mateFindProbability(finding, plies)).toBeLessThanOrEqual(mateFindProbability(finding, plies - 2));
      }
    }
    const weak = baseMateFinding(skillAt(21));
    const strong = baseMateFinding(skillAt(35));
    expect(mateFindProbability(strong, 7)).toBeGreaterThan(mateFindProbability(weak, 7));
    expect(mateFindProbability(baseMateFinding(1), 31)).toBe(1);
  });

  it('raises the chance with the tsume trait, most for mates around the level, and by degree', () => {
    const at = (level, degree, plies) => {
      const settings = applyCharacter(strengthAt(level), degree ? withTrait('tsume', degree) : null, quiet, { skill: skillAt(level) });
      return mateFindProbability(settings.mateFinding, plies);
    };
    for (const level of [21, 30, 35]) {
      for (const plies of [3, 5, 7, 9]) {
        expect(at(level, 1, plies)).toBeGreaterThanOrEqual(at(level, 0, plies));
        expect(at(level, 2, plies)).toBeGreaterThanOrEqual(at(level, 1, plies));
      }
    }
    // 上がり幅はレベルで変わる。六級程度では3手詰め、アマ四段程度では11手詰めの上がり幅が大きい。
    expect(at(21, 2, 3) - at(21, 0, 3)).toBeGreaterThan(at(35, 2, 3) - at(35, 0, 3));
    expect(at(35, 2, 11) - at(35, 0, 11)).toBeGreaterThan(at(21, 2, 11) - at(21, 0, 11));
  });

  it('shifts probabilities by log-odds, staying inside 0..1', () => {
    expect(shiftProbability(0.5, 0)).toBeCloseTo(0.5);
    expect(shiftProbability(0.5, 1)).toBeGreaterThan(0.7);
    expect(shiftProbability(0.99, 2)).toBeLessThan(1);
    expect(shiftProbability(0.9, 1) - 0.9).toBeLessThan(shiftProbability(0.5, 1) - 0.5);
  });

  it('mates with the given chance, choosing the shortest mate', () => {
    const candidates = [
      { rank: 1, move: '2b3c', score: mate(9) },
      { rank: 2, move: '7g7f', score: mate(5) },
      { rank: 3, move: '2g2f', score: cp(300) },
    ];
    const sure = { mateFinding: { center: 100, slope: 1 } };
    expect(chooseMatingMove({ candidates, strength: sure, random: () => 0.5 })).toMatchObject({ move: '7g7f', mate: 5 });
    expect(chooseMatingMove({ candidates, strength: { mateFinding: { center: -100, slope: 1 } }, random: () => 0.5 })).toBeNull();
    expect(chooseMatingMove({ candidates, strength: {} })).toBeNull();
    const finding = { center: 5, slope: 0.7 };
    let found = 0;
    for (let seed = 1; seed <= 2000; seed += 1) if (chooseMatingMove({ candidates, strength: { mateFinding: finding }, random: createRng(seed).next })) found += 1;
    expect(found / 2000).toBeCloseTo(mateFindProbability(finding, 5), 1);
  });

  it('makes chooseCpuMove play the mate when it finds it', async () => {
    const strength = { ...strengthAt(12), mateFinding: { center: 100, slope: 1 }, bestMoveRate: 0 };
    const search = { move: '2g2f', candidates: [{ rank: 1, move: '2g2f', score: mate(3) }, { rank: 2, move: '7g7f', score: cp(0) }] };
    for (let seed = 1; seed <= 20; seed += 1) {
      const choice = await chooseCpuMove({
        strength, sfen: STANDARD_SFEN, legalMoves: ['2g2f', '7g7f'], search, random: createRng(seed).next,
      });
      expect(choice).toMatchObject({ move: '2g2f', kind: 'mate' });
    }
  });
});

describe('style', () => {
  const naturalness = Object.assign(() => 1, {
    isSacrifice: () => false,
    leaning: (move) => ({ attack: 1, defend: -1 }[move] ?? 0),
  });
  const candidates = [
    { rank: 1, move: 'quiet', score: cp(100) },
    { rank: 2, move: 'attack', score: cp(60) },
    { rank: 3, move: 'defend', score: cp(50) },
    { rank: 4, move: 'far', score: cp(-200) },
  ];
  const search = { move: 'quiet', candidates };
  const count = (attack, move) => {
    let hits = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      const choice = chooseStyledMove({ search, candidates, style: { attack, margin: 80, rate: 0.6 }, naturalness, random: createRng(seed).next });
      if (choice?.move === move) hits += 1;
      if (choice) expect(choice.loss).toBeLessThanOrEqual(80);
    }
    return hits;
  };

  it('picks moves that fit the style, only near the best move, at a rate that grows with the style', () => {
    expect(count(0.9, 'attack')).toBeGreaterThan(count(0.3, 'attack'));
    expect(count(0.9, 'defend')).toBe(0);
    expect(count(-0.9, 'defend')).toBeGreaterThan(100);
    expect(count(0.9, 'far')).toBe(0);
    expect(chooseStyledMove({ search, candidates, style: { attack: 0 }, naturalness })).toBeNull();
  });

  it('keeps the best move when it already fits the style', () => {
    const attackFirst = { move: 'attack', candidates };
    for (let seed = 1; seed <= 50; seed += 1) {
      expect(chooseStyledMove({ search: attackFirst, candidates, style: { attack: 1, margin: 80, rate: 1 }, naturalness, random: createRng(seed).next })).toBeNull();
    }
  });

  it('names the style in words', () => {
    expect(attackStyleLabel(0.8)).toBe('激しい攻め将棋');
    expect(attackStyleLabel(-0.4)).toBe('受け将棋');
    expect(attackStyleLabel(0)).toBe('バランス型');
  });
});

describe('situation', () => {
  it('tells the phase by the ply and finds no danger at the start', () => {
    expect(characterSituation({ sfen: STANDARD_SFEN, ply: 0 })).toMatchObject({ phase: 'opening', kingDanger: false, attackChance: false, opponentRook: 'static' });
    expect(characterSituation({ sfen: STANDARD_SFEN, ply: 40 }).phase).toBe('middle');
    expect(characterSituation({ sfen: STANDARD_SFEN, ply: 90 }).phase).toBe('ending');
  });

  it('sees a king in danger and a ranging rook', () => {
    // 先手玉に、後手の金と竜が迫っている。後手の飛車は振っていない(竜)。
    const danger = characterSituation({ sfen: '4k4/9/9/9/9/9/9/3g5/4K2+r1 b - 1', ply: 100 });
    expect(danger.kingDanger).toBe(true);
    const ranging = characterSituation({ sfen: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 2', ply: 1 });
    expect(ranging.opponentRook).toBe('static');
    const vsRanging = characterSituation({ sfen: 'lnsgkgsnl/1b2r4/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1', ply: 10 });
    expect(vsRanging.opponentRook).toBe('ranging');
  });
});

describe('traits on the strength settings', () => {
  const base = strengthAt(30);
  const apply = (character, situation, level = 30) => applyCharacter(strengthAt(level), character, situation, { skill: skillAt(level) });

  it('adds the base mate horizon and changes nothing else without a character', () => {
    const plain = apply(null, quiet);
    expect(plain).toEqual({ ...base, mateFinding: baseMateFinding(skillAt(30)) });
  });

  it('reads deeper and is sharper only where the trait applies', () => {
    expect(apply(withTrait('deep-reading', 2), quiet).nodes).toBe(Math.round(base.nodes * 1.6));
    const middle = apply(withTrait('middle-strong', 1), quiet);
    expect(middle.nodes).toBeGreaterThan(base.nodes);
    expect(middle.scoreTemperature).toBeLessThan(base.scoreTemperature);
    expect(middle.bestMoveRate).toBeGreaterThan(base.bestMoveRate);
    expect(apply(withTrait('middle-strong', 1), { ...quiet, phase: 'ending' }).nodes).toBe(base.nodes);
    // 探索量はLv40未満の上限を超えない。
    expect(apply(withTrait('deep-reading', 2), quiet, 39).nodes).toBeLessThanOrEqual(TOP_NODES);
  });

  it('defends accurately in a dangerous endgame, and collapses there with the weakness, scaled to the level', () => {
    const danger = { ...quiet, phase: 'ending', kingDanger: true };
    for (const level of [21, 30, 36]) {
      const own = strengthAt(level);
      const steady = apply(withTrait('endgame-defense', 2), danger, level);
      expect(steady.moveLossCap).toBe(Math.max(80, Math.round(own.moveLossCap * 0.4)));
      expect(steady.blunderLimit).toBe(Math.max(0, own.blunderLimit - 2));
      expect(apply(withTrait('endgame-defense', 2), quiet, level).moveLossCap).toBe(own.moveLossCap);
      const slight = apply(withTrait('endgame-collapse', 1), danger, level);
      const heavy = apply(withTrait('endgame-collapse', 2), danger, level);
      expect(slight.oversightRate).toBeGreaterThan(own.oversightRate ?? 0);
      expect(heavy.oversightRate).toBeGreaterThan(slight.oversightRate);
      expect(heavy.moveLossCap).toBeGreaterThanOrEqual(2500);
    }
    // 頓死は、もとから見落としの多い弱いレベルほど多い。
    expect(apply(withTrait('endgame-collapse', 2), danger, 21).oversightRate).toBeGreaterThan(apply(withTrait('endgame-collapse', 2), danger, 36).oversightRate);
  });

  it('reacts to the score after the search', () => {
    expect(activeTraits(withTrait('tenacious'), { ...quiet, advantage: BEHIND_SCORE - 1 })).toHaveLength(1);
    expect(activeTraits(withTrait('tenacious'), { ...quiet })).toHaveLength(0);
    const loose = apply(withTrait('loose-when-ahead', 2), { ...quiet, advantage: FAR_AHEAD_SCORE });
    expect(loose.moveLossCap).toBe(Math.round(base.moveLossCap * 2));
    expect(loose.blunderLimit).toBe(base.blunderLimit + 2);
    expect(loose.bestMoveRate).toBeLessThan(base.bestMoveRate);
  });

  it('carries the attacking style into the settings, but never changes the top level', () => {
    expect(apply({ attack: 0.7, traits: [] }, quiet).style).toMatchObject({ attack: 0.7 });
    const top = apply({ attack: 0.9, traits: [{ id: 'deep-reading', degree: 2 }, { id: 'middle-strong', degree: 2 }] }, quiet, 40);
    expect(top).toEqual({ ...strengthAt(40), mateFinding: baseMateFinding(1), activeTraits: ['deep-reading', 'middle-strong'] });
  });
});

describe('creating characters', () => {
  const sample = (rating, count = 1500) => Array.from({ length: count }, (_, index) => createCharacter(createRng(index + 1), {
    rating, age: 35, style: { id: 'yagura', rook: 'static' },
  }));
  const kindCount = (characters, kind) => characters.reduce((sum, { traits }) => sum + traits.filter(({ id }) => TRAITS.find((t) => t.id === id).kind === kind).length, 0) / characters.length;

  it('gives stronger players more strengths and fewer weaknesses, and most players only a few', () => {
    const weak = sample(1300);
    const strong = sample(1850);
    expect(kindCount(strong, 'strength')).toBeGreaterThan(kindCount(weak, 'strength'));
    expect(kindCount(strong, 'weakness')).toBeLessThan(kindCount(weak, 'weakness'));
    const average = sample(1500);
    expect(average.filter(({ traits }) => traits.length <= 2).length / average.length).toBeGreaterThan(0.75);
    expect(average.some(({ traits }) => traits.length === 0)).toBe(true);
  });

  it('keeps the style in range, never pairs exclusive traits, and names every trait', () => {
    for (const character of sample(1600, 800)) {
      expect(character.attack).toBeGreaterThanOrEqual(-1);
      expect(character.attack).toBeLessThanOrEqual(1);
      const ids = character.traits.map(({ id }) => id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.includes('endgame-defense') && ids.includes('endgame-collapse')).toBe(false);
      expect(ids.includes('vs-ranging') && ids.includes('vs-static')).toBe(false);
      for (const trait of character.traits) {
        expect([1, 2]).toContain(trait.degree);
        expect(traitLabel(trait)).toMatch(/やや|とても|あまり|まったく/);
      }
    }
  });

  it('leans aggressive openings toward attack, and keeps a character valid as the player ages', () => {
    const mean = (styleId) => Array.from({ length: 800 }, (_, index) => createCharacter(createRng(index + 7), {
      rating: 1500, age: 35, style: { id: styleId, rook: 'static' },
    }).attack).reduce((sum, value) => sum + value, 0) / 800;
    expect(mean('ishida')).toBeGreaterThan(mean('ibisha-anaguma'));
    let character = createCharacter(createRng(3), { rating: 1700, age: 40, style: { id: 'yagura', rook: 'static' } });
    for (let year = 0; year < 30; year += 1) {
      character = ageCharacter(createRng(100 + year), character, { age: 40 + year, rating: 1700, style: { id: 'yagura', rook: 'static' } });
      expect(new Set(character.traits.map(({ id }) => id)).size).toBe(character.traits.length);
    }
    expect(describeCharacter(character).style).toBeTruthy();
  });
});
