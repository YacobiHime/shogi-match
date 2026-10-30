import { describe, expect, test } from 'vitest';

import { MEMORY_PROVERBS, MEMORY_WORDS } from '../data/memory-palace-words.mjs';
import { appendUsiMove, createGameRecord, STANDARD_SFEN } from '../game-state';
import {
  CASTLE_LOCI,
  PALACE_LESSONS,
  PRACTICE_MAX,
  PRACTICE_MIN,
  cleanCustomLoci,
  fourChoices,
  lessonUnlocked,
  litLoci,
  nextPracticeCount,
  palaceLoci,
  palaceWordSet,
  practiceOpen,
  practiceValue,
  scoreOrder,
  shogiScenes,
  shogiSequence,
} from './memory-palace.mjs';
import { OPENING_CASTLES } from './opening-guide.mjs';

describe('記憶の宮殿', () => {
  test('言葉と場所は重ならず、数が足りる', () => {
    const words = MEMORY_WORDS.map(({ word }) => word);
    expect(new Set(words).size).toBe(words.length);
    expect(words.length).toBeGreaterThanOrEqual(PRACTICE_MAX * 2);
    expect(MEMORY_WORDS.every(({ emoji }) => emoji.length > 0)).toBe(true);
    expect(CASTLE_LOCI).toHaveLength(30);
    expect(new Set(CASTLE_LOCI.map(({ name }) => name)).size).toBe(30);
    expect(new Set(MEMORY_PROVERBS).size).toBe(10);
  });

  test('講は順に開き、自分の宮殿の講はとばしてもよい', () => {
    expect(lessonUnlocked([], 'walk')).toBe(true);
    expect(lessonUnlocked([], 'place5')).toBe(false);
    expect(lessonUnlocked(['walk'], 'place5')).toBe(true);
    expect(lessonUnlocked(['walk', 'place5', 'ten', 'jump'], 'shogi')).toBe(true);
    expect(lessonUnlocked(['walk', 'place5', 'ten'], 'shogi')).toBe(false);
    expect(lessonUnlocked([], 'nope')).toBe(false);
    expect(practiceOpen(['walk'])).toBe(false);
    expect(practiceOpen(['walk', 'place5'])).toBe(true);
    expect(PALACE_LESSONS.map(({ id }) => id)).toEqual(['walk', 'place5', 'ten', 'jump', 'custom', 'shogi']);
  });

  test('講を終えるたびに5か所ずつ明かりがつき、6つで30か所', () => {
    expect(litLoci([])).toBe(5);
    expect(litLoci(['walk', 'place5'])).toBe(15);
    expect(litLoci(PALACE_LESSONS.map(({ id }) => id))).toBe(30);
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
    expect(set.distractors.every(({ word }) => !words.includes(word))).toBe(true);
    // 大げさな絵の動きは、続けて同じにならない。
    const actions = set.scenes.map(({ image, locus, item }) => image.slice(`${locus.name}に${item.word}`.length));
    for (let index = 1; index < actions.length; index += 1) expect(actions[index]).not.toBe(actions[index - 1]);
    // 場所の数より多くは置かない。
    expect(palaceWordSet(1, 40).scenes).toHaveLength(30);
  });

  test('4択は答えを1つだけ含む', () => {
    const options = fourChoices(5, 'りんご', ['りんご', 'ぶどう', 'もも', 'すいか', 'いちご']);
    expect(options).toHaveLength(4);
    expect(options.filter((option) => option === 'りんご')).toHaveLength(1);
    expect(new Set(options).size).toBe(4);
  });

  test('順番の採点と、毎日の練習の数の上げ下げ', () => {
    expect(scoreOrder(['a', 'b', 'c'], ['a', 'c', 'b'])).toEqual({ correct: 1, total: 3, positions: [true, false, false], accuracy: 1 / 3 });
    expect(nextPracticeCount(5, 1)).toBe(7);
    expect(nextPracticeCount(9, 0.85)).toBe(9);
    expect(nextPracticeCount(9, 0.5)).toBe(7);
    expect(nextPracticeCount(PRACTICE_MIN, 0)).toBe(PRACTICE_MIN);
    expect(nextPracticeCount(PRACTICE_MAX, 1)).toBe(PRACTICE_MAX);
    expect(nextPracticeCount(10, 1, 12)).toBe(12);
    expect(practiceValue({ correct: 8, total: 10, accuracy: 0.8 })).toBe(8);
    expect(practiceValue({ correct: 7, total: 10, accuracy: 0.7 })).toBe(0);
  });

  test('自分の宮殿は10か所以上で使い、名前を整える', () => {
    expect(palaceLoci([])).toBe(CASTLE_LOCI);
    expect(palaceLoci(['a', 'b'])).toBe(CASTLE_LOCI);
    const names = Array.from({ length: 12 }, (_, index) => `場所${index + 1}`);
    expect(palaceLoci(names).map(({ name }) => name)).toEqual(names);
    expect(cleanCustomLoci([' 玄関 ', '', '玄関', 'x'.repeat(30)])).toEqual(['玄関', 'x'.repeat(20)]);
    expect(cleanCustomLoci(Array.from({ length: 40 }, (_, index) => `p${index}`))).toHaveLength(PRACTICE_MAX);
  });

  test('講6の定跡の手順は、初めの局面から合法で、四間飛車と美濃囲いができる', () => {
    const sequence = shogiSequence();
    expect(sequence).toHaveLength(8);
    // 先手だけが続けて指す手順なので、後手は手を返さない局面で確かめる(盤の手番だけを先手に戻す)。
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
  });

  test('講6の場面は手順と格言を場所の順に置く', () => {
    const moves = shogiScenes(1, CASTLE_LOCI, 'moves');
    expect(moves.map(({ item }) => item.word)).toEqual(shogiSequence().map(({ label }) => label));
    const proverbs = shogiScenes(1, CASTLE_LOCI, 'proverbs');
    expect(proverbs.map(({ item }) => item.word)).toEqual([...MEMORY_PROVERBS]);
  });
});
