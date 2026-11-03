// 脳トレ「記憶力」の場所法の学校と毎日の練習(docs/brain-training-design.mdの11-6)。
// 自分の宮殿(palace-builder.mjs)に、覚えたいものを1つずつ「場所とからんで動く絵」にして置き、場所をたどって思い出す。
// 講1〜9で方法を身につけ、講3を終えると毎日の練習(きのうの言葉・宮殿に置く・数字)が開く。画面に依存しない。

import { MEMORY_WORDS } from '../data/memory-palace-words.mjs';
import { LOCUS_ACTS, LOCUS_KIND_BY_NAME, LOCUS_KINDS } from '../data/palace-acts.mjs';
import { MOVE_CUES, PROVERB_SET, TREASURE_SETS } from '../data/memory-treasure-sets.mjs';
import { addBox, applyReview, cleanBoxes, cleanShelf, nextBoxDay, dueBoxes, addBlocker, checkShelfEntry, editBoxWords, repackBoxes, returnShelfToBox } from './memory-box.mjs';
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
 * countは置く数、hintsは絵の手がかり(絵文字とからむ絵の文)を見せるか、backwardは後ろからも思い出すか。
 */
export const PALACE_LESSONS = Object.freeze([
  { id: 'walk', number: 1, title: '宮殿を歩く', goal: '自分の宮殿の場所を、順番・逆順・飛び飛びで言う', kind: 'walk', after: null },
  { id: 'image', number: 2, title: '絵にする', goal: '覚えたいものを、場所とからんで動く絵にするコツ', kind: 'image', after: 'walk' },
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

/**
 * 講2の「絵にするコツ」。いちばん効くのは場所とかかわり合う絵、次に動き。大げさな絵はときどき混ぜるだけ
 * (docs/brain-training-design.mdの14-3のB25〜B27)。
 */
export const IMAGE_TIPS = Object.freeze([
  { title: '場所とからめる', text: 'ドアにはさまる・冷蔵庫からあふれる' },
  { title: '動かす', text: '転がる・跳ねる・泳ぐ・歌う' },
  { title: 'ときどき大げさに', text: 'ありえないほど大きく、たくさん' },
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
    /** 思い出しの箱の組(memory-box.mjs。14-9)。 */
    boxes: [],
    /** 宝物の棚(1か月たっても思い出せた組)。 */
    shelf: [],
    /** 宝物用の宮殿のid(箱に組があるあいだ固定する。''はまだ決めていない)。 */
    treasurePalace: '',
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
  // 思い出しの箱(足しただけの項目。前の保存にはないので、ないときは空のまま)。
  store.boxes = cleanBoxes(value.boxes);
  store.shelf = cleanShelf(value.shelf);
  const ownReady = new Set(store.palaces.filter(palaceReady).map(({ id }) => id));
  store.treasurePalace = value.treasurePalace === SAMPLE_PALACE_ID || ownReady.has(value.treasurePalace) ? value.treasurePalace : '';
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

/**
 * 毎日の練習と講で使える宮殿。箱に組があるあいだは、宝物用の宮殿を使わない(混ざりを防ぐ。14-3のB14)。
 * 宝物用の宮殿しかなければ、使える宮殿をそのまま返す。
 */
export function practicePalaces(store) {
  const all = usablePalaces(store);
  const treasure = store.boxes?.length ? store.treasurePalace : '';
  const list = treasure ? all.filter(({ id }) => id !== treasure) : all;
  return list.length ? list : all;
}

/** 講で使う宮殿(前に使った宮殿か、最初の宮殿。宝物用の宮殿は使わない)。 */
export function lessonPalace(store) {
  const list = practicePalaces(store);
  return list.find(({ id }) => id === store.lastPalace) ?? list[0] ?? null;
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

/**
 * 場所の動きの種類(14-9の「からむ絵」)。カードに種類が書いてあればそれ、なければ名前から(並べ替え・名前の変更をしても、
 * カードに残した種類を使う)。自分で書いたカードは「そのほか」。
 * @param {{ name: string, kind?: string }} locus
 */
export function locusKind(locus) {
  if (locus?.kind && LOCUS_KINDS.includes(locus.kind)) return locus.kind;
  return LOCUS_KIND_BY_NAME[locus?.name] ?? 'other';
}

/**
 * 場所と覚えるものが、かかわり合って動く絵の文(14-3のB25〜B27)。場所の種類の型を先に、最後に大げさな型を1つ(ときどき混ぜる。B26)。
 * 覚えるものに絵の手がかり(cue。「{場}」を含む文)があれば、その文を最初に置く(月の和名・格言など、絵にしにくい言葉のため)。
 * @param {{ name: string, kind?: string }} locus
 * @param {{ word: string, cue?: string }} item
 * @returns {string[]}
 */
export function sceneImages(locus, item) {
  const fill = (template) => template.replaceAll('{場}', locus.name).replaceAll('{物}', item.word);
  const kind = locusKind(locus);
  const own = LOCUS_ACTS[kind] ?? LOCUS_ACTS.other;
  const extra = kind === 'other' ? [] : [LOCUS_ACTS.other[0]];
  const images = [...own, ...extra].map(fill);
  return item.cue ? [item.cue.replaceAll('{場}', locus.name), ...images] : images;
}

/** 1つの場所に置く1つの絵(場所・覚えるもの・からむ絵の文と、ほかの絵の文)。variantは最初に見せる文の番号。 */
function scene(locus, item, variant) {
  const imageOptions = sceneImages(locus, item);
  const first = item.cue ? 0 : variant % imageOptions.length;
  return { locus, item, image: imageOptions[first], imageOptions: [...imageOptions.slice(first), ...imageOptions.slice(0, first)] };
}
/** 最初に見せる絵の文の番号を、場所ごとに混ぜて配る(同じ型が続かないように)。 */
function actionsFor(rng, count) {
  return Array.from({ length: count }, () => Math.floor(rng.next() * 3));
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

/**
 * 講2の「どの絵がいちばん覚えやすい？」。場所とかかわり合って動く絵が正解(14-3のB25・B27)。
 * まちがいは、場所のそばに置いただけの絵と、大げさでも場所とからまない絵(奇抜なだけでは効かない。B25)。
 */
export function imageQuiz(seed, loci) {
  const rng = createRng(seed);
  const words = shuffled(rng, MEMORY_WORDS).slice(0, 2);
  return words.map((item, index) => {
    const locus = loci[(index + 3) % loci.length];
    const options = [
      { text: `${locus.name}のそばに、${item.word}が1つ置いてある。`, good: false },
      { text: `空いっぱいに、巨大な${item.word}がぷかぷか浮かんでいる！`, good: false },
      { text: sceneImages(locus, item)[0], good: true },
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
  const palaces = practicePalaces(store);
  if (!palaces.length) return null;
  const last = store.lastWords;
  const recall = last && last.day < day && findPalace(store, last.palace) ? last : null;
  let palace = palaces.find(({ id }) => id === store.lastPalace) ?? palaces[0];
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
    : PROVERB_SET.items;
  const actions = actionsFor(rng, items.length);
  return items.slice(0, loci.length).map((item, index) => scene(loci[index], item, actions[index]));
}

// ===== 思い出しの箱(14-9) =====

/** 宝物用の宮殿(見本のお城は、選んでいなくても宝物用に使える)。 */
function resolveTreasure(store, id) {
  if (id === SAMPLE_PALACE_ID) return SAMPLE_PALACE;
  return store.palaces.find((palace) => palace.id === id && palaceReady(palace)) ?? null;
}

/**
 * 宝物用の宮殿を選ぶ。決めてあればそれ。まだなら、毎日の練習に使っていない宮殿(自分の宮殿が2つ以上あれば練習に使っていない方、
 * 1つなら見本のお城)。練習に見本のお城を使っていて、自分の宮殿もないときは''(箱の前に宮殿を作る)。
 * @returns {string}
 */
export function chooseTreasurePalace(store) {
  if (store.treasurePalace && resolveTreasure(store, store.treasurePalace)) return store.treasurePalace;
  const usable = usablePalaces(store);
  if (!usable.length) return '';
  const practiceId = (findPalace(store, store.lastPalace) ?? usable[0]).id;
  const own = store.palaces.filter(palaceReady);
  const other = [...own].reverse().find(({ id }) => id !== practiceId);
  if (other && own.length >= 2) return other.id;
  if (practiceId !== SAMPLE_PALACE_ID) return SAMPLE_PALACE_ID;
  return other?.id ?? '';
}

/** 宝物用の宮殿(決めた宮殿か、これから使う宮殿)。なければnull。 */
export function treasurePalaceOf(store) {
  return resolveTreasure(store, chooseTreasurePalace(store));
}

/**
 * 箱の目録。作戦の手順(四間飛車と美濃囲い)は、対局の作戦カードと同じ手順から作る。
 * @returns {{ id: string, title: string, emoji: string, desc: string, items: { word: string, ask?: string, cue?: string, picture?: string, emoji?: string }[] }[]}
 */
export function treasureSets() {
  const moves = shogiSequence().map(({ label }, index) => {
    const piece = label.slice(-1);
    const square = label.slice(1, 3);
    const cue = (MOVE_CUES[piece] ?? '{場}で、駒が{先}へ動く！').replace('{先}', square);
    return { word: label, ask: `${index + 1}手目は？`, cue, emoji: '☗' };
  });
  const [proverbs, ...rest] = TREASURE_SETS;
  return [
    proverbs,
    { id: 'shiken-mino', title: '四間飛車と美濃囲い', emoji: '☗', desc: '作戦カードと同じ8手の手順', items: moves },
    ...rest,
  ];
}

/** 組を宝物用の宮殿に入れられるか(''なら入れられる)。'palace'は宝物用の宮殿がない。 */
export function boxBlocker(store, size) {
  const palace = treasurePalaceOf(store);
  if (!palace) return 'palace';
  return addBlocker(store.boxes, palace.loci.length, size);
}

/** 組が置かれた場所(宮殿の場所が減っていたら「○か所目」で補う)。 */
export function boxLoci(store, box) {
  const loci = treasurePalaceOf(store)?.loci ?? [];
  return box.items.map((_, index) => loci[box.start + index] ?? { name: `${box.start + index + 1}か所目`, emoji: '📍', group: '' });
}

/**
 * 組を場所に置く絵。絵の文は場所の種類と、覚えるものの手がかり(cue)から(sceneImages)。picsは選んだ絵の番号。
 * @param {readonly { name: string, emoji: string, kind?: string }[]} loci
 * @param {{ word: string, ask?: string, cue?: string, picture?: string, emoji?: string }[]} items
 * @param {number[]} [pics]
 */
export function treasureScenes(loci, items, pics = []) {
  return items.map((item, index) => {
    const locus = loci[index];
    const imageOptions = sceneImages(locus, { word: item.picture ?? item.word, cue: item.cue });
    const pick = (pics[index] ?? 0) % imageOptions.length;
    return {
      locus,
      item: { word: item.word, emoji: item.emoji ?? '📦' },
      ask: item.ask ?? '',
      image: imageOptions[pick],
      imageOptions: [...imageOptions.slice(pick), ...imageOptions.slice(0, pick)],
    };
  });
}

/**
 * 組を箱に入れる(宝物用の宮殿を決め、空いた場所に続けて置く)。
 * @param {ReturnType<typeof emptyMemoryStore>} store
 * @param {{ set: string, title: string, emoji: string, items: unknown[], pics?: number[] }} input
 * @param {string} day
 */
export function addTreasureBox(store, input, day) {
  const treasure = chooseTreasurePalace(store);
  const palace = resolveTreasure(store, treasure);
  if (!palace) return { store, box: null, blocker: 'palace' };
  const result = addBox(store.boxes, input, palace.loci.length, day);
  if (!result.box) return { store, box: null, blocker: result.blocker };
  return { store: { ...store, boxes: result.boxes, treasurePalace: treasure }, box: result.box, blocker: '' };
}

/** 箱の組を思い出した結果を入れる。 */
export function reviewTreasureBox(store, id, results, day) {
  const { boxes, shelf, outcome } = applyReview(store.boxes, store.shelf, id, results, day);
  return { store: { ...store, boxes, shelf }, outcome };
}

/** 今日思い出す組(時期の来た組のうち、いちばん早いもの)。 */
export function dueTreasureBox(store, day) {
  return dueBoxes(store.boxes, day)[0] ?? null;
}

/** 次に箱の時期が来る日。 */
export function nextTreasureDay(store, day) {
  return nextBoxDay(store.boxes, day);
}

// ===== 14-16: 棚の組をめくる・言葉を直す・宝物用の宮殿を選び直す =====

/** 練習に使っている宮殿のid(前に使った宮殿か、最初の宮殿)。 */
function practiceId(store) {
  const usable = usablePalaces(store).filter(({ id }) => id !== store.treasurePalace || !store.boxes?.length);
  return (usable.find(({ id }) => id === store.lastPalace) ?? usable[0])?.id ?? '';
}

/**
 * 宝物用の宮殿の候補(自分の宮殿と見本のお城)。練習に使っている宮殿は選べるが、その印(practice)をつける。
 * fitsは、いま箱にある組がその宮殿に全部置けるか。
 */
export function treasureChoices(store) {
  const practice = practiceId(store);
  const own = store.palaces.filter(palaceReady);
  return [...own, SAMPLE_PALACE].map((palace) => ({
    id: palace.id,
    name: palace.id === SAMPLE_PALACE_ID ? '見本のお城' : palace.name,
    loci: palace.loci.length,
    current: palace.id === chooseTreasurePalace(store),
    practice: palace.id === practice,
    fits: Boolean(repackBoxes(store.boxes, palace.loci.length)),
  }));
}

/**
 * 宝物用の宮殿を選び直す。箱の組は新しい宮殿の空いた場所に順に詰め直す(次に思い出す日と段はそのまま)。置けなければnull。
 * 練習に使っていた宮殿を選んだら、毎日の練習はほかの宮殿を使う(practicePalaces)。
 */
export function moveTreasurePalace(store, id) {
  const palace = resolveTreasure(store, id);
  if (!palace) return null;
  const boxes = repackBoxes(store.boxes, palace.loci.length);
  if (!boxes) return null;
  return { ...store, boxes, treasurePalace: id };
}

/** 棚の組の場所(棚に入ったときの宝物用の宮殿の場所。いまは別の組が使っていることもある)。 */
export function shelfLoci(store, entry) {
  const loci = treasurePalaceOf(store)?.loci ?? [];
  return (entry.items ?? []).map((_, index) => loci[entry.start + index] ?? { name: `${entry.start + index + 1}か所目`, emoji: '📍', group: '' });
}

/** 棚の組を確かめた結果を入れる(段は動かさない)。 */
export function checkTreasureShelf(store, index, results, day) {
  const { shelf, check } = checkShelfEntry(store.shelf, index, results, day);
  return { store: { ...store, shelf }, check };
}

/** 棚の組を箱にもどす(宝物用の宮殿の空いた場所に置き直し、3日あとから思い出し直す)。 */
export function returnTreasureShelf(store, index, day) {
  const treasure = chooseTreasurePalace(store);
  const palace = resolveTreasure(store, treasure);
  if (!palace) return { store, box: null, blocker: 'palace' };
  const result = returnShelfToBox(store.boxes, store.shelf, index, palace.loci.length, day);
  if (!result.box) return { store, box: null, blocker: result.blocker };
  return { store: { ...store, boxes: result.boxes, shelf: result.shelf, treasurePalace: treasure }, box: result.box, blocker: '' };
}

/** 箱の組の言葉を直す。 */
export function editTreasureBox(store, id, words, title) {
  const { boxes, error } = editBoxWords(store.boxes, id, words, title);
  return { store: error ? store : { ...store, boxes }, error };
}
