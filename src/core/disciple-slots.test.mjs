import { describe, expect, it } from 'vitest';
import { DISCIPLE_SLOTS_KEY, activeDiscipleSlot, deleteDiscipleSlot, discipleSlotCards, discipleSlotSummary, hasOtherDiscipleSlot, switchDiscipleSlot } from './disciple-slots.mjs';
import { DISCIPLE_RUN_KEY, createDiscipleRun, loadDiscipleRun, saveDiscipleRun } from './disciple-run.mjs';
import { STORY_EPISODES, episodeOfScene } from './story-mode.mjs';
import { DISCIPLES } from './disciple-strength.mjs';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
  };
}

describe('弟子の記録の枠(27-1)', () => {
  it('使ったことのない人は記録1だけで、目次の鍵を書かない', () => {
    const storage = memoryStorage();
    saveDiscipleRun(storage, createDiscipleRun({ seed: 1, discipleId: 'ao' }));
    const cards = discipleSlotCards(storage);
    expect(cards.map((card) => card.empty)).toEqual([false, true, true]);
    expect(cards[0]).toMatchObject({ active: true, summary: { name: DISCIPLES.find((d) => d.id === 'ao').name, place: '研修会前' } });
    expect(hasOtherDiscipleSlot(storage)).toBe(false);
    expect(storage.keys()).not.toContain(DISCIPLE_SLOTS_KEY);
  });

  it('空の枠へ替えると今の記録をしまい、戻すと同じ記録が出る', () => {
    const storage = memoryStorage();
    const first = createDiscipleRun({ seed: 1, discipleId: 'ao' });
    saveDiscipleRun(storage, first);
    expect(switchDiscipleSlot(storage, 2)).toBe(true);
    expect(activeDiscipleSlot(storage)).toBe(2);
    expect(loadDiscipleRun(storage)).toBeNull();
    expect(hasOtherDiscipleSlot(storage)).toBe(true);
    saveDiscipleRun(storage, createDiscipleRun({ seed: 2, discipleId: 'minato' }));
    expect(discipleSlotCards(storage).map((card) => card.summary?.discipleId ?? null)).toEqual(['ao', null, 'minato']);
    expect(switchDiscipleSlot(storage, 0)).toBe(true);
    expect(loadDiscipleRun(storage).seed).toBe(first.seed);
    expect(switchDiscipleSlot(storage, 0)).toBe(false);
    expect(switchDiscipleSlot(storage, 5)).toBe(false);
  });

  it('遊んでいない枠だけ消せる。終えた記録は評価を出す', () => {
    const storage = memoryStorage();
    saveDiscipleRun(storage, createDiscipleRun({ seed: 1, discipleId: 'ao' }));
    switchDiscipleSlot(storage, 1);
    saveDiscipleRun(storage, createDiscipleRun({ seed: 2, discipleId: 'tsumugi' }));
    expect(deleteDiscipleSlot(storage, 1)).toBe(false);
    expect(deleteDiscipleSlot(storage, 0)).toBe(true);
    expect(discipleSlotCards(storage)[0].empty).toBe(true);
    expect(storage.getItem(DISCIPLE_RUN_KEY)).not.toBeNull();
    const ended = { ...createDiscipleRun({ seed: 3, discipleId: 'ao' }), end: { rank: 'A', text: '' } };
    expect(discipleSlotSummary(ended).end.rank).toBe('A');
    expect(discipleSlotSummary(null)).toBeNull();
  });
});

describe('物語の目録の師匠の1年(27-2)', () => {
  it('師匠の1年の場面がサブに載り、台本のidから引ける', () => {
    const subs = STORY_EPISODES.filter((episode) => episode.label === '師匠の1年');
    expect(subs.length).toBe(DISCIPLES.length + 28);
    expect(episodeOfScene('disciple-slump')?.id).toBe('disciple:disciple-slump');
    expect(episodeOfScene('disciple-intro-ao')?.vars.disciple).toBe(DISCIPLES.find((d) => d.id === 'ao').name);
  });
});
