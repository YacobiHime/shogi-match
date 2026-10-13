// 大会(竜王戦)の棋士の強さ。強さの値はレーティング(rating)だけで持ち、次の2つに使う。
// - 自動対局の勝率: レーティングの差からElo式で決める。難易度には関係しない。
// - 実際に指すときのCPUのLv: 難易度に合わせて、レーティングからLvへ換算する。
// 換算の根拠と測定の方法は docs/tournament-design.md の「棋士の強さ」にある。

/** 棋士の尺度の基準。平均的な棋士を1500とする(棋士別成績一覧のレーティングと同じ置き方)。 */
export const PRO_MEAN_RATING = 1500;

export const MIN_CPU_LEVEL = 0;
export const MAX_CPU_LEVEL = 40;

/**
 * CPUのLvごとの、自己対局のレーティング(Lv0を0とする)。表の間は直線で補い、範囲の外は端の傾きで延ばす。
 * 仮の値: 2026-09-27の割り付け(docs/difficulty-calibration.md の「校正方法」)の、Lv0〜20は1Lvあたり約85、
 * Lv20〜40は約156という間隔をそのまま使う。CPUのLvごとの強さを調整したら、測り直してこの表を差し替える。
 */
export const SELFPLAY_LEVEL_RATINGS = Object.freeze([
  [0, 0],
  [20, 1700],
  [40, 4820],
]);

export const DIFFICULTY_LEVELS = 12;
/** 基準の難易度。2026-10-10に下へ2段階足したので、以前の5がこの7にあたる。 */
export const BASE_DIFFICULTY = 7;
/** 難易度1段階で、換算の基準点が動くLv。 */
export const LEVELS_PER_DIFFICULTY = 4;

/** 組ごとのレーティングの平均。上の組ほど強い。根拠は docs/tournament-design.md。 */
export const GROUP_MEAN_RATING = Object.freeze({ 1: 1760, 2: 1680, 3: 1620, 4: 1560, 5: 1500, 6: 1380 });

/** 組ごとのレーティングのばらつき(標準偏差)。6組は、アマ・女流・奨励会員が混じるので広い。 */
export const GROUP_RATING_SPREAD = Object.freeze({ 1: 90, 2: 90, 3: 90, 4: 100, 5: 110, 6: 140 });

/**
 * 換算の基準点。基準の難易度で、6組の平均の棋士をこのLvとして指させる。
 * 難易度を1段階上げるごとに、基準点はLEVELS_PER_DIFFICULTYだけ上がる。
 */
export const ANCHOR = Object.freeze({ rating: GROUP_MEAN_RATING[6], level: 30 });

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Lv(小数も可)の、自己対局のレーティング。範囲の外は、端の傾きで延ばす。 */
export function selfplayRating(level) {
  const table = SELFPLAY_LEVEL_RATINGS;
  let index = table.findIndex(([lv]) => lv >= level);
  if (index <= 0) index = index === 0 ? 1 : table.length - 1;
  const [l0, r0] = table[index - 1];
  const [l1, r1] = table[index];
  return r0 + ((level - l0) * (r1 - r0)) / (l1 - l0);
}

/** 自己対局のレーティングに当たるLv(小数)。selfplayRatingの逆。 */
export function levelForSelfplayRating(rating) {
  const table = SELFPLAY_LEVEL_RATINGS;
  let index = table.findIndex(([, r]) => r >= rating);
  if (index <= 0) index = index === 0 ? 1 : table.length - 1;
  const [l0, r0] = table[index - 1];
  const [l1, r1] = table[index];
  return l0 + ((rating - r0) * (l1 - l0)) / (r1 - r0);
}

const normalizedDifficulty = (difficulty) => clamp(Math.round(Number(difficulty) || BASE_DIFFICULTY), 1, DIFFICULTY_LEVELS);

/** 難易度での、基準点(6組の平均の棋士)のLv。 */
export function anchorLevel(difficulty) {
  return ANCHOR.level + (normalizedDifficulty(difficulty) - BASE_DIFFICULTY) * LEVELS_PER_DIFFICULTY;
}

/**
 * レーティングを、難易度でのLv(小数、範囲外も含む)に換算する。
 * 基準点からのレーティング差を、自己対局で同じ差になるLvの差に置き換える。
 */
export function exactLevelForRating(rating, difficulty) {
  return levelForSelfplayRating(selfplayRating(anchorLevel(difficulty)) + (rating - ANCHOR.rating));
}

/** 実際に指すときのCPUのLv。整数で、Lv0〜40に収める。 */
export function ratingToLevel(rating, difficulty) {
  return clamp(Math.round(exactLevelForRating(rating, difficulty)), MIN_CPU_LEVEL, MAX_CPU_LEVEL);
}

/** Lvを、難易度での棋士の尺度のレーティングに直す。ratingToLevelの逆(丸めの前)。 */
export function levelToRating(level, difficulty) {
  return Math.round(ANCHOR.rating + selfplayRating(level) - selfplayRating(anchorLevel(difficulty)));
}

/** 自動対局の勝率。難易度は使わない。 */
export function winProbability(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** 難易度での、その組の相手のLvの平均(小数)。 */
export function groupMeanLevel(group, difficulty) {
  return clamp(exactLevelForRating(GROUP_MEAN_RATING[group], difficulty), MIN_CPU_LEVEL, MAX_CPU_LEVEL);
}

/** おすすめの難易度。6組の相手の平均のLvが、プレイヤーの棋力(Lv)に近くなる難易度。 */
export function recommendedDifficulty(playerLevel) {
  let best = BASE_DIFFICULTY;
  for (let difficulty = 1; difficulty <= DIFFICULTY_LEVELS; difficulty += 1) {
    if (Math.abs(groupMeanLevel(6, difficulty) - playerLevel) < Math.abs(groupMeanLevel(6, best) - playerLevel)) best = difficulty;
  }
  return best;
}
