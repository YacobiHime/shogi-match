/**
 * 「つぎはこれ」の見立て(docs/home-next-adaptive-design.mdの3章・4章)。
 * 段階1: レーティングと、最近の勝ち負け・Lvごとの勝ち負けから、勝ち越せそうな相手のLvと、勧める理由の1行を決める。
 * 段階2: 自由対局の中身の記録(core/play-insight.mjs)から、内容の強さを見立てに混ぜ、復習の1問・弱点の練習を勧める。
 * 黙って難易度を変えない。勧めるだけで、選ぶのは本人(自由対局ではどのLvでも選べる)。画面に依存しない。
 */
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';
import { INITIAL_RATING, gradeName, levelRating, nextRatingGoal, ratingLevel } from './player-rating.mjs';
import { contentStrength, detectWeaknesses } from './play-insight.mjs';
import { isReviewProblemId } from './review-problems.mjs';
import { nearRewardLines } from './home-extras.mjs';

const MAX_LEVEL = CPU_STRENGTH_PRESETS.at(-1).level;

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

/** 勧めるLv。Lv0は練習相手でレーティングに数えないので、ふだんはLv1(15級)から。 */
const clampLevel = (level) => Math.min(MAX_LEVEL, Math.max(1, Math.round(level)));
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
  const rating = Number.isFinite(state?.rating) ? state.rating : INITIAL_RATING;
  const performance = recentPerformance(ratedHistory(state));
  return performance !== null && performance < rating ? performance : rating;
}

/** 内容の強さの重み(結果6：内容4)と、結果の強さから動かす幅の上限(Lv2つ分。1LvはR60)。 */
export const CONTENT_WEIGHT = 0.4;
export const CONTENT_SPREAD = 120;

/**
 * 見立ての強さ(3-2)。内容の強さ(R内容)がなければ結果の強さ。あれば0.6×R結果＋0.4×R内容を、R結果の±160に収める。
 * @param {number} result 結果の強さ
 * @param {number | null} content 内容の強さ
 */
export function blendedStrength(result, content) {
  if (!Number.isFinite(content)) return result;
  const blended = (1 - CONTENT_WEIGHT) * result + CONTENT_WEIGHT * content;
  return Math.round(Math.min(result + CONTENT_SPREAD, Math.max(result - CONTENT_SPREAD, blended)));
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
 * @typedef {{
 *   kind: 'review' | 'mate' | 'ending' | 'free' | 'opening' | 'matchup' | 'widen', problemId?: string,
 *   rook?: 'static' | 'ranging',
 * }} PracticeStep
 *   rookは、matchupでは相手に指してもらう戦法、widenではプレイヤーが試す戦法
 * @typedef {{
 *   level: number, kind: string, title: string, reason: string, base: number, cap: number, handicapLevel: number | null,
 *   handicapId?: { id: 'rook' | 'lance', label: string },
 *   practice?: PracticeStep,
 * }} PlayPlan
 */

/**
 * 次の見立て。
 * kind: 'first-win'(初めて勝ったLvの次)・'warmup'(3連敗の立て直し)・'challenge'(2連勝)・'practice'(復習の1問・弱点の練習)・
 * 'promotion'(昇級をかけた一局)・'normal'。
 * handicapLevelは、立て直しで「香落ちで挑む」ときのLv(連敗したLv)。practiceは、練習のときの中身。
 * 練習のときも、levelは対局で勧めるLv(弱点の練習の学習対局の強さに使う)。
 * @param {any} state player-ratingの記録
 * @param {{
 *   insight?: any, reviewDueId?: string | null, problemIds?: Set<string> | null,
 *   reward?: { wonLevels: number[], themeRemaining: number | null } | null,
 * }} [context]
 *   insightは対局の中身の記録(play-insight.mjs)、reviewDueIdは復習の期日が来た問題、problemIdsは「あなたの対局から」の問題のID
 * @returns {PlayPlan}
 */
export function recommendPlay(state, context = {}) {
  const plan = recommendMatch(state, contentStrength(context.insight?.games ?? []), context.insight?.games ?? [], context.reward ?? null);
  if (plan.kind !== 'normal' && plan.kind !== 'promotion') return plan;
  const practice = recommendPractice(state, context);
  return practice ? { ...plan, kind: 'practice', ...practice } : plan;
}

/** 練習は対局2局に1回まで。 */
export const PRACTICE_EVERY = 2;

const PRACTICE_TEXT = Object.freeze({
  mate: { title: '詰みを解き直そう', reason: (count) => (count > 1 ? `詰みを逃した局面が${count}つ。解き直そう` : '詰みを逃した局面があったね。解き直そう') },
  ending: { title: '自分の対局の終盤から', reason: () => '終盤で損が増えているね。自分の対局の終盤から指してみよう' },
  free: { title: '駒の利きを見ながら対局', reason: () => '駒をタダで取られる手が多め。利きを見ながら指そう' },
  opening: { title: '作戦カードで組み方を練習', reason: () => '序盤で押されたね。作戦カードで組み方を練習しよう' },
});

/** 振り飛車の戦法の名前(戦型検出のbt_match2のうち、飛車を振るもの)。ほかは居飛車として数える。 */
const RANGING_ROOKS = Object.freeze(['四間飛車', '三間飛車', '向かい飛車', '中飛車']);
/** 苦手な戦型を見る、片方の戦型の対局数の下限と、勝率の上限・もう片方との差。 */
export const MATCHUP_MIN_GAMES = 5;
const MATCHUP_MAX_RATE = 0.4;
const MATCHUP_GAP = 0.2;
/** 戦法を広げるを見る、対局数の下限と、片方に偏っているとみなす割合。 */
export const WIDEN_MIN_GAMES = 15;
const WIDEN_SHARE = 0.9;
const ROOK_NAME = Object.freeze({ static: '居飛車', ranging: '振り飛車' });

const sumTally = (table, names) => names.reduce((total, name) => {
  const tally = table?.[name];
  return { wins: total.wins + (tally?.wins ?? 0), losses: total.losses + (tally?.losses ?? 0), draws: total.draws + (tally?.draws ?? 0) };
}, { wins: 0, losses: 0, draws: 0 });
const gamesOf = (tally) => tally.wins + tally.losses + tally.draws;
const rateOf = (tally) => (tally.wins + tally.losses ? tally.wins / (tally.wins + tally.losses) : 0);

/**
 * 戦型の癖(docs/home-next-adaptive-design.mdの14章)。レーティングの対局の戦法の成績(player-ratingのusage)から。
 * - matchup: 相手の戦法(居飛車・振り飛車)の片方に、勝率4割以下で、もう片方より2割以上低い(両方5局以上)
 * - widen: 自分の戦法が、戦型を記録した15局以上で、9割以上どちらかに偏っている
 * @param {any} state player-ratingの記録
 * @returns {{ kind: 'matchup' | 'widen', rook: 'static' | 'ranging', title: string, reason: string }[]}
 */
export function detectHabits(state) {
  const found = [];
  const total = { wins: state?.wins ?? 0, losses: state?.losses ?? 0, draws: state?.draws ?? 0 };
  const vsRanging = sumTally(state?.usage?.opponentRook, RANGING_ROOKS);
  const vsStatic = { wins: total.wins - vsRanging.wins, losses: total.losses - vsRanging.losses, draws: total.draws - vsRanging.draws };
  if (gamesOf(vsRanging) >= MATCHUP_MIN_GAMES && gamesOf(vsStatic) >= MATCHUP_MIN_GAMES) {
    for (const [rook, weak, strong] of [['ranging', vsRanging, vsStatic], ['static', vsStatic, vsRanging]]) {
      if (rateOf(weak) <= MATCHUP_MAX_RATE && rateOf(strong) - rateOf(weak) >= MATCHUP_GAP) {
        found.push({
          kind: 'matchup', rook,
          title: `${ROOK_NAME[rook]}党と対局`,
          reason: `対${ROOK_NAME[rook]}は${weak.wins}勝${weak.losses}敗。${ROOK_NAME[rook]}を指す相手で慣れよう`,
        });
      }
    }
  }
  // 戦型を記録した対局の数(囲いの記録がある対局)。記録の前の対局や、囲いの分からない対局は数えない。
  const castleTable = state?.usage?.castle ?? {};
  const games = gamesOf(sumTally(castleTable, Object.keys(castleTable)));
  if (games >= WIDEN_MIN_GAMES) {
    const ranging = gamesOf(sumTally(state?.usage?.rook, RANGING_ROOKS));
    const share = ranging / games;
    const rook = share <= 1 - WIDEN_SHARE ? 'ranging' : share >= WIDEN_SHARE ? 'static' : null;
    if (rook) {
      const other = rook === 'ranging' ? 'static' : 'ranging';
      found.push({
        kind: 'widen', rook,
        title: `${ROOK_NAME[rook]}を試そう`,
        reason: `これまでの${games}局は、ほとんど${ROOK_NAME[other]}。作戦カードで${ROOK_NAME[rook]}を指してみよう`,
      });
    }
  }
  return found;
}

/**
 * 復習の1問(ウ)・弱点の練習(エ)。練習のあと対局が2局たっていなければ出さない。弱点は、前の練習と同じ種類を続けない。
 * @returns {{ title: string, reason: string, practice: PracticeStep } | null}
 */
function recommendPractice(state, { insight = null, reviewDueId = null, problemIds = null } = {}) {
  const last = insight?.practice;
  if (last && (state?.games ?? 0) - last.games < PRACTICE_EVERY) return null;
  if (reviewDueId) {
    const reason = isReviewProblemId(reviewDueId) ? '前に逃した詰み、今日は見つけられるかな' : '前に苦労した問題、今日は解けるかな';
    return { title: 'やこび姫からの1問', reason, practice: { kind: 'review', problemId: reviewDueId } };
  }
  for (const weakness of detectWeaknesses(insight?.games ?? [])) {
    if (weakness.kind === last?.kind) continue;
    if (weakness.kind === 'mate' && !(weakness.problemId && problemIds?.has(weakness.problemId))) continue;
    const text = PRACTICE_TEXT[weakness.kind];
    return {
      title: text.title,
      reason: text.reason(weakness.count),
      practice: weakness.problemId ? { kind: weakness.kind, problemId: weakness.problemId } : { kind: weakness.kind },
    };
  }
  // 対局の中身に目立つ弱点がなければ、戦型の癖(苦手な戦型・戦法の偏り)。
  for (const habit of detectHabits(state)) {
    if (habit.kind === last?.kind) continue;
    return { title: habit.title, reason: habit.reason, practice: { kind: habit.kind, rook: habit.rook } };
  }
  return null;
}

/** 次の対局のLvと理由(段階1の見立てに、内容の強さを混ぜる)。insightGamesは対局の中身の記録(理由の1行に使う)。 */
function recommendMatch(state, content, insightGames = [], reward = null) {
  const games = ratedHistory(state);
  const strength = blendedStrength(resultStrength(state), content);
  const base = clampLevel(ratingLevel(strength - TARGET_MARGIN));
  const cap = unbeatenCap(state);
  const normal = (level) => ({
    level, kind: 'normal', title: '対局する', base, cap, handicapLevel: null,
    reason: normalReason(state, games, level, insightGames, reward),
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
    // 15級(Lv1)に勝てないときは、Lv0(練習相手。レーティングに数えない)と飛車落ち(docs/level-ladder-design.mdの3-4)。
    const level = played <= 1 ? 0 : clampLevel(played - 2);
    if (level < played) {
      return {
        level, kind: 'warmup', title: `Lv.${level}で腕ならし`, base, cap, handicapLevel: played, handicapId: handicapForLevel(played),
        reason: level === 0
          ? `Lv.${played}に${losses}連敗。Lv.0で肩ならししよう（レーティングには数えないよ）`
          : `Lv.${played}に${losses}連敗。${played - level}つ下で、勝つ感覚を取り戻そう`,
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

/**
 * 「対局する」の理由の1行(docs/home-next-adaptive-design.mdの13-4)。同じ状態なら同じ文にし、対局が1つ進むと変わるよう、
 * 候補をレーティングの対局の数で選ぶ: 最近5局の成績・前の対局・そのLvとの通算・次の級まで・良い内容・あと少しのご褒美。
 */
export function normalReason(state, games, level, insightGames = [], reward = null) {
  const head = `Lv.${level} ${presetLabel(level)}の相手と。`;
  const recentText = recentRecordText(games);
  if (!games.length) return `${head}振り駒ですぐ始めるよ`;
  const candidates = [`${head}${recentText}`];
  const last = games.at(-1);
  if (last.outcome === 'win') candidates.push(`前の対局はLv.${last.opponentLevel}に勝ち。次はLv.${level}で`);
  else if (last.outcome === 'loss') candidates.push(`前の対局は惜しかったね。Lv.${level}でもう一度`);
  const tally = state?.levels?.[level];
  const played = (tally?.wins ?? 0) + (tally?.losses ?? 0) + (tally?.draws ?? 0);
  if (!played) candidates.push(`Lv.${level}とは初めての対局。どんな相手かな`);
  else if ((tally?.wins ?? 0) > (tally?.losses ?? 0)) candidates.push(`Lv.${level}とは通算${tally.wins}勝${tally.losses}敗。勝ち越しを伸ばそう`);
  else if (!(tally?.wins)) candidates.push(`Lv.${level}とは${played}局指して、まだ勝ちなし。まずは1勝`);
  else candidates.push(`Lv.${level}とは通算${tally.wins}勝${tally.losses}敗。ここで勝ち越そう`);
  const goal = nextRatingGoal(state?.rating);
  if (goal) candidates.push(`${gradeName(goal.label)}まであとR${goal.remaining}。Lv.${level}で一歩ずつ`);
  const good = goodContentLine(insightGames);
  if (good) candidates.push(`${good}その調子でLv.${level}と`);
  // あと少しのご褒美(★・着せ替え。docs/home-next-adaptive-design.mdの15章)。
  if (reward) candidates.push(...nearRewardLines({ level, ...reward }));
  return candidates[(state?.games ?? 0) % candidates.length];
}

/** 良い内容とみなす、1局の測れた手の数の下限と、それまでの平均損失からの下がり方。 */
const GOOD_MIN_MOVES = 15;
const GOOD_IMPROVEMENT = 0.75;
/**
 * いちばん新しい対局の中身が良かったら、その1行(良い手の続き。docs/home-next-adaptive-design.mdの14章)。
 * 大きな悪手がなければ「前の局は大きな悪手なし！」、それまでの平均損失より25%以上少なければ「いつもより損の少ない内容」。
 */
export function goodContentLine(insightGames) {
  const analyzedGames = insightGames.filter((game) => game?.summary);
  const last = analyzedGames.at(-1)?.summary;
  if (!last || last.moves < GOOD_MIN_MOVES) return '';
  if (last.big === 0) return '前の局は大きな悪手なし！ ';
  const before = analyzedGames.slice(-6, -1).map((game) => game.summary);
  const moves = before.reduce((total, summary) => total + summary.moves, 0);
  if (moves < GOOD_MIN_MOVES) return '';
  const mean = before.reduce((total, summary) => total + summary.sum, 0) / moves;
  return last.sum / last.moves <= mean * GOOD_IMPROVEMENT ? '前の局は、いつもより損の少ない内容。' : '';
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
 * 立て直しで勧める駒落ち。15級(Lv1)は飛車落ち、それより上は香落ち(docs/level-ladder-design.mdの3-4)。
 * @param {number} level 連敗したLv
 * @returns {{ id: 'rook' | 'lance', label: string }}
 */
export function handicapForLevel(level) {
  return level <= 1 ? { id: 'rook', label: '飛車落ち' } : { id: 'lance', label: '香落ち' };
}

/**
 * 終局画面の主ボタン(4-2)。平手の通常対局で勝ったら1つ上のLv、立て直しの駒落ち(香落ち・飛車落ち)で勝ったら平手。
 * Lv0(練習相手。レーティングに数えない)に勝ったら15級(Lv1)へ。ほかはnull(今の「もう一局」)。
 * @param {{ won: boolean, rated: boolean, level: number | undefined, lanceHandicap?: boolean, handicapLabel?: string, firstWin: boolean }} game
 * @returns {{ kind: 'up' | 'even' | 'top', level: number, title: string, reason: string, sameTitle: string } | null}
 */
export function resultNextStep({ won, rated, level, lanceHandicap = false, handicapLabel = '', firstWin }) {
  if (!won || !Number.isFinite(level)) return null;
  const handicap = handicapLabel || (lanceHandicap ? '香落ち' : '');
  if (handicap) {
    return { kind: 'even', level, title: `平手でLv.${level}に挑む`, reason: `${handicap}で勝ったね。次は平手で`, sameTitle: `${handicap}でもう一局` };
  }
  if (level === 0) {
    return { kind: 'up', level: 1, title: 'Lv.1に挑戦', reason: `Lv.0に勝ったね。次は${gradeName(presetLabel(1))}のLv.1へ`, sameTitle: '同じLv.0でもう一局' };
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
