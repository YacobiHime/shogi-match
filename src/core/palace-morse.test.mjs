import { describe, expect, it } from 'vitest';
import { MORSE_READ_WORDS, MORSE_WORDS } from '../data/morse-words.mjs';
import { REVIEW_DAYS } from './memory-box.mjs';
import { SAMPLE_PALACE_ID, emptyMemoryStore } from './memory-palace.mjs';
import {
  MORSE_CODES,
  MORSE_LETTERS,
  MORSE_LOCI,
  MORSE_SESSIONS,
  PALACE_COURSES_KEY,
  chantCode,
  cleanCourseStore,
  completeMorseReview,
  completeMorseSession,
  emptyMorseProgress,
  loadCourseStore,
  morseKnownCount,
  morseListenQuestions,
  morseMarks,
  morseOptions,
  morsePalace,
  morsePlan,
  morseReadQuestions,
  morseScenes,
  morseSpoken,
  morseStageText,
  morseTimeline,
  placedLetters,
  saveCourseStore,
  scoreMorseCode,
} from './palace-morse.mjs';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
function ownPalace(id, count) {
  return { id, name: id, place: 'free', loci: Array.from({ length: count }, (_, index) => ({ name: `場所${index + 1}`, emoji: '📍', group: '' })) };
}

describe('語呂と符号', () => {
  it('26文字とも、拍から作った符号が本当の符号と同じ', () => {
    expect(MORSE_WORDS.map(({ letter }) => letter)).toEqual(MORSE_LETTERS);
    for (const item of MORSE_WORDS) expect(chantCode(item.chant), `${item.letter} ${item.word}`).toBe(MORSE_CODES[item.letter]);
  });

  it('ユーザーの例: Cはチーズケーキで、ツー・トン・ツー・トン', () => {
    const c = MORSE_WORDS.find(({ letter }) => letter === 'C');
    expect(c?.chant.join('')).toBe('チーズケーキ');
    expect(morseSpoken(MORSE_CODES.C)).toBe('ツー・トン・ツー・トン');
    expect(morseMarks(MORSE_CODES.C)).toBe('－・－・');
  });

  it('どの語呂にも、場所とからむ絵の文({場}を1回)と頭文字の手がかりがある', () => {
    for (const item of MORSE_WORDS) {
      expect(item.cue.split('{場}').length - 1, item.letter).toBe(1);
      expect(item.initial.length).toBeGreaterThan(2);
      expect(item.emoji.length).toBeGreaterThan(0);
    }
  });

  it('読む言葉はA〜Zの文字だけ', () => {
    for (const { word } of MORSE_READ_WORDS) expect([...word].every((letter) => MORSE_LETTERS.includes(letter))).toBe(true);
  });

  it('3つの回で26文字をちょうど1回ずつ', () => {
    expect(MORSE_SESSIONS.flat()).toEqual(MORSE_LETTERS);
    expect(MORSE_SESSIONS.map((letters) => letters.length)).toEqual([9, 9, 8]);
  });
});

describe('音の時間割', () => {
  it('トンは1単位、ツーは3単位、音のあいだは1単位', () => {
    const { marks, total } = morseTimeline('-.-.', 100);
    expect(marks).toEqual([
      { at: 0, ms: 300, kind: 'dash' },
      { at: 400, ms: 100, kind: 'dot' },
      { at: 600, ms: 300, kind: 'dash' },
      { at: 1000, ms: 100, kind: 'dot' },
    ]);
    expect(total).toBe(1100);
  });
});

describe('置く宮殿', () => {
  it('26か所以上の自分の宮殿で、毎日の練習の宮殿でないものを選ぶ。なければ見本のお城', () => {
    const memory = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 30), ownPalace('p2', 26), ownPalace('p3', 12)], lastPalace: 'p1' };
    expect(morsePalace(memory).id).toBe('p2');
    expect(morsePalace({ ...memory, lastPalace: 'p2' }).id).toBe('p1');
    expect(morsePalace({ ...memory, palaces: [ownPalace('p3', 12)] }).id).toBe(SAMPLE_PALACE_ID);
    // 箱に組がある宝物用の宮殿もよける。
    expect(morsePalace({ ...memory, boxes: [{}], treasurePalace: 'p2' }).id).toBe(SAMPLE_PALACE_ID);
  });

  it('一度決めた宮殿は、使えるあいだ変えない', () => {
    const memory = { ...emptyMemoryStore(), palaces: [ownPalace('p1', 30), ownPalace('p2', 26)], lastPalace: 'p2' };
    expect(morsePalace(memory, 'p2').id).toBe('p2');
    expect(morsePalace(memory, SAMPLE_PALACE_ID).id).toBe(SAMPLE_PALACE_ID);
    expect(morsePalace({ ...memory, palaces: [ownPalace('p1', 30)] }, 'p2').id).toBe('p1');
  });

  it('文字の番号の場所に、語呂の絵を置く(Cは3か所目にチーズケーキ)', () => {
    const palace = ownPalace('p1', MORSE_LOCI);
    const scenes = morseScenes(palace, MORSE_SESSIONS[0]);
    expect(scenes[2]).toMatchObject({ letter: 'C', index: 2, code: '-.-.' });
    expect(scenes[2].locus.name).toBe('場所3');
    expect(scenes[2].image).toBe('場所3に、大きなチーズケーキがドンと置かれて、甘いにおいがする！');
    expect(morseScenes(palace, MORSE_SESSIONS[2])[0].locus.name).toBe('場所19');
  });
});

describe('問題', () => {
  it('選択肢は4つで答えを含み、なるべく同じ長さの符号の文字', () => {
    const options = morseOptions(1, 'C', MORSE_LETTERS);
    expect(options).toHaveLength(4);
    expect(options).toContain('C');
    expect(new Set(options).size).toBe(4);
    expect(options.every((letter) => MORSE_CODES[letter].length === 4)).toBe(true);
    // 覚えた文字が少ないときは、それだけから。
    expect(morseOptions(2, 'E', ['E', 'T', 'A'])).toHaveLength(3);
  });

  it('聞いて当てる問題は、同じ文字が続かず、選択肢は覚えた文字から', () => {
    const letters = MORSE_SESSIONS[0];
    const questions = morseListenQuestions(5, letters, letters, 12);
    expect(questions).toHaveLength(12);
    for (let index = 1; index < questions.length; index += 1) expect(questions[index].letter).not.toBe(questions[index - 1].letter);
    for (const question of questions) {
      expect(letters).toContain(question.letter);
      expect(question.options.every((letter) => letters.includes(letter))).toBe(true);
      expect(question.code).toBe(MORSE_CODES[question.letter]);
    }
    expect(morseListenQuestions(5, letters, letters, 6)).toEqual(morseListenQuestions(5, letters, letters, 6));
  });

  it('読む問題は言葉の1文字ずつ', () => {
    const questions = morseReadQuestions(3, 'SHOGI');
    expect(questions.map(({ letter }) => letter).join('')).toBe('SHOGI');
    expect(questions.every((question) => question.options.includes(question.letter))).toBe(true);
  });

  it('打った符号の採点', () => {
    expect(scoreMorseCode('C', '-.-.')).toBe(true);
    expect(scoreMorseCode('C', '-.-')).toBe(false);
  });
});

describe('進み具合とおさらい', () => {
  it('回を終えると次の回、3回目でおさらいの段0(次の日)', () => {
    let progress = emptyMorseProgress();
    expect(morsePlan(progress, '2026-11-14')).toMatchObject({ kind: 'session', number: 1, letters: MORSE_SESSIONS[0] });
    progress = completeMorseSession(progress, 1, MORSE_SESSIONS[0].map((letter) => ({ letter, ok: letter !== 'C' })), '2026-11-14', 'castle');
    expect(progress).toMatchObject({ done: 1, palace: 'castle', stage: -1 });
    expect(morseKnownCount(progress)).toBe(8);
    expect(placedLetters(progress)).toEqual(MORSE_SESSIONS[0]);
    // 前の回をもう一度受けても、回は進まない。Cが打てたら覚えた文字に入る。
    progress = completeMorseSession(progress, 1, [{ letter: 'C', ok: true }], '2026-11-14', '');
    expect(progress.done).toBe(1);
    expect(progress.known).toContain('C');
    progress = completeMorseSession(progress, 2, MORSE_SESSIONS[1].map((letter) => ({ letter, ok: true })), '2026-11-15', '');
    progress = completeMorseSession(progress, 3, MORSE_SESSIONS[2].map((letter) => ({ letter, ok: true })), '2026-11-16', '');
    expect(progress).toMatchObject({ done: 3, stage: 0, next: '2026-11-17', palace: 'castle' });
    expect(morseKnownCount(progress)).toBe(26);
    expect(morsePlan(progress, '2026-11-16')).toMatchObject({ kind: 'review', due: false, next: '2026-11-17' });
    expect(morsePlan(progress, '2026-11-17')).toMatchObject({ kind: 'review', due: true });
  });

  it('おさらいは8割で次の段(間隔が伸びる)、届かなければ1段戻して次の日。1か月を越えると身についた', () => {
    let progress = { ...emptyMorseProgress(), done: 3, stage: 0, next: '2026-11-17', known: [...MORSE_LETTERS] };
    let result = completeMorseReview(progress, [{ letter: 'A', ok: true }], { correct: 30, total: 34 }, '2026-11-17');
    expect(result.passed).toBe(true);
    expect(result.progress).toMatchObject({ stage: 1, next: '2026-11-20' });
    result = completeMorseReview(result.progress, [{ letter: 'Q', ok: false }], { correct: 20, total: 34 }, '2026-11-20');
    expect(result.passed).toBe(false);
    expect(result.progress).toMatchObject({ stage: 0, next: '2026-11-21' });
    expect(result.progress.known).not.toContain('Q');
    progress = { ...result.progress, stage: REVIEW_DAYS.length - 1 };
    result = completeMorseReview(progress, [], { correct: 34, total: 34 }, '2026-12-30');
    expect(result.mastered).toBe(true);
    expect(morsePlan(result.progress, '2026-12-31').kind).toBe('mastered');
    expect(morseStageText(0)).toBe('1日後のおさらい');
    expect(morseStageText(4)).toBe('1か月後のおさらい');
    expect(morseStageText(REVIEW_DAYS.length)).toBe('身についた');
  });

  it('保存して読み直せる。形の違う値は捨てる', () => {
    const storage = memoryStorage();
    const store = { version: 1, morse: { ...emptyMorseProgress(), palace: 'p2', done: 2, known: ['A', 'B', 'ZZ'], stage: 3, next: '2026-11-20', last: 'x' } };
    saveCourseStore(storage, store);
    const loaded = loadCourseStore(storage);
    // 3回を終えるまでは、おさらいの段は-1のまま。知らない文字・日付でない値は捨てる。
    expect(loaded.morse).toEqual({ palace: 'p2', done: 2, known: ['A', 'B'], stage: -1, next: '2026-11-20', last: '' });
    storage.setItem(PALACE_COURSES_KEY, '{oops');
    expect(loadCourseStore(storage).morse).toEqual(emptyMorseProgress());
    expect(cleanCourseStore({ version: 1, morse: { done: 3, stage: -1 } }).morse.stage).toBe(0);
  });
});
