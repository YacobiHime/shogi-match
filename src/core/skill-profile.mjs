// 棋力カルテ。CPUとの勝ち負け・棋力テスト・対局の場面採点・自己申告の幅を合わせて、棋力(このゲームのCPUと五分に
// 指せるLv)と幅を出す(docs/skill-assessment-design.mdの6章)。勝ち負けを正とし、テストと場面採点は「その人では勝ち負けと
// どれだけずれるか」の幅(個人のずれ)を足して入れる。画面と保存の仕組みに依存しない(保存はload/saveに渡す)。

import { levelRating } from './player-rating.mjs';

export const SKILL_PROFILE_KEY = 'yacobihime:shogi-match:skill-profile:v1';

const MIN_LEVEL = 0;
const MAX_LEVEL = 49;
const STEP = 0.25;
/** 勝ち負けを数える最近の対局の数(レーティングの履歴の長さと同じ)。 */
export const PROFILE_RESULT_GAMES = 30;
/** 1局さかのぼるごとの重さ(上達を追うため、古い対局ほど軽くする)。 */
const RESULT_DECAY = 0.95;
/** 大会の対局の重さ。棋士の棋風・特殊能力で、表のLvより強さがずれるため。 */
const TOURNAMENT_WEIGHT = 0.7;
/**
 * 1Lvの重さ(1Lvあたりのロジット)の候補と、初めの重み。Eloで約R60・R80・R110・R155。
 * 勝ち負けに合う重さへ寄せる(候補ごとの起こりやすさで平均する)。
 */
export const SLOPE_CANDIDATES = Object.freeze([
  Object.freeze({ slope: 0.35, prior: 0.25 }),
  Object.freeze({ slope: 0.45, prior: 0.35 }),
  Object.freeze({ slope: 0.65, prior: 0.25 }),
  Object.freeze({ slope: 0.9, prior: 0.15 }),
]);
/** 個人のずれ(Lv)。その人ではテスト・場面採点が勝ち負けとどれだけずれるかの見込み。 */
export const TEST_PERSONAL_SD = 3.5;
export const CONTENT_PERSONAL_SD = 3;
/** 合わせるテストと対局の場面採点の数。 */
export const PROFILE_TESTS = 3;
export const PROFILE_CONTENT_GAMES = 10;
/** 古いテストほど幅を広げる倍率(1回さかのぼるごと)。 */
const TEST_AGE_INFLATION = 1.3;
/** 自己申告の幅の外側の裾(Lv)。 */
const BAND_TAIL = 5;
/** 何も材料がないときの広い山(Lv)。 */
const POPULATION_MEAN = 15;
const POPULATION_SD = 12;
/** カルテでレーティングを置き換えるのに要る、勝ち負けの数(テスト・場面・札のどれかがあれば、それだけでよい)。 */
export const PROFILE_MIN_RESULTS = 5;
const RATED_SCORES = Object.freeze({ win: 1, draw: 0.5, loss: 0 });
const TOURNAMENT_EVENTS = new Set(['ryuo', 'meijin', 'shoreikai', 'kenshukai']);

/**
 * 保存するのは、棋力テストの結果と、札・自己申告の幅。勝ち負けはレーティングの履歴、場面採点は対局の中身の記録
 * (play-insight.mjsの要約のcontent)にあるので、ここには持たない(見立てのときに渡す)。
 */
export function createSkillProfile() {
  return { tests: [], band: null };
}

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const validEstimate = (entry) => entry && finite(entry.level) && finite(entry.spread) && entry.spread > 0;
const validBand = (band) => Array.isArray(band) && band.length === 2 && band.every(finite) && band[0] <= band[1];

/** 保存したカルテを読む。形がおかしいものは捨てる。読めなければ空のカルテ。 */
export function loadSkillProfile(storage) {
  try {
    const stored = JSON.parse(storage?.getItem(SKILL_PROFILE_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return createSkillProfile();
    return {
      tests: Array.isArray(stored.tests) ? stored.tests.filter(validEstimate).slice(-PROFILE_TESTS) : [],
      band: validBand(stored.band) ? [stored.band[0], stored.band[1]] : null,
    };
  } catch {
    return createSkillProfile();
  }
}

export function saveSkillProfile(storage, profile) {
  try {
    storage?.setItem(SKILL_PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/**
 * 棋力テストの結果を足す。abilitiesは力ごとの{ level, spread }(画面に出す)。最近のPROFILE_TESTS回だけ残す。
 * @param {ReturnType<typeof createSkillProfile>} profile
 * @param {{ level: number, spread: number, at?: number, abilities?: object }} test
 */
export function recordSkillTest(profile, { level, spread, at = Date.now(), abilities = {} }) {
  if (!validEstimate({ level, spread })) return profile;
  return { ...profile, tests: [...profile.tests, { level, spread, at, abilities }].slice(-PROFILE_TESTS) };
}

/**
 * 対局の中身の記録(play-insight.mjs)から、最近の対局の場面採点(1局の中身のLvと幅)。古い順。
 * @param {readonly { at?: number, summary?: { content?: { level: number, spread: number } | null } | null }[]} games
 */
export function contentFromInsight(games) {
  return (games ?? [])
    .map((game) => game?.summary?.content)
    .filter(validEstimate)
    .slice(-PROFILE_CONTENT_GAMES);
}

/** 札・自己申告の幅を決める(新しい申告で置き換える)。nullで消す。 */
export function setProfileBand(profile, band) {
  return { ...profile, band: validBand(band) ? [band[0], band[1]] : null };
}

/**
 * レーティングの履歴から、CPUとの勝ち負け(相手のLv・点・重さ)。新しい対局ほど重く、大会の対局は軽くする。
 * 申告・測定の記録(opponentLevelのない記録)は飛ばす。
 * @param {readonly any[]} history player-rating.mjsのhistory(古い順)
 */
export function resultsFromHistory(history) {
  const games = (history ?? [])
    .filter((entry) => finite(entry?.opponentLevel) && entry.opponentLevel >= 1 && entry.outcome in RATED_SCORES)
    .slice(-PROFILE_RESULT_GAMES);
  return games.map((entry, index) => ({
    opponent: entry.opponentLevel,
    score: RATED_SCORES[entry.outcome],
    weight: RESULT_DECAY ** (games.length - 1 - index) * (TOURNAMENT_EVENTS.has(entry.event) ? TOURNAMENT_WEIGHT : 1),
  }));
}

/** 複数回の推定を1つに合わせる(幅の逆二乗で重み付け)。新しいものほど重く(古いものは幅を広げる)。 */
export function poolEstimates(entries, ageInflation = 1) {
  const valid = (entries ?? []).filter(validEstimate);
  if (!valid.length) return null;
  let precision = 0;
  let weighted = 0;
  valid.forEach((entry, index) => {
    const spread = entry.spread * ageInflation ** (valid.length - 1 - index);
    precision += 1 / spread ** 2;
    weighted += entry.level / spread ** 2;
  });
  return { level: weighted / precision, spread: Math.sqrt(1 / precision) };
}

const normalLog = (x, mean, sd) => -((x - mean) ** 2) / (2 * sd ** 2);
const logistic = (x) => 1 / (1 + Math.exp(-x));

/**
 * 棋力カルテの見立て。Lv0〜49の0.25刻みで、材料ごとの起こりやすさを掛け合わせ、平均を総合のLv、標準偏差を幅にする。
 * - 勝ち負け: 1Lvの重さの候補ごとの起こりやすさを、候補の重みで平均する(重さを勝ち負けから学ぶ)。
 * - テスト・場面採点: 合わせた推定に、個人のずれを足した正規分布。
 * - 札・自己申告: 幅の中は同じ、外は裾。どれもなければ広い山。
 * @param {{
 *   history?: readonly any[], profile?: ReturnType<typeof createSkillProfile> | null,
 *   content?: readonly { level: number, spread: number }[], extraResults?: { opponent: number, score: number, weight?: number }[],
 * }} input history: レーティングの履歴、content: 最近の対局の場面採点(contentFromInsight)、
 *   extraResults: 履歴にまだ入っていない勝ち負け(測定の対局の途中など)
 */
export function estimateProfile({ history = [], profile = null, content: contentList = [], extraResults = [] } = {}) {
  const results = [...resultsFromHistory(history), ...extraResults.map((result) => ({ weight: 1, ...result }))];
  const test = poolEstimates(profile?.tests ?? [], TEST_AGE_INFLATION);
  const content = poolEstimates(contentList.slice(-PROFILE_CONTENT_GAMES));
  const band = profile?.band ?? null;
  const levels = [];
  for (let level = MIN_LEVEL; level <= MAX_LEVEL + 1e-9; level += STEP) levels.push(level);
  // 勝ち負け以外の材料の対数の起こりやすさ。
  const baseLog = levels.map((level) => {
    let log = 0;
    if (band) {
      const outside = level < band[0] ? band[0] - level : level > band[1] ? level - band[1] : 0;
      log += normalLog(outside, 0, BAND_TAIL);
    } else {
      log += normalLog(level, POPULATION_MEAN, POPULATION_SD);
    }
    if (test) log += normalLog(level, test.level, Math.hypot(test.spread, TEST_PERSONAL_SD));
    if (content) log += normalLog(level, content.level, Math.hypot(content.spread, CONTENT_PERSONAL_SD));
    return log;
  });
  // 1Lvの重さの候補ごとに、勝ち負けの対数の起こりやすさ。
  const slopeLogs = SLOPE_CANDIDATES.map(({ slope }) => levels.map((level) => results.reduce((sum, { opponent, score, weight }) => {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, logistic(slope * (level - opponent))));
    return sum + weight * (score * Math.log(p) + (1 - score) * Math.log(1 - p));
  }, 0)));
  const max = Math.max(...levels.flatMap((_, index) => SLOPE_CANDIDATES.map((_, k) => baseLog[index] + slopeLogs[k][index])));
  const posterior = levels.map((_, index) => SLOPE_CANDIDATES.reduce((sum, { prior }, k) => sum + prior * Math.exp(baseLog[index] + slopeLogs[k][index] - max), 0));
  const slopeWeights = SLOPE_CANDIDATES.map(({ prior }, k) => prior * levels.reduce((sum, _, index) => sum + Math.exp(baseLog[index] + slopeLogs[k][index] - max), 0));
  const total = posterior.reduce((sum, value) => sum + value, 0);
  const mean = posterior.reduce((sum, value, index) => sum + value * levels[index], 0) / total;
  const variance = posterior.reduce((sum, value, index) => sum + value * (levels[index] - mean) ** 2, 0) / total;
  const spread = Math.sqrt(Math.max(0, variance));
  const slopeTotal = slopeWeights.reduce((sum, value) => sum + value, 0);
  return {
    level: mean,
    spread,
    rating: levelRating(mean),
    ratingLow: levelRating(Math.max(MIN_LEVEL, mean - spread)),
    ratingHigh: levelRating(Math.min(MAX_LEVEL, mean + spread)),
    // 勝ち負けから見た1Lvの重さ(候補の重みの平均)。
    slope: SLOPE_CANDIDATES.reduce((sum, { slope }, k) => sum + slope * slopeWeights[k] / slopeTotal, 0),
    sources: { results: results.length, tests: profile?.tests?.length ?? 0, content: Math.min(contentList.length, PROFILE_CONTENT_GAMES), band: Boolean(band) },
    // カルテでレーティングを置き換えてよいか(材料が十分あるか)。
    enough: Boolean(test || content || band) || results.length >= PROFILE_MIN_RESULTS,
  };
}
