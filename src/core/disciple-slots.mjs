// 師匠の1年の記録の枠(弟子の記録を3つまで。docs/disciple-mode-design.mdの27章)。
// 遊んでいる枠の中身は今までどおり`disciple:v1`に置き、ほかの枠は`disciple-slots:v1`にしまう(仕組みはsave-slots.mjs。棋士の1年と同じ)。
// 画面に依存しない。

import { DISCIPLE_RUN_KEY, placeText, turnCalendar } from './disciple-run.mjs';
import { deleteSlotOf, loadSlotIndexOf, slotContents, switchSlotOf } from './save-slots.mjs';

export const DISCIPLE_SLOTS_KEY = 'yacobihime:shogi-match:disciple-slots:v1';
/** 枠の数(棋士の1年と同じ3つ。一覧が1画面に収まる)。 */
export const DISCIPLE_SLOT_COUNT = 3;
const STORE = Object.freeze({ activeKey: DISCIPLE_RUN_KEY, slotsKey: DISCIPLE_SLOTS_KEY, count: DISCIPLE_SLOT_COUNT });

/** 枠の画面の言葉。 */
export const DISCIPLE_SLOT_TEXT = Object.freeze({
  title: '弟子の記録',
  sub: '続きを育てる記録か、新しい弟子を選ぼう',
  slot: (index) => `記録${index + 1}`,
  empty: '新しく弟子をとる',
  emptyNote: '3人の候補から1人を選ぶ',
  playing: 'いま育てている記録',
  ended: '育成を終えた記録',
  delete: '消す',
  deleteAsk: 'この記録を消します。戻せません',
  deleteKeep: 'やめる',
  deleteDo: '消す',
});

/**
 * 枠の札の中身。読めない保存はnull。
 * @param {any} packed
 */
export function discipleSlotSummary(packed) {
  if (!packed || typeof packed !== 'object' || !packed.stats || !packed.name) return null;
  const calendar = turnCalendar(Number(packed.turn) || 0, packed.startGrade);
  return {
    name: String(packed.name),
    discipleId: String(packed.discipleId ?? ''),
    head: `${calendar.label}・${calendar.year}年目`,
    place: placeText(packed),
    end: packed.end ? { rank: String(packed.end.rank ?? ''), text: String(packed.end.text ?? '') } : null,
    skills: Array.isArray(packed.skills) ? packed.skills.length : 0,
  };
}

/**
 * 枠の一覧(画面の札)。
 * @param {Storage | null | undefined} storage
 */
export function discipleSlotCards(storage) {
  return slotContents(storage, STORE).map(({ index, active, packed }) => {
    const summary = discipleSlotSummary(packed);
    return { index, label: DISCIPLE_SLOT_TEXT.slot(index), active, empty: !summary, summary };
  });
}

/** いま遊んでいない枠に、中身の入った記録があるか(あれば入口で記録の一覧を見せる)。 */
export const hasOtherDiscipleSlot = (storage) => discipleSlotCards(storage).some((card) => !card.active && !card.empty);
/** いま遊んでいる枠の番号。 */
export const activeDiscipleSlot = (storage) => loadSlotIndexOf(storage, STORE).active;
/** 枠を替える(遊んでいる記録を目次にしまい、選んだ記録を出す)。 */
export const switchDiscipleSlot = (storage, slot) => switchSlotOf(storage, STORE, slot);
/** 遊んでいない枠を消す。 */
export const deleteDiscipleSlot = (storage, slot) => deleteSlotOf(storage, STORE, slot);
