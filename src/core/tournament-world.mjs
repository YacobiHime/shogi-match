// 世界の物差し(docs/tournament-strength-spread-design.md)。大会の棋士を何Lvで指させるかの基準(W)を、
// 竜王戦・名人戦・奨励会・研修会で1つ共有し、期をまたいで同じものを使い続ける。プレイヤーが強くなると、
// 同じ世界で上の組に勝てるようになる。期ごとに棋力へ合わせ直さない(強くなった実感を残す。G:6-1)。

import { WORLD_STEP_LEVELS, recommendedDifficulty, recommendedWorldLevel } from './ryuo-strength.mjs';

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
  const level = stored
    ? stored.level + (difficulty - stored.difficulty) * WORLD_STEP_LEVELS
    : recommendedWorldLevel(playerLevel) + (difficulty - recommendedDifficulty(playerLevel)) * WORLD_STEP_LEVELS;
  return { level, difficulty, playerLevel, at };
}

/**
 * 入口で知らせる、世界と棋力のずれ。強くなった(grown)ら、世界は変えずに伸びを伝える。
 * 弱くなった(dropped)か、竜王戦で2期続けて降級した(struggling)ら、やさしい世界を選べる形で勧める(G:4-3)。
 * @param {{ stored: ReturnType<typeof loadTournamentWorld>, playerLevel: number, history?: { relegated?: boolean }[] }} input
 * @returns {{ kind: 'grown' | 'dropped' | 'struggling', delta: number } | null}
 */
export function worldReview({ stored, playerLevel, history = [] }) {
  if (!stored || !finite(playerLevel)) return null;
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
