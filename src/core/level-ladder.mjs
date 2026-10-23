// 段級位の表を作り直す前の保存を、今の表へ移すための対応(docs/level-ladder-design.md)。
// - 1つ目の表(v1、2026-10-21まで): Lv0〜40。26級〜16級・十五級〜一級・アマ初段〜七段・プロ級・藤井聡太並み。
// - 2つ目の表(v2、2026-10-22): Lv0〜40。15級〜1級・アマ初段〜七段(3Lvずつ)・プロの道・藤井聡太並み。
// - 今の表(v3、2026-10-23): Lv0〜49。v2の下に24級〜16級(Lv1〜9)を足し、v2のLv1以上は9つ上がった。
// 強さは、どの表も「もとの校正のどのLv(小数)の強さを使うか」(source)で比べる。

import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

/** 今の表のLv1〜49(sourceが増える順)。 */
const LADDER_POINTS = CPU_STRENGTH_PRESETS.slice(1);
/** 今の表のいちばん上のLv(藤井聡太並み)。 */
const TOP_LEVEL = CPU_STRENGTH_PRESETS.at(-1).level;

/** 今の表の版。保存にこの印があれば、もう移してある。印がなければv1、2ならv2の保存。 */
export const LADDER_VERSION = 3;
/** 2つ目の表(2026-10-22)の版。 */
export const LADDER_V2 = 2;
/** v2のLv1以上を、今の表へ移すときに足す数(下に足した24級〜16級の数)。 */
export const LADDER_V2_SHIFT = 9;
/** v1・v2のいちばん上のLv(藤井聡太並み)。 */
const OLD_TOP_LEVEL = 40;

/** v1の低級帯の付け替え(2026-10-21のLOW_BAND_SOURCE_LEVELS)。v1のLv12〜24が使っていた、もとの校正のLv。 */
const OLD_LOW_BAND_SOURCES = Object.freeze({
  12: 11.93, 13: 12.08, 14: 12.15, 15: 12.29, 16: 12.47, 17: 12.58, 18: 12.67,
  19: 12.79, 20: 12.89, 21: 13.6, 22: 14.3, 23: 15.5, 24: 18.5, 25: 25,
});

/** v1のLv(小数、12〜40)が使っていた、もとの校正のLv。Lv25から上は、もとの校正のまま。 */
function oldSourceOf(level) {
  if (level >= 25) return level;
  const lo = Math.floor(level);
  const hi = Math.ceil(level);
  const low = OLD_LOW_BAND_SOURCES[lo];
  return hi === lo ? low : low + (OLD_LOW_BAND_SOURCES[hi] - low) * (level - lo);
}

/**
 * もとの校正のLv(小数)と同じ強さの、今の表のLv(小数)。今の表のsourceを、間は直線で逆に引く。
 * いちばん下の24級(Lv1)より弱いときはLv0〜1のあいだ、いちばん上より強いときはいちばん上。
 * @param {number} source
 */
export function ladderLevelForSource(source) {
  const presets = LADDER_POINTS;
  if (!(source > 0)) return 0;
  if (source <= presets[0].source) return presets[0].level * source / presets[0].source;
  for (let index = 1; index < presets.length; index += 1) {
    const upper = presets[index];
    if (source <= upper.source) {
      const lower = presets[index - 1];
      return lower.level + (source - lower.source) / (upper.source - lower.source);
    }
  }
  return TOP_LEVEL;
}

/**
 * v1のLv(小数も可)を、今の表のLv(小数)へ。
 * v1の26級〜16級(Lv1〜11)は、今の表の同じ名前の級へ(24級より下の26級・25級はLv0〜1のあいだ)。
 * v1の15級(Lv12)から上は、同じ強さの今の表のLvへ。
 * @param {number} level
 */
export function ladderLevelFromOld(level) {
  if (!Number.isFinite(level) || level <= 0) return 0;
  if (level >= OLD_TOP_LEVEL) return TOP_LEVEL;
  // v1のLv n(26級がLv1)は、今の表の(27−n)級=Lv(n−2)。
  if (level < 3) return level / 3;
  if (level < 12) return level - 2;
  return ladderLevelForSource(oldSourceOf(level));
}

/** v1のLv(整数)を、今の表のLv(整数)へ。勝ったLvや対局の相手のLvを移すときに使う。 */
export function ladderLevelIndexFromOld(level) {
  return Math.min(TOP_LEVEL, Math.max(0, Math.round(ladderLevelFromOld(level))));
}

/** Lv(小数)のレーティング(60×Lv−30、0より下は0)。player-rating.mjsのlevelRatingと同じ式。 */
const ratingOfLevel = (level) => Math.max(0, Math.round(60 * level - 30));

/** v1のレーティング(Lv×80)を、同じ強さの今の表のレーティング(60×Lv−30)へ。 */
export function ladderRatingFromOld(rating) {
  if (!Number.isFinite(rating)) return rating;
  return ratingOfLevel(ladderLevelFromOld(rating / 80));
}

/**
 * v2のLv(小数も可)を、今の表のLv(小数)へ。Lv1(15級)から上は9つ上がる。
 * v2のLv0〜1のあいだ(v1の26級〜16級を縮めたところ)は、v1に戻してから移す。
 * @param {number} level
 */
export function ladderLevelFromV2(level) {
  if (!Number.isFinite(level) || level <= 0) return 0;
  if (level >= 1) return Math.min(TOP_LEVEL, level + LADDER_V2_SHIFT);
  return ladderLevelFromOld(level * 12);
}

/** v2のLv(整数)を、今の表のLv(整数)へ。 */
export function ladderLevelIndexFromV2(level) {
  return Math.min(TOP_LEVEL, Math.max(0, Math.round(ladderLevelFromV2(level))));
}

/** v2のレーティング(60×Lv−30)を、同じ強さの今の表のレーティングへ(15級から上は+540)。 */
export function ladderRatingFromV2(rating) {
  if (!Number.isFinite(rating)) return rating;
  return ratingOfLevel(ladderLevelFromV2((rating + 30) / 60));
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

/** 今の表のいちばん下の級(24級)。 */
const LOWEST_GRADE = 24;

/**
 * v1・v2の段級位の名前を、今の表の名前へ。級は算用数字(「十四級」→「14級」)、今の表にない25級より下は24級、
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
  return `${Math.min(LOWEST_GRADE, number)}級${suffix}`;
}

/**
 * 今の表のLv(小数)と同じ強さの、v1のLv(小数)。ladderLevelFromOldの逆。
 * 竜王戦の難易度の換算(ryuo-strength.mjs)は、v1のLvで校正した表を使うので、その出入りに使う。
 * 24級〜15級(Lv1〜10)は同じ名前のv1のLv、15級より上は今の表のsourceを直線で引き、v1の低級帯の付け替えを逆に引く。
 * @param {number} level
 */
export function oldLevelFromLadder(level) {
  if (!Number.isFinite(level) || level <= 0) return 0;
  if (level >= TOP_LEVEL) return OLD_TOP_LEVEL;
  if (level < 1) return level * 3;
  if (level <= 10) return level + 2;
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
 * 期(竜王戦・名人戦)の棋士のLvを、今の表へ移す。今の表より前に始めた期だけ(ladderの印が今の版でない期)。
 * @template T
 * @param {T} season
 * @returns {T}
 */
export function migrateSeasonLevels(season) {
  const value = /** @type {any} */ (season);
  if (!value || typeof value !== 'object' || value.ladder === LADDER_VERSION) return season;
  const move = value.ladder === LADDER_V2 ? ladderLevelIndexFromV2 : ladderLevelIndexFromOld;
  const players = Object.fromEntries(Object.entries(value.players ?? {}).map(([id, player]) => [
    id, player && Number.isFinite(player.level) ? { ...player, level: move(player.level) } : player,
  ]));
  return /** @type {T} */ ({ ...value, ladder: LADDER_VERSION, players });
}
