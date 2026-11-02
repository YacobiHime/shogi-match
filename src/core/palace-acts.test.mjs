import { describe, expect, test } from 'vitest';
import { LOCUS_ACTS, LOCUS_KINDS, LOCUS_KIND_BY_NAME } from '../data/palace-acts.mjs';
import { PLACE_KINDS, placeDeck } from '../data/palace-cards.mjs';
import { CASTLE_LOCI, imageQuiz, locusKind, palaceWordSet, sceneImages } from './memory-palace.mjs';
import { addLocus, cleanLocus, createPalace, renameLocus } from './palace-builder.mjs';

describe('場所とからむ絵(docs/brain-training-design.mdの14-9)', () => {
  test('どの束のどのカードにも、見本のお城のどの場所にも、動きの種類がある', () => {
    const cards = [...PLACE_KINDS.filter(({ id }) => id !== 'free').flatMap(({ id }) => placeDeck(id)), ...CASTLE_LOCI];
    const missing = cards.filter((card) => !LOCUS_KIND_BY_NAME[card.name]).map(({ name }) => name);
    expect(missing).toEqual([]);
    for (const kind of Object.values(LOCUS_KIND_BY_NAME)) expect(LOCUS_KINDS).toContain(kind);
  });

  test('どの種類にも2つ以上の文の型があり、どの型も場所と覚えるものを1回ずつ含む', () => {
    for (const [kind, templates] of Object.entries(LOCUS_ACTS)) {
      expect(templates.length, kind).toBeGreaterThanOrEqual(2);
      for (const template of templates) {
        expect(template.split('{場}').length - 1, template).toBe(1);
        expect(template.split('{物}').length - 1, template).toBe(1);
      }
    }
  });

  test('絵の文には場所と覚えるものが入る。自分で書いたカードは「そのほか」の型', () => {
    const fridge = sceneImages({ name: '冷蔵庫' }, { word: 'ぞう' });
    expect(fridge.length).toBeGreaterThanOrEqual(3);
    for (const image of fridge) expect(image).toMatch(/冷蔵庫[\s\S]*ぞう|ぞう[\s\S]*冷蔵庫/);
    expect(locusKind({ name: 'おばあちゃんの部屋' })).toBe('other');
    expect(sceneImages({ name: 'おばあちゃんの部屋' }, { word: 'りんご' })).toHaveLength(LOCUS_ACTS.other.length);
  });

  test('名前を自分の呼び方に変えても、動きの種類は残る', () => {
    let palace = createPalace([], { place: 'home' }).palace;
    palace = addLocus(palace, { name: 'ソファ', emoji: '🛋️', group: 'seat' }).palace;
    expect(palace.loci[0].kind).toBe('seat');
    palace = renameLocus(palace, 0, 'おばあちゃんの座いす');
    expect(palace.loci[0]).toMatchObject({ name: 'おばあちゃんの座いす', kind: 'seat' });
    expect(locusKind(palace.loci[0])).toBe('seat');
    expect(cleanLocus({ name: '机', kind: 'unknown' })).toMatchObject({ kind: 'table' });
    expect(cleanLocus({ name: '自分の場所' })).not.toHaveProperty('kind');
  });

  test('覚えるものに絵の手がかりがあれば、その文を最初に出す', () => {
    const images = sceneImages({ name: '玄関' }, { word: '師走', cue: '{場}を、先生が大あわてで走っていく！' });
    expect(images[0]).toBe('玄関を、先生が大あわてで走っていく！');
  });

  test('宮殿に置く組の絵は、ほかの絵の文も持つ。講2の正解は場所とからむ絵', () => {
    const set = palaceWordSet(7, 5, CASTLE_LOCI);
    for (const scene of set.scenes) {
      expect(scene.imageOptions[0]).toBe(scene.image);
      expect(scene.imageOptions.length).toBeGreaterThanOrEqual(2);
      expect(scene.image).toContain(scene.locus.name);
      expect(scene.image).toContain(scene.item.word);
    }
    for (const question of imageQuiz(3, CASTLE_LOCI)) {
      const good = question.options.find(({ good }) => good);
      expect(good.text).toBe(sceneImages(question.locus, question.item)[0]);
      expect(question.options.filter(({ good }) => !good).every(({ text }) => !sceneImages(question.locus, question.item).includes(text))).toBe(true);
    }
  });
});
