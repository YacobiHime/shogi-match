import { describe, expect, it } from 'vitest';
import { BRAIN_SCALE, BRAIN_SCALE_STEPS, BRAIN_SOUND_MAX_MS, brainSoundLength, brainSoundPlan, comboStep } from './brain-sound.mjs';

const KINDS = ['tick', 'place', 'ready', 'go', 'correct', 'miss', 'finish', 'stamp', 'best', 'lantern'];

describe('道場の音(docs/brain-training-design.mdの14-8)', () => {
  it('続けて正解した数から音の段を決め、8段で止まる', () => {
    expect(comboStep(1)).toBe(0);
    expect(comboStep(2)).toBe(1);
    expect(comboStep(8)).toBe(7);
    expect(comboStep(30)).toBe(BRAIN_SCALE_STEPS - 1);
    expect(comboStep(0)).toBe(0);
    expect(comboStep(Number.NaN)).toBe(0);
  });

  it('正解の音は段が上がるほど高い', () => {
    const highs = BRAIN_SCALE.map((_, step) => brainSoundPlan('correct', step)[0].freq);
    for (let index = 1; index < highs.length; index += 1) expect(highs[index]).toBeGreaterThan(highs[index - 1]);
    expect(brainSoundPlan('correct', 99)[0].freq).toBe(BRAIN_SCALE.at(-1));
  });

  it('どの音も1.5秒より短く、大きすぎない', () => {
    for (const kind of KINDS) {
      const plan = brainSoundPlan(kind, 3);
      expect(plan.length, kind).toBeGreaterThan(0);
      expect(brainSoundLength(plan), kind).toBeLessThan(BRAIN_SOUND_MAX_MS);
      for (const tone of plan) {
        expect(tone.gain, kind).toBeGreaterThan(0);
        expect(tone.gain, kind).toBeLessThanOrEqual(0.35);
        expect(tone.ms, kind).toBeGreaterThan(0);
      }
    }
  });

  it('数字キーの音は、ほかの音よりずっと小さく短い', () => {
    const tick = brainSoundPlan('tick');
    expect(brainSoundLength(tick)).toBeLessThanOrEqual(20);
    expect(tick[0].gain).toBeLessThan(brainSoundPlan('correct')[0].gain / 2);
  });

  it('知らない出来事は鳴らさない', () => {
    expect(brainSoundPlan('unknown')).toEqual([]);
  });
});
