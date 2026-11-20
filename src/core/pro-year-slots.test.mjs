import { describe, expect, it } from 'vitest';
import { PRO_YEAR_KEY, createProYear, loadProYear, saveProYear } from './pro-year.mjs';
import { proYearProfileTitles } from './pro-year-note.mjs';
import { createRoster } from './ryuo-roster.mjs';
import {
  PRO_YEAR_SLOTS_KEY, PRO_YEAR_SLOT_COUNT, bestTitles, deleteSlot, hasSavedSlot, loadSlotIndex, otherSlotTitles, slotCards, switchSlot,
} from './pro-year-slots.mjs';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
  };
}
const roster = createRoster({ seed: 3 });
const year = (seed, fiscalYear = 2026) => createProYear({ seed, fiscalYear, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

describe('棋士の1年の記録の枠(37章)', () => {
  it('前の保存は記録1として読み、使っていなければ目次の鍵を作らない', () => {
    const storage = memoryStorage();
    saveProYear(storage, year(1));
    const cards = slotCards(storage);
    expect(cards).toHaveLength(PRO_YEAR_SLOT_COUNT);
    expect(cards[0]).toMatchObject({ active: true, empty: false });
    expect(cards[0].summary.head).toContain('2026年度');
    expect(cards.slice(1).every((card) => card.empty)).toBe(true);
    expect(hasSavedSlot(storage)).toBe(true);
    expect(storage.getItem(PRO_YEAR_SLOTS_KEY)).toBeNull();
  });

  it('空の枠へ替えると今の記録をしまい、戻すと同じ中身が出る', () => {
    const storage = memoryStorage();
    const first = year(1);
    saveProYear(storage, first);
    const before = storage.getItem(PRO_YEAR_KEY);
    expect(switchSlot(storage, 1)).toBe(true);
    expect(storage.getItem(PRO_YEAR_KEY)).toBeNull();
    expect(loadSlotIndex(storage).active).toBe(1);
    // 新しい枠でデビューする。
    saveProYear(storage, year(2, 2030));
    const cards = slotCards(storage);
    expect(cards[0]).toMatchObject({ active: false, empty: false });
    expect(cards[1]).toMatchObject({ active: true, empty: false });
    expect(cards[1].summary.head).toContain('2030年度');
    // 記録1へ戻す。
    expect(switchSlot(storage, 0)).toBe(true);
    expect(storage.getItem(PRO_YEAR_KEY)).toBe(before);
    expect(loadProYear(storage, roster)?.seed).toBe(1);
    expect(slotCards(storage)[1].summary.head).toContain('2030年度');
    // 同じ枠・範囲の外は何もしない。
    expect(switchSlot(storage, 0)).toBe(false);
    expect(switchSlot(storage, PRO_YEAR_SLOT_COUNT)).toBe(false);
  });

  it('遊んでいない枠だけ消せ、記録1だけに戻れば目次の鍵も消える', () => {
    const storage = memoryStorage();
    saveProYear(storage, year(1));
    switchSlot(storage, 2);
    saveProYear(storage, year(2));
    switchSlot(storage, 0);
    expect(deleteSlot(storage, 0)).toBe(false);
    expect(deleteSlot(storage, 2)).toBe(true);
    expect(slotCards(storage)[2].empty).toBe(true);
    expect(storage.getItem(PRO_YEAR_SLOTS_KEY)).toBeNull();
  });

  it('中断した対局があると、ほかの枠は開けない印になる', () => {
    const storage = memoryStorage();
    saveProYear(storage, year(1));
    const cards = slotCards(storage, { suspended: true });
    expect(cards[0]).toMatchObject({ suspended: true, locked: false });
    expect(cards[1]).toMatchObject({ locked: true });
  });

  it('壊れた目次でも遊べる', () => {
    const storage = memoryStorage();
    storage.setItem(PRO_YEAR_SLOTS_KEY, '{');
    expect(loadSlotIndex(storage).active).toBe(0);
    storage.setItem(PRO_YEAR_SLOTS_KEY, JSON.stringify({ version: 1, active: 9, slots: ['x', 'y'] }));
    const index = loadSlotIndex(storage);
    expect(index.active).toBe(0);
    expect(index.slots[0]).toBeNull();
    expect(slotCards(storage)[1].empty).toBe(true);
  });

  it('ほかの枠の称号も読み、同じ称号は回数の多いほうを選ぶ', () => {
    const storage = memoryStorage();
    const strong = year(1);
    strong.user.titleCounts = { ryuo: 3 };
    saveProYear(storage, strong);
    switchSlot(storage, 1);
    const titles = otherSlotTitles(storage);
    expect(titles.map((title) => title.id)).toContain('pro-title-ryuo');
    const weak = year(2);
    weak.user.titleCounts = { ryuo: 1 };
    const merged = bestTitles([...proYearProfileTitles(weak), ...otherSlotTitles(storage)]);
    expect(merged.find((title) => title.id === 'pro-title-ryuo')?.detail).toContain('通算3期');
    const picked = bestTitles([
      { id: 'a', rank: 20, weight: 1, label: '1' },
      { id: 'a', rank: 20, weight: 3, label: '3' },
      { id: 'b', rank: 22, weight: 2, label: 'b2' },
      { id: 'b', rank: 23, weight: 3, label: 'b3' },
    ]);
    expect(picked.map((title) => title.label)).toEqual(['3', 'b3']);
  });
});
