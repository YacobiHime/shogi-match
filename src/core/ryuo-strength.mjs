// 大会(竜王戦)の棋士の強さ。強さの値はレーティング(rating)だけで持ち、次の2つに使う。
// - 自動対局の勝率: レーティングの差からElo式で決める。難易度には関係しない。
// - 実際に指すときのCPUのLv: 難易度に合わせて、レーティングからLvへ換算する。
// 換算の根拠と測定の方法は docs/tournament-design.md の「棋士の強さ」にある。
// 換算の表(自己対局のレーティング・基準点)は、段級位の作り直し(2026-10-22)より前のLvで校正したもの。
// 従来の換算は、同じ強さの新しい表のLvへ移す(level-ladder.mjs)。
// 2026-10-23以降に始める期は、測定結果と同じEloでおすすめを補正する(tournamentLevel)。

import { ladderLevelFromOld, oldLevelFromLadder } from './level-ladder.mjs';
import { levelRating, ratingLevel } from './player-rating.mjs';

/**
 * 棋士の尺度。実物の非公式の棋士レーティング(Elo式、差400で勝率約91%)の、現役の棋士の分布に合わせる:
 * 平均約1555・標準偏差約145(2018〜2019年の集計で平均1550〜1561、標準偏差143〜155)。docs/rating-realism-design.md。
 */
export const PRO_MEAN_RATING = 1555;
export const PRO_RATING_SD = 145;

/**
 * 棋士として指させるいちばん弱いLv。Lv0(駒の動きを覚えたて)は練習相手で、大会の棋士にはしない(24級から)。
 * 1つ目の表(v1)の26級〜16級の強さだった難易度1〜4の6組は、2026-10-23に足した24級〜16級(Lv1〜9)に戻る。
 */
export const MIN_CPU_LEVEL = 1;
/** いちばん上(藤井聡太並み)。 */
export const MAX_CPU_LEVEL = 49;

/**
 * CPUのLv(作り直しの前の表)ごとの、自己対局のレーティング(Lv0を0とする)。表の間は直線で補い、範囲の外は端の傾きで延ばす。
 * 仮の値: 2026-09-27の割り付け(docs/difficulty-calibration.md の「校正方法」)の、Lv0〜20は1Lvあたり約85、
 * Lv20〜40は約156という間隔をそのまま使う。CPUのLvごとの強さを調整したら、測り直してこの表を差し替える。
 */
export const SELFPLAY_LEVEL_RATINGS = Object.freeze([
  [0, 0],
  [20, 1700],
  [40, 4820],
]);

export const DIFFICULTY_LEVELS = 14;
/**
 * 基準の難易度。2026-10-10と2026-10-13に、それぞれ下へ2段階足した。最初の5が、いまの9にあたる。
 * いちばん下の1は、6組の相手の平均がLv.-2(Lv0に丸める)。
 */
export const BASE_DIFFICULTY = 9;
/** 難易度1段階で、換算の基準点が動くLv。 */
export const LEVELS_PER_DIFFICULTY = 4;

/**
 * 組ごとのレーティングの平均。上の組ほど強い。1〜5組は実物の竜王戦の組の平均(2019年4月の棋士レーティング)、
 * 6組は棋士全体の平均が約1555になるように決めた値。根拠は docs/rating-realism-design.md。
 */
export const GROUP_MEAN_RATING = Object.freeze({ 1: 1786, 2: 1659, 3: 1635, 4: 1584, 5: 1524, 6: 1450 });

/** 組ごとのレーティングのばらつき(標準偏差)。棋士全体の標準偏差が約150になるように決めた値。 */
export const GROUP_RATING_SPREAD = Object.freeze({ 1: 85, 2: 75, 3: 75, 4: 80, 5: 85, 6: 105 });

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

/** 難易度での、基準点(6組の平均の棋士)のLv(作り直しの前の表)。 */
export function anchorLevel(difficulty) {
  return ANCHOR.level + (normalizedDifficulty(difficulty) - BASE_DIFFICULTY) * LEVELS_PER_DIFFICULTY;
}

/**
 * レーティングを、難易度でのLv(今の表、小数、Lv0〜49)に換算する。
 * 基準点からのレーティング差を、自己対局で同じ差になる(前の表の)Lvの差に置き換え、同じ強さの新しい表のLvへ移す。
 */
export function exactLevelForRating(rating, difficulty) {
  return ladderLevelFromOld(levelForSelfplayRating(selfplayRating(anchorLevel(difficulty)) + (rating - ANCHOR.rating)));
}

/** 実際に指すときのCPUのLv。整数で、Lv1〜49に収める。 */
export function ratingToLevel(rating, difficulty) {
  return clamp(Math.round(exactLevelForRating(rating, difficulty)), MIN_CPU_LEVEL, MAX_CPU_LEVEL);
}

/** Lvを、難易度での棋士の尺度のレーティングに直す。ratingToLevelの逆(丸めの前)。 */
export function levelToRating(level, difficulty) {
  return Math.round(ANCHOR.rating + selfplayRating(oldLevelFromLadder(level)) - selfplayRating(anchorLevel(difficulty)));
}

/** 自動対局の勝率。難易度は使わない。 */
export function winProbability(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** その組の平均レーティングに当たるLv。棋力を渡すと新しい期のおすすめ・番号順の補正を含む。 */
export function groupMeanLevel(group, difficulty, recommendedFor = null) {
  if (Number.isFinite(recommendedFor)) return tournamentLevel(GROUP_MEAN_RATING[group], difficulty, recommendedFor);
  return clamp(exactLevelForRating(GROUP_MEAN_RATING[group], difficulty), MIN_CPU_LEVEL, MAX_CPU_LEVEL);
}

/** おすすめは1局あたり7割を中心に、6〜8割を目安にする。プレイヤー用Elo(R60/Lv)で換算する。 */
export const TOURNAMENT_TARGET_WIN_RATE = 0.7;
const marginFor = (rate) => 400 * Math.log10(rate / (1 - rate));
const TARGET_MARGIN = marginFor(TOURNAMENT_TARGET_WIN_RATE);

/**
 * おすすめを明示して始める期のCPUのLv。棋士の強弱は残し、Elo上の見込み勝率を6〜8割に収める。
 * 旧Lv換算表は刻みが粗いため使わず、測定結果と同じプレイヤー用Eloで計算する。
 * 丸めた後も範囲を守る。Lv1より弱い大会棋士はいないので、低級帯では下限を優先する。
 * @param {number} rating 棋士のレーティング(名簿の尺度)
 * @param {number} playerLevel 測定・対局結果の棋力(小数可)。期の開始時に固定する。
 */
export function recommendedTournamentLevel(rating, playerLevel) {
  const playerRating = levelRating(playerLevel);
  const lowest = clamp(Math.ceil(ratingLevel(playerRating - marginFor(0.8))), MIN_CPU_LEVEL, MAX_CPU_LEVEL);
  const highest = clamp(Math.floor(ratingLevel(playerRating - marginFor(0.6))), MIN_CPU_LEVEL, MAX_CPU_LEVEL);
  const opponentRating = playerRating - TARGET_MARGIN + (rating - GROUP_MEAN_RATING[6]);
  return clamp(Math.round(ratingLevel(opponentRating)), lowest, Math.max(lowest, highest));
}

/** おすすめの番号。6組の平均が、勝率7割に当たる相手のLvに近いものを選ぶ。実際のLvは上の関数で補正する。 */
export function recommendedDifficulty(playerLevel) {
  const target = clamp(ratingLevel(levelRating(playerLevel) - TARGET_MARGIN), MIN_CPU_LEVEL, MAX_CPU_LEVEL);
  let best = BASE_DIFFICULTY;
  for (let difficulty = 1; difficulty <= DIFFICULTY_LEVELS; difficulty += 1) {
    if (Math.abs(groupMeanLevel(6, difficulty) - target) < Math.abs(groupMeanLevel(6, best) - target)) best = difficulty;
  }
  return best;
}

/**
 * 新しく始める期のLv。おすすめの上下を手動で選んだときも、番号と強さの順が逆転しないようにする。
 * 従来の換算を使い、おすすめより高い番号は最低でも差の分だけ強く、低い番号はその分弱くする。
 */
export function tournamentLevel(rating, difficulty, playerLevel) {
  const recommended = recommendedTournamentLevel(rating, playerLevel);
  const delta = normalizedDifficulty(difficulty) - recommendedDifficulty(playerLevel);
  if (!delta) return recommended;
  const boundary = clamp(recommended + delta, MIN_CPU_LEVEL, MAX_CPU_LEVEL);
  const legacy = ratingToLevel(rating, difficulty);
  return delta > 0 ? Math.max(legacy, boundary) : Math.min(legacy, boundary);
}
