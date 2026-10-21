/**
 * 「つぎはこれ」の対局の見立て(docs/home-next-adaptive-design.mdの3章・4章。段階1: 勝ち負けの記録だけで決める)。
 * レーティングと、最近の勝ち負け・Lvごとの勝ち負けから、勝ち越せそうな相手のLvと、勧める理由の1行を決める。
 * 黙って難易度を変えない。勧めるだけで、選ぶのは本人(自由対局ではどのLvでも選べる)。画面に依存しない。
 */
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';
import { gradeName, levelRating, nextRatingGoal } from './player-rating.mjs';

const MAX_LEVEL = CPU_STRENGTH_PRESETS.at(-1).level;
const RATING_PER_LEVEL = levelRating(1);

/** 勧める相手の、勝率の見込み。0.6なら、相手はR約70下(Eloの式)。 */
export const TARGET_WIN_RATE = 0.6;
export const TARGET_MARGIN = Math.round(400 * Math.log10(TARGET_WIN_RATE / (1 - TARGET_WIN_RATE)));
/** 最近の成績を見る対局の数と、使い始める対局の数。 */
export const RECENT_GAMES = 10;
const RECENT_MIN = 5;
/** 最近の成績(パフォーマンス)の、相手の平均からの上下の幅。 */
const PERFORMANCE_SPREAD = 200;
/** 連敗・連勝・勝てていないLvなどの規則を使い始める対局数(少ないうちは、基準のLvだけにする)。 */
export const RULES_MIN_GAMES = 10;
/** 勝てていないLvとみなす、勝ちなしの対局数。 */
export const UNBEATEN_GAMES = 3;
/** 1回で動かすLvの上限(直前に指したLvから)。 */
export const MAX_STEP = 2;
/** 「昇級をかけた一局」にする、次の級までの残り(勝ち1回分)。 */
export const PROMOTION_MARGIN = 10;

const clampLevel = (level) => Math.min(MAX_LEVEL, Math.max(0, Math.round(level)));
const presetLabel = (level) => CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)?.label ?? '';

/** レーティングの対象の対局の記録(申告・測定を除く)。 */
function ratedHistory(state) {
  return (state?.history ?? []).filter((entry) => Number.isFinite(entry?.opponentLevel) && ['win', 'loss', 'draw'].includes(entry.outcome));
}

/**
 * 最近の成績のレーティング(パフォーマンス)。相手のLvの平均に、勝ち越し・負け越しの分を足す。対局が少なければnull。
 * @param {{ opponentLevel: number, outcome: string }[]} games
 */
export function recentPerformance(games) {
  const recent = games.slice(-RECENT_GAMES);
  if (recent.length < RECENT_MIN) return null;
  const opponent = recent.reduce((sum, { opponentLevel }) => sum + levelRating(opponentLevel), 0) / recent.length;
  const score = recent.reduce((sum, { outcome }) => sum + (outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0), 0) / recent.length;
  return Math.round(opponent + Math.max(-PERFORMANCE_SPREAD, Math.min(PERFORMANCE_SPREAD, 400 * score)));
}

/** 結果の強さ。最近の成績のほうが低ければ、そちらを使う(負けが続いたときに、早く下げる)。 */
export function resultStrength(state) {
  const rating = Number.isFinite(state?.rating) ? state.rating : 800;
  const performance = recentPerformance(ratedHistory(state));
  return performance !== null && performance < rating ? performance : rating;
}

function lastIndexOf(list, test) {
  for (let index = list.length - 1; index >= 0; index -= 1) if (test(list[index])) return index;
  return -1;
}

/** 直近の、同じLvへの連続した結果(outcomeが続く数)。 */
function streakAt(games, level, outcome) {
  let count = 0;
  for (let index = games.length - 1; index >= 0; index -= 1) {
    if (games[index].opponentLevel !== level || games[index].outcome !== outcome) break;
    count += 1;
  }
  return count;
}

/**
 * 勧めるLvの上限。3局以上指して1勝もしていないLvより下にする。
 * ただし、そのLvの1つ下で、そのLvに最後に負けたあとに勝っていれば、もう一度挑戦できる(上限にしない)。
 * @returns {number}
 */
export function unbeatenCap(state) {
  const games = ratedHistory(state);
  let cap = MAX_LEVEL;
  for (const [key, tally] of Object.entries(state?.levels ?? {})) {
    const level = Number(key);
    const played = (tally?.wins ?? 0) + (tally?.losses ?? 0) + (tally?.draws ?? 0);
    if (!Number.isFinite(level) || played < UNBEATEN_GAMES || (tally?.wins ?? 0) > 0) continue;
    const lastLoss = lastIndexOf(games, (entry) => entry.opponentLevel === level);
    const recovered = lastIndexOf(games, (entry) => entry.opponentLevel === level - 1 && entry.outcome === 'win') > lastLoss;
    if (!recovered) cap = Math.min(cap, level - 1);
  }
  return Math.max(0, cap);
}

/**
 * 次の対局の見立て。
 * kind: 'first-win'(初めて勝ったLvの次)・'warmup'(3連敗の立て直し)・'challenge'(2連勝)・'promotion'(昇級をかけた一局)・'normal'。
 * handicapLevelは、立て直しで「香落ちで挑む」ときのLv(連敗したLv)。
 * @param {any} state player-ratingの記録
 * @returns {{ level: number, kind: string, title: string, reason: string, base: number, cap: number, handicapLevel: number | null }}
 */
export function recommendPlay(state) {
  const games = ratedHistory(state);
  const strength = resultStrength(state);
  const base = clampLevel((strength - TARGET_MARGIN) / RATING_PER_LEVEL);
  const cap = unbeatenCap(state);
  const recentText = recentRecordText(games);
  const normal = (level) => ({
    level, kind: 'normal', title: '対局する', base, cap, handicapLevel: null,
    reason: `Lv.${level} ${presetLabel(level)}の相手と。${recentText || '振り駒ですぐ始めるよ'}`,
  });
  if ((state?.games ?? 0) < RULES_MIN_GAMES || !games.length) return withPromotion(state, normal(base));

  const last = games.at(-1);
  const played = last.opponentLevel;
  const within = (level) => clampLevel(Math.min(played + MAX_STEP, Math.max(played - MAX_STEP, level)));
  const wins = streakAt(games, played, 'win');
  const losses = streakAt(games, played, 'loss');

  if (last.outcome === 'win' && (state.levels?.[played]?.wins ?? 0) === 1 && played < MAX_LEVEL) {
    const level = played + 1;
    return { level, kind: 'first-win', title: `Lv.${level}に挑戦`, reason: `Lv.${played}に初勝利！ 次は1つ上へ`, base, cap, handicapLevel: null };
  }
  if (losses >= 3) {
    const level = clampLevel(played - 2);
    if (level < played) {
      return {
        level, kind: 'warmup', title: `Lv.${level}で腕ならし`, base, cap, handicapLevel: played,
        reason: `Lv.${played}に${losses}連敗。${played - level}つ下で、勝つ感覚を取り戻そう`,
      };
    }
  }
  if (wins >= 2 && played < MAX_LEVEL && played + 1 <= cap) {
    const level = played + 1;
    return { level, kind: 'challenge', title: `Lv.${level}に挑戦`, reason: `Lv.${played}に${wins}連勝中。1つ上でも勝てるはず`, base, cap, handicapLevel: null };
  }
  let level = losses === 2 ? Math.min(base, played - 1) : base;
  level = within(Math.min(level, cap));
  return withPromotion(state, normal(level));
}

/** 次の級まで勝ち1回分なら、「昇級をかけた一局」にする。 */
function withPromotion(state, plan) {
  if (plan.kind !== 'normal') return plan;
  const goal = nextRatingGoal(state?.rating);
  if (!goal || goal.remaining > PROMOTION_MARGIN || (state?.games ?? 0) < 1) return plan;
  return {
    ...plan, kind: 'promotion', title: '昇級をかけた一局',
    reason: `${gradeName(goal.label)}まであとR${goal.remaining}。Lv.${plan.level}に勝てば昇級だよ`,
  };
}

/** 最近5局の成績の1行(「ここ5局は3勝2敗、いい調子」)。対局がなければ空。 */
function recentRecordText(games) {
  const recent = games.slice(-5);
  if (!recent.length) return '';
  const wins = recent.filter(({ outcome }) => outcome === 'win').length;
  const losses = recent.filter(({ outcome }) => outcome === 'loss').length;
  const draws = recent.length - wins - losses;
  const tone = wins > losses ? '、いい調子' : '';
  return `ここ${recent.length}局は${wins}勝${losses}敗${draws ? `${draws}分` : ''}${tone}`;
}

/**
 * 終局画面の主ボタン(4-2)。平手の通常対局で勝ったら1つ上のLv、香落ちで勝ったら平手。ほかはnull(今の「もう一局」)。
 * @param {{ won: boolean, rated: boolean, level: number | undefined, lanceHandicap: boolean, firstWin: boolean }} game
 * @returns {{ kind: 'up' | 'even' | 'top', level: number, title: string, reason: string, sameTitle: string } | null}
 */
export function resultNextStep({ won, rated, level, lanceHandicap, firstWin }) {
  if (!won || !Number.isFinite(level)) return null;
  if (lanceHandicap) {
    return { kind: 'even', level, title: `平手でLv.${level}に挑む`, reason: '香落ちで勝ったね。次は平手で', sameTitle: '香落ちでもう一局' };
  }
  if (!rated) return null;
  if (level >= MAX_LEVEL) {
    return { kind: 'top', level, title: 'もう一局', reason: `Lv.${MAX_LEVEL}（${presetLabel(MAX_LEVEL)}）に勝った！`, sameTitle: '' };
  }
  return {
    kind: 'up',
    level: level + 1,
    title: `Lv.${level + 1}に挑戦`,
    reason: firstWin ? `Lv.${level}に初勝利！ 次は1つ上へ` : `Lv.${level}に勝ったね。次は1つ上へ`,
    sameTitle: `同じLv.${level}でもう一局`,
  };
}
