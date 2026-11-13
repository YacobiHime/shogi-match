// やこびノートの「大会」の棋士の1年の札(docs/pro-year-design.mdの12章)。保存(pro-year:v1)をそのまま読み、
// 1年を組み立て直さずに、いまの年度・今年度の成績・順位戦のクラス・タイトル・これまでの年度を出す(ノートを軽く保つ)。

import { PRO_EVENTS, PRO_USER_ID as USER_ID, PRO_YEAR_KEY, proEvent } from './pro-year.mjs';
import { originText } from './pro-year-origin.mjs';

const EVENT_BY_NAME = Object.fromEntries(PRO_EVENTS.map((event) => [event.id, event.name]));

export const PRO_YEAR_NOTE_KEY = PRO_YEAR_KEY;
const CLASS_NAMES = Object.freeze({ A: 'A級', B1: 'B級1組', B2: 'B級2組', C1: 'C級1組', C2: 'C級2組' });

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八'];
/** タイトルの格の順(竜王・名人・王位・王座・棋王・王将・叡王・棋聖)。 */
export const TITLE_ORDER = Object.freeze(['ryuo', 'meijin', 'oi', 'oza', 'kio', 'osho', 'eio', 'kisei']);

/**
 * 棋戦の名前の並び(タイトルは格の順、ほかは見つけた順)と回数。
 * @param {Record<string, number>} counts
 */
function countRows(counts) {
  return Object.entries(counts ?? {})
    .filter(([, count]) => Number(count) > 0)
    .sort(([a], [b]) => (TITLE_ORDER.indexOf(a) + 1 || 99) - (TITLE_ORDER.indexOf(b) + 1 || 99))
    .map(([id, count]) => ({ id, name: proEvent(id)?.name ?? id, short: proEvent(id)?.short ?? id, count: Number(count) }));
}

/** 「三冠」のような冠の数(2以上)。 */
export const crownName = (count) => (count >= 2 && count < NUMERALS.length ? `${NUMERALS[count]}冠` : count >= 2 ? `${count}冠` : '');

/**
 * 保存の中身から札の形を作る。棋士の1年を始めていなければnull。
 * 17章: 段位・通算成績・いま持っているタイトル(冠の数)・タイトルの通算期数・棋戦優勝・将棋大賞を足す。
 * @param {any} packed
 */
export function proYearNote(packed) {
  if (!packed || packed.version !== 1 || !Number.isFinite(packed.fy)) return null;
  let wins = 0;
  let losses = 0;
  for (const row of Array.isArray(packed.games) ? packed.games : []) {
    // [番号, 期, 段階, 回戦, 先, 後, 日, 勝ち, 印, ...]。印の1は自分の対局。
    if (!Array.isArray(row) || !(row[8] & 1) || !row[7]) continue;
    if (String(row[6] ?? '') < `${packed.fy}-04-01`) continue;
    const winner = row[7] === 1 ? row[4] : row[5];
    if (winner === USER_ID) wins += 1;
    else losses += 1;
  }
  const holding = TITLE_ORDER.filter((id) => packed.titles?.[id] === USER_ID);
  const titles = holding.map((id) => proEvent(id)?.short ?? id);
  const history = (Array.isArray(packed.history) ? packed.history : []).filter(Boolean).map((entry) => ({
    fy: entry.fy, wins: entry.wins ?? 0, losses: entry.losses ?? 0, titles: entry.titles ?? [], awards: entry.awards ?? [],
    champions: Array.isArray(entry.champions) ? entry.champions : [], dan: entry.dan ?? '',
    // 年度の途中にデビューした半年の年度(18章)。「10月から」。
    since: entry.half && typeof entry.debut === 'string' ? `${Number(entry.debut.slice(5, 7))}月から` : '',
  })).reverse();
  // 通算(終えた年度と今年度)。
  const total = history.reduce((sum, entry) => ({ wins: sum.wins + entry.wins, losses: sum.losses + entry.losses }), { wins, losses });
  // タイトルの通算期数と棋戦優勝(前の保存で回数を持たないときは、年度のまとめの名前から数える)。
  const titleRows = countRows(packed.user?.titleCounts);
  let cupCounts = packed.user?.cupCounts;
  if (!cupCounts) {
    cupCounts = {};
    for (const entry of history) {
      for (const name of entry.champions) {
        const id = Object.keys(EVENT_BY_NAME).find((key) => EVENT_BY_NAME[key] === name) ?? name;
        cupCounts[id] = (cupCounts[id] ?? 0) + 1;
      }
    }
  }
  const cupRows = countRows(cupCounts);
  const awards = history.reduce((sum, entry) => sum + entry.awards.length, 0);
  const user = packed.players?.[USER_ID];
  return {
    fy: packed.fy,
    wins,
    losses,
    total,
    dan: typeof user?.d === 'string' ? user.d : '',
    cls: CLASS_NAMES[packed.user?.cls] ?? '',
    titles,
    crown: crownName(holding.length),
    titleRows,
    cupRows,
    awards,
    history,
    money: Number(packed.user?.money) || 0,
    // 奨励会から四段になってデビューした道(18章。「奨励会から（棋士番号第347号）・10月1日デビュー」)。
    origin: packed.origin ? originText(packed.origin)?.noteLine ?? '' : '',
  };
}

/**
 * 棋士の1年の結果を、やこびノートの「所属と称号」の称号にする(17章)。同じidは上書き(player-profile.mjsのgrantTitle)。
 * タイトルは1つずつ(通算期数を説明に)、同時に2つ以上持ったら「棋士の1年 ○冠」、棋戦優勝は1つずつ。
 * 竜王戦・名人戦の大会の「竜王」「名人」と見分けるため、名前の頭に「棋士の1年」を付ける。
 * @param {any} state 棋士の1年の状態(pro-year.mjs)
 * @returns {{ id: string, label: string, detail: string, rank: number }[]}
 */
export function proYearProfileTitles(state) {
  if (!state?.user) return [];
  const result = [];
  for (const row of countRows(state.user.titleCounts)) {
    result.push({ id: `pro-title-${row.id}`, label: `棋士の1年 ${row.short}`, detail: `棋士の1年で${row.name}を獲得（通算${row.count}期）`, rank: 20 });
  }
  const holding = TITLE_ORDER.filter((id) => state.titles?.[id] === USER_ID).length;
  const best = Math.max(holding, Number(state.user.bestCrowns) || 0);
  if (best >= 2) result.push({ id: 'pro-crowns', label: `棋士の1年 ${crownName(best)}`, detail: `棋士の1年で、タイトルを同時に${best}つ持った`, rank: 20 + best });
  for (const row of countRows(state.user.cupCounts)) {
    result.push({ id: `pro-cup-${row.id}`, label: `${row.name}優勝`, detail: `棋士の1年で${row.name}に優勝（通算${row.count}回）`, rank: 9 });
  }
  return result;
}

/** localStorageから読む(読めなければnull)。 */
export function loadProYearNote(storage) {
  try {
    return proYearNote(JSON.parse(storage?.getItem(PRO_YEAR_NOTE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}
