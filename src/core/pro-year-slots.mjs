// 棋士の1年の記録の枠(セーブデータを3つまで。docs/pro-year-design.mdの37章)。
// 遊んでいる枠の中身は今までどおり`pro-year:v1`に置き(やこびノート・引き継ぎ・データリセットはそのまま読む)、
// ほかの枠は`pro-year-slots:v1`にしまう。枠を替えるときは、2つの鍵の中身を入れ替えるだけ(読み直しや組み立て直しはしない)。
// 画面に依存しない。保存の文字列をそのまま運ぶ。

import { PRO_YEAR_KEY } from './pro-year.mjs';
import { proYearNote, proYearProfileTitles } from './pro-year-note.mjs';

export const PRO_YEAR_SLOTS_KEY = 'yacobihime:shogi-match:pro-year-slots:v1';
/** 枠の数。3つなら一覧が1画面に収まり、選ぶのに迷わない(37-2)。 */
export const PRO_YEAR_SLOT_COUNT = 3;

/** 枠の画面の言葉。 */
export const PRO_YEAR_SLOT_TEXT = Object.freeze({
  title: '棋士人生の記録',
  sub: '続ける記録か、新しいデビューを選ぼう',
  slot: (index) => `記録${index + 1}`,
  empty: '新しくデビュー',
  emptyNote: '新四段として、はじめから',
  playing: 'いま遊んでいる記録',
  suspended: '中断した対局あり',
  locked: '中断した対局を指し終えてから、ほかの記録を開けるよ',
  delete: '消す',
  deleteTitle: (index) => `記録${index + 1}を消します。`,
  deleteNote: '消した記録は戻せません。賞状帳の賞状と、所属と称号は残ります。',
  deleteKeep: 'やめる',
  deleteDo: '消す',
  hanane: 'どの記録の続きを指すの。別の道を試すなら、空いた枠からデビューすればいい',
});

/**
 * 枠の目次を読む。目次がない前の保存は、今の`pro-year:v1`を記録1にする。
 * slots[active]はいつもnull(中身は`pro-year:v1`にある)。
 * @param {Storage | null | undefined} storage
 * @returns {{ version: 1, active: number, slots: (string | null)[] }}
 */
export function loadSlotIndex(storage) {
  const empty = { version: /** @type {const} */ (1), active: 0, slots: Array.from({ length: PRO_YEAR_SLOT_COUNT }, () => null) };
  try {
    const parsed = JSON.parse(storage?.getItem(PRO_YEAR_SLOTS_KEY) ?? 'null');
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.slots)) return empty;
    const active = Number.isInteger(parsed.active) && parsed.active >= 0 && parsed.active < PRO_YEAR_SLOT_COUNT ? parsed.active : 0;
    const slots = empty.slots.map((_, index) => (index !== active && typeof parsed.slots[index] === 'string' ? parsed.slots[index] : null));
    return { version: 1, active, slots };
  } catch {
    return empty;
  }
}

/** @param {Storage | null | undefined} storage @param {{ active: number, slots: (string | null)[] }} index */
function saveSlotIndex(storage, index) {
  // 使ったことのない人(枠が記録1だけ)は目次を書かない(鍵を増やさない)。
  if (index.active === 0 && index.slots.every((slot) => !slot)) {
    storage?.removeItem(PRO_YEAR_SLOTS_KEY);
    return;
  }
  storage?.setItem(PRO_YEAR_SLOTS_KEY, JSON.stringify({ version: 1, active: index.active, slots: index.slots }));
}

/** @param {string | null} text */
function parsePacked(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * 枠の札の中身(保存を組み立て直さず、やこびノートと同じ`proYearNote`で読む)。
 * @param {any} packed
 */
export function slotSummary(packed) {
  const note = proYearNote(packed);
  if (!note) return null;
  const lines = [
    [`${note.fy}年度`, note.dan, note.cls].filter(Boolean).join('・'),
    `通算${note.total.wins}勝${note.total.losses}敗`,
  ];
  const titleLine = note.crown ? `${note.crown}（${note.titles.join('・')}）` : note.titles.length ? note.titles.join('・') : '';
  const totals = note.titleRows.reduce((sum, row) => sum + row.count, 0);
  return {
    head: lines[0],
    record: lines[1],
    titles: titleLine,
    career: totals ? `タイトル通算${totals}期` : note.cupRows.length ? `棋戦優勝${note.cupRows.reduce((sum, row) => sum + row.count, 0)}回` : '',
    date: typeof packed.date === 'string' ? packed.date : '',
    yearDone: Boolean(packed.yearDone),
  };
}

/**
 * 枠の一覧(画面の札)。
 * @param {Storage | null | undefined} storage
 * @param {{ suspended?: boolean }} [options] suspended: 遊んでいる枠に中断した対局がある(ほかの枠は開けない)
 */
export function slotCards(storage, { suspended = false } = {}) {
  const index = loadSlotIndex(storage);
  let activeText = null;
  try {
    activeText = storage?.getItem(PRO_YEAR_KEY) ?? null;
  } catch {
    activeText = null;
  }
  return index.slots.map((text, slot) => {
    const active = slot === index.active;
    const summary = slotSummary(parsePacked(active ? activeText : text));
    return {
      index: slot,
      label: PRO_YEAR_SLOT_TEXT.slot(slot),
      active,
      empty: !summary,
      summary,
      suspended: active && suspended && Boolean(summary),
      locked: !active && suspended,
    };
  });
}

/** 中身の入った枠があるか(なければ、入口からすぐデビューの画面へ)。 */
export function hasSavedSlot(storage) {
  return slotCards(storage).some((card) => !card.empty);
}

/**
 * 枠を替える。今の`pro-year:v1`を目次にしまい、選んだ枠の中身を`pro-year:v1`へ出す(空の枠なら消す)。
 * 同じ枠なら何もしない。
 * @param {Storage | null | undefined} storage
 * @param {number} slot
 * @returns {boolean} 替えたか
 */
export function switchSlot(storage, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PRO_YEAR_SLOT_COUNT) return false;
  const index = loadSlotIndex(storage);
  if (slot === index.active) return false;
  try {
    const current = storage?.getItem(PRO_YEAR_KEY) ?? null;
    const target = index.slots[slot];
    const slots = [...index.slots];
    slots[index.active] = current && parsePacked(current) ? current : null;
    slots[slot] = null;
    // 先に目次を書く(途中で止まっても、しまった記録が消えない)。
    saveSlotIndex(storage, { active: slot, slots });
    if (target) storage?.setItem(PRO_YEAR_KEY, target);
    else storage?.removeItem(PRO_YEAR_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * 遊んでいない枠を消す(遊んでいる枠は、呼ぶ側が状態をnullにして消す)。
 * @param {Storage | null | undefined} storage
 * @param {number} slot
 */
export function deleteSlot(storage, slot) {
  const index = loadSlotIndex(storage);
  if (slot === index.active || !index.slots[slot]) return false;
  const slots = [...index.slots];
  slots[slot] = null;
  try {
    saveSlotIndex(storage, { active: index.active, slots });
    return true;
  } catch {
    return false;
  }
}

/**
 * 遊んでいない枠の称号(所属と称号は、どの記録で取ったものも残す。37-3)。
 * @param {Storage | null | undefined} storage
 */
export function otherSlotTitles(storage) {
  return loadSlotIndex(storage).slots.flatMap((text) => proYearProfileTitles(parsePacked(text)));
}

/**
 * 同じidの称号が何枠にもあるとき、いちばん上のものを選ぶ(格が上、同じ格なら回数`weight`が多いほう)。
 * @param {{ id: string, rank: number, weight?: number }[]} titles
 */
export function bestTitles(titles) {
  /** @type {Map<string, any>} */
  const best = new Map();
  for (const title of titles) {
    const current = best.get(title.id);
    if (!current || title.rank > current.rank || (title.rank === current.rank && (title.weight ?? 0) > (current.weight ?? 0))) best.set(title.id, title);
  }
  return [...best.values()];
}
