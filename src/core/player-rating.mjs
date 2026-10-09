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
  return { rating: INITIAL_RATING, games: 0, wins: 0, losses: 0, draws: 0, levels: {}, colors: {}, usage: {}, measured: null, declared: null, declaredLevels: {}, history: [] };
}

const OUTCOME_KEY = { win: 'wins', loss: 'losses', draw: 'draws' };

/** キーごとの成績(勝・敗・引き分け)の表に1局を加える。 */
function addToTally(tally = {}, key, outcome) {
  const current = tally[key] ?? { wins: 0, losses: 0, draws: 0 };
  return { ...tally, [key]: { ...current, [OUTCOME_KEY[outcome]]: current[OUTCOME_KEY[outcome]] + 1 } };
}

/** 成績の分類。battle: 戦型、rook: 戦法、castle: 囲い。opponent*は相手側。 */
export const USAGE_CATEGORIES = ['battle', 'rook', 'castle', 'opponentRook', 'opponentCastle'];

/** 分類ごとの成績の表に、1局の戦型・戦法・囲いを加える。名前のないものは数えない。 */
function addUsage(usage = {}, profile = {}, outcome) {
  const next = { ...usage };
  for (const category of USAGE_CATEGORIES) {
    const name = profile[category];
    if (typeof name === 'string' && name) next[category] = addToTally(next[category], name, outcome);
  }
  return next;
}

/**
 * 分類ごとの使用状況を、対局数の多い順に返す。rateは全対局に占める割合(0〜1)。
 * @param {ReturnType<typeof createRatingState>} state
 * @param {string} category USAGE_CATEGORIESのどれか
 */
export function usageRows(state, category) {
  const total = Math.max(1, state.games);
  return Object.entries(state.usage?.[category] ?? {})
    .map(([name, { wins, losses, draws }]) => ({
      name, wins, losses, draws, games: wins + losses + draws, rate: (wins + losses + draws) / total,
    }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name, 'ja'));
}

/** 選択肢に添える「R800・2勝1敗0引き分け」。 */
export function levelRatingText(state, level) {
  const { wins = 0, losses = 0, draws = 0 } = state.levels?.[level] ?? {};
  return `R${levelRating(level)}・${wins}勝${losses}敗${draws}引き分け`;
}

/**
 * 1局の結果を反映した新しい状態と、変動を返す。
 * @param {ReturnType<typeof createRatingState>} state
 * @param {{
 *   opponentLevel: number,
 *   outcome: 'win' | 'loss' | 'draw',
 *   color?: 'black' | 'white',
 *   profile?: { [category: string]: string | undefined },
 *   at?: number,
 * }} game
 * colorはプレイヤーの手番、profileは分類(USAGE_CATEGORIES)ごとの戦型・戦法・囲いの名前。
 */
export function applyRatedGame(state, { opponentLevel, outcome, color, profile, at = Date.now() }) {
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const opponent = levelRating(opponentLevel);
  const expected = 1 / (1 + 10 ** ((opponent - state.rating) / 400));
  const k = state.games < PROVISIONAL_GAMES ? PROVISIONAL_K : STANDARD_K;
  const after = Math.max(0, Math.round(state.rating + k * (score - expected)));
  const next = {
    ...state,
    rating: after,
    games: state.games + 1,
    wins: state.wins + (outcome === 'win' ? 1 : 0),
    losses: state.losses + (outcome === 'loss' ? 1 : 0),
    draws: state.draws + (outcome === 'draw' ? 1 : 0),
    levels: addToTally(state.levels, opponentLevel, outcome),
    declaredLevels: state.declared
      ? { ...state.declaredLevels, [state.declared.label]: addToTally(state.declaredLevels?.[state.declared.label], opponentLevel, outcome) }
      : (state.declaredLevels ?? {}),
    colors: color ? addToTally(state.colors, color, outcome) : (state.colors ?? {}),
    usage: addUsage(state.usage, profile, outcome),
    history: [...state.history, { at, rating: after, opponentLevel, outcome }].slice(-MAX_HISTORY),
  };
  return { state: next, before: Math.round(state.rating), after, delta: after - Math.round(state.rating) };
}

/**
 * 自己申告できる段級位の選択肢(二十六級〜アマ七段)。同じ表示名のレベルが複数あるときは、真ん中のレベルを代表にする。
 * @returns {{ label: string, level: number }[]}
 */
export function declarableGrades() {
  const groups = new Map();
  for (const preset of CPU_STRENGTH_PRESETS) {
    if (preset.level === 0 || !/^(.+級|アマ.+段)程度$/.test(preset.label)) continue;
    groups.set(preset.label, [...(groups.get(preset.label) ?? []), preset.level]);
  }
  return [...groups].map(([label, levels]) => ({ label: label.replace(/程度$/, ''), level: levels[Math.floor((levels.length - 1) / 2)] }));
}

/**
 * 自己申告した段級位をレーティングに設定する。以降の対局は、申告ごとのCPUのレベル別成績にも記録する
 * (表示名と実際の棋力のずれを見るため)。対局数は変えない。
 * @param {ReturnType<typeof createRatingState>} state
 * @param {{ label: string, level: number, at?: number }} grade
 */
export function applyDeclaredGrade(state, { label, level, at = Date.now() }) {
  const rating = levelRating(level);
  return {
    ...state,
    rating,
    declared: { label, level, at },
    history: [...state.history, { at, rating, opponentLevel: null, outcome: 'declare' }].slice(-MAX_HISTORY),
  };
}

/**
 * 棋力測定の結果をレーティングとして設定する。対局数は変えない(測定は数局ぶんの精度のため、
 * 最初の10局のうちはその後の対局で動きやすいまま)。履歴にはoutcome: 'measure'で残す。
 * @param {ReturnType<typeof createRatingState>} state
 * @param {{ rating: number, label?: string, at?: number }} measurement
 */
export function applyMeasuredRating(state, { rating, label = '', at = Date.now() }) {
  const value = Math.max(0, Math.round(rating));
  return {
    ...state,
    rating: value,
    measured: { rating: value, label, at },
    history: [...state.history, { at, rating: value, opponentLevel: null, outcome: 'measure' }].slice(-MAX_HISTORY),
  };
}

const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
const loadTally = (tally) => Object.fromEntries(Object.entries(tally ?? {}).map(([key, record]) => [
  key, { wins: count(record?.wins), losses: count(record?.losses), draws: count(record?.draws) },
]));

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
      measured: parsed.measured && Number.isFinite(parsed.measured.rating)
        ? { rating: Math.round(parsed.measured.rating), label: String(parsed.measured.label ?? ''), at: Number(parsed.measured.at) || 0 }
        : null,
      declared: parsed.declared && typeof parsed.declared.label === 'string' && Number.isFinite(parsed.declared.level)
        ? { label: parsed.declared.label, level: parsed.declared.level, at: Number(parsed.declared.at) || 0 }
        : null,
      declaredLevels: Object.fromEntries(Object.entries(parsed.declaredLevels ?? {}).map(([label, tally]) => [label, loadTally(tally)])),
      levels: loadTally(parsed.levels),
      colors: loadTally(parsed.colors),
      usage: Object.fromEntries(
        USAGE_CATEGORIES.filter((category) => parsed.usage?.[category]).map((category) => [category, loadTally(parsed.usage[category])]),
      ),
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
