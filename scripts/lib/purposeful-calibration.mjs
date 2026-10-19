// 比較計測のtuned指定。探索量を再調整するときはstrength-settings.mjsの校正値を変える。
import { CPU_STRENGTH_PRESETS, calibratedHybridSearchSettings, searchSettingsForSkill } from "../../src/core/strength-settings.mjs";

export function purposefulCalibration(strength) {
  const level = strength.level;
  if (!(level >= 11 && level <= 39)) return strength;
  const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === level);
  return { ...strength, ...calibratedHybridSearchSettings(level, searchSettingsForSkill(preset.skill)) };
}
