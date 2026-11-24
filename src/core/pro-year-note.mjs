// やこびノートの「大会」の棋士の1年の札(docs/pro-year-design.mdの12章)。保存(pro-year:v1)をそのまま読み、
// 1年を組み立て直さずに、いまの年度・今年度の成績・順位戦のクラス・タイトル・これまでの年度を出す(ノートを軽く保つ)。

import { PRO_EVENTS, PRO_USER_ID as USER_ID, PRO_YEAR_KEY, proEvent } from './pro-year.mjs';
import { originText } from './pro-year-origin.mjs';
import { ETERNAL_RULES } from './pro-title.mjs';

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

/**
 * 永世称号の呼び名。名人は「二十世名人」と呼ぶ(実在の永世名人は十九世まで。docs/pro-year-design.mdの39章)。
 * @param {string} id
 */
export const eternalLabel = (id) => (id === 'meijin' ? '二十世名人' : ETERNAL_RULES[/** @type {keyof typeof ETERNAL_RULES} */ (id)]?.name ?? '');

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
 * weightは同じidを記録の枠どうしで比べる回数(37-3)。
 * @returns {{ id: string, label: string, detail: string, rank: number, weight: number }[]}
 */
export function proYearProfileTitles(state) {
  if (!state?.user) return [];
  const result = [];
  // 称号の名前は「竜王」「永世竜王」のように短く(ノートには棋士の1年の称号だけを並べる。39章)。
  // 防衛の数・連覇・永世称号は説明に(19章)。永世称号は1つずつ称号に。
  for (const row of countRows(state.user.titleCounts)) {
    const record = state.user.titleRecord?.[row.id] ?? null;
    const holding = state.titles?.[row.id] === USER_ID;
    const extra = [
      record?.defenses ? `防衛${record.defenses}回` : '',
      holding && (record?.streak ?? 0) >= 2 ? `${record.streak}連覇中` : (record?.best ?? 0) >= 2 ? `最長${record.best}連覇` : '',
    ].filter(Boolean).join('・');
    result.push({ id: `pro-title-${row.id}`, label: row.short, detail: `棋士の1年で${row.name}・通算${row.count}期${extra ? `（${extra}）` : ''}`, rank: 20, weight: row.count });
    const eternal = ETERNAL_RULES[/** @type {keyof typeof ETERNAL_RULES} */ (row.id)];
    if (record?.eternal && eternal) {
      const label = eternalLabel(row.id);
      const named = label === eternal.name ? '' : `（${label}）`;
      result.push({ id: `pro-eternal-${row.id}`, label, detail: `棋士の1年で${eternal.name}${named}の資格を得た（${record.eternal}年度）`, rank: 30, weight: 1 });
    }
  }
  // 8つすべての永世称号(pro-milestones.mjsの永世八冠と同じ)。
  if (TITLE_ORDER.every((id) => state.user.titleRecord?.[id]?.eternal)) {
    result.push({ id: 'pro-eternal-all', label: '永世八冠', detail: '棋士の1年で、8つのタイトルすべての永世称号の資格を得た', rank: 40, weight: 8 });
  }
  const holding = TITLE_ORDER.filter((id) => state.titles?.[id] === USER_ID).length;
  const best = Math.max(holding, Number(state.user.bestCrowns) || 0);
  if (best >= 2) result.push({ id: 'pro-crowns', label: crownName(best), detail: `棋士の1年で、タイトルを同時に${best}つ持った`, rank: 20 + best, weight: best });
  for (const row of countRows(state.user.cupCounts)) {
    result.push({ id: `pro-cup-${row.id}`, label: `${row.name}優勝`, detail: `棋士の1年で${row.name}に優勝（通算${row.count}回）`, rank: 9, weight: row.count });
  }
  return result;
}

/** 称号のidのタイトルの格の順(タイトルでなければ後ろ)。 */
function titleOrderOf(id) {
  const index = TITLE_ORDER.findIndex((title) => id.endsWith(`-${title}`));
  return index < 0 ? 99 : index;
}

/**
 * やこびノートに並べる称号(棋士の1年のものだけ。docs/pro-year-design.mdの39章)。
 * どの記録の枠の称号も合わせたもの(pro-year-slots.mjsのbestTitles)を受け取り、永世称号の資格を得たタイトルは
 * 「竜王」を消して「永世竜王」だけにする。高い称号から、同じ高さならタイトルの格の順。
 * @param {{ id: string, label: string, detail?: string, rank: number, weight?: number }[]} titles
 */
export function noteTitleBadges(titles) {
  const eternal = new Set(titles.filter((title) => title.id.startsWith('pro-eternal-')).map((title) => title.id.slice('pro-eternal-'.length)));
  return titles
    .filter((title) => !(title.id.startsWith('pro-title-') && eternal.has(title.id.slice('pro-title-'.length))))
    .sort((a, b) => b.rank - a.rank || titleOrderOf(a.id) - titleOrderOf(b.id) || (b.weight ?? 0) - (a.weight ?? 0));
}

/**
 * 代表の称号の候補(39章)。ノートの称号に、いま同時に持っているタイトルの組を足す。
 * 竜王と名人を持っていれば「竜王・名人」、2つか3つ持っていれば「竜王・王位・棋聖」のような組。4つ以上は○冠で呼ぶ。
 * @param {ReturnType<typeof noteTitleBadges>} badges
 * @param {any} state いま遊んでいる記録の枠(pro-year:v1)
 */
export function featuredChoices(badges, state) {
  const holding = TITLE_ORDER.filter((id) => state?.titles?.[id] === USER_ID);
  const combos = [];
  if (holding.includes('ryuo') && holding.includes('meijin')) combos.push(['ryuo', 'meijin']);
  if (holding.length >= 2 && holding.length <= 3 && !(holding.length === 2 && combos.length)) combos.push(holding);
  const extra = combos.map((ids) => ({
    id: `pro-combo-${ids.join('-')}`,
    label: ids.map((id) => proEvent(id)?.short ?? id).join('・'),
    detail: 'いま同時に持っているタイトル',
    rank: 20 + ids.length,
    weight: ids.length,
  }));
  return [...badges, ...extra];
}

/**
 * 代表の称号。選んだものがなければ(失冠して組がなくなったときなど)、いちばん高い称号。
 * @param {ReturnType<typeof featuredChoices>} choices
 * @param {string} featuredId
 */
export function featuredTitle(choices, featuredId) {
  return choices.find((choice) => choice.id === featuredId) ?? choices[0] ?? null;
}

/** localStorageから読む(読めなければnull)。 */
export function loadProYearNote(storage) {
  try {
    return proYearNote(JSON.parse(storage?.getItem(PRO_YEAR_NOTE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}
