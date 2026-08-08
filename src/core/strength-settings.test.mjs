import { describe, expect, it } from 'vitest';
import { getStrengthSearchSettings } from './strength-settings.mjs';

describe('CPU strength settings', () => {
  it('keeps lower difficulties within plausible candidate moves', () => {
    expect(getStrengthSearchSettings(1000)).toEqual({
      nodes: 8000,
      multiPv: 5,
      moveRank: { min: 2, max: 5 },
    });
    expect(getStrengthSearchSettings(10000)).toEqual({
      nodes: 22000,
      multiPv: 4,
      moveRank: { min: 1, max: 4 },
    });
    expect(getStrengthSearchSettings(30000)).toEqual({
      nodes: 45000,
      multiPv: 3,
      moveRank: { min: 1, max: 3 },
    });
  });

  it('keeps strong presets on their best available candidates', () => {
    expect(getStrengthSearchSettings(100000)).toEqual({
      nodes: 100000,
      multiPv: 3,
      moveRank: { min: 1, max: 3 },
    });
    expect(getStrengthSearchSettings(300000)).toEqual({
      nodes: 300000,
      multiPv: 1,
      moveRank: { min: 1, max: 1 },
    });
    expect(getStrengthSearchSettings(1000000)).toEqual({
      nodes: 1000000,
      multiPv: 1,
      moveRank: { min: 1, max: 1 },
    });
  });

  it('falls back to normal for an unknown preset', () => {
    expect(getStrengthSearchSettings(999)).toEqual(getStrengthSearchSettings(30000));
  });
});
