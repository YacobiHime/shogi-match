import { describe, expect, it } from 'vitest';
import { getStrengthSearchSettings } from './strength-settings.mjs';

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
      maxScoreLoss: 650,
    });
    expect(getStrengthSearchSettings(30000)).toEqual({
      nodes: 60000,
      multiPv: 4,
      moveRank: { min: 1, max: 4 },
      maxScoreLoss: 350,
    });
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
