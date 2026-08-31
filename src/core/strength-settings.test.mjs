import { describe, expect, it } from 'vitest';
import {
  CPU_STRENGTH_PRESETS,
  getStrengthSearchSettings,
  usesRandomLegalMove,
} from './strength-settings.mjs';

describe('CPU strength settings', () => {
  it('offers every level from 0 through 20', () => {
    expect(CPU_STRENGTH_PRESETS).toHaveLength(21);
    expect(CPU_STRENGTH_PRESETS.map(({ level }) => level))
      .toEqual(Array.from({ length: 21 }, (_, level) => level));
    expect(CPU_STRENGTH_PRESETS.at(-2)).toMatchObject({
      level: 19,
      value: 400000,
      label: 'アマ四〜五段程度',
    });
    expect(CPU_STRENGTH_PRESETS.at(-1)).toMatchObject({
      level: 20,
      value: 480000,
      label: '藤井聡太並み',
    });
  });

  it('keeps every legacy preset value available', () => {
    const values = CPU_STRENGTH_PRESETS.map(({ value }) => value);
    expect(values).toEqual(expect.arrayContaining([
      1000, 5000, 10000, 20000, 30000,
      60000, 100000, 200000, 300000, 480000,
    ]));
  });

  it('uses a random legal-move CPU only for level zero', () => {
    expect(usesRandomLegalMove(1000)).toBe(true);
    for (const { level, value } of CPU_STRENGTH_PRESETS.slice(1)) {
      expect(usesRandomLegalMove(value), `Lv${level}`).toBe(false);
    }
  });

  it('makes search and best-move choice progressively stronger', () => {
    const settings = CPU_STRENGTH_PRESETS.slice(1)
      .map(({ value }) => getStrengthSearchSettings(value));
    expect(settings.every((entry, index) => (
      index === 0 || entry.nodes >= settings[index - 1].nodes
    ))).toBe(true);
    expect(settings.map(({ bestMoveRate }) => bestMoveRate)).toEqual([
      0.03, 0.05, 0.08, 0.12, 0.16,
      0.20, 0.25, 0.30, 0.35, 0.42,
      0.50, 0.58, 0.66, 0.74, 0.82,
      0.88, 0.92, 0.95, 0.98, 1,
    ]);
    expect(settings.every((entry, index) => (
      index === 0 || entry.maxScoreLoss <= settings[index - 1].maxScoreLoss
    ))).toBe(true);
  });

  it('preserves the intended anchor settings', () => {
    expect(getStrengthSearchSettings(30000)).toEqual({
      nodes: 8000,
      multiPv: 9,
      moveRank: { min: 2, max: 9 },
      maxScoreLoss: 900,
      scoreTemperature: 650,
      bestMoveRate: 0.42,
    });
    expect(getStrengthSearchSettings(400000)).toEqual({
      nodes: 240000,
      multiPv: 2,
      moveRank: { min: 2, max: 2 },
      maxScoreLoss: 140,
      scoreTemperature: 45,
      bestMoveRate: 0.98,
    });
    expect(getStrengthSearchSettings(480000)).toEqual({
      nodes: 480000,
      multiPv: 1,
      moveRank: { min: 1, max: 1 },
      maxScoreLoss: 0,
      bestMoveRate: 1,
    });
  });

  it('falls back to level ten for an unknown preset', () => {
    expect(getStrengthSearchSettings(999)).toEqual(getStrengthSearchSettings(30000));
  });
});
