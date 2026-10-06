import { describe, expect, it } from 'vitest';
import {
  CPU_STRENGTH_PRESETS,
  DEFAULT_STRENGTH_VALUE,
  getStrengthSearchSettings,
  normalizeStrengthValue,
  searchSettingsForSkill,
  strengthPresetFor,
  usesNaturalMoveOnly,
} from './strength-settings.mjs';

// 2026-09-26版の識別値と表示名。旧URL・保存データは同じ段級位のレベルへ引き継ぐ。
const LEGACY_PRESETS = [
  [1000, '駒の動きを覚えたて'], [2000, '十五級程度'], [3000, '十五級程度'], [4000, '十五級程度'],
  [4500, '十五級程度'], [5000, '十五級程度'], [6000, '十四級程度'], [7000, '十三級程度'],
  [8000, '十二級程度'], [10000, '十一級程度'], [12000, '十級程度'], [15000, '九級程度'],
  [20000, '八級程度'], [25000, '七級程度'], [30000, '六級程度'], [60000, '五級程度'],
  [70000, '四級程度'], [80000, '三級程度'], [100000, '二級程度'], [150000, '一級程度'],
  [200000, 'アマ初段程度'], [250000, 'アマ二段程度'], [300000, 'アマ三段程度'],
  [400000, 'アマ四段程度'], [480000, '藤井聡太並み'],
];

describe('CPU strength settings', () => {
  it('offers Lv0 plus forty Piyo-like levels', () => {
    expect(CPU_STRENGTH_PRESETS).toHaveLength(41);
    expect(CPU_STRENGTH_PRESETS.map(({ level }) => level))
      .toEqual(Array.from({ length: 41 }, (_, level) => level));
    expect(CPU_STRENGTH_PRESETS[0].label).toBe('駒の動きを覚えたて');
    expect(CPU_STRENGTH_PRESETS[1].label).toBe('十五級程度');
    // ぴよ将棋のLv15(3級前後)と同じ目安にする。
    expect(CPU_STRENGTH_PRESETS[15].label).toBe('三級程度');
    expect(CPU_STRENGTH_PRESETS.at(-1)).toMatchObject({ level: 40, value: 480000, label: '藤井聡太並み' });
  });

  it('orders identifiers and calibrated skill from weakest to strongest', () => {
    const increasing = (key) => CPU_STRENGTH_PRESETS.every((preset, index, list) => (
      index === 0 || preset[key] > list[index - 1][key]
    ));
    expect(increasing('value')).toBe(true);
    expect(increasing('skill')).toBe(true);
    expect(CPU_STRENGTH_PRESETS[0].skill).toBe(0);
    expect(CPU_STRENGTH_PRESETS.at(-1).skill).toBe(1);
  });

  it('maps legacy values to the level with the same rank label', () => {
    for (const [value, label] of LEGACY_PRESETS) {
      expect(strengthPresetFor(value).label, String(value)).toBe(label);
    }
  });

  it('rounds unknown values to the nearest level and falls back to the default', () => {
    expect(normalizeStrengthValue(120000)).toBe(125000);
    expect(normalizeStrengthValue(999)).toBe(1000);
    // 藤井聡太並み(Lv40)が上限。それより大きい値(以前の版のLv41など)はLv40にする。
    expect(strengthPresetFor(1500000).level).toBe(40);
    expect(normalizeStrengthValue(Number.NaN)).toBe(DEFAULT_STRENGTH_VALUE);
    expect(strengthPresetFor(DEFAULT_STRENGTH_VALUE).level).toBe(10);
  });

  it('uses the engine-free natural-move CPU only for level zero', () => {
    expect(usesNaturalMoveOnly(1000)).toBe(true);
    for (const { level, value } of CPU_STRENGTH_PRESETS.slice(1)) {
      expect(usesNaturalMoveOnly(value), `Lv${level}`).toBe(false);
    }
  });

  it('moves every setting only in the stronger direction as skill rises', () => {
    const settings = Array.from({ length: 101 }, (_, index) => searchSettingsForSkill(index / 100)).slice(1);
    const monotonic = (key, direction) => settings.every((entry, index) => (
      index === 0 || direction * (entry[key] - settings[index - 1][key]) >= 0
    ));
    expect(monotonic('nodes', 1)).toBe(true);
    expect(monotonic('bestMoveRate', 1)).toBe(true);
    expect(monotonic('maxScoreLoss', -1)).toBe(true);
    expect(monotonic('naturalnessAlpha', -1)).toBe(true);
    expect(monotonic('naturalMoveRate', -1)).toBe(true);
    expect(monotonic('oversightRate', -1)).toBe(true);
    // 最高技量は最善手だけを選ぶため温度を持たない。
    expect(settings.slice(0, -1).every((entry, index, list) => (
      index === 0 || entry.scoreTemperature <= list[index - 1].scoreTemperature
    ))).toBe(true);
    expect(settings.every(({ randomLegalRate, randomFallback }) => (
      randomLegalRate === 0 && randomFallback === false
    ))).toBe(true);
  });

  it('plays unread natural moves only at level zero and narrows vision below', () => {
    const settings = (level) => getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value);
    expect(settings(0).naturalMoveRate).toBe(1);
    // Lv1だけは、Lv0とのつなぎとして読まない手を少し混ぜる。
    expect(settings(1).naturalMoveRate).toBeGreaterThan(0);
    expect(settings(1).naturalMoveRate).toBeLessThan(0.5);
    for (const level of [2, 15, 21, 40]) expect(settings(level).naturalMoveRate, `Lv${level}`).toBe(0);
    // 読まない手の代わりに、目に付く少数の手だけを読む。
    expect(settings(1).visionWidth).toBe(3);
    expect(settings(40).visionWidth).toBeUndefined();
  });

  it('keeps weaker levels on their chosen opening plan longer', () => {
    const scale = (level) => getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value).openingPlanScoreScale;
    expect(scale(1)).toBeGreaterThan(2.9);
    expect(scale(40)).toBe(1);
    expect(CPU_STRENGTH_PRESETS.slice(1).every(({ value }, index, list) => (
      index === 0 || getStrengthSearchSettings(value).openingPlanScoreScale
        <= getStrengthSearchSettings(list[index - 1].value).openingPlanScoreScale
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

  it('reads with one thread below the strongest level', () => {
    for (const { level, value } of CPU_STRENGTH_PRESETS.slice(1, -1)) {
      expect(getStrengthSearchSettings(value).searchThreads, `Lv${level}`).toBe(1);
    }
  });

  it('limits the oversight re-search to a light second search', () => {
    for (const { level, value } of CPU_STRENGTH_PRESETS.slice(1)) {
      const settings = getStrengthSearchSettings(value);
      if (settings.oversightRate === 0) continue;
      expect(settings.oversightNodes, `Lv${level}`).toBeGreaterThan(settings.nodes);
      expect(settings.oversightNodes, `Lv${level}`).toBeLessThanOrEqual(70000);
      // 見落としも1手の損失上限を超えない。上限は見落としの下限(300)より大きく保つ。
      expect(settings.oversightMaxLoss, `Lv${level}`).toBeLessThanOrEqual(settings.moveLossCap);
      expect(settings.oversightMaxLoss, `Lv${level}`).toBeGreaterThan(300);
    }
  });

  it('caps the loss of a single move and limits big blunders per game', () => {
    const settings = Array.from({ length: 99 }, (_, index) => searchSettingsForSkill((index + 1) / 100));
    const monotonic = (key, direction) => settings.every((entry, index) => (
      index === 0 || direction * (entry[key] - settings[index - 1][key]) >= 0
    ));
    expect(monotonic('moveLossCap', -1)).toBe(true);
    expect(monotonic('blunderLimit', -1)).toBe(true);
    expect(monotonic('blunderCooldown', 1)).toBe(true);
    expect(monotonic('simplicity', -1)).toBe(true);
    const lv15 = getStrengthSearchSettings(CPU_STRENGTH_PRESETS[15].value);
    // 以前のLv15は、見落としで2300、抽選で970まで損をする手を選べた。
    expect(lv15.moveLossCap).toBeLessThanOrEqual(600);
    expect(lv15.blunderLimit).toBeLessThanOrEqual(2);
    // 低レベルでも、大駒をただで渡すほどの損は上限で防ぐ。
    expect(getStrengthSearchSettings(CPU_STRENGTH_PRESETS[2].value).moveLossCap).toBeLessThanOrEqual(1300);
    expect(lv15.simplicity).toBeGreaterThan(0.5);
    expect(getStrengthSearchSettings(1000).simplicity).toBe(1);
  });

  it('keeps the strongest level as a pure best-move search', () => {
    // Lv40だけ、曲線の上端(48万)より1.5倍多く、2スレッドで読む。
    expect(getStrengthSearchSettings(480000)).toEqual({
      nodes: 720000,
      searchThreads: 2,
      multiPv: 1,
      moveRank: { min: 1, max: 1 },
      maxScoreLoss: 0,
      bestMoveRate: 1,
      naturalnessAlpha: 0,
      naturalMoveRate: 0,
      oversightRate: 0,
      oversightShallowLoss: 0,
      oversightNodes: 0,
      oversightMaxLoss: 0,
      openingPlanScoreScale: 1,
      randomLegalRate: 0,
      randomFallback: false,
    });
  });
});
