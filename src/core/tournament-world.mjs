// 世界の物差し(docs/tournament-strength-spread-design.md)。大会の棋士を何Lvで指させるかの基準(W)を、
// 竜王戦・名人戦・奨励会・研修会で1つ共有し、期をまたいで同じものを使い続ける。プレイヤーが強くなると、
// 同じ世界で上の組に勝てるようになる。期ごとに棋力へ合わせ直さない(強くなった実感を残す。G:6-1)。

import {
  MAX_CPU_LEVEL, REAL_DIFFICULTY, REAL_WORLD, WORLD_STEP_LEVELS, isRealWorld, recommendedDifficulty, recommendedWorldLevel, worldCpuLevel,
} from './ryuo-strength.mjs';
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

export const TOURNAMENT_WORLD_KEY = 'yacobihime:shogi-match:tournament-world:v1';
/** 棋力が、世界を決めたときからこれだけ動いたら、入口で知らせる(Lv)。 */
export const WORLD_DRIFT_LEVELS = 2;

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * 保存した世界の物差し。level: 基準の棋士(6組の平均)を指させるLv、difficulty: そのときの難易度の番号、
 * playerLevel: 決めたときの棋力、at: 決めた時刻。なければnull。
 * @returns {{ level: number, difficulty: number, playerLevel: number, at: number } | null}
 */
export function loadTournamentWorld(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(TOURNAMENT_WORLD_KEY) ?? 'null');
    if (!parsed || !finite(parsed.level) || !Number.isInteger(parsed.difficulty) || !finite(parsed.playerLevel)) return null;
    return { level: parsed.level, difficulty: parsed.difficulty, playerLevel: parsed.playerLevel, at: finite(parsed.at) ? parsed.at : 0 };
  } catch {
    return null;
  }
}

export function saveTournamentWorld(storage, world) {
  try {
    storage?.setItem(TOURNAMENT_WORLD_KEY, JSON.stringify(world));
  } catch {
    // 保存できなければ、次の期はまたおすすめから決める。
  }
}

/** 入口で選んでおく難易度の番号。世界があれば「いつもの世界」、なければ棋力からのおすすめ。 */
export function defaultWorldDifficulty(stored, playerLevel) {
  return stored ? stored.difficulty : recommendedDifficulty(playerLevel);
}

/**
 * 入口で選んだ難易度の番号から、世界の基準Lvを決める。世界があれば、その番号からの差だけ動かす(同じ番号なら同じ世界)。
 * なければ、棋力からのおすすめ(基準の棋士に7割)を中心に、番号1つで1.5Lv動かす。
 * @param {{ stored: ReturnType<typeof loadTournamentWorld>, playerLevel: number, difficulty: number, at?: number }} input
 */
export function resolveWorld({ stored, playerLevel, difficulty, at = Date.now() }) {
  if (stored && stored.difficulty === difficulty) return stored;
  // 本物は、棋力に合わせない世界(9章)。本物から番号の世界へ戻るときは、はじめてと同じく棋力のおすすめから決める。
  if (difficulty === REAL_DIFFICULTY) return { level: REAL_WORLD, difficulty, playerLevel, at };
  const numbered = stored && !isRealWorld(stored.level) ? stored : null;
  const level = numbered
    ? numbered.level + (difficulty - numbered.difficulty) * WORLD_STEP_LEVELS
    : recommendedWorldLevel(playerLevel) + (difficulty - recommendedDifficulty(playerLevel)) * WORLD_STEP_LEVELS;
  return { level, difficulty, playerLevel, at };
}

/** 段級位の表の名前(「程度」を除く。例: 5級・アマ初段・若手プロ・藤井聡太並み)。 */
export function levelGradeName(level) {
  const rounded = Math.min(MAX_CPU_LEVEL, Math.max(0, Math.round(Number(level) || 0)));
  const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === rounded) ?? CPU_STRENGTH_PRESETS[0];
  return preset.label.replace(/程度$/, '');
}

/** 難易度の番号の呼び名(本物は「本物」)。 */
export function difficultyName(difficulty) {
  return difficulty === REAL_DIFFICULTY ? '本物' : String(difficulty);
}

/**
 * 難易度の選択肢(8章)。番号ごとに、その世界でのいちばん下といちばん上の相手の段級位を説明に出す(数字だけでは強さが分からないため。
 * U:5-3 情報を言葉で)。いちばん上は「本物」(9章)。
 * @param {{ stored: ReturnType<typeof loadTournamentWorld>, playerLevel: number, base: number,
 *   bottom: { label: string, rating: number }, top: { label: string, rating: number },
 *   recommended?: number | null }} input
 *   bottomとtopは、説明に出す相手(竜王戦なら6組の平均と竜王)。baseは、その大会の基準の棋士のレーティング。
 * @returns {{ value: number, label: string, description: string }[]}
 */
export function difficultyOptions({ stored, playerLevel, base, bottom, top, recommended = null }) {
  const options = [];
  const gradeIn = (rating, world) => levelGradeName(worldCpuLevel(rating, world, base));
  for (let difficulty = 1; difficulty <= REAL_DIFFICULTY; difficulty += 1) {
    const world = resolveWorld({ stored, playerLevel, difficulty, at: stored?.at ?? 0 }).level;
    const tags = [];
    if (stored && stored.difficulty === difficulty) tags.push('いつもの世界');
    if (difficulty === recommended) tags.push('おすすめ');
    const strength = `${bottom.label} ${gradeIn(bottom.rating, world)}〜${top.label} ${gradeIn(top.rating, world)}`;
    const real = difficulty === REAL_DIFFICULTY;
    options.push({
      value: difficulty,
      label: real ? '本物' : String(difficulty),
      description: [real ? `実際の大会と同じ強さ。${strength}` : strength, ...tags].join('・'),
    });
  }
  return options;
}

/**
 * 入口で知らせる、世界と棋力のずれ。強くなった(grown)ら、世界は変えずに伸びを伝える。
 * 弱くなった(dropped)か、竜王戦で2期続けて降級した(struggling)ら、やさしい世界を選べる形で勧める(G:4-3)。
 * @param {{ stored: ReturnType<typeof loadTournamentWorld>, playerLevel: number, history?: { relegated?: boolean }[] }} input
 * @returns {{ kind: 'grown' | 'dropped' | 'struggling', delta: number } | null}
 */
export function worldReview({ stored, playerLevel, history = [] }) {
  // 本物の世界は棋力に合わせない世界なので、見直しの一言は出さない(9章)。
  if (!stored || !finite(playerLevel) || isRealWorld(stored.level)) return null;
  const delta = Math.round((playerLevel - stored.playerLevel) * 10) / 10;
  if (delta >= WORLD_DRIFT_LEVELS) return { kind: 'grown', delta };
  if (delta <= -WORLD_DRIFT_LEVELS) return { kind: 'dropped', delta };
  const recent = history.slice(-2);
  if (recent.length === 2 && recent.every((entry) => entry?.relegated)) return { kind: 'struggling', delta };
  return null;
}

/** 「格上」「格下」の札を付ける、相手とプレイヤーのLvの差。 */
export const RANK_TAG_LEVELS = 2;

/**
 * 次の相手の札(4-5)。プレイヤーよりRANK_TAG_LEVELS以上強ければ「格上」、弱ければ「格下」。それ以外はnull。
 * @param {number} opponentLevel
 * @param {number} userLevel
 * @returns {'格上' | '格下' | null}
 */
export function rankTag(opponentLevel, userLevel) {
  if (!finite(opponentLevel) || !finite(userLevel)) return null;
  const diff = opponentLevel - userLevel;
  if (diff >= RANK_TAG_LEVELS) return '格上';
  if (diff <= -RANK_TAG_LEVELS) return '格下';
  return null;
}
