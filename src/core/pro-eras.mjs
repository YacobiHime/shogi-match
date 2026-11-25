// 棋士の「育った時代」と、その時代の作戦の割合(docs/disciple-mode-design.mdの40章のL1)。
// 時代ごとの作戦の数は、プロの棋譜を数えた表(src/data/pro-opening-eras.mjs)。棋士の年齢から、将棋を覚えて伸びた頃(20歳の頃)の時代を決める。
// 画面・保存の仕組みに依存しない。乱数は使わない(得意戦法を作るときの乱数の順番を変えないため)。

import { PRO_OPENING_ERAS } from '../data/pro-opening-eras.mjs';

/** 年齢から時代を決めるときの、いまの年(大会の暦に依存しない、決まった年)。 */
export const ERA_BASE_YEAR = 2026;
/** 将棋を覚えて伸びた頃の年齢。 */
export const ERA_AGE = 20;
/** 時代の区切り(西暦の年。その年までを含む。scripts/fetch-pro-kifu.mjsのERASと同じ)。 */
export const ERA_LIMITS = Object.freeze([
  ['edo', 1867], ['early', 1960], ['showa', 1988], ['heisei', 2018], ['reiwa', 9999],
]);
/** 時代の名前。 */
export const ERA_LABELS = Object.freeze({ edo: '江戸', early: '明治〜昭和前期', showa: '昭和後期', heisei: '平成', reiwa: '令和', shoreikai: '奨励会' });

/** 年から時代。 */
export function eraOfYear(year) {
  const y = Number(year);
  return ERA_LIMITS.find(([, until]) => y <= until)?.[0] ?? 'reiwa';
}

/**
 * 棋士の年齢から、育った時代。年齢がなければ令和。
 * @param {number | null | undefined} age
 */
export function eraForAge(age) {
  const a = Number(age);
  if (!Number.isFinite(a) || a <= 0) return 'reiwa';
  return eraOfYear(ERA_BASE_YEAR - a + ERA_AGE);
}

/**
 * 時代の作戦の割合。振り飛車を指す割合(ranging)と、居飛車・振り飛車ごとの得意戦法の重み(目録に当たらない「other」は除く)。
 * 表にない時代はnull(呼ぶ側は今までの仮の値を使う)。
 * @param {string} era
 * @returns {{ ranging: number, staticWeights: Record<string, number>, rangingWeights: Record<string, number>, games: number } | null}
 */
export function eraOpeningShares(era) {
  const row = /** @type {Record<string, any>} */ (PRO_OPENING_ERAS)[era];
  if (!row?.games) return null;
  const merged = /** @type {Record<string, number>} */ ({});
  for (const color of ['black', 'white']) {
    for (const [style, n] of Object.entries(row[color] ?? {})) merged[style] = (merged[style] ?? 0) + Number(n);
  }
  const staticWeights = /** @type {Record<string, number>} */ ({});
  const rangingWeights = /** @type {Record<string, number>} */ ({});
  let staticTotal = 0;
  let rangingTotal = 0;
  for (const [style, n] of Object.entries(merged)) {
    const ranging = RANGING_STYLES.has(style) || style === 'other-ranging';
    if (ranging) rangingTotal += n;
    else staticTotal += n;
    if (style.startsWith('other-')) continue;
    (ranging ? rangingWeights : staticWeights)[style] = n;
  }
  const total = staticTotal + rangingTotal;
  if (!total) return null;
  return { ranging: rangingTotal / total, staticWeights, rangingWeights, games: row.games };
}

/** 振り飛車の得意戦法のid(ryuo-data.mjsのOPPONENT_STYLESのrookが'ranging'のもの)。 */
const RANGING_STYLES = new Set(['shiken-mino', 'shiken-anaguma', 'shiken-silver-crown', 'sangen', 'gokigen', 'mukai', 'ishida', 'fujii-system']);
