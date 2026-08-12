import { describe, expect, it } from 'vitest';
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from './strength-settings.mjs';

describe('CPU strength settings', () => {
  it('keeps lower difficulties within plausible candidate moves', () => {
    expect(getStrengthSearchSettings(1000)).toEqual({
      nodes: 10000,
      multiPv: 5,
      moveRank: { min: 2, max: 5 },
      maxScoreLoss: 900,
    });
    expect(getStrengthSearchSettings(10000)).toEqual({
      nodes: 20000,
      multiPv: 4,
      moveRank: { min: 2, max: 4 },
      maxScoreLoss: 700,
    });
    expect(getStrengthSearchSettings(20000)).toEqual({
      nodes: 30000,
      multiPv: 4,
      moveRank: { min: 1, max: 4 },
      maxScoreLoss: 600,
    });
    expect(getStrengthSearchSettings(30000)).toEqual({
      nodes: 40000,
      multiPv: 4,
      moveRank: { min: 1, max: 4 },
      maxScoreLoss: 500,
    });
  });

  it('offers ten gradual UI presets', () => {
    expect(CPU_STRENGTH_PRESETS.map(({ label }) => label)).toEqual([
      '入門', '初級', '易しい', 'やや易しい', 'ふつう',
      'やや強い', '強い', '上級', 'かなり強い', '藤井聡太並み',
    ]);
    expect(CPU_STRENGTH_PRESETS.map(({ value }) => value))
      .toEqual([1000, 5000, 10000, 20000, 30000, 60000, 100000, 200000, 300000, 480000]);
  });

  it('steps strong presets toward the best candidate', () => {
    expect(getStrengthSearchSettings(100000)).toEqual({
      nodes: 120000,
      multiPv: 3,
      moveRank: { min: 1, max: 3 },
      maxScoreLoss: 220,
    });
    expect(getStrengthSearchSettings(300000)).toEqual({
      nodes: 300000,
      multiPv: 2,
      moveRank: { min: 1, max: 2 },
      maxScoreLoss: 100,
    });
    expect(getStrengthSearchSettings(480000)).toEqual({
      nodes: 480000,
      multiPv: 1,
      moveRank: { min: 1, max: 1 },
      maxScoreLoss: 0,
    });
  });

  it('falls back to normal for an unknown preset', () => {
    expect(getStrengthSearchSettings(999)).toEqual(getStrengthSearchSettings(30000));
  });
});
