import { describe, expect, it } from 'vitest';
import {
  CPU_STRENGTH_PRESETS,
  getStrengthSearchSettings,
  usesNaturalMoveOnly,
} from './strength-settings.mjs';

describe('CPU strength settings', () => {
  it('offers every level from 0 through 24', () => {
    expect(CPU_STRENGTH_PRESETS).toHaveLength(25);
    expect(CPU_STRENGTH_PRESETS.map(({ level }) => level))
      .toEqual(Array.from({ length: 25 }, (_, level) => level));
    // Lv0は一様ランダムをやめ自然さで選ぶため、「完全不規則指し」から改名した。
    expect(CPU_STRENGTH_PRESETS[0].label).toBe('駒の動きを覚えたて');
    expect(CPU_STRENGTH_PRESETS[14].label).toBe('六級程度');
    expect(CPU_STRENGTH_PRESETS.at(-2)).toMatchObject({
      level: 23,
      value: 400000,
      label: 'アマ四〜五段程度',
    });
    expect(CPU_STRENGTH_PRESETS.at(-1)).toMatchObject({
      level: 24,
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

  it('uses the engine-free natural-move CPU only for level zero', () => {
    expect(usesNaturalMoveOnly(1000)).toBe(true);
    for (const { level, value } of CPU_STRENGTH_PRESETS.slice(1)) {
      expect(usesNaturalMoveOnly(value), `Lv${level}`).toBe(false);
    }
  });

  it('makes search and best-move choice progressively stronger', () => {
    const settings = CPU_STRENGTH_PRESETS.slice(1)
      .map(({ value }) => getStrengthSearchSettings(value));
    const nonDecreasing = (key) => settings.every((entry, index) => (
      index === 0 || entry[key] >= settings[index - 1][key]
    ));
    const nonIncreasing = (key) => settings.every((entry, index) => (
      index === 0 || entry[key] <= settings[index - 1][key]
    ));
    expect(nonDecreasing('nodes')).toBe(true);
    expect(settings.map(({ bestMoveRate }) => bestMoveRate)).toEqual([
      0.01, 0.01, 0.02, 0.02, 0.03,
      0.05, 0.08, 0.12, 0.16,
      0.20, 0.25, 0.30, 0.35, 0.42,
      0.50, 0.58, 0.66, 0.74, 0.82,
      0.88, 0.92, 0.95, 0.98, 1,
    ]);
    expect(nonIncreasing('maxScoreLoss')).toBe(true);
    // Lv24は最善手だけを選ぶため温度を持たない。
    expect(settings.slice(0, -1).every((entry, index, list) => (
      index === 0 || entry.scoreTemperature <= list[index - 1].scoreTemperature
    ))).toBe(true);
    expect(nonIncreasing('oversightRate')).toBe(true);
    expect(nonIncreasing('naturalnessAlpha')).toBe(true);
    // 一様ランダムの着手は廃止した。互換キーだけ残す。
    expect(settings.every(({ randomLegalRate, randomFallback }) => (
      randomLegalRate === 0 && randomFallback === false
    ))).toBe(true);
  });

  it('never excludes the top candidates and keeps low-level MultiPV small', () => {
    for (const { level, value } of CPU_STRENGTH_PRESETS.slice(1)) {
      const settings = getStrengthSearchSettings(value);
      expect(settings.moveRank, `Lv${level}`).toEqual({ min: 1, max: settings.multiPv });
      // 少ないノード数で大きなMultiPVにすると候補順位も評価値もノイズになる。
      expect(settings.multiPv, `Lv${level}`).toBeLessThanOrEqual(
        Math.max(4, Math.ceil(Math.log2(settings.nodes))),
      );
    }
  });

  it('limits the oversight re-search to a light second search', () => {
    for (const { level, value } of CPU_STRENGTH_PRESETS.slice(1)) {
      const settings = getStrengthSearchSettings(value);
      if (settings.oversightRate === 0) continue;
      expect(settings.oversightNodes, `Lv${level}`).toBeGreaterThan(settings.nodes);
      expect(settings.oversightNodes, `Lv${level}`).toBeLessThanOrEqual(70000);
      expect(settings.oversightMaxLoss, `Lv${level}`).toBeGreaterThan(settings.maxScoreLoss);
    }
  });

  it('preserves the intended anchor settings', () => {
    // 全レベルで1位候補から選ぶ仕様へ変更し、自然さと見落としの設定を追加した。
    expect(getStrengthSearchSettings(30000)).toEqual({
      nodes: 8000,
      multiPv: 9,
      moveRank: { min: 1, max: 9 },
      maxScoreLoss: 900,
      scoreTemperature: 650,
      bestMoveRate: 0.42,
      naturalnessAlpha: 0.6,
      oversightRate: 0.04,
      oversightShallowLoss: 200,
      oversightNodes: 24000,
      oversightMaxLoss: 1000,
      randomLegalRate: 0,
      randomFallback: false,
    });
    expect(getStrengthSearchSettings(400000)).toEqual({
      nodes: 240000,
      multiPv: 2,
      moveRank: { min: 1, max: 2 },
      maxScoreLoss: 140,
      scoreTemperature: 45,
      bestMoveRate: 0.98,
      naturalnessAlpha: 0.2,
      oversightRate: 0,
      oversightShallowLoss: 0,
      oversightNodes: 0,
      oversightMaxLoss: 0,
      randomLegalRate: 0,
      randomFallback: false,
    });
    expect(getStrengthSearchSettings(480000)).toEqual({
      nodes: 480000,
      multiPv: 1,
      moveRank: { min: 1, max: 1 },
      maxScoreLoss: 0,
      bestMoveRate: 1,
      naturalnessAlpha: 0,
      oversightRate: 0,
      oversightShallowLoss: 0,
      oversightNodes: 0,
      oversightMaxLoss: 0,
      randomLegalRate: 0,
      randomFallback: false,
    });
  });

  it('falls back to level fourteen for an unknown preset', () => {
    expect(getStrengthSearchSettings(999)).toEqual(getStrengthSearchSettings(30000));
  });
});
