// 脳トレ「記憶力」の場所法の学校と毎日の練習(docs/brain-training-design.mdの11-6)。
// 自分の宮殿(palace-builder.mjs)に、覚えたいものを1つずつ「大げさな絵」にして置き、場所をたどって思い出す。
// 講1〜9で方法を身につけ、講3を終えると毎日の練習(きのうの言葉・宮殿に置く・数字)が開く。画面に依存しない。

import { MEMORY_PROVERBS, MEMORY_WORDS } from '../data/memory-palace-words.mjs';
import { openingFormationSteps, openingStepLabel } from './opening-formation.mjs';
import { cleanPalaces, palaceReady } from './palace-builder.mjs';
import { createRng } from './ryuo-random.mjs';

/** 記憶力の部屋の保存の鍵(自分の宮殿・講の進み・前の回の言葉)。 */
export const MEMORY_PALACE_KEY = 'yacobihime:shogi-match:memory-palace:v1';
/** 前の版の脳トレの記録(自分の宮殿の場所と、毎日の練習の言葉の数を引き継ぐ)。 */
const BRAIN_TRAINING_V1_KEY = 'yacobihime:shogi-match:brain-training:v1';

/** 見本の宮殿(やこび姫のお城の30か所)。自分の場所を使いたくない人・すぐ試したい人向け(B13)。 */
export const CASTLE_LOCI = Object.freeze([
  ['門', '⛩️'], ['池', '🐟'], ['石灯籠', '🏮'], ['玄関', '👞'], ['廊下の掛け軸', '🖼️'],
  ['台所', '🍳'], ['茶の間', '🍵'], ['将棋の間', '☗'], ['書庫', '📚'], ['天守の窓', '🏯'],
  ['大階段', '🪜'], ['鏡の間', '🪞'], ['衣装部屋', '👘'], ['寝室', '🛏️'], ['縁側', '🌸'],
  ['宝物庫', '💎'], ['琴の間', '🎵'], ['時計の間', '⏰'], ['物見やぐら', '🔭'], ['隠し扉', '🚪'],
  ['地図の部屋', '🗺️'], ['鍛冶場', '⚒️'], ['薬の部屋', '🧪'], ['鳥の巣', '🐦'], ['鐘つき堂', '🔔'],
  ['星見台', '⭐'], ['雲の橋', '☁️'], ['金のしゃちほこ', '🐉'], ['屋根の上', '🌅'], ['天守のてっぺん', '👑'],
].map(([name, emoji]) => Object.freeze({ name, emoji, group: '' })));
export const SAMPLE_PALACE_ID = 'castle';
export const SAMPLE_PALACE = Object.freeze({ id: SAMPLE_PALACE_ID, name: '見本の宮殿（お城）', place: 'sample', loci: CASTLE_LOCI });

/**
 * 学校の講。afterは開くために終えておく講(講7は講5のあと、次の日に)。
 * countは置く数、hintsは絵の手がかり(絵文字と大げさな絵の文)を見せるか、backwardは後ろからも思い出すか。
 */
export const PALACE_LESSONS = Object.freeze([
  { id: 'walk', number: 1, title: '宮殿を歩く', goal: '自分の宮殿の場所を、順番・逆順・飛び飛びで言う', kind: 'walk', after: null },
  { id: 'image', number: 2, title: '絵にする', goal: '覚えたいものを、大げさで動きのある絵にするコツ', kind: 'image', after: 'walk' },
  { id: 'place5', number: 3, title: '5個を置く', goal: '言葉5個を、宮殿の最初の5か所に置く', kind: 'order', count: 5, hints: true, after: 'image' },
  { id: 'ten', number: 4, title: '10個と逆順', goal: '10個。前からと、後ろからも思い出す', kind: 'order', count: 10, hints: true, backward: true, after: 'place5' },
  { id: 'twenty', number: 5, title: '20個', goal: '20個を順番どおりに。次の日にも思い出す', kind: 'order', count: 20, needLoci: 20, keep: true, after: 'ten' },
  { id: 'digits', number: 6, title: '数字を絵にする', goal: '0〜9を形の絵にして、10けたの数を覚える', kind: 'digits', after: 'twenty' },
  { id: 'nextday', number: 7, title: '次の日に思い出す', goal: '講5で置いた20個を、次の日に思い出す', kind: 'nextday', after: 'twenty' },
  { id: 'two', number: 8, title: '宮殿を使い分ける', goal: '同じ宮殿にすぐ置くと混ざる。2つ目の宮殿を作る', kind: 'two', after: 'digits' },
  { id: 'use', number: 9, title: '使ってみる', goal: '買い物リスト・やること・人の名前・将棋', kind: 'use', after: 'two' },
].map((lesson) => Object.freeze(lesson)));
const LESSON_IDS = new Set(PALACE_LESSONS.map(({ id }) => id));
/** 毎日の練習が開く講。 */
export const PRACTICE_OPENS_AFTER = 'place5';
/** 毎日の練習の言葉の数。 */
export const PRACTICE_MIN = 5;
export const PRACTICE_MAX = 30;
export const PRACTICE_STEP = 2;
/** 毎日の練習で、次の回に増やす・減らす合格の割合。 */
export const PRACTICE_PASS = 0.8;
/** 数字のけた数(1か所に2けた)。 */
export const DIGIT_LESSON_LENGTH = 10;
export const DIGIT_MIN = 6;
export const DIGIT_MAX = 40;

/** 大げさな絵にするための動き(場所と言葉に添える)。 */
const SILLY_ACTIONS = [
  'が、はみ出すほど大きくなっている！',
  'が、ぐるぐる回って光っている！',
  'で、足のふみ場もない！',
  'が、大声で歌っている！',
  'が、ドーンと落ちてきた！',
  'が、ぷかぷか浮かんでいる！',
  'が、山のように積み上がっている！',
  'が、ぴょんぴょん跳ねている！',
];

/** 講2の「絵にするコツ」。 */
export const IMAGE_TIPS = Object.freeze([
  { title: '大げさに', text: 'ありえないほど大きく、たくさん' },
  { title: '動かす', text: '回る・跳ねる・こわれる・歌う' },
  { title: '場所とからめる', text: 'ドアにはさまる・冷蔵庫からあふれる' },
]);

/**
 * 数字の絵(形が似ているもの)。1つめが最初の絵で、自分で変えられる。
 */
export const DIGIT_CHOICES = Object.freeze([
  [['たまご', '🥚'], ['ドーナツ', '🍩']],
  [['えんぴつ', '✏️'], ['ろうそく', '🕯️']],
  [['白鳥', '🦢'], ['アヒル', '🦆']],
  [['耳', '👂'], ['くちびる', '👄']],
  [['ヨット', '⛵'], ['旗', '🚩']],
  [['フック', '🪝'], ['タツノオトシゴ', '🐉']],
  [['かたつむり', '🐌'], ['さくらんぼ', '🍒']],
  [['ブーメラン', '🪃'], ['つえ', '🦯']],
  [['ゆきだるま', '⛄'], ['めがね', '👓']],
  [['ふうせん', '🎈'], ['おたまじゃくし', '🐸']],
].map((choices) => Object.freeze(choices.map(([word, emoji]) => Object.freeze({ word, emoji })))));

/** 講9で使う、買い物リスト・やること・人の名前。 */
export const SHOPPING_ITEMS = Object.freeze([
  ['牛乳', '🥛'], ['たまご', '🥚'], ['食パン', '🍞'], ['バナナ', '🍌'], ['トマト', '🍅'], ['チーズ', '🧀'],
  ['ヨーグルト', '🥣'], ['じゃがいも', '🥔'], ['にんじん', '🥕'], ['せっけん', '🧼'], ['ティッシュ', '🧻'], ['電池', '🔋'],
].map(([word, emoji]) => Object.freeze({ word, emoji })));
export const TODO_ITEMS = Object.freeze([
  ['手紙を出す', '📮'], ['本を返す', '📕'], ['かさを持っていく', '☂️'], ['植木に水をやる', '🪴'], ['電話をかける', '☎️'],
  ['ゴミを出す', '🗑️'], ['くつを洗う', '👟'], ['カギをかける', '🔑'], ['宿題を出す', '📝'], ['写真をとる', '📷'],
].map(([word, emoji]) => Object.freeze({ word, emoji })));
/** 人の名前は、名前の音から絵を作る(さとう→砂糖)。 */
export const NAME_PEOPLE = Object.freeze([
  ['さとうさん', '👩', '砂糖', '🍬'], ['たなかさん', '👨', '田んぼ', '🌾'], ['すずきさん', '👧', '鈴', '🔔'],
  ['やまもとさん', '👴', '山', '⛰️'], ['いけださん', '👵', '池', '🐟'], ['はやしさん', '👦', '林', '🌲'],
  ['かわむらさん', '🧑', '川', '🏞️'], ['いしいさん', '👱', '石', '🪨'], ['ほしのさん', '🧔', '星', '⭐'],
  ['うめださん', '👩‍🦱', '梅', '🌸'],
].map(([word, face, cue, emoji]) => Object.freeze({ word, face, cue, emoji })));

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function shuffled(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ===== 保存 =====

export function defaultDigits() {
  return DIGIT_CHOICES.map((choices) => choices[0].word);
}

export function emptyMemoryStore() {
  return {
    version: 1,
    palaces: [],
    sample: false,
    lessons: [],
    digits: defaultDigits(),
    lastWords: null,
    lessonWords: null,
    lastPalace: '',
    practiceCount: PRACTICE_MIN,
    digitCount: DIGIT_LESSON_LENGTH,
  };
}

function cleanWordsEntry(value, palaceIds) {
  if (!isPlainObject(value) || typeof value.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null;
  if (!palaceIds.has(value.palace)) return null;
  const words = Array.isArray(value.words) ? value.words.filter((word) => typeof word === 'string' && word.length <= 20).slice(0, PRACTICE_MAX) : [];
  return words.length ? { palace: value.palace, words, day: value.day } : null;
}

/** 保存の値を整える。形が違う値は捨てる。 */
export function cleanMemoryStore(value) {
  const store = emptyMemoryStore();
  if (!isPlainObject(value) || value.version !== 1) return store;
  store.palaces = cleanPalaces(value.palaces);
  store.sample = value.sample === true;
  store.lessons = Array.isArray(value.lessons) ? [...new Set(value.lessons.filter((id) => LESSON_IDS.has(id)))] : [];
  if (Array.isArray(value.digits) && value.digits.length === 10) {
    store.digits = value.digits.map((word, digit) => (typeof word === 'string' && word.trim() ? word.trim().slice(0, 10) : DIGIT_CHOICES[digit][0].word));
  }
  const palaceIds = new Set([SAMPLE_PALACE_ID, ...store.palaces.map(({ id }) => id)]);
  store.lastWords = cleanWordsEntry(value.lastWords, palaceIds);
  store.lessonWords = cleanWordsEntry(value.lessonWords, palaceIds);
  store.lastPalace = palaceIds.has(value.lastPalace) ? value.lastPalace : '';
  if (Number.isFinite(value.practiceCount)) store.practiceCount = clamp(Math.floor(value.practiceCount), PRACTICE_MIN, PRACTICE_MAX);
  if (Number.isFinite(value.digitCount)) store.digitCount = clamp(Math.floor(value.digitCount / 2) * 2, DIGIT_MIN, DIGIT_MAX);
  return store;
}

/**
 * 前の版の脳トレの記録から引き継ぐ。自分の宮殿(10か所以上)は「自由に作る」の宮殿にし、毎日の練習の言葉の数を残す。
 * 前の講の進みは、講が新しくなったので引き継がない。
 */
export function migrateMemoryStoreV1(brainV1) {
  const store = emptyMemoryStore();
  if (!isPlainObject(brainV1) || brainV1.version !== 1) return store;
  const custom = Array.isArray(brainV1.palace?.custom) ? brainV1.palace.custom : [];
  const loci = [...new Set(custom.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim().slice(0, 16)))]
    .slice(0, 30)
    .map((name) => ({ name, emoji: '📍', group: '' }));
  if (loci.length >= 10) store.palaces = cleanPalaces([{ id: 'p1', name: '自分の宮殿', place: 'free', loci }]);
  const count = brainV1.levels?.palace;
  if (Number.isFinite(count)) store.practiceCount = clamp(Math.floor(count), PRACTICE_MIN, PRACTICE_MAX);
  return store;
}

function readJson(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

export function loadMemoryStore(storage) {
  const parsed = readJson(storage, MEMORY_PALACE_KEY);
  if (parsed !== null) return cleanMemoryStore(parsed);
  return migrateMemoryStoreV1(readJson(storage, BRAIN_TRAINING_V1_KEY));
}

export function saveMemoryStore(storage, store) {
  try {
    storage?.setItem(MEMORY_PALACE_KEY, JSON.stringify(store));
  } catch {
    // 保存できない環境でも、その場では遊べる。
  }
}

// ===== 宮殿 =====

/** 使える宮殿(10か所以上の自分の宮殿と、選んでいれば見本の宮殿)。 */
export function usablePalaces(store) {
  const own = store.palaces.filter(palaceReady);
  return store.sample ? [...own, SAMPLE_PALACE] : own;
}

export function hasPalace(store) {
  return usablePalaces(store).length > 0;
}

export function findPalace(store, id) {
  return usablePalaces(store).find((palace) => palace.id === id) ?? null;
}

/** 講で使う宮殿(前に使った宮殿か、最初の宮殿)。 */
export function lessonPalace(store) {
  return findPalace(store, store.lastPalace) ?? usablePalaces(store)[0] ?? null;
}

// ===== 講 =====

/** 講が開いているか。講1は宮殿があれば開き、ほかは前の講(after)を終えると開く。 */
export function lessonUnlocked(lessons, lessonId, palaceReadyNow = true) {
  const lesson = PALACE_LESSONS.find(({ id }) => id === lessonId);
  if (!lesson || !palaceReadyNow) return false;
  return lesson.after === null || lessons.includes(lesson.after);
}

/** 次に受ける講(開いていて、まだ終えていない、いちばん前の講)。全部終えたらnull。 */
export function nextLesson(lessons) {
  return PALACE_LESSONS.find((lesson) => !lessons.includes(lesson.id) && lessonUnlocked(lessons, lesson.id))?.id ?? null;
}

export function practiceOpen(lessons) {
  return lessons.includes(PRACTICE_OPENS_AFTER);
}

/**
 * 講7(次の日に思い出す)の状態。講5で置いた言葉が、前の日より前ならready、同じ日ならwait、なければmissing。
 * @returns {'ready' | 'wait' | 'missing'}
 */
export function nextDayState(store, day) {
  const entry = store.lessonWords;
  if (!entry || !findPalace(store, entry.palace)) return 'missing';
  return entry.day < day ? 'ready' : 'wait';
}

// ===== 覚える組 =====

/** 1つの場所に置く1つの絵(場所・覚えるもの・大げさな絵の文)。 */
function scene(locus, item, action) {
  return { locus, item, image: `${locus.name}に${item.word}${action}` };
}
/** 大げさな絵の動きを、続けて同じにならないよう混ぜて配る。 */
function actionsFor(rng, count) {
  const list = [];
  while (list.length < count) list.push(...shuffled(rng, SILLY_ACTIONS));
  return list.slice(0, count);
}

/**
 * 覚える言葉の組を作る。同じ種なら同じ組。distractorsは思い出しの札に混ぜる、ほかの言葉。
 * avoidの言葉は使わない(前の回の言葉と混ざらないように)。
 * @param {number} seed
 * @param {number} count
 * @param {readonly { name: string, emoji: string }[]} loci
 * @param {string[]} [avoid]
 */
export function palaceWordSet(seed, count, loci = CASTLE_LOCI, avoid = []) {
  const rng = createRng(seed);
  const size = Math.min(count, loci.length);
  const skip = new Set(avoid);
  const words = shuffled(rng, MEMORY_WORDS.filter(({ word }) => !skip.has(word)));
  const items = words.slice(0, size);
  const distractors = words.slice(size, size * 2);
  const actions = actionsFor(rng, items.length);
  return {
    scenes: items.map((item, index) => scene(loci[index], item, actions[index])),
    distractors,
    pool: shuffled(rng, [...items, ...distractors]),
  };
}

/** 決まった言葉(前の回の言葉など)を思い出す札。言葉と、同じ数のほかの言葉を混ぜる。 */
export function recallPool(seed, words) {
  const rng = createRng(seed);
  const skip = new Set(words);
  const others = shuffled(rng, MEMORY_WORDS.filter(({ word }) => !skip.has(word))).slice(0, words.length).map(({ word }) => word);
  return shuffled(rng, [...words, ...others]);
}

/** 記憶テストの組(15個の言葉と、じゃまの15個)。方法を教える前と、コースの後で同じ形(11-6)。 */
export function memoryTestSet(seed, count = 15) {
  const rng = createRng(seed);
  const words = shuffled(rng, MEMORY_WORDS);
  const items = words.slice(0, count);
  return { words: items, pool: shuffled(rng, [...items, ...words.slice(count, count * 2)]).map(({ word }) => word) };
}

/** 4択の選択肢(答えと、ほかの3つ)。 */
export function fourChoices(seed, answer, others) {
  const rng = createRng(seed);
  const pool = shuffled(rng, [...new Set(others)].filter((item) => item !== answer)).slice(0, 3);
  return shuffled(rng, [answer, ...pool]);
}

/**
 * 順番に押した答えの採点。positionsは何番目が合ったか(とばした所は空の文字)。
 * @param {string[]} expected
 * @param {string[]} answer
 */
export function scoreOrder(expected, answer) {
  const positions = expected.map((word, index) => answer[index] === word);
  const correct = positions.filter(Boolean).length;
  return { correct, total: expected.length, positions, accuracy: expected.length ? correct / expected.length : 0 };
}

/** 講1の場所の問題。順番どおり・逆順・飛び飛び(「7番目は？」を3問)。 */
export function walkQuiz(seed, loci, count = 10) {
  const rng = createRng(seed);
  const route = loci.slice(0, Math.min(count, loci.length));
  const names = route.map(({ name }) => name);
  const jumps = shuffled(rng, route.map((_, index) => index)).slice(0, 3).map((index) => ({
    number: index + 1,
    answer: names[index],
    options: fourChoices(seed + index + 1, names[index], names),
  }));
  return { route, forward: names, backward: [...names].reverse(), pool: shuffled(rng, names), jumps };
}

/** 講2の「どの絵がいちばん覚えやすい？」。大げさで、動きがあって、場所とからむ絵が正解。 */
export function imageQuiz(seed, loci) {
  const rng = createRng(seed);
  const words = shuffled(rng, MEMORY_WORDS).slice(0, 2);
  return words.map((item, index) => {
    const locus = loci[(index + 3) % loci.length];
    const options = [
      { text: `${locus.name}のそばに、${item.word}が1つ置いてある。`, good: false },
      { text: `${locus.name}の上に、${item.word}の絵がかざってある。`, good: false },
      { text: `${locus.name}から、巨大な${item.word}がドドドッとあふれ出して止まらない！`, good: true },
    ];
    return { locus, item, options: shuffled(rng, options) };
  });
}

/** 講2の見本の絵(宮殿の最初の3か所に、3つの言葉)。 */
export function imageExamples(seed, loci) {
  return palaceWordSet(seed, 3, loci).scenes;
}

/** 毎日の練習の次の言葉の数。全部合えば2つ増やし、8割未満なら2つ減らす。 */
export function nextPracticeCount(count, accuracy, maxLoci = PRACTICE_MAX) {
  const max = Math.min(PRACTICE_MAX, maxLoci);
  if (accuracy >= 1) return Math.min(max, count + PRACTICE_STEP);
  if (accuracy < PRACTICE_PASS) return Math.max(PRACTICE_MIN, count - PRACTICE_STEP);
  return Math.min(max, count);
}

/** 毎日の練習の記録。8割以上合ったら、合った数。 */
export function practiceValue(score) {
  return score.accuracy >= PRACTICE_PASS ? score.correct : 0;
}

// ===== 毎日の練習 =====

/**
 * 今日の毎日の練習。①前の回の言葉(前の日より前の回があれば) → ②宮殿に置く → ③数字(講6を終えていれば、日替わり)。
 * 宮殿が2つ以上あれば、前の回と別の宮殿を使う(混ざりを防ぐ。B14)。1つなら、思い出してから同じ宮殿に置く。
 * @param {ReturnType<typeof emptyMemoryStore>} store
 * @param {string} day
 */
export function planPractice(store, day) {
  const palaces = usablePalaces(store);
  if (!palaces.length) return null;
  const last = store.lastWords;
  const recall = last && last.day < day && findPalace(store, last.palace) ? last : null;
  let palace = findPalace(store, store.lastPalace) ?? palaces[0];
  if (palaces.length >= 2 && last) palace = palaces.find(({ id }) => id !== last.palace) ?? palace;
  const count = clamp(store.practiceCount, PRACTICE_MIN, Math.min(PRACTICE_MAX, palace.loci.length));
  const digits = store.lessons.includes('digits') && Number(day.slice(-2)) % 2 === 1;
  const digitCount = clamp(store.digitCount, DIGIT_MIN, Math.min(DIGIT_MAX, palace.loci.length * 2));
  return { recall, palace, count, digits, digitCount };
}

/** 前の回の言葉の呼び方。前の日なら「きのうの言葉」。 */
export function recallLabel(entryDay, day) {
  const [a, b] = [entryDay, day].map((value) => {
    const [year, month, date] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, date);
  });
  return Math.round((b - a) / 86400000) === 1 ? 'きのうの言葉' : '前の回の言葉';
}

// ===== 数字 =====

/** 数字の絵(言葉と絵文字)。自分で変えた言葉は絵文字を🔢にする。 */
export function digitImage(digits, digit) {
  const word = digits[digit] ?? DIGIT_CHOICES[digit][0].word;
  const known = DIGIT_CHOICES[digit].find((choice) => choice.word === word);
  return { word, emoji: known?.emoji ?? '🔢' };
}

/** 覚える数(けた数は偶数。同じ種なら同じ数)。 */
export function digitNumber(seed, length) {
  const rng = createRng(seed);
  let text = '';
  for (let index = 0; index < length; index += 1) text += String(Math.floor(rng.next() * 10));
  return text;
}

/** 数を2けたずつ場所に置く絵。 */
export function digitScenes(number, loci, digits) {
  const scenes = [];
  for (let index = 0; index * 2 < number.length && index < loci.length; index += 1) {
    const pair = number.slice(index * 2, index * 2 + 2);
    const images = [...pair].map((digit) => digitImage(digits, Number(digit)));
    const locus = loci[index];
    scenes.push({
      locus,
      pair,
      images,
      image: images.length === 2
        ? `${locus.name}で、${images[0].word}が${images[1].word}にぶつかって大さわぎ！`
        : `${locus.name}に、${images[0].word}がドーンと立っている！`,
    });
  }
  return scenes;
}

/** 数の採点(けたごと)。 */
export function scoreDigits(expected, answer) {
  const positions = [...expected].map((digit, index) => answer[index] === digit);
  const correct = positions.filter(Boolean).length;
  return { correct, total: expected.length, positions, accuracy: expected.length ? correct / expected.length : 0 };
}

/** 次の数字のけた数。全部合えば2けた増やし、8割未満なら2けた減らす。 */
export function nextDigitCount(count, accuracy, maxLoci = DIGIT_MAX / 2) {
  const max = Math.min(DIGIT_MAX, maxLoci * 2);
  if (accuracy >= 1) return Math.min(max, count + 2);
  if (accuracy < PRACTICE_PASS) return Math.max(DIGIT_MIN, count - 2);
  return Math.min(max, count);
}

// ===== 講9 使ってみる =====

/** 買い物リストかやることを、宮殿の場所に置く組。 */
export function listScenes(seed, kind, loci) {
  const rng = createRng(seed);
  const source = kind === 'todo' ? TODO_ITEMS : SHOPPING_ITEMS;
  const count = kind === 'todo' ? 5 : 8;
  const items = shuffled(rng, source).slice(0, Math.min(count, loci.length));
  const actions = actionsFor(rng, items.length);
  return { scenes: items.map((item, index) => scene(loci[index], item, actions[index])), pool: shuffled(rng, source.map(({ word }) => word)) };
}

/** 人の名前を、名前の音の絵で宮殿に置く組。 */
export function nameScenes(seed, loci) {
  const rng = createRng(seed);
  const people = shuffled(rng, NAME_PEOPLE).slice(0, Math.min(5, loci.length));
  return people.map((person, index) => ({
    locus: loci[index],
    item: { word: person.word, emoji: person.face },
    person,
    image: `${loci[index].name}で、${person.word}が${person.cue}${person.emoji}をかかえて手をふっている！`,
  }));
}

/**
 * 講9の将棋の手順(8手)。四間飛車と美濃囲いを、対局の作戦カード・教室のコツと同じ手順(opening-formation.mjs)で作る。
 * @returns {{ label: string, usi: string }[]}
 */
export function shogiSequence() {
  const { steps } = openingFormationSteps('shiken', 'mino');
  return steps.slice(0, 10).map((step) => ({ label: openingStepLabel(step, 'black'), usi: step.usi }));
}

/**
 * 講9の将棋の場面(定跡の手順か格言を、場所に置く)。
 * @param {number} seed
 * @param {readonly { name: string, emoji: string }[]} [loci]
 * @param {'moves' | 'proverbs'} [kind]
 */
export function shogiScenes(seed, loci = CASTLE_LOCI, kind = 'moves') {
  const rng = createRng(seed);
  const items = kind === 'moves'
    ? shogiSequence().map(({ label }) => ({ word: label, emoji: '☗' }))
    : MEMORY_PROVERBS.map((proverb) => ({ word: proverb, emoji: '📜' }));
  const actions = actionsFor(rng, items.length);
  return items.slice(0, loci.length).map((item, index) => scene(loci[index], item, actions[index]));
}
