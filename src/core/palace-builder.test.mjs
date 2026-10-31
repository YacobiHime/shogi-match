import { describe, expect, test } from 'vitest';

import { PALACE_TIPS, PLACE_KINDS, placeDeck } from '../data/palace-cards.mjs';
import {
  LOCI_MAX,
  LOCI_READY,
  PALACE_MAX,
  addLocus,
  cleanPalace,
  cleanPalaces,
  createPalace,
  moveLocus,
  palaceReady,
  removeLocus,
  removePalace,
  renameLocus,
  renamePalace,
  replacePalace,
  restoreLocus,
  similarNeighbors,
} from './palace-builder.mjs';

function filled(palace, count) {
  let current = palace;
  const deck = placeDeck('free');
  for (let index = 0; index < count; index += 1) current = addLocus(current, deck[index]).palace;
  return current;
}

describe('場所カードの束', () => {
  test('家・学校・道・お店の束は、名前が重ならず、絵がある。家は40枚ほど', () => {
    for (const kind of PLACE_KINDS) {
      const deck = placeDeck(kind.id);
      expect(deck.length).toBeGreaterThanOrEqual(LOCI_READY * 2);
      expect(new Set(deck.map(({ name }) => name)).size).toBe(deck.length);
      expect(deck.every(({ emoji }) => emoji.length > 0)).toBe(true);
    }
    expect(placeDeck('home').length).toBeGreaterThanOrEqual(40);
    expect(placeDeck('free').length).toBeGreaterThan(placeDeck('home').length);
    expect(PLACE_KINDS[0].id).toBe('home');
    expect(PALACE_TIPS).toHaveLength(3);
  });
});

describe('宮殿づくり', () => {
  test('宮殿は3つまで。空いている番号で作る', () => {
    let palaces = [];
    for (let index = 0; index < PALACE_MAX; index += 1) {
      const made = createPalace(palaces, { place: 'home' });
      palaces = made.palaces;
      expect(made.palace.name).toBe('わが家');
    }
    expect(palaces.map(({ id }) => id)).toEqual(['p1', 'p2', 'p3']);
    expect(createPalace(palaces, { place: 'home' })).toBeNull();
    palaces = removePalace(palaces, 'p2');
    expect(createPalace(palaces, { place: 'school', name: '中学校' }).palace).toMatchObject({ id: 'p2', name: '中学校', place: 'school' });
  });

  test('カードを並べる・名前を変える・入れ替える・消して取り消す', () => {
    let palace = createPalace([], { place: 'home' }).palace;
    const deck = placeDeck('home');
    palace = addLocus(palace, deck[2]).palace;
    palace = addLocus(palace, deck[4]).palace;
    palace = addLocus(palace, { name: '  おばあちゃんの  座いす ', emoji: '🪑' }).palace;
    expect(palace.loci.map(({ name }) => name)).toEqual(['玄関のドア', 'くつ箱', 'おばあちゃんの 座いす']);
    palace = renameLocus(palace, 1, 'げた箱');
    expect(palace.loci[1].name).toBe('げた箱');
    expect(renameLocus(palace, 1, '   ')).toBe(palace);
    palace = moveLocus(palace, 2, 0);
    expect(palace.loci.map(({ name }) => name)).toEqual(['おばあちゃんの 座いす', '玄関のドア', 'げた箱']);
    expect(moveLocus(palace, 0, 9)).toBe(palace);
    const removed = removeLocus(palace, 1);
    expect(removed.palace.loci).toHaveLength(2);
    expect(removed.removed.name).toBe('玄関のドア');
    expect(restoreLocus(removed.palace, removed.index, removed.removed).loci).toEqual(palace.loci);
    expect(renamePalace(palace, '実家').name).toBe('実家');
    expect(replacePalace([palace], renamePalace(palace, '実家'))[0].name).toBe('実家');
  });

  test('10か所でできあがり、30か所が上限', () => {
    let palace = createPalace([], { place: 'free' }).palace;
    palace = filled(palace, LOCI_READY - 1);
    expect(palaceReady(palace)).toBe(false);
    palace = filled(palace, 1);
    expect(palaceReady(palace)).toBe(true);
    palace = filled(createPalace([], { place: 'free' }).palace, LOCI_MAX);
    const over = addLocus(palace, { name: 'もう1つ' });
    expect(over.full).toBe(true);
    expect(over.palace.loci).toHaveLength(LOCI_MAX);
  });

  test('似た場所(ドアどうし・同じ名前)が続くと知らせる', () => {
    let palace = createPalace([], { place: 'home' }).palace;
    palace = addLocus(palace, { name: '玄関のドア', emoji: '🚪', group: 'door' }).palace;
    const door = addLocus(palace, { name: '部屋のドア', emoji: '🚪', group: 'door' });
    expect(door.similar).toBe(true);
    const sofa = addLocus(palace, { name: 'ソファ', emoji: '🛋️', group: 'seat' });
    expect(sofa.similar).toBe(false);
    const same = addLocus(sofa.palace, { name: 'ソファ' });
    expect(same.similar).toBe(true);
    expect(similarNeighbors(door.palace)).toEqual([1]);
  });

  test('壊れた保存を捨てる', () => {
    expect(cleanPalace(null)).toBeNull();
    expect(cleanPalace({ id: 'x1', loci: [] })).toBeNull();
    const palace = cleanPalace({ id: 'p1', name: '', place: 'moon', loci: [{ name: '玄関', emoji: '🚪', group: 'Door!' }, { name: ' ' }, 'x'] });
    expect(palace).toEqual({ id: 'p1', name: '自分の宮殿', place: 'free', loci: [{ name: '玄関', emoji: '🚪', group: '' }] });
    expect(cleanPalaces([{ id: 'p1', loci: [] }, { id: 'p1', loci: [] }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }]).map(({ id }) => id)).toEqual(['p1', 'p2', 'p3']);
  });
});
