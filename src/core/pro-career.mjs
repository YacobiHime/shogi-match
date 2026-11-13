// 棋士の1年の「何期も続く棋士人生」(docs/pro-year-design.mdの15-3の5・7)。画面に依存しない。
// 昇段は名簿と同じ決まり(ryuo-league.mjsのapplyDanRules・勝数規定)。棋士の歩みは年度ごとの1行と通算。

import { DAN_ORDER, WINS_TO_PROMOTE } from './ryuo-league.mjs';

const JUNNI_DAN = Object.freeze({ C1: '五段', B2: '六段', B1: '七段', A: '八段' });
const higher = (a, b) => (DAN_ORDER.indexOf(b) > DAN_ORDER.indexOf(a) ? b : a);

/**
 * 実績から決まる段位(下げない)。名簿の`applyDanRules`と同じ決まりに、勝数規定を足す。
 * @param {{ dan?: string, group?: number, cls?: string | null, titles?: Record<string, number>, sinceWins?: number }} input
 * @returns {string}
 */
export function danFor({ dan = '四段', group = 6, cls = null, titles = {}, sinceWins = 0 }) {
  let next = DAN_ORDER.includes(dan) ? dan : '四段';
  const total = Object.values(titles ?? {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const ryuo = titles?.ryuo ?? 0;
  if (group <= 2) next = higher(next, '六段');
  if (group === 1) next = higher(next, '七段');
  if (cls && JUNNI_DAN[cls]) next = higher(next, JUNNI_DAN[cls]);
  if (total >= 1) next = higher(next, '七段');
  if (total >= 2 || ryuo >= 1) next = higher(next, '八段');
  if (total >= 3 || ryuo >= 2 || (titles?.meijin ?? 0) >= 1) next = higher(next, '九段');
  // 勝数規定(前の昇段からの勝ち数)。1度に1段だけ。
  const need = WINS_TO_PROMOTE[next];
  if (need && next === (DAN_ORDER.includes(dan) ? dan : '四段') && sinceWins >= need) next = DAN_ORDER[DAN_ORDER.indexOf(next) + 1];
  return next;
}

/**
 * 次の昇段の見込み(成績のタブ・自分の札)。九段ならnull。
 * @param {{ dan?: string, group?: number, cls?: string | null, sinceWins?: number }} input
 */
export function nextDanHint({ dan = '四段', group = 6, cls = null, sinceWins = 0 }) {
  const index = DAN_ORDER.indexOf(dan);
  if (index < 0 || index >= DAN_ORDER.length - 1) return null;
  const target = DAN_ORDER[index + 1];
  const ways = [];
  const clsFor = Object.entries(JUNNI_DAN).find(([, value]) => value === target)?.[0];
  const CLASS = { C1: 'C級1組', B2: 'B級2組', B1: 'B級1組', A: 'A級' };
  if (clsFor && clsFor !== cls) ways.push(`${CLASS[clsFor]}へ昇級`);
  if (target === '六段' && group > 2) ways.push('竜王戦 2組へ');
  if (target === '七段' && group > 1) ways.push('竜王戦 1組へ');
  if (['七段', '八段', '九段'].includes(target)) ways.push(target === '七段' ? 'タイトル1期' : target === '八段' ? 'タイトル2期' : 'タイトル3期');
  const need = WINS_TO_PROMOTE[dan];
  const left = need ? Math.max(0, need - sinceWins) : null;
  return { dan: target, ways, winsLeft: left, text: [...ways.slice(0, 2), left !== null ? `勝数規定 あと${left}勝` : ''].filter(Boolean).join('・') };
}

/** 竜王戦の組の昇級(ランキング戦で決勝に進めば1つ上へ。簡略の決まり)。 */
export const ryuoGroupAfter = (group, reachedFinal) => (reachedFinal ? Math.max(1, group - 1) : group);

/**
 * 棋士の歩み(年度ごとの行と通算)。
 * @param {any[]} history 年度のまとめ(古い順)
 * @param {any} [current] 今の年度の途中の行
 */
export function careerRoad(history, current = null) {
  const rows = [...(history ?? []), ...(current ? [{ ...current, now: true }] : [])].map((item) => ({
    fy: item.fy,
    now: Boolean(item.now),
    dan: item.danUp ? `${item.danUp.from} → ${item.danUp.to}` : item.dan ?? '',
    wins: item.wins ?? 0,
    losses: item.losses ?? 0,
    cls: item.clsText ?? '',
    group: item.group ? `${item.group}組${item.groupUp ? ' 昇級' : ''}` : '',
    honors: [...(item.titles ?? []), ...(item.champions ?? [])].join('・'),
    headline: item.headlines?.[0]?.headline ?? '',
    // 年度の途中にデビューした半年の年度(docs/pro-year-design.mdの18章)。「10月から」と添える。
    half: Boolean(item.half),
    since: item.half && typeof item.debut === 'string' ? `${Number(item.debut.slice(5, 7))}月から` : '',
  }));
  const done = rows.filter((row) => row.fy !== undefined);
  const wins = done.reduce((sum, row) => sum + row.wins, 0);
  const losses = done.reduce((sum, row) => sum + row.losses, 0);
  const titles = [...(history ?? []), ...(current ? [current] : [])].reduce((sum, item) => sum + (item.titles?.length ?? 0), 0);
  const champions = [...(history ?? []), ...(current ? [current] : [])].flatMap((item) => (item.champions ?? []).map((name) => `${name}（${item.fy}年度）`));
  return { rows, total: { wins, losses, rate: wins + losses ? wins / (wins + losses) : 0, titles, champions } };
}
