import { describe, expect, it } from 'vitest';
import {
  CPU_STRENGTH_PRESETS,
  getStrengthSearchSettings,
  usesRandomLegalMove,
} from './strength-settings.mjs';

describe('CPU strength settings', () => {
  it('keeps lower difficulties within plausible candidate moves', () => {
    expect(getStrengthSearchSettings(1000)).toEqual({
      nodes: 2000,
      multiPv: 12,
      moveRank: { min: 3, max: 12 },
      maxScoreLoss: 1600,
    });
    expect(getStrengthSearchSettings(10000)).toEqual({
      nodes: 2500,
      multiPv: 12,
      moveRank: { min: 4, max: 12 },
      maxScoreLoss: 1600,
    });
    expect(getStrengthSearchSettings(20000)).toEqual({
      nodes: 4000,
      multiPv: 10,
      moveRank: { min: 3, max: 10 },
      maxScoreLoss: 1200,
    });
    expect(getStrengthSearchSettings(30000)).toEqual({
      nodes: 11000,
      multiPv: 8,
      moveRank: { min: 2, max: 7 },
      maxScoreLoss: 800,
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

  it('uses a random legal-move CPU only for the introductory level', () => {
    expect(usesRandomLegalMove(1000)).toBe(true);
    expect(usesRandomLegalMove(5000)).toBe(false);
    expect(usesRandomLegalMove(30000)).toBe(false);
  });

  it('steps strong presets toward the best candidate', () => {
    expect(getStrengthSearchSettings(100000)).toEqual({
      nodes: 25000,
      multiPv: 6,
      moveRank: { min: 1, max: 6 },
      maxScoreLoss: 500,
    });
    expect(getStrengthSearchSettings(300000)).toEqual({
      nodes: 120000,
      multiPv: 3,
      moveRank: { min: 1, max: 3 },
      maxScoreLoss: 220,
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
