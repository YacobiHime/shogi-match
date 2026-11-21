// 棋士の1年の記録の枠(セーブデータを3つまで。docs/pro-year-design.mdの37章)。
// 遊んでいる枠の中身は今までどおり`pro-year:v1`に置き(やこびノート・引き継ぎ・データリセットはそのまま読む)、
// ほかの枠は`pro-year-slots:v1`にしまう。枠を替えるときは、2つの鍵の中身を入れ替えるだけ(読み直しや組み立て直しはしない。共通の仕組みはsave-slots.mjs)。
// 画面に依存しない。保存の文字列をそのまま運ぶ。

import { PRO_YEAR_KEY } from './pro-year.mjs';
import { proYearNote, proYearProfileTitles } from './pro-year-note.mjs';
import { deleteSlotOf, loadSlotIndexOf, parsePacked, slotContents, switchSlotOf } from './save-slots.mjs';

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

/** 記録の枠の鍵(共通の仕組みsave-slots.mjsに渡す)。 */
const STORE = Object.freeze({ activeKey: PRO_YEAR_KEY, slotsKey: PRO_YEAR_SLOTS_KEY, count: PRO_YEAR_SLOT_COUNT });

/**
 * 枠の目次を読む。目次がない前の保存は、今の`pro-year:v1`を記録1にする。
 * slots[active]はいつもnull(中身は`pro-year:v1`にある)。
 * @param {Storage | null | undefined} storage
 * @returns {{ version: 1, active: number, slots: (string | null)[] }}
 */
export const loadSlotIndex = (storage) => loadSlotIndexOf(storage, STORE);

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
  return slotContents(storage, STORE).map(({ index: slot, active, packed }) => {
    const summary = slotSummary(packed);
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
export const switchSlot = (storage, slot) => switchSlotOf(storage, STORE, slot);

/**
 * 遊んでいない枠を消す(遊んでいる枠は、呼ぶ側が状態をnullにして消す)。
 * @param {Storage | null | undefined} storage
 * @param {number} slot
 */
export const deleteSlot = (storage, slot) => deleteSlotOf(storage, STORE, slot);

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
