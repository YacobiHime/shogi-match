import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_PRESETS,
  CPU_STRENGTH_PRESETS,
  sourceLevelSettings,
  DEFAULT_STRENGTH_VALUE,
  calibratedHybridSearchSettings,
  getStrengthSearchSettings,
  logicLevelOf,
  normalizeStrengthValue,
  searchSettingsForSkill,
  strengthPresetFor,
  usesNaturalMoveOnly,
} from './strength-settings.mjs';

// 2026-09-26版・2026-10-07版の識別値と、2026-10-23の50段階の表示名。
// 旧URL・保存データは、同じ段級位(今の表にない26級・25級は24級)のレベルへ引き継ぐ。
const LEGACY_PRESETS = [
  [1000, '駒の動きを覚えたて'], [1100, '24級程度'], [1200, '24級程度'], [1300, '24級程度'], [1800, '20級程度'],
  [2000, '19級程度'], [3000, '18級程度'], [4000, '17級程度'],
  [4500, '16級程度'], [5000, '15級程度'], [6000, '14級程度'], [7000, '13級程度'],
  [8000, '12級程度'], [10000, '11級程度'], [12000, '10級程度'], [15000, '9級程度'],
  [20000, '8級程度'], [25000, '7級程度'], [30000, '6級程度'], [60000, '5級程度'], [65000, '5級程度'],
  [70000, '4級程度'], [75000, '4級程度'], [80000, '3級程度'], [90000, '3級程度'], [100000, '2級程度'], [125000, '2級程度'],
  [150000, '1級程度'], [175000, '1級程度'],
  [200000, 'アマ初段程度'], [225000, 'アマ初段程度'], [250000, 'アマ二段程度'], [265000, 'アマ二段程度'], [300000, 'アマ三段程度'],
  [320000, 'アマ三段程度'], [400000, 'アマ四段程度'], [480000, '藤井聡太並み'],
  [280000, 'アマ二段程度'], [340000, 'アマ三段程度'], [360000, 'アマ四段程度'], [408000, 'アマ四段程度'],
  [416000, 'アマ五段程度'], [424000, 'アマ五段程度'], [432000, 'アマ五段程度'], [440000, 'アマ六段程度'], [448000, 'アマ六段程度'],
  [456000, 'アマ七段程度'], [464000, 'アマ七段程度'],
  // 前の「プロ級」(Lv39)は、同じ強さのタイトル保持者。
  [472000, 'タイトル保持者程度'],
];

/** 表示名が同じレベルのうち、最も弱いもの。 */
const presetByLabel = (label) => CPU_STRENGTH_PRESETS.find((preset) => preset.label === label);

describe('CPU strength settings', () => {
  it('offers Lv0 plus forty-nine levels from 24級 to 藤井聡太並み (2026-10-23)', () => {
    expect(CPU_STRENGTH_PRESETS).toHaveLength(50);
    expect(CPU_STRENGTH_PRESETS.map(({ level }) => level))
      .toEqual(Array.from({ length: 50 }, (_, level) => level));
    expect(CPU_STRENGTH_PRESETS[0].label).toBe('駒の動きを覚えたて');
    // 級は算用数字で1級位に1Lv。24級がLv1、15級がLv10、1級がLv24。
    for (let grade = 24; grade >= 1; grade -= 1) expect(CPU_STRENGTH_PRESETS[25 - grade].label).toBe(`${grade}級程度`);
    expect(CPU_STRENGTH_PRESETS.slice(45).map(({ label }) => label))
      .toEqual(['奨励会三段程度', '若手プロ程度', 'トッププロ程度', 'タイトル保持者程度', '藤井聡太並み']);
    expect(CPU_STRENGTH_PRESETS.at(-1)).toMatchObject({ level: 49, value: 480000, label: '藤井聡太並み' });
  });

  it('splits amateur dan ranks (段位は漢字) into three levels each, and 七段 into two', () => {
    for (const rank of ['初', '二', '三', '四', '五', '六']) {
      expect(CPU_STRENGTH_PRESETS.filter(({ label }) => label === `アマ${rank}段程度`), rank).toHaveLength(3);
    }
    expect(CPU_STRENGTH_PRESETS.filter(({ label }) => label === 'アマ七段程度')).toHaveLength(2);
  });

  it('draws every level except Lv0 and the top from the original calibration (source)', () => {
    expect(CALIBRATION_PRESETS).toHaveLength(41);
    expect(CPU_STRENGTH_PRESETS[0].source).toBe(0);
    expect(CPU_STRENGTH_PRESETS.at(-1).source).toBe(40);
    for (const { level, value, source } of CPU_STRENGTH_PRESETS.slice(1, -1)) {
      expect(source, `Lv${level}`).toBeGreaterThan(0);
      expect(source, `Lv${level}`).toBeLessThanOrEqual(39);
      expect(getStrengthSearchSettings(value), `Lv${level}`).toEqual(sourceLevelSettings(source));
    }
    // 15級(Lv10)は、前の表の15級(もとの校正の11.93)と同じ強さ。
    expect(CPU_STRENGTH_PRESETS[10].source).toBe(11.93);
  });

  it('plays 24級〜16級 with the logic AI at a fractional level, and the rest with the engine', () => {
    for (const { level, value, source } of CPU_STRENGTH_PRESETS) {
      const logic = logicLevelOf(value);
      if (level >= 1 && level <= 9) {
        expect(logic, `Lv${level}`).toBe(source);
        expect(source, `Lv${level}`).toBeLessThanOrEqual(10);
      } else {
        expect(logic, `Lv${level}`).toBeNull();
      }
    }
  });

  it('orders identifiers and calibrated skill from weakest to strongest', () => {
    const increasing = (key) => CPU_STRENGTH_PRESETS.every((preset, index, list) => (
      index === 0 || preset[key] > list[index - 1][key]
    ));
    expect(increasing('value')).toBe(true);
    // 24級〜16級(ロジックAI)の技量は、もとの校正の0.002〜0.02を小数3桁に丸めたもので、隣が同じ値になることがある。
    expect(CPU_STRENGTH_PRESETS.every((preset, index, list) => index === 0 || preset.skill >= list[index - 1].skill)).toBe(true);
    expect(CPU_STRENGTH_PRESETS.slice(10).every((preset, index, list) => index === 0 || preset.skill > list[index - 1].skill)).toBe(true);
    expect(increasing('source')).toBe(true);
    expect(CPU_STRENGTH_PRESETS[0].skill).toBe(0);
    expect(CPU_STRENGTH_PRESETS.at(-1).skill).toBe(1);
  });

  it('maps legacy values to the level with the same rank label', () => {
    for (const [value, label] of LEGACY_PRESETS) {
      expect(strengthPresetFor(value).label, String(value)).toBe(label);
    }
  });

  it('rounds unknown values to the nearest level and falls back to the default', () => {
    expect(normalizeStrengthValue(130000)).toBe(150000);
    expect(normalizeStrengthValue(999)).toBe(1000);
    // 藤井聡太並み(Lv49)が上限。それより大きい値(以前の版のLv41など)はLv49にする。
    expect(strengthPresetFor(1500000).level).toBe(49);
    expect(normalizeStrengthValue(Number.NaN)).toBe(DEFAULT_STRENGTH_VALUE);
    expect(strengthPresetFor(DEFAULT_STRENGTH_VALUE).label).toBe('6級程度');
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
    // 15級(Lv10)は、もとの校正のLv11とLv12を混ぜた強さで、読まない手が少し残る(24級〜16級はロジックAIで指す)。
    expect(settings(10).naturalMoveRate).toBeGreaterThan(0);
    expect(settings(10).naturalMoveRate).toBeLessThan(0.5);
    // 6級(Lv19)までは、もとのLv12とLv13を混ぜた設定なので、読まない手が少しずつ減って残る。
    const blended = CPU_STRENGTH_PRESETS.slice(10, 20).map(({ level }) => settings(level).naturalMoveRate);
    expect(blended.every((rate, index) => index === 0 || rate <= blended[index - 1])).toBe(true);
    for (const level of [20, 25, 39, 49]) expect(settings(level).naturalMoveRate, `Lv${level}`).toBe(0);
    // 読まない手の代わりに、目に付く少数の手だけを読む。
    expect(settings(10).visionWidth).toBeGreaterThanOrEqual(3);
    expect(settings(49).visionWidth).toBeUndefined();
  });

  it('keeps weaker levels on their chosen opening plan longer', () => {
    const scale = (level) => getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value).openingPlanScoreScale;
    expect(scale(1)).toBeGreaterThan(2.9);
    expect(scale(49)).toBe(1);
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
    for (const { level, value, source } of CPU_STRENGTH_PRESETS.slice(1)) {
      const settings = getStrengthSearchSettings(value);
      if (settings.oversightRate === 0) continue;
      expect(settings.oversightNodes, `Lv${level}`).toBeLessThanOrEqual(70000);
      // 見落としも1手の損失上限を超えない。
      expect(settings.oversightMaxLoss, `Lv${level}`).toBeLessThanOrEqual(settings.moveLossCap);
      // もとの校正の整数のLvでは、見落としの読み直しは本体より深く、上限は見落としの下限(300)より大きい。
      // 見落としがなくなる境目(もとのLv35と36のあいだ)を混ぜたLvでは、割合と一緒に上限も小さくなって消える。
      if (!Number.isInteger(source)) continue;
      expect(settings.oversightNodes, `Lv${level}`).toBeGreaterThan(settings.nodes);
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
    const lv15 = getStrengthSearchSettings(presetByLabel('3級程度').value);
    // 以前の三級程度(Lv15)は、見落としで2300、抽選で970まで損をする手を選べた。
    expect(lv15.moveLossCap).toBeLessThanOrEqual(600);
    expect(lv15.blunderLimit).toBeLessThanOrEqual(2);
    // 低レベルでも、大駒をただで渡すほどの損は上限で防ぐ。
    expect(getStrengthSearchSettings(CPU_STRENGTH_PRESETS[11].value).moveLossCap).toBeLessThanOrEqual(1300);
    expect(lv15.simplicity).toBeGreaterThan(0.5);
    expect(getStrengthSearchSettings(1000).simplicity).toBe(1);
  });

  it('keeps the strongest level as a pure best-move search', () => {
    const strongest = getStrengthSearchSettings(480000);
    expect(calibratedHybridSearchSettings(40, strongest)).toBe(strongest);
    // 藤井聡太並み(Lv49)だけ、曲線の上端(48万)より1.5倍多く、2スレッドで読む。
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
