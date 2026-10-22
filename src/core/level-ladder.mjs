// 段級位の作り直し(2026-10-22。docs/level-ladder-design.md)の前の保存を、新しい表へ移すための対応。
// 前の表のLv(二十六級〜プロ級)から、同じ強さの新しい表のLv(15級〜タイトル保持者)へ、強さで移す。
// 強さは、どちらの表も「もとの校正のどのLv(小数)の強さを使うか」(source)で比べる。

import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

/** 新しい表のLv1〜40(sourceが増える順)。 */
const LADDER_POINTS = CPU_STRENGTH_PRESETS.slice(1);

/** 新しい表の版。保存にこの印があれば、もう移してある。 */
export const LADDER_VERSION = 2;

/** 前の表の低級帯の付け替え(2026-10-21のLOW_BAND_SOURCE_LEVELS)。前のLv12〜24が使っていた、もとの校正のLv。 */
const OLD_LOW_BAND_SOURCES = Object.freeze({
  12: 11.93, 13: 12.08, 14: 12.15, 15: 12.29, 16: 12.47, 17: 12.58, 18: 12.67,
  19: 12.79, 20: 12.89, 21: 13.6, 22: 14.3, 23: 15.5, 24: 18.5, 25: 25,
});

/** 前の表のLv(小数、12〜40)が使っていた、もとの校正のLv。Lv25から上は、もとの校正のまま。 */
function oldSourceOf(level) {
  if (level >= 25) return level;
  const lo = Math.floor(level);
  const hi = Math.ceil(level);
  const low = OLD_LOW_BAND_SOURCES[lo];
  return hi === lo ? low : low + (OLD_LOW_BAND_SOURCES[hi] - low) * (level - lo);
}

/**
 * もとの校正のLv(小数)と同じ強さの、新しい表のLv(小数)。新しい表のsourceを、間は直線で逆に引く。
 * 15級(Lv1)より弱いときは1、Lv40より強いときは40。
 * @param {number} source
 */
export function ladderLevelForSource(source) {
  const presets = LADDER_POINTS;
  if (!(source > presets[0].source)) return 1;
  for (let index = 1; index < presets.length; index += 1) {
    const upper = presets[index];
    if (source <= upper.source) {
      const lower = presets[index - 1];
      return lower.level + (source - lower.source) / (upper.source - lower.source);
    }
  }
  return 40;
}

/**
 * 前の表のLv(小数も可)を、同じ強さの新しい表のLv(小数)へ。
 * 前の26級〜16級(Lv1〜11)は、新しい表のLv0〜1のあいだへ縮める(前のLv12=15級が新しいLv1)。
 * @param {number} level
 */
export function ladderLevelFromOld(level) {
  if (!Number.isFinite(level) || level <= 0) return 0;
  if (level >= 40) return 40;
  if (level < 12) return level / 12;
  return ladderLevelForSource(oldSourceOf(level));
}

/** 前の表のLv(整数)を、新しい表のLv(整数)へ。勝ったLvや対局の相手のLvを移すときに使う。 */
export function ladderLevelIndexFromOld(level) {
  return Math.min(40, Math.max(0, Math.round(ladderLevelFromOld(level))));
}

/** 前の表のレーティング(Lv×80)を、同じ強さの新しい表のレーティング(60×Lv−30)へ。 */
export function ladderRatingFromOld(rating) {
  if (!Number.isFinite(rating)) return rating;
  const level = ladderLevelFromOld(rating / 80);
  return Math.max(0, Math.round(60 * level - 30));
}

const KANJI_DIGITS = Object.freeze({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 });

/** 「二十六」などの漢数字(1〜99)を数に。読めなければnull。 */
function kanjiNumber(text) {
  const match = /^([一二三四五六七八九])?(十)?([一二三四五六七八九])?$/.exec(text);
  if (!match || !text) return null;
  const tens = match[2] ? (match[1] ? KANJI_DIGITS[match[1]] : 1) : 0;
  const ones = match[2] ? (match[3] ? KANJI_DIGITS[match[3]] : 0) : (match[1] ? KANJI_DIGITS[match[1]] : 0);
  return match[2] ? tens * 10 + ones : ones || null;
}

/**
 * 前の表の段級位の名前を、新しい表の名前へ。級は算用数字(「十四級」→「14級」)、なくなった16級より下は15級、
 * 段位はそのまま、プロ級はタイトル保持者(同じ強さ)。「程度」はあればそのまま残す。
 * @param {string} label
 */
export function ladderLabelFromOld(label) {
  const text = String(label ?? '');
  const suffix = text.endsWith('程度') ? '程度' : '';
  const body = suffix ? text.slice(0, -suffix.length) : text;
  if (body === 'プロ級') return `タイトル保持者${suffix}`;
  const grade = /^(.+)級$/.exec(body);
  if (!grade) return text;
  const number = /^\d+$/.test(grade[1]) ? Number(grade[1]) : kanjiNumber(grade[1]);
  if (!number) return text;
  return `${Math.min(15, number)}級${suffix}`;
}

/**
 * 新しい表のLv(小数)と同じ強さの、前の表のLv(小数)。ladderLevelFromOldの逆。
 * 竜王戦の難易度の換算(ryuo-strength.mjs)は、前の表のLvで校正した表を使うので、その出入りに使う。
 * 新しい表のsourceを直線で引き、前の表の低級帯の付け替え(OLD_LOW_BAND_SOURCES)を逆に引く。
 * @param {number} level
 */
export function oldLevelFromLadder(level) {
  if (!Number.isFinite(level) || level <= 0) return 0;
  if (level >= 40) return 40;
  if (level < 1) return level * 12;
  const lo = Math.floor(level);
  const low = CPU_STRENGTH_PRESETS[lo].source;
  const source = lo === level ? low : low + (CPU_STRENGTH_PRESETS[lo + 1].source - low) * (level - lo);
  if (source >= 25) return source;
  for (let old = 12; old < 25; old += 1) {
    const a = OLD_LOW_BAND_SOURCES[old];
    const b = OLD_LOW_BAND_SOURCES[old + 1];
    if (source <= b) return old + (source - a) / (b - a);
  }
  return 25;
}

/**
 * 期(竜王戦・名人戦)の棋士のLvを、新しい表へ移す。作り直しの前に始めた期だけ(ladderの印がない期)。
 * @template T
 * @param {T} season
 * @returns {T}
 */
export function migrateSeasonLevels(season) {
  const value = /** @type {any} */ (season);
  if (!value || typeof value !== 'object' || value.ladder === LADDER_VERSION) return season;
  const players = Object.fromEntries(Object.entries(value.players ?? {}).map(([id, player]) => [
    id, player && Number.isFinite(player.level) ? { ...player, level: ladderLevelIndexFromOld(player.level) } : player,
  ]));
  return /** @type {T} */ ({ ...value, ladder: LADDER_VERSION, players });
}
