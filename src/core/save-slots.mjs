// 記録の枠(セーブデータを何枠か持つ)の共通の仕組み。棋士の1年(docs/pro-year-design.mdの37章)と師匠の1年(docs/disciple-mode-design.mdの27章)で使う。
// 遊んでいる枠の中身はそのモードの保存の鍵(activeKey)に置いたまま、ほかの枠は目次の鍵(slotsKey)にしまう。
// 枠を替えるときは、2つの鍵の中身を入れ替えるだけ(保存の文字列をそのまま運び、組み立て直さない)。画面に依存しない。

/**
 * @typedef {{ activeKey: string, slotsKey: string, count: number }} SlotStore
 * @typedef {{ version: 1, active: number, slots: (string | null)[] }} SlotIndex
 */

/**
 * 枠の目次を読む。目次がない前の保存は、遊んでいる鍵の中身を枠1にする。slots[active]はいつもnull。
 * @param {Storage | null | undefined} storage
 * @param {SlotStore} store
 * @returns {SlotIndex}
 */
export function loadSlotIndexOf(storage, store) {
  const empty = { version: /** @type {const} */ (1), active: 0, slots: Array.from({ length: store.count }, () => null) };
  try {
    const parsed = JSON.parse(storage?.getItem(store.slotsKey) ?? 'null');
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.slots)) return empty;
    const active = Number.isInteger(parsed.active) && parsed.active >= 0 && parsed.active < store.count ? parsed.active : 0;
    const slots = empty.slots.map((_, index) => (index !== active && typeof parsed.slots[index] === 'string' ? parsed.slots[index] : null));
    return { version: 1, active, slots };
  } catch {
    return empty;
  }
}

/**
 * 目次を書く。使ったことのない人(枠1だけ)は書かない(鍵を増やさない)。
 * @param {Storage | null | undefined} storage
 * @param {SlotStore} store
 * @param {{ active: number, slots: (string | null)[] }} index
 */
export function saveSlotIndexOf(storage, store, index) {
  if (index.active === 0 && index.slots.every((slot) => !slot)) {
    storage?.removeItem(store.slotsKey);
    return;
  }
  storage?.setItem(store.slotsKey, JSON.stringify({ version: 1, active: index.active, slots: index.slots }));
}

/** 保存の文字列を読む(読めなければnull)。 @param {string | null} text */
export function parsePacked(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * 枠ごとの保存の中身(遊んでいる枠は遊んでいる鍵から)。
 * @param {Storage | null | undefined} storage
 * @param {SlotStore} store
 * @returns {{ index: number, active: boolean, packed: any }[]}
 */
export function slotContents(storage, store) {
  const index = loadSlotIndexOf(storage, store);
  let activeText = null;
  try {
    activeText = storage?.getItem(store.activeKey) ?? null;
  } catch {
    activeText = null;
  }
  return index.slots.map((text, slot) => ({ index: slot, active: slot === index.active, packed: parsePacked(slot === index.active ? activeText : text) }));
}

/**
 * 枠を替える。遊んでいる鍵の中身を目次にしまい、選んだ枠の中身を遊んでいる鍵へ出す(空の枠なら消す)。同じ枠なら何もしない。
 * @param {Storage | null | undefined} storage
 * @param {SlotStore} store
 * @param {number} slot
 * @returns {boolean} 替えたか
 */
export function switchSlotOf(storage, store, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= store.count) return false;
  const index = loadSlotIndexOf(storage, store);
  if (slot === index.active) return false;
  try {
    const current = storage?.getItem(store.activeKey) ?? null;
    const target = index.slots[slot];
    const slots = [...index.slots];
    slots[index.active] = current && parsePacked(current) ? current : null;
    slots[slot] = null;
    // 先に目次を書く(途中で止まっても、しまった記録が消えない)。
    saveSlotIndexOf(storage, store, { active: slot, slots });
    if (target) storage?.setItem(store.activeKey, target);
    else storage?.removeItem(store.activeKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * 遊んでいない枠を消す(遊んでいる枠は、呼ぶ側が状態を消す)。
 * @param {Storage | null | undefined} storage
 * @param {SlotStore} store
 * @param {number} slot
 */
export function deleteSlotOf(storage, store, slot) {
  const index = loadSlotIndexOf(storage, store);
  if (slot === index.active || !index.slots[slot]) return false;
  const slots = [...index.slots];
  slots[slot] = null;
  try {
    saveSlotIndexOf(storage, store, { active: index.active, slots });
    return true;
  } catch {
    return false;
  }
}
