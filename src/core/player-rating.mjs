// 通常対局(平手・対CPU)の結果から、プレイヤーのレーティングをElo式で計算する。
// CPUの各レベルには、ぴよ将棋の目安(1レベルでR約80)に合わせたレーティングを割り当てる。
// 強さの校正値そのものではなく、表示名どおりの段級位の目安である(docs/difficulty-calibration.md)。

import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

export const RATING_STORAGE_KEY = 'yacobihime:shogi-match:player-rating';
export const INITIAL_RATING = 800;
const RATING_PER_LEVEL = 80;
/** 最初の対局数まではレーティングが動きやすいよう、Kを大きくする。 */
const PROVISIONAL_GAMES = 10;
const PROVISIONAL_K = 40;
const STANDARD_K = 20;
const MAX_HISTORY = 30;

const MAX_LEVEL = CPU_STRENGTH_PRESETS.at(-1).level;

/** CPUのLvに割り当てるレーティング。 */
export function levelRating(level) {
  return Math.round(level * RATING_PER_LEVEL);
}

/** レーティングに最も近いCPUのLv。上限はLv40。 */
export function recommendedLevel(rating) {
  const level = Math.round((Number.isFinite(rating) ? rating : INITIAL_RATING) / RATING_PER_LEVEL);
  return Math.min(MAX_LEVEL, Math.max(0, level));
}

export function createRatingState() {
  return { rating: INITIAL_RATING, games: 0, wins: 0, losses: 0, draws: 0, history: [] };
}

/**
 * 1局の結果を反映した新しい状態と、変動を返す。
 * @param {ReturnType<typeof createRatingState>} state
 * @param {{ opponentLevel: number, outcome: 'win' | 'loss' | 'draw', at?: number }} game
 */
export function applyRatedGame(state, { opponentLevel, outcome, at = Date.now() }) {
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const opponent = levelRating(opponentLevel);
  const expected = 1 / (1 + 10 ** ((opponent - state.rating) / 400));
  const k = state.games < PROVISIONAL_GAMES ? PROVISIONAL_K : STANDARD_K;
  const after = Math.max(0, Math.round(state.rating + k * (score - expected)));
  const next = {
    rating: after,
    games: state.games + 1,
    wins: state.wins + (outcome === 'win' ? 1 : 0),
    losses: state.losses + (outcome === 'loss' ? 1 : 0),
    draws: state.draws + (outcome === 'draw' ? 1 : 0),
    history: [...state.history, { at, rating: after, opponentLevel, outcome }].slice(-MAX_HISTORY),
  };
  return { state: next, before: Math.round(state.rating), after, delta: after - Math.round(state.rating) };
}

const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

export function loadRatingState(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(RATING_STORAGE_KEY) ?? 'null');
    if (!parsed || !Number.isFinite(parsed.rating)) return createRatingState();
    return {
      rating: Math.max(0, Math.round(parsed.rating)),
      games: count(parsed.games),
      wins: count(parsed.wins),
      losses: count(parsed.losses),
      draws: count(parsed.draws),
      history: Array.isArray(parsed.history)
        ? parsed.history.filter((entry) => entry && Number.isFinite(entry.rating)).slice(-MAX_HISTORY)
        : [],
    };
  } catch {
    return createRatingState();
  }
}

export function saveRatingState(storage, state) {
  try {
    storage?.setItem(RATING_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
