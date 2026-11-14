// 場所法の実用コース「モールス信号」(docs/brain-training-design.mdの17章)。画面に依存しない。
// 語呂(頭文字がその文字で、拍ごとに言うと符号のリズムになる言葉)を、宮殿のA=1か所目・B=2か所目…に置き、
// 場所から符号を打つ・音だけで当てる・言葉を読む。3回で26文字、そのあと思い出しの箱と同じ間隔でおさらいする。

import { MORSE_READ_WORDS, MORSE_WORDS } from '../data/morse-words.mjs';
import { BOX_PASS, REVIEW_DAYS, addDays } from './memory-box.mjs';
import { SAMPLE_PALACE, SAMPLE_PALACE_ID, findPalace, sceneImages, usablePalaces } from './memory-palace.mjs';
import { createRng } from './ryuo-random.mjs';

/** 実用コースの進み具合の保存の鍵(17-6)。 */
export const PALACE_COURSES_KEY = 'yacobihime:shogi-match:palace-courses:v1';

/** 国際モールス符号(A〜Z)。「.」はトン(短い音)、「-」はツー(長い音)。 */
export const MORSE_CODES = Object.freeze({
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
});
export const MORSE_LETTERS = Object.freeze(Object.keys(MORSE_CODES));
/** 3つの回(A〜I・J〜R・S〜Z。17-5)。 */
export const MORSE_SESSIONS = Object.freeze([
  Object.freeze(MORSE_LETTERS.slice(0, 9)),
  Object.freeze(MORSE_LETTERS.slice(9, 18)),
  Object.freeze(MORSE_LETTERS.slice(18)),
]);
/** 置くのに要る場所の数。 */
export const MORSE_LOCI = MORSE_LETTERS.length;
/** 符号の音の1単位(ミリ秒)。トンは1単位、ツーは3単位、音と音のあいだは1単位(17-4)。 */
export const MORSE_UNIT_MS = 90;
/** 聞いて当てる問題の数(回の始めのおさらい・回の終わり・全部のおさらい)。 */
export const MORSE_WARMUP_COUNT = 4;
export const MORSE_LISTEN_COUNT = 6;
export const MORSE_REVIEW_LISTEN_COUNT = 8;
/** おさらいで次の段に上がる割合(思い出しの箱と同じ)。 */
export const MORSE_PASS = BOX_PASS;
export { MORSE_READ_WORDS };

/** 拍が伸ばす音(ツー)か。 */
export function isLongBeat(beat) {
  return beat.endsWith('ー');
}

/** 拍の並びから符号を作る(伸ばす音はツー、ほかの1音はトン)。 */
export function chantCode(chant) {
  return chant.map((beat) => (isLongBeat(beat) ? '-' : '.')).join('');
}

/** その文字の語呂。 */
export function morseWord(letter) {
  return MORSE_WORDS.find((item) => item.letter === letter) ?? null;
}

/** 符号の読み(「ツー・トン・ツー・トン」)。 */
export function morseSpoken(code) {
  return [...code].map((mark) => (mark === '-' ? 'ツー' : 'トン')).join('・');
}

/** 符号の見た目(「－・－・」)。 */
export function morseMarks(code) {
  return [...code].map((mark) => (mark === '-' ? '－' : '・')).join('');
}

/**
 * 符号を鳴らす時間割。atは始まり、msは長さ(ミリ秒)。totalは全体の長さ。
 * @returns {{ marks: { at: number, ms: number, kind: 'dot' | 'dash' }[], total: number }}
 */
export function morseTimeline(code, unitMs = MORSE_UNIT_MS) {
  const marks = [];
  let at = 0;
  for (const mark of code) {
    const ms = (mark === '-' ? 3 : 1) * unitMs;
    marks.push({ at, ms, kind: mark === '-' ? 'dash' : 'dot' });
    at += ms + unitMs;
  }
  return { marks, total: Math.max(0, at - unitMs) };
}

// ===== 置く宮殿 =====

/**
 * モールス信号を置く宮殿(17-5)。26か所以上ある自分の宮殿のうち、毎日の練習の宮殿と、箱に組がある宝物用の宮殿をよける。
 * なければ見本のお城(30か所)。決めてあり、まだ使えるならそれ。
 * @param {{ palaces: readonly { id: string, loci: readonly unknown[] }[], sample: boolean, lastPalace: string, boxes: readonly unknown[], treasurePalace: string }} memory
 * @param {string} [chosen]
 */
export function morsePalace(memory, chosen = '') {
  if (chosen) {
    const kept = chosen === SAMPLE_PALACE_ID ? SAMPLE_PALACE : findPalace(memory, chosen);
    if (kept && kept.loci.length >= MORSE_LOCI) return kept;
  }
  const avoid = new Set([memory.lastPalace, memory.boxes?.length ? memory.treasurePalace : ''].filter(Boolean));
  const own = usablePalaces(memory).filter((palace) => palace.id !== SAMPLE_PALACE_ID && palace.loci.length >= MORSE_LOCI && !avoid.has(palace.id));
  return own[0] ?? SAMPLE_PALACE;
}

/**
 * 回の文字を宮殿に置く場面(文字の番号の場所に、語呂の絵)。imageOptionsの最初は語呂の絵の文。
 * @param {{ loci: readonly { name: string, emoji: string, kind?: string }[] }} palace
 * @param {readonly string[]} letters
 */
export function morseScenes(palace, letters) {
  return letters.map((letter) => {
    const index = MORSE_LETTERS.indexOf(letter);
    const word = morseWord(letter);
    const locus = palace.loci[index];
    const imageOptions = sceneImages(locus, { word: word.word, cue: word.cue });
    return { letter, index, locus, word, code: MORSE_CODES[letter], image: imageOptions[0], imageOptions };
  });
}

// ===== 問題 =====

function shuffled(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * 4つの選択肢(答えと、覚えた文字からほかの3つ)。なるべく同じ長さの符号の文字を選ぶ(長さで当てられないように。17-5)。
 * @param {number} seed
 * @param {string} answer
 * @param {readonly string[]} pool
 */
export function morseOptions(seed, answer, pool) {
  const rng = createRng(seed);
  const length = MORSE_CODES[answer].length;
  const others = pool.filter((letter) => letter !== answer);
  const near = shuffled(rng, others.filter((letter) => Math.abs(MORSE_CODES[letter].length - length) <= 0));
  const far = shuffled(rng, others.filter((letter) => Math.abs(MORSE_CODES[letter].length - length) > 0))
    .sort((a, b) => Math.abs(MORSE_CODES[a].length - length) - Math.abs(MORSE_CODES[b].length - length));
  const picked = [...near, ...far].slice(0, 3);
  return shuffled(rng, [answer, ...picked]);
}

/**
 * 聞いて当てる問題。lettersから出し(同じ文字が続かないように)、選択肢はpoolから。
 * @param {number} seed
 * @param {readonly string[]} letters
 * @param {readonly string[]} pool
 * @param {number} count
 */
export function morseListenQuestions(seed, letters, pool, count) {
  const rng = createRng(seed);
  const questions = [];
  let order = shuffled(rng, letters);
  while (questions.length < count && letters.length) {
    if (!order.length) order = shuffled(rng, letters);
    const letter = order.shift();
    if (questions.at(-1)?.letter === letter && letters.length > 1) {
      order.push(letter);
      continue;
    }
    questions.push({ letter, code: MORSE_CODES[letter], options: morseOptions(seed + questions.length * 7919 + 1, letter, pool) });
  }
  return questions;
}

/** 読む問題(言葉の1文字ずつ。選択肢は全部の文字から)。 */
export function morseReadQuestions(seed, word) {
  return [...word].map((letter, index) => ({ letter, code: MORSE_CODES[letter], options: morseOptions(seed + index * 104729 + 3, letter, MORSE_LETTERS) }));
}

/** 打った符号が合っているか。 */
export function scoreMorseCode(letter, given) {
  return given === MORSE_CODES[letter];
}

// ===== 進み具合 =====

export function emptyMorseProgress() {
  return {
    /** 置く宮殿のid(''はまだ決めていない)。 */
    palace: '',
    /** 終えた回(0〜3)。 */
    done: 0,
    /** 場所から正しく打てた文字(いちばん新しい答えで)。 */
    known: [],
    /** おさらいの段(コースを終えるまで-1。REVIEW_DAYSの番号。全部越えたらREVIEW_DAYS.length)。 */
    stage: -1,
    /** 次のおさらいの日(''はまだ)。 */
    next: '',
    /** いちばん新しく受けた日。 */
    last: '',
  };
}

export function emptyCourseStore() {
  return { version: 1, morse: emptyMorseProgress() };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 保存の値を整える。形が違う値は捨てる。 */
export function cleanCourseStore(value) {
  const store = emptyCourseStore();
  if (!isPlainObject(value) || value.version !== 1 || !isPlainObject(value.morse)) return store;
  const source = value.morse;
  const morse = store.morse;
  morse.palace = typeof source.palace === 'string' ? source.palace.slice(0, 40) : '';
  morse.done = Number.isInteger(source.done) ? Math.max(0, Math.min(MORSE_SESSIONS.length, source.done)) : 0;
  morse.known = Array.isArray(source.known) ? [...new Set(source.known.filter((letter) => MORSE_LETTERS.includes(letter)))] : [];
  morse.stage = Number.isInteger(source.stage) ? Math.max(-1, Math.min(REVIEW_DAYS.length, source.stage)) : -1;
  if (morse.done < MORSE_SESSIONS.length) morse.stage = -1;
  else if (morse.stage < 0) morse.stage = 0;
  morse.next = typeof source.next === 'string' && DAY.test(source.next) ? source.next : '';
  morse.last = typeof source.last === 'string' && DAY.test(source.last) ? source.last : '';
  return store;
}

export function loadCourseStore(storage) {
  try {
    return cleanCourseStore(JSON.parse(storage?.getItem(PALACE_COURSES_KEY) ?? 'null'));
  } catch {
    return emptyCourseStore();
  }
}

export function saveCourseStore(storage, store) {
  try {
    storage?.setItem(PALACE_COURSES_KEY, JSON.stringify(store));
  } catch {
    // 保存できない環境でも、その場では遊べる。
  }
}

/** 覚えた文字(場所から打てた文字)の数。道場の記録の値。 */
export function morseKnownCount(progress) {
  return progress.known.length;
}

/** これまでの回で置いた文字(A〜)。 */
export function placedLetters(progress) {
  return MORSE_SESSIONS.slice(0, progress.done).flat();
}

/**
 * 次にすること。session(次の回)・review(おさらいの日)・wait(次のおさらいはまだ)・mastered(1か月のおさらいを越えた)。
 * @returns {{ kind: 'session', number: number, letters: readonly string[] } | { kind: 'review', due: boolean, next: string } | { kind: 'mastered', next: string }}
 */
export function morsePlan(progress, day) {
  if (progress.done < MORSE_SESSIONS.length) {
    return { kind: 'session', number: progress.done + 1, letters: MORSE_SESSIONS[progress.done] };
  }
  if (progress.stage >= REVIEW_DAYS.length) return { kind: 'mastered', next: progress.next };
  return { kind: 'review', due: !progress.next || progress.next <= day, next: progress.next };
}

/** 場所から打った答えで、覚えた文字を直す(合えば足し、まちがえれば外す)。 */
function updateKnown(known, answers) {
  const set = new Set(known);
  for (const { letter, ok } of answers) {
    if (ok) set.add(letter);
    else set.delete(letter);
  }
  return MORSE_LETTERS.filter((letter) => set.has(letter));
}

/**
 * 回を終える。終えた回を進め、覚えた文字を直す。3回目を終えたら、おさらいの段0にして次の日を決める。
 * 前に終えた回をもう一度受けたときは、回は進めない。
 * @param {ReturnType<typeof emptyMorseProgress>} progress
 * @param {number} number 受けた回(1〜3)
 * @param {{ letter: string, ok: boolean }[]} answers 場所から打った答え
 * @param {string} day
 * @param {string} palaceId
 */
export function completeMorseSession(progress, number, answers, day, palaceId) {
  const done = Math.max(progress.done, Math.min(MORSE_SESSIONS.length, number));
  const next = { ...progress, palace: palaceId || progress.palace, done, known: updateKnown(progress.known, answers), last: day };
  if (done >= MORSE_SESSIONS.length && progress.stage < 0) {
    next.stage = 0;
    next.next = addDays(day, REVIEW_DAYS[0]);
  }
  return next;
}

/**
 * おさらいを終える。8割で次の段、届かなければ1段戻す(0より下にはしない)。段が上がると、次の日はその段の間隔あと。
 * @param {ReturnType<typeof emptyMorseProgress>} progress
 * @param {{ letter: string, ok: boolean }[]} answers 場所から打った答え
 * @param {{ correct: number, total: number }} score 全部の問題の正解数
 * @param {string} day
 */
export function completeMorseReview(progress, answers, score, day) {
  const passed = score.total > 0 && score.correct / score.total >= MORSE_PASS;
  const stage = passed ? Math.min(REVIEW_DAYS.length, Math.max(0, progress.stage) + 1) : Math.max(0, progress.stage - 1);
  const wait = REVIEW_DAYS[Math.min(stage, REVIEW_DAYS.length - 1)];
  return {
    progress: { ...progress, stage, known: updateKnown(progress.known, answers), next: addDays(day, passed ? wait : 1), last: day },
    passed,
    mastered: stage >= REVIEW_DAYS.length,
  };
}

/** おさらいの段の言葉(「次は3日後」など)。 */
export function morseStageText(stage) {
  if (stage >= REVIEW_DAYS.length) return '身についた';
  const days = REVIEW_DAYS[Math.max(0, stage)];
  return days >= 30 ? '1か月後のおさらい' : days >= 14 ? '2週間後のおさらい' : days >= 7 ? '1週間後のおさらい' : `${days}日後のおさらい`;
}
