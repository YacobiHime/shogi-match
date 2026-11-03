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
  addTreasureBox,
  boxBlocker,
  checkTreasureShelf,
  editTreasureBox,
  moveTreasurePalace,
  returnTreasureShelf,
  shelfLoci,
  treasureChoices,
  boxLoci,
  chooseTreasurePalace,
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
  practicePalaces,
  practiceValue,
  recallLabel,
  recallPool,
  reviewTreasureBox,
  saveMemoryStore,
  scoreDigits,
  scoreOrder,
  shogiScenes,
  shogiSequence,
  treasurePalaceOf,
  treasureScenes,
  treasureSets,
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
      // 場所と覚えるものがからむ絵の文(14-9)。
      expect(scene.image).toContain(scene.locus.name);
      expect(scene.image).toContain(scene.item.word);
      expect(scene.imageOptions).toContain(scene.image);
    });
    const words = set.scenes.map(({ item }) => item.word);
    expect(set.pool).toHaveLength(20);
    expect(words.every((word) => set.pool.some((item) => item.word === word))).toBe(true);
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

describe('思い出しの箱と宝物用の宮殿(docs/brain-training-design.mdの14-9)', () => {
  const day = '2026-11-02';

  test('宝物用の宮殿: 自分の宮殿が2つ以上なら練習に使っていない方、1つなら見本のお城', () => {
    const two = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 12), ownPalace('p2', 15)], lastPalace: 'p1' };
    expect(chooseTreasurePalace(two)).toBe('p2');
    expect(chooseTreasurePalace({ ...two, lastPalace: 'p2' })).toBe('p1');
    const one = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 12)] };
    expect(chooseTreasurePalace(one)).toBe('castle');
    expect(treasurePalaceOf(one)).toBe(SAMPLE_PALACE);
    // 練習に見本のお城を使っていて、自分の宮殿もなければ、箱の前に宮殿を作る
    const castleOnly = { ...emptyMemoryStore(), sample: true, lastPalace: 'castle' };
    expect(chooseTreasurePalace(castleOnly)).toBe('');
    expect(boxBlocker(castleOnly, 10)).toBe('palace');
    expect(chooseTreasurePalace({ ...castleOnly, palaces: [ownPalace('p1', 12)] })).toBe('p1');
    expect(chooseTreasurePalace(emptyMemoryStore())).toBe('');
  });

  test('箱に組があるあいだ、毎日の練習と講は宝物用の宮殿を使わない', () => {
    const store = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 12), ownPalace('p2', 15)], lastPalace: 'p2', lessons: ['walk', 'image', 'place5'] };
    expect(practicePalaces(store).map(({ id }) => id)).toEqual(['p1', 'p2']);
    const added = addTreasureBox(store, { set: 'planets', title: '惑星', emoji: '🪐', items: ['水星', '金星', '地球'] }, day);
    expect(added.store.treasurePalace).toBe('p1');
    expect(practicePalaces(added.store).map(({ id }) => id)).toEqual(['p2']);
    expect(lessonPalace({ ...added.store, lastPalace: 'p1' })?.id).toBe('p2');
    expect(planPractice({ ...added.store, lastPalace: 'p1' }, day)?.palace.id).toBe('p2');
    // 宝物用の宮殿しかないときは、そのまま使う(遊べなくしない)
    const single = addTreasureBox({ ...emptyMemoryStore(), palaces: [ownPalace('p1', 12)], sample: true, lastPalace: 'castle' }, { set: 'x', title: 'x', emoji: '📦', items: ['a', 'b', 'c'] }, day);
    expect(single.store.treasurePalace).toBe('p1');
    expect(practicePalaces(single.store).map(({ id }) => id)).toEqual(['castle']);
  });

  test('組は宝物用の宮殿の空いた場所に続けて置き、場所が足りなければ入れない', () => {
    let store = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 12)] };
    const sets = treasureSets();
    const proverbs = sets.find(({ id }) => id === 'proverbs');
    const months = sets.find(({ id }) => id === 'months');
    store = addTreasureBox(store, { ...proverbs, set: proverbs.id }, day).store;
    store = addTreasureBox(store, { ...months, set: months.id }, day).store;
    expect(store.boxes.map(({ start }) => start)).toEqual([0, 10]);
    expect(boxLoci(store, store.boxes[1]).map(({ name }) => name)).toEqual(CASTLE_LOCI.slice(10, 22).map(({ name }) => name));
    // お城の30か所のうち22か所を使った。残りは8か所
    expect(boxBlocker(store, 12)).toBe('room');
    expect(boxBlocker(store, 8)).toBe('');
    const zodiac = sets.find(({ id }) => id === 'zodiac');
    store = addTreasureBox(store, { ...zodiac, set: zodiac.id }, day).store;
    expect(store.boxes).toHaveLength(2);
    expect(boxBlocker(store, 3)).toBe('');
  });

  test('目録: どの組も3〜12個で、絵の手がかりは場所を含む。作戦の手順は対局と同じ8手', () => {
    const sets = treasureSets();
    expect(sets.map(({ id }) => id)).toEqual(['proverbs', 'shiken-mino', 'herbs', 'months', 'planets', 'zodiac']);
    for (const set of sets) {
      expect(set.items.length).toBeGreaterThanOrEqual(3);
      expect(set.items.length).toBeLessThanOrEqual(12);
      for (const item of set.items) if (item.cue) expect(item.cue).toContain('{場}');
    }
    expect(sets[0].items.map(({ word }) => word)).toEqual([...MEMORY_PROVERBS]);
    const moves = sets[1].items;
    expect(moves.map(({ word }) => word)).toEqual(shogiSequence().map(({ label }) => label));
    expect(moves[0]).toMatchObject({ ask: '1手目は？', cue: '{場}で、歩が７六へ、ぐいっと1歩進む！' });
    const scenes = treasureScenes(CASTLE_LOCI, sets.find(({ id }) => id === 'months').items);
    expect(scenes[11].image).toBe('門を、先生が大あわてで走っていく！'.replace('門', CASTLE_LOCI[11].name));
    expect(scenes[0].ask).toBe('1月は？');
    // 絵にする言葉(picture)があれば、その言葉で絵の文を作る
    const zodiac = treasureScenes(CASTLE_LOCI, sets.find(({ id }) => id === 'zodiac').items);
    expect(zodiac[0].item.word).toBe('子（ね）');
    expect(zodiac[0].image).toContain('ねずみ');
    // 選んだ絵の番号で、思い出したあとに同じ絵を出す
    const [first] = treasureScenes(CASTLE_LOCI, [{ word: 'りんご' }], [1]);
    expect(first.image).toBe(first.imageOptions[0]);
    expect(treasureScenes(CASTLE_LOCI, [{ word: 'りんご' }])[0].imageOptions[1]).toBe(first.image);
  });

  test('思い出した結果で段が動き、保存して読み直せる(前の保存には箱がない)', () => {
    const storage = memoryStorage();
    let store = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 12)] };
    store = addTreasureBox(store, { set: 'planets', title: '惑星', emoji: '🪐', items: treasureSets().find(({ id }) => id === 'planets').items, pics: [1, 0, 2] }, day).store;
    const reviewed = reviewTreasureBox(store, store.boxes[0].id, Array(8).fill(true), '2026-11-03');
    expect(reviewed.outcome).toMatchObject({ passed: true, stage: 1, next: '2026-11-06' });
    saveMemoryStore(storage, reviewed.store);
    const loaded = loadMemoryStore(storage);
    expect(loaded.boxes).toEqual(reviewed.store.boxes);
    expect(loaded.treasurePalace).toBe('castle');
    expect(loaded.boxes[0].pics).toEqual([1, 0, 2, 0, 0, 0, 0, 0]);
    // 前の保存(箱の項目なし)はそのまま読め、消えた宮殿は宝物用にしない
    expect(cleanMemoryStore({ version: 1, palaces: [] })).toMatchObject({ boxes: [], shelf: [], treasurePalace: '' });
    expect(cleanMemoryStore({ ...reviewed.store, treasurePalace: 'gone' }).treasurePalace).toBe('');
  });
});

describe('宝物用の宮殿を選び直す・棚の組(14-16)', () => {
  const day = '2026-11-02';
  test('候補は自分の宮殿と見本のお城。練習に使う宮殿と、組が置けるかの印', () => {
    let store = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 12), ownPalace('p2', 10)], lastPalace: 'p1', treasurePalace: 'castle' };
    store = addTreasureBox(store, { set: 'x', title: 'x', emoji: '📦', items: Array.from({ length: 11 }, (_, i) => `w${i}`) }, day).store;
    expect(store.boxes[0].start).toBe(0);
    const choices = treasureChoices(store);
    expect(choices.map(({ id, current, practice, fits }) => [id, current, practice, fits])).toEqual([
      ['p1', false, true, true],
      ['p2', false, false, false],
      ['castle', true, false, true],
    ]);
    expect(moveTreasurePalace(store, 'p2')).toBeNull();
    const moved = moveTreasurePalace(store, 'p1');
    expect(moved.treasurePalace).toBe('p1');
    expect(moved.boxes[0].next).toBe(store.boxes[0].next);
    // 練習に使っていた宮殿を宝物用にしたら、毎日の練習はほかの宮殿を使う
    expect(planPractice(moved, day).palace.id).toBe('p2');
  });

  test('棚の組を確かめ、箱にもどし、言葉を直す', () => {
    let store = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 12)] };
    store = addTreasureBox(store, { set: 'x', title: 'x', emoji: '📦', items: ['a', 'b', 'c'] }, day).store;
    store = { ...store, boxes: [{ ...store.boxes[0], stage: 4 }] };
    store = reviewTreasureBox(store, store.boxes[0].id, [true, true, true], '2026-12-30').store;
    expect(shelfLoci(store, store.shelf[0]).map(({ name }) => name)).toEqual(CASTLE_LOCI.slice(0, 3).map(({ name }) => name));
    const checked = checkTreasureShelf(store, 0, [true, false, false], '2027-02-01');
    expect(checked.check.passed).toBe(false);
    const back = returnTreasureShelf(checked.store, 0, '2027-02-01');
    expect(back.store.shelf).toEqual([]);
    expect(back.store.boxes[0]).toMatchObject({ stage: 1, next: '2027-02-04' });
    const edited = editTreasureBox(back.store, back.box.id, ['あ', 'b', 'c'], '');
    expect(edited.store.boxes[0].items[0].word).toBe('あ');
  });
});
