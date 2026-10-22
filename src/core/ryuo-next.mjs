// ホームの「つぎはこれ」の、竜王戦の部分(docs/home-next-adaptive-design.mdの13章)。
// 期の途中なら「次の相手の対策」か「続きを指す」、期が終わったら「次の期へ」。文は、期の中の対局の数で言い換える。
// 期の画面の形(describeSeasonのpending)と、小さな数だけを受け取る。画面と保存に依存しない。

import { openingEntry, proOpening } from './opening-usage.mjs';
import { HANANE } from './ryuo-story.mjs';

/** 対策をした次の一局を覚える鍵(期と次の一局の組で1つだけ)。 */
export const RYUO_COUNTER_KEY = 'yacobihime:shogi-match:ryuo-counter:v1';

/**
 * 次の一局を見分ける印。次の一局が替わると、対策は「まだ」に戻る。
 * @param {string} seasonId
 * @param {{ opponentId: string, label?: string } | null | undefined} pending
 */
export function counterKey(seasonId, pending) {
  return pending ? `${seasonId}:${pending.opponentId}:${pending.label ?? ''}` : '';
}

/** 対策をした次の一局の印を読む(なければ空)。 */
export function loadCounterKey(storage) {
  try {
    const value = storage?.getItem(RYUO_COUNTER_KEY);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

/** 対策をした次の一局の印を残す。 */
export function saveCounterKey(storage, key) {
  try {
    storage?.setItem(RYUO_COUNTER_KEY, key);
  } catch {
    // 保存できなくても、対策の対局はできる。
  }
}

/**
 * 対策の練習対局で、相手が指す戦法と囲い。相手の手番での使用率がいちばん高い戦法(本番でいちばん出やすいもの)。
 * 使用率がなければ、相手の得意戦法(style)。
 * @param {any} opponent 棋士の札(describeSeasonのplayerBrief)
 * @param {'black' | 'white'} playerColor プレイヤーの手番
 * @returns {{ style: any, label: string, share: number | null } | null}
 */
export function counterStyle(opponent, playerColor) {
  const usage = opponent?.repertoire?.usage ?? null;
  const side = playerColor === 'black' ? 'white' : 'black';
  const table = usage?.[side] ?? null;
  if (table && Object.keys(table).length) {
    const total = Object.values(table).reduce((sum, value) => sum + value, 0) || 1;
    const [id, weight] = Object.entries(table).sort((a, b) => b[1] - a[1])[0];
    const castles = Object.entries(usage.castles?.[id] ?? {}).sort((a, b) => b[1] - a[1]);
    const style = openingEntry(id, castles[0]?.[0] ?? '');
    if (style) {
      const label = proOpening(id)?.label ?? style.label;
      return { style, label, share: Math.round((weight / total) * 100) };
    }
  }
  return opponent?.style ? { style: opponent.style, label: opponent.style.label ?? '', share: null } : null;
}

/** 名前の後ろの「さん」(羽音・善彦も同じ。プレイヤーから見た呼び方)。 */
const san = (opponent) => `${opponent?.name ?? '相手'}さん`;

/**
 * 竜王戦の「つぎはこれ」。期の途中でなければnull。
 * - main: 'counter'(対策が主役)か'continue'(続きが主役)
 * - continue・counter: それぞれのカードの見出しと1行。subは、主役でない方の小さな入口の文。
 * @param {{
 *   pending: any,
 *   seasonId: string,
 *   gamesPlayed: number,
 *   lastGame?: { win: boolean, opponentId: string } | null,
 *   counterDone?: boolean,
 * }} input
 *   pendingは期の画面の次の一局(describeSeasonのpending)、gamesPlayedは期の中でプレイヤーが指した対局の数
 */
export function ryuoNextPlan({ pending, seasonId, gamesPlayed, lastGame = null, counterDone = false }) {
  if (!pending?.opponent) return null;
  const opponent = pending.opponent;
  const stakes = pending.stakes ?? {};
  const series = pending.kind === 'playoff' || pending.kind === 'finals';
  const lostLast = series && lastGame && lastGame.opponentId === pending.opponentId && !lastGame.win;
  const boss = Boolean(stakes.boss);
  const favorite = counterStyle(opponent, pending.color === 'white' ? 'white' : 'black');
  const colorText = pending.color === 'white' ? '後手' : '先手';
  const favoriteText = favorite?.label ? `得意の${favorite.label}${favorite.share !== null ? `（${favorite.share}%）` : ''}` : '得意の作戦';

  const counterTitle = `${opponent.name}対策`;
  const counterReason = counterDone
    ? `${favoriteText}を、もう一度。記録には残らないよ`
    : `${favoriteText}を、本番と同じ${colorText}で試そう。記録には残らないよ`;

  const winText = stakes.win ? `勝てば${stakes.win}` : '';
  const left = series ? Math.max(0, (pending.need ?? 0) - (pending.wins?.user ?? 0)) : 0;
  /** 続きの1行の候補。山場・羽音戦・対策のあとは、決まった1行を先に使う。 */
  const lines = [];
  if (counterDone) lines.push(`対策はばっちり。本番の${san(opponent)}へ${winText ? `。${winText}` : ''}`);
  else if (opponent.story === HANANE) lines.push(`ライバル・${opponent.name}との一局。${winText || '負けられない'}`);
  else if (boss) lines.push(`山場の一局！ ${winText || `${san(opponent)}との大一番`}`);
  else if (lostLast) lines.push(`前の局は落としたけど、まだ${left}勝あるよ。${san(opponent)}へ`);
  if (!lines.length) {
    const candidates = [
      `${opponent.name} ${opponent.dan}と。${winText || '1局ずつ勝ち上がろう'}`,
      lastGame?.win ? `前の局は勝ち！ この勢いで${san(opponent)}へ` : `${san(opponent)}は${favoriteText}。作戦を立てて挑もう`,
      `${san(opponent)}の${favoriteText}に注意。${winText}`.replace(/。$/, ''),
    ];
    lines.push(candidates[Math.abs(gamesPlayed) % candidates.length]);
  }
  const continueTitle = series ? String(pending.label ?? `第${pending.gameNo}局`) : `竜王戦 ${shortLabel(pending.label)}`;
  const main = !counterDone && (boss || lostLast) ? 'counter' : 'continue';
  return {
    main,
    key: counterKey(seasonId, pending),
    continue: { title: continueTitle, reason: lines[0], sub: `続きを指す（${series ? `第${pending.gameNo}局` : shortLabel(pending.label)}）` },
    counter: { title: counterTitle, reason: counterReason, sub: counterDone ? 'もう一度対策する' : `${opponent.name}さんの対策をする` },
    style: favorite?.style ?? null,
  };
}

/** 次の一局の名前を短く(「6組ランキング戦 準々決勝」→「準々決勝」、番勝負はそのまま)。 */
function shortLabel(label) {
  const text = String(label ?? '');
  const parts = text.split(' ');
  return parts.length > 1 && /ランキング戦|決勝トーナメント|昇級者決定戦|出場者決定戦|敗者復活戦/.test(parts[0]) ? parts.slice(1).join(' ') : text;
}

/**
 * 期が終わったあとの「次の期へ」。直前のレーティングの対局が竜王戦のときだけ出す(竜王戦を遊んでいた流れを続ける)。
 * @param {{ inSeason: boolean, lastRatedEvent?: string, seasons: number, group: number, ryuo?: boolean }} input
 *   seasonsは終えた期の数、groupは次の期の組(竜王ならryuo)
 */
export function ryuoNextSeasonPlan({ inSeason, lastRatedEvent = '', seasons, group, ryuo = false }) {
  if (inSeason || lastRatedEvent !== 'ryuo' || seasons < 1) return null;
  return {
    title: `第${seasons + 1}期 竜王戦へ`,
    reason: ryuo ? '竜王として、防衛戦に挑もう' : `${group}組から、竜王をめざそう`,
  };
}
