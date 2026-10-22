// 通常対局(平手・対CPU)の結果から、プレイヤーのレーティングをElo式で計算する。
// CPUの各レベルには、段級位の目安のレーティングを割り当てる(2026-10-22の作り直し。docs/level-ladder-design.md)。
// 15級(Lv1)がR30、5級(Lv11)がR630(ユーザーの実測でぴよ将棋の五級)、1Lvあたり R60。Lv0は練習相手で、レーティングに数えない。

import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';
import { LADDER_VERSION, ladderLabelFromOld, ladderLevelIndexFromOld, ladderRatingFromOld } from './level-ladder.mjs';

export const RATING_STORAGE_KEY = 'yacobihime:shogi-match:player-rating';
/** はじめの人は15級(Lv1)から。棋力測定とはじめての案内で決まる人は、そちらで決める。 */
export const INITIAL_RATING = 30;
const RATING_PER_LEVEL = 60;
/** 最初の対局数まではレーティングが動きやすいよう、Kを大きくする。 */
const PROVISIONAL_GAMES = 10;
const PROVISIONAL_K = 40;
const STANDARD_K = 20;
const MAX_HISTORY = 30;

const MAX_LEVEL = CPU_STRENGTH_PRESETS.at(-1).level;

/** CPUのLv(小数も可)に割り当てるレーティング。Lv1(15級)がR30、1LvあたりR60。Lv0は0。 */
export function levelRating(level) {
  return level <= 0 ? 0 : Math.max(0, Math.round(level * RATING_PER_LEVEL - RATING_PER_LEVEL / 2));
}

/** レーティングに当たるLv(小数)。levelRatingの逆。 */
export function ratingLevel(rating) {
  return ((Number.isFinite(rating) ? rating : INITIAL_RATING) + RATING_PER_LEVEL / 2) / RATING_PER_LEVEL;
}

/** レーティングに最も近いCPUのLv。Lv1(15級)からLv40まで(Lv0は練習相手で、勧めない)。 */
export function recommendedLevel(rating) {
  return Math.min(MAX_LEVEL, Math.max(1, Math.round(ratingLevel(rating))));
}

/** レーティングに数える相手か。Lv0(駒の動きを覚えたて)は練習相手で、数えない。 */
export function isRatedLevel(level) {
  return Number.isFinite(level) && level >= 1;
}

/** 段級位の表示名から「程度」を除いたもの。 */
export function gradeName(label) {
  return String(label ?? '').replace(/程度$/, '');
}

/**
 * 次の目標。いまの目安と違う表示名の、すぐ上のレベル。
 * recommendedLevelは(R+30)÷60を四捨五入するので、レベルLの目安になるのはR(60L−60)から。
 * percentは、いまの表示名に入ったところから次の表示名までの進み具合(0〜100)。いちばん上ではnull。
 * @param {number} rating
 * @returns {{ label: string, level: number, remaining: number, percent: number } | null}
 */
export function nextRatingGoal(rating) {
  const current = CPU_STRENGTH_PRESETS.find((preset) => preset.level === recommendedLevel(rating));
  const next = CPU_STRENGTH_PRESETS.find((preset) => preset.level > current.level && preset.label !== current.label);
  if (!next) return null;
  const firstOfCurrent = CPU_STRENGTH_PRESETS.find((preset) => preset.label === current.label);
  const threshold = (level) => Math.max(0, levelRating(level) - RATING_PER_LEVEL / 2);
  const start = threshold(firstOfCurrent.level);
  const target = threshold(next.level);
  const value = Number.isFinite(rating) ? rating : INITIAL_RATING;
  const ratio = target > start ? (value - start) / (target - start) : 0;
  return {
    label: next.label,
    level: next.level,
    remaining: Math.max(1, Math.ceil(target - value)),
    percent: Math.round(Math.min(1, Math.max(0, ratio)) * 100),
  };
}

/** 難易度を変える提案を出す連敗の数。 */
export const RETRY_SUGGESTION_LOSSES = 3;

/**
 * 同じLvの相手に、直近で続けて負けた数。間に別のLvとの対局・勝ち・引き分けがあれば、そこで数え直す。
 * 申告・測定の記録(opponentLevelのない記録)は飛ばす。
 * @param {ReturnType<typeof createRatingState>} state
 * @param {number} level
 */
export function losingStreakAt(state, level) {
  let losses = 0;
  for (let index = (state?.history?.length ?? 0) - 1; index >= 0; index -= 1) {
    const entry = state.history[index];
    if (!Number.isFinite(entry?.opponentLevel)) continue;
    if (entry.opponentLevel !== level || entry.outcome !== 'loss') break;
    losses += 1;
  }
  return losses;
}

/**
 * 同じLvに続けて負けたときの、選べる提案。自動では下げず、挑戦を続ける道と並べて見せる。
 * lowerLevelはLv0の相手ではnull。15級(Lv1)の下は、Lv0(練習相手)。駒落ちは、15級なら飛車落ち、ほかは香落ち。
 * @param {ReturnType<typeof createRatingState>} state
 * @param {number} level
 * @returns {{ level: number, losses: number, lowerLevel: number | null, handicapId: 'rook' | 'lance', handicapLabel: string } | null}
 */
export function retrySuggestion(state, level) {
  if (!Number.isFinite(level)) return null;
  const losses = losingStreakAt(state, level);
  if (losses < RETRY_SUGGESTION_LOSSES) return null;
  // 腕ならしは2つ下(つぎはこれの立て直しと同じ。docs/home-next-adaptive-design.mdの3-3)。
  const lowerLevel = level <= 0 ? null : level === 1 ? 0 : Math.max(1, level - 2);
  const rook = level <= 1;
  return { level, losses, lowerLevel, handicapId: rook ? 'rook' : 'lance', handicapLabel: rook ? '飛車落ち' : '香落ち' };
}

export function createRatingState() {
  return {
    ladder: LADDER_VERSION, rating: INITIAL_RATING, games: 0, wins: 0, losses: 0, draws: 0,
    levels: {}, colors: {}, events: {}, usage: {}, measured: null, declared: null, declaredLevels: {}, history: [], ladderNotice: null,
  };
}

/**
 * 記録する棋戦。free: 自由対局(平手・対CPU)、ryuo: 竜王戦。
 * 棋戦を増やすときは、ここに足すと、やこびノートの「棋戦ごとの成績」に出る。
 */
export const RATED_EVENTS = Object.freeze([
  Object.freeze({ id: 'free', label: '自由対局' }),
  Object.freeze({ id: 'ryuo', label: '竜王戦' }),
  Object.freeze({ id: 'meijin', label: '名人戦' }),
]);
const RATED_EVENT_IDS = new Set(RATED_EVENTS.map(({ id }) => id));

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

/** 選択肢に添える「R570・2勝1敗0引き分け」。Lv0は練習相手で、レーティングに数えない。 */
export function levelRatingText(state, level) {
  const { wins = 0, losses = 0, draws = 0 } = state.levels?.[level] ?? {};
  return `${isRatedLevel(level) ? `R${levelRating(level)}` : '練習相手'}・${wins}勝${losses}敗${draws}引き分け`;
}

/**
 * 1局の結果を反映した新しい状態と、変動を返す。
 * @param {ReturnType<typeof createRatingState>} state
 * @param {{
 *   opponentLevel: number,
 *   outcome: 'win' | 'loss' | 'draw',
 *   color?: 'black' | 'white',
 *   profile?: { [category: string]: string | undefined },
 *   event?: string,
 *   opponent?: string,
 *   stage?: string,
 *   at?: number,
 * }} game
 * colorはプレイヤーの手番、profileは分類(USAGE_CATEGORIES)ごとの戦型・戦法・囲いの名前。
 * eventは棋戦(RATED_EVENTSのid。省略すると自由対局)、opponentは相手の名前、stageは棋戦の中の段階(「決勝トーナメント 準決勝」など)。
 */
export function applyRatedGame(state, { opponentLevel, outcome, color, profile, event = 'free', opponent: opponentName, stage, at = Date.now() }) {
  const eventId = RATED_EVENT_IDS.has(event) ? event : 'free';
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
    events: addToTally(state.events, eventId, outcome),
    usage: addUsage(state.usage, profile, outcome),
    history: [...state.history, {
      at,
      rating: after,
      opponentLevel,
      outcome,
      event: eventId,
      ...(opponentName ? { opponent: String(opponentName) } : {}),
      ...(stage ? { stage: String(stage) } : {}),
    }].slice(-MAX_HISTORY),
  };
  return { state: next, before: Math.round(state.rating), after, delta: after - Math.round(state.rating) };
}

/**
 * 自己申告できる段級位の選択肢(15級〜アマ七段)。同じ表示名のレベルが複数あるときは、真ん中のレベルを代表にする。
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

/**
 * 棋戦ごとの成績。棋戦を記録する前に保存した対局は、すべて自由対局だった(竜王戦は数えていなかった)ので、自由対局として読む。
 */
function loadEvents(parsed) {
  if (parsed.events && typeof parsed.events === 'object') {
    return loadTally(Object.fromEntries(Object.entries(parsed.events).filter(([id]) => RATED_EVENT_IDS.has(id))));
  }
  const tally = { wins: count(parsed.wins), losses: count(parsed.losses), draws: count(parsed.draws) };
  return tally.wins + tally.losses + tally.draws ? { free: tally } : {};
}

/** 成績の表のキーを付け替え、同じキーに重なったら足し合わせる。 */
function remapTally(tally, mapKey) {
  const next = {};
  for (const [key, record] of Object.entries(tally ?? {})) {
    const to = mapKey(key);
    const current = next[to] ?? { wins: 0, losses: 0, draws: 0 };
    next[to] = {
      wins: current.wins + count(record?.wins), losses: current.losses + count(record?.losses), draws: current.draws + count(record?.draws),
    };
  }
  return next;
}

const presetLabelAt = (presets, level) => gradeName(presets.find((preset) => preset.level === level)?.label ?? '');

/**
 * 段級位の作り直し(2026-10-22)の前の保存を、新しい表へ移す。レーティング・相手のLv・申告の名前を、同じ強さのところへ。
 * 対局したことのある人には、1回だけ知らせる(ladderNotice。やこび姫が「段級位の物差しを作り直したよ」)。
 * @param {any} parsed 前の版の保存
 */
export function migrateRatingSnapshot(parsed) {
  const mapLevel = (key) => String(ladderLevelIndexFromOld(Number(key)));
  const before = Math.max(0, Math.round(parsed.rating));
  const after = ladderRatingFromOld(before);
  const played = count(parsed.games) > 0 || Boolean(parsed.measured) || Boolean(parsed.declared);
  return {
    ...parsed,
    ladder: LADDER_VERSION,
    rating: after,
    levels: remapTally(parsed.levels, mapLevel),
    declaredLevels: Object.fromEntries(Object.entries(parsed.declaredLevels ?? {}).map(([label, tally]) => [
      ladderLabelFromOld(label), remapTally(tally, mapLevel),
    ])),
    declared: parsed.declared && typeof parsed.declared.label === 'string' && Number.isFinite(parsed.declared.level)
      ? { ...parsed.declared, label: ladderLabelFromOld(parsed.declared.label), level: ladderLevelIndexFromOld(parsed.declared.level) }
      : parsed.declared ?? null,
    measured: parsed.measured && Number.isFinite(parsed.measured.rating)
      ? { ...parsed.measured, rating: ladderRatingFromOld(parsed.measured.rating), label: ladderLabelFromOld(parsed.measured.label ?? '') }
      : parsed.measured ?? null,
    history: Array.isArray(parsed.history) ? parsed.history.filter(Boolean).map((entry) => ({
      ...entry,
      ...(Number.isFinite(entry.rating) ? { rating: ladderRatingFromOld(entry.rating) } : {}),
      ...(Number.isFinite(entry.opponentLevel) ? { opponentLevel: ladderLevelIndexFromOld(entry.opponentLevel) } : {}),
    })) : [],
    ladderNotice: played ? {
      beforeRating: before,
      afterRating: after,
      beforeLabel: ladderOldLabel(before),
      afterLabel: presetLabelAt(CPU_STRENGTH_PRESETS, recommendedLevel(after)),
    } : null,
  };
}

/** 前の表(R=Lv×80)での段級位の名前(知らせに「前は十二級」と出す)。 */
function ladderOldLabel(rating) {
  const level = Math.min(40, Math.max(0, Math.round(rating / 80)));
  return OLD_LABELS[level] ?? '';
}

/** 前の表の段級位の名前(Lv0〜40)。知らせの「前は」にだけ使う。 */
const OLD_LABELS = Object.freeze([
  '駒の動きを覚えたて', '二十六級', '二十五級', '二十四級', '二十三級', '二十二級', '二十一級', '二十級', '十九級', '十八級', '十七級',
  '十六級', '十五級', '十四級', '十三級', '十二級', '十一級', '十級', '九級', '八級', '七級', '六級', '五級', '五級', '四級', '四級',
  '三級', '三級', '二級', '二級', '一級', '一級', 'アマ初段', 'アマ二段', 'アマ三段', 'アマ四段', 'アマ五段', 'アマ六段', 'アマ七段',
  'プロ級', '藤井聡太並み',
]);

export function loadRatingState(storage) {
  try {
    const stored = JSON.parse(storage?.getItem(RATING_STORAGE_KEY) ?? 'null');
    if (!stored || !Number.isFinite(stored.rating)) return createRatingState();
    const parsed = stored.ladder === LADDER_VERSION ? stored : migrateRatingSnapshot(stored);
    const notice = parsed.ladderNotice;
    return {
      ladder: LADDER_VERSION,
      ladderNotice: notice && Number.isFinite(notice.beforeRating) && Number.isFinite(notice.afterRating)
        ? {
          beforeRating: Math.round(notice.beforeRating), afterRating: Math.round(notice.afterRating),
          beforeLabel: String(notice.beforeLabel ?? ''), afterLabel: String(notice.afterLabel ?? ''),
        }
        : null,
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
      events: loadEvents(parsed),
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

/** 段級位の作り直しの知らせを見た。 */
export function dismissLadderNotice(state) {
  return { ...state, ladderNotice: null };
}

export function saveRatingState(storage, state) {
  try {
    storage?.setItem(RATING_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
