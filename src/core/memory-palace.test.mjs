import { describe, expect, test } from 'vitest';

import { MEMORY_PROVERBS, MEMORY_WORDS } from '../data/memory-palace-words.mjs';
import { appendUsiMove, createGameRecord, STANDARD_SFEN } from '../game-state';
import {
  CASTLE_LOCI,
  DIGIT_CHOICES,
  DIGIT_MIN,
  MEMORY_PALACE_KEY,
  PALACE_LESSONS,
  PRACTICE_MAX,
  PRACTICE_MIN,
  SAMPLE_PALACE,
  cleanMemoryStore,
  defaultDigits,
  digitImage,
  digitNumber,
  digitScenes,
  emptyMemoryStore,
  findPalace,
  fourChoices,
  hasPalace,
  imageQuiz,
  lessonPalace,
  lessonUnlocked,
  listScenes,
  loadMemoryStore,
  memoryTestSet,
  migrateMemoryStoreV1,
  nameScenes,
  nextDayState,
  nextDigitCount,
  nextLesson,
  nextPracticeCount,
  palaceWordSet,
  planPractice,
  practiceOpen,
  practiceValue,
  recallLabel,
  recallPool,
  saveMemoryStore,
  scoreDigits,
  scoreOrder,
  shogiScenes,
  shogiSequence,
  usablePalaces,
  walkQuiz,
} from './memory-palace.mjs';
import { OPENING_CASTLES } from './opening-guide.mjs';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    data,
  };
}

function ownPalace(id, count) {
  return { id, name: `宮殿${id}`, place: 'free', loci: Array.from({ length: count }, (_, index) => ({ name: `${id}場所${index + 1}`, emoji: '📍', group: '' })) };
}

describe('記憶の宮殿の学校', () => {
  test('言葉と見本の宮殿は重ならず、数が足りる', () => {
    const words = MEMORY_WORDS.map(({ word }) => word);
    expect(new Set(words).size).toBe(words.length);
    expect(words.length).toBeGreaterThanOrEqual(PRACTICE_MAX * 2);
    expect(CASTLE_LOCI).toHaveLength(30);
    expect(new Set(CASTLE_LOCI.map(({ name }) => name)).size).toBe(30);
    expect(new Set(MEMORY_PROVERBS).size).toBe(10);
    expect(PALACE_LESSONS.map(({ number }) => number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('講は宮殿ができてから順に開く。講7は講5のあと、講3を終えると毎日の練習が開く', () => {
    expect(lessonUnlocked([], 'walk', false)).toBe(false);
    expect(lessonUnlocked([], 'walk')).toBe(true);
    expect(lessonUnlocked([], 'image')).toBe(false);
    expect(lessonUnlocked(['walk'], 'image')).toBe(true);
    expect(lessonUnlocked(['walk', 'image', 'place5', 'ten', 'twenty'], 'nextday')).toBe(true);
    expect(lessonUnlocked(['walk', 'image', 'place5', 'ten', 'twenty'], 'two')).toBe(false);
    expect(lessonUnlocked([], 'nope')).toBe(false);
    expect(nextLesson([])).toBe('walk');
    expect(nextLesson(['walk', 'image'])).toBe('place5');
    expect(nextLesson(PALACE_LESSONS.map(({ id }) => id))).toBeNull();
    expect(practiceOpen(['walk', 'image'])).toBe(false);
    expect(practiceOpen(['walk', 'image', 'place5'])).toBe(true);
  });

  test('使える宮殿は10か所以上の自分の宮殿と、選んだときの見本の宮殿', () => {
    const store = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 9), ownPalace('p2', 12)] };
    expect(usablePalaces(store).map(({ id }) => id)).toEqual(['p2']);
    expect(hasPalace({ ...emptyMemoryStore(), palaces: [ownPalace('p1', 9)] })).toBe(false);
    expect(usablePalaces({ ...store, sample: true }).map(({ id }) => id)).toEqual(['p2', 'castle']);
    expect(findPalace({ ...store, sample: true }, 'castle')).toBe(SAMPLE_PALACE);
    expect(lessonPalace({ ...store, sample: true, lastPalace: 'castle' }).id).toBe('castle');
    expect(lessonPalace(store).id).toBe('p2');
  });

  test('覚える組は同じ種なら同じ。場所の順に1つずつ置き、思い出しの札は覚えた言葉とほかの言葉', () => {
    expect(palaceWordSet(3, 10)).toEqual(palaceWordSet(3, 10));
    const set = palaceWordSet(3, 10);
    expect(set.scenes).toHaveLength(10);
    set.scenes.forEach((scene, index) => {
      expect(scene.locus).toBe(CASTLE_LOCI[index]);
      expect(scene.image.startsWith(`${scene.locus.name}に${scene.item.word}`)).toBe(true);
    });
    const words = set.scenes.map(({ item }) => item.word);
    expect(set.pool).toHaveLength(20);
    expect(words.every((word) => set.pool.some((item) => item.word === word))).toBe(true);
    const actions = set.scenes.map(({ image, locus, item }) => image.slice(`${locus.name}に${item.word}`.length));
    for (let index = 1; index < actions.length; index += 1) expect(actions[index]).not.toBe(actions[index - 1]);
    expect(palaceWordSet(1, 40).scenes).toHaveLength(30);
    // 前の回の言葉は使わない。
    const avoid = palaceWordSet(4, 10).scenes.map(({ item }) => item.word);
    expect(palaceWordSet(4, 10, CASTLE_LOCI, avoid).scenes.some(({ item }) => avoid.includes(item.word))).toBe(false);
    const pool = recallPool(2, avoid);
    expect(pool).toHaveLength(20);
    expect(avoid.every((word) => pool.includes(word))).toBe(true);
  });

  test('記憶テストは15個とじゃまの15個', () => {
    const set = memoryTestSet(8);
    expect(set.words).toHaveLength(15);
    expect(set.pool).toHaveLength(30);
    expect(new Set(set.pool).size).toBe(30);
    expect(set.words.every(({ word }) => set.pool.includes(word))).toBe(true);
    expect(memoryTestSet(8)).toEqual(set);
  });

  test('講1の場所の問題は、順番・逆順・飛び飛び', () => {
    const quiz = walkQuiz(1, CASTLE_LOCI);
    expect(quiz.forward).toEqual(CASTLE_LOCI.slice(0, 10).map(({ name }) => name));
    expect(quiz.backward).toEqual([...quiz.forward].reverse());
    expect([...quiz.pool].sort()).toEqual([...quiz.forward].sort());
    expect(quiz.jumps).toHaveLength(3);
    for (const jump of quiz.jumps) {
      expect(jump.answer).toBe(quiz.forward[jump.number - 1]);
      expect(jump.options).toContain(jump.answer);
    }
  });

  test('講2の絵の問題は、覚えやすい絵が1つだけ', () => {
    for (const question of imageQuiz(3, CASTLE_LOCI)) {
      expect(question.options.filter(({ good }) => good)).toHaveLength(1);
      expect(question.options.find(({ good }) => good).text).toContain(question.locus.name);
    }
  });

  test('4択は答えを1つだけ含む', () => {
    const options = fourChoices(5, 'りんご', ['りんご', 'ぶどう', 'もも', 'すいか', 'いちご']);
    expect(options).toHaveLength(4);
    expect(options.filter((option) => option === 'りんご')).toHaveLength(1);
    expect(new Set(options).size).toBe(4);
  });

  test('順番の採点と、毎日の練習の数の上げ下げ', () => {
    expect(scoreOrder(['a', 'b', 'c'], ['a', 'c', 'b'])).toEqual({ correct: 1, total: 3, positions: [true, false, false], accuracy: 1 / 3 });
    expect(scoreOrder(['a', 'b', 'c'], ['a', '', 'c']).correct).toBe(2);
    expect(nextPracticeCount(5, 1)).toBe(7);
    expect(nextPracticeCount(9, 0.85)).toBe(9);
    expect(nextPracticeCount(9, 0.5)).toBe(7);
    expect(nextPracticeCount(PRACTICE_MIN, 0)).toBe(PRACTICE_MIN);
    expect(nextPracticeCount(PRACTICE_MAX, 1)).toBe(PRACTICE_MAX);
    expect(nextPracticeCount(10, 1, 12)).toBe(12);
    expect(practiceValue({ correct: 8, total: 10, accuracy: 0.8 })).toBe(8);
    expect(practiceValue({ correct: 7, total: 10, accuracy: 0.7 })).toBe(0);
  });
});

describe('毎日の練習', () => {
  const day = '2026-11-03';

  test('前の日より前の回の言葉を思い出し、宮殿が2つあれば前の回と別の宮殿に置く', () => {
    const store = {
      ...emptyMemoryStore(),
      palaces: [ownPalace('p1', 12), ownPalace('p2', 15)],
      lessons: ['walk', 'image', 'place5'],
      lastWords: { palace: 'p1', words: ['りんご', 'いぬ'], day: '2026-11-02' },
      practiceCount: 13,
    };
    const plan = planPractice(store, day);
    expect(plan.recall).toEqual(store.lastWords);
    expect(plan.palace.id).toBe('p2');
    expect(plan.count).toBe(13);
    expect(plan.digits).toBe(false);
    expect(recallLabel('2026-11-02', day)).toBe('きのうの言葉');
    expect(recallLabel('2026-10-30', day)).toBe('前の回の言葉');
    // 同じ日の2回目は思い出さない。宮殿が1つなら同じ宮殿(思い出してから置く)。
    expect(planPractice({ ...store, lastWords: { ...store.lastWords, day } }, day).recall).toBeNull();
    const one = planPractice({ ...store, palaces: [ownPalace('p1', 12)] }, day);
    expect(one.palace.id).toBe('p1');
    // 言葉の数は宮殿の場所の数まで。
    expect(one.count).toBe(12);
    expect(planPractice(emptyMemoryStore(), day)).toBeNull();
  });

  test('講6を終えると、日替わりで数字も練習する', () => {
    const store = { ...emptyMemoryStore(), sample: true, lessons: ['digits'], digitCount: 12 };
    expect(planPractice(store, '2026-11-03').digits).toBe(true);
    expect(planPractice(store, '2026-11-04').digits).toBe(false);
    expect(planPractice(store, '2026-11-03').digitCount).toBe(12);
  });

  test('講7は講5で置いた言葉を次の日に', () => {
    const store = { ...emptyMemoryStore(), sample: true, lessonWords: { palace: 'castle', words: ['りんご'], day: '2026-11-02' } };
    expect(nextDayState(store, '2026-11-02')).toBe('wait');
    expect(nextDayState(store, '2026-11-03')).toBe('ready');
    expect(nextDayState(emptyMemoryStore(), '2026-11-03')).toBe('missing');
    // 宮殿を消したら思い出せない。
    expect(nextDayState({ ...store, sample: false }, '2026-11-03')).toBe('missing');
  });
});

describe('数字を絵にする', () => {
  test('0〜9の絵、2けたずつ場所に置き、けたごとに採点する', () => {
    expect(DIGIT_CHOICES).toHaveLength(10);
    expect(defaultDigits()[1]).toBe('えんぴつ');
    expect(digitImage(defaultDigits(), 2)).toEqual({ word: '白鳥', emoji: '🦢' });
    const custom = defaultDigits();
    custom[3] = 'さんま';
    expect(digitImage(custom, 3)).toEqual({ word: 'さんま', emoji: '🔢' });
    const number = digitNumber(4, 10);
    expect(number).toMatch(/^\d{10}$/);
    expect(digitNumber(4, 10)).toBe(number);
    const scenes = digitScenes(number, CASTLE_LOCI, defaultDigits());
    expect(scenes).toHaveLength(5);
    expect(scenes.map(({ pair }) => pair).join('')).toBe(number);
    expect(scenes[0].image).toContain(scenes[0].images[0].word);
    expect(scoreDigits('1234', '1294')).toMatchObject({ correct: 3, total: 4 });
    expect(nextDigitCount(10, 1)).toBe(12);
    expect(nextDigitCount(10, 0.5)).toBe(8);
    expect(nextDigitCount(DIGIT_MIN, 0)).toBe(DIGIT_MIN);
    expect(nextDigitCount(20, 1, 10)).toBe(20);
  });
});

describe('講9 使ってみる', () => {
  test('買い物リスト・やること・人の名前を場所に置く', () => {
    const shopping = listScenes(1, 'shopping', CASTLE_LOCI);
    expect(shopping.scenes).toHaveLength(8);
    expect(shopping.scenes.every(({ item }) => shopping.pool.includes(item.word))).toBe(true);
    expect(listScenes(1, 'todo', CASTLE_LOCI).scenes).toHaveLength(5);
    const names = nameScenes(1, CASTLE_LOCI);
    expect(names).toHaveLength(5);
    expect(names[0].image).toContain(names[0].person.cue);
  });

  test('将棋の手順は、初めの局面から合法で、四間飛車と美濃囲いができる', () => {
    const sequence = shogiSequence();
    expect(sequence).toHaveLength(8);
    let sfen = STANDARD_SFEN;
    for (const { usi } of sequence) {
      const record = createGameRecord(sfen.replace(' w ', ' b '));
      expect(appendUsiMove(record, usi)).toBe(true);
      sfen = record.position.sfen;
    }
    const mino = OPENING_CASTLES.find(({ id }) => id === 'mino');
    const board = sfen.split(' ')[0].split('/');
    const at = (square) => {
      const row = board[square.charCodeAt(1) - 97];
      let file = 9;
      for (const char of row.replace(/\+/g, '')) {
        if (/\d/.test(char)) file -= Number(char);
        else {
          if (file === Number(square[0])) return char;
          file -= 1;
        }
      }
      return '';
    };
    for (const [square, kind] of mino.completionSquares) expect(at(square)).toBe(kind);
    expect(at('6h')).toBe('R');
    expect(sequence[0].label).toBe('▲７六歩');
    const moves = shogiScenes(1, CASTLE_LOCI, 'moves');
    expect(moves.map(({ item }) => item.word)).toEqual(sequence.map(({ label }) => label));
    expect(shogiScenes(1, CASTLE_LOCI, 'proverbs').map(({ item }) => item.word)).toEqual([...MEMORY_PROVERBS]);
  });
});

describe('保存', () => {
  test('保存して読み直し、壊れた値を捨てる', () => {
    const storage = memoryStorage();
    expect(loadMemoryStore(storage)).toEqual(emptyMemoryStore());
    const store = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 11)], lessons: ['walk', 'nope'], lastWords: { palace: 'p1', words: ['りんご'], day: '2026-11-01' }, practiceCount: 99, digitCount: 11 };
    saveMemoryStore(storage, store);
    const loaded = loadMemoryStore(storage);
    expect(loaded.palaces).toHaveLength(1);
    expect(loaded.lessons).toEqual(['walk']);
    expect(loaded.lastWords).toEqual(store.lastWords);
    expect(loaded.practiceCount).toBe(PRACTICE_MAX);
    expect(loaded.digitCount).toBe(10);
    // 消した宮殿の言葉は捨てる。
    expect(cleanMemoryStore({ ...store, palaces: [] }).lastWords).toBeNull();
    expect(loadMemoryStore(memoryStorage({ [MEMORY_PALACE_KEY]: '{' }))).toEqual(emptyMemoryStore());
    expect(() => saveMemoryStore({ setItem() { throw new Error('full'); } }, store)).not.toThrow();
  });

  test('前の版の自分の宮殿(10か所以上)と、毎日の練習の言葉の数を引き継ぐ', () => {
    const custom = Array.from({ length: 12 }, (_, index) => `場所${index + 1}`);
    const migrated = migrateMemoryStoreV1({ version: 1, levels: { palace: 11 }, palace: { lessons: ['walk', 'place5'], custom } });
    expect(migrated.palaces).toHaveLength(1);
    expect(migrated.palaces[0].loci.map(({ name }) => name)).toEqual(custom);
    expect(migrated.practiceCount).toBe(11);
    expect(migrated.lessons).toEqual([]);
    expect(migrateMemoryStoreV1({ version: 1, palace: { custom: ['玄関'] } }).palaces).toEqual([]);
    const storage = memoryStorage({ 'yacobihime:shogi-match:brain-training:v1': JSON.stringify({ version: 1, palace: { custom } }) });
    expect(loadMemoryStore(storage).palaces).toHaveLength(1);
  });
});
