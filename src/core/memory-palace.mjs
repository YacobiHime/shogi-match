// 脳トレ「記憶の宮殿」(場所法)の学校(docs/brain-training-design.mdの3-4)。
// 宮殿(よく知っている道順の場所)に、覚えたいものを1つずつ「大げさな絵」にして置き、場所をたどって思い出す。
// 講1〜6で方法を覚え、毎日の練習で言葉の数を伸ばす。講6で定跡の手順と格言を覚える。画面に依存しない。

import { MEMORY_PROVERBS, MEMORY_WORDS } from '../data/memory-palace-words.mjs';
import { openingFormationSteps, openingStepLabel } from './opening-formation.mjs';
import { createRng } from './ryuo-random.mjs';

/** やこび姫のお城の30か所(道順の順)。講を終えるたびに5か所ずつ明かりがつく。 */
export const CASTLE_LOCI = Object.freeze([
  ['門', '⛩️'], ['池', '🐟'], ['石灯籠', '🏮'], ['玄関', '👞'], ['廊下の掛け軸', '🖼️'],
  ['台所', '🍳'], ['茶の間', '🍵'], ['将棋の間', '☗'], ['書庫', '📚'], ['天守の窓', '🏯'],
  ['大階段', '🪜'], ['鏡の間', '🪞'], ['衣装部屋', '👘'], ['寝室', '🛏️'], ['縁側', '🌸'],
  ['宝物庫', '💎'], ['琴の間', '🎵'], ['時計の間', '⏰'], ['物見やぐら', '🔭'], ['隠し扉', '🚪'],
  ['地図の部屋', '🗺️'], ['鍛冶場', '⚒️'], ['薬の部屋', '🧪'], ['鳥の巣', '🐦'], ['鐘つき堂', '🔔'],
  ['星見台', '⭐'], ['雲の橋', '☁️'], ['金のしゃちほこ', '🐉'], ['屋根の上', '🌅'], ['天守のてっぺん', '👑'],
].map(([name, emoji]) => Object.freeze({ name, emoji })));
export const LIGHTS_PER_LESSON = 5;

/** 講。kindで中身の作り方を決める。 */
export const PALACE_LESSONS = Object.freeze([
  { id: 'walk', title: '宮殿を歩こう', goal: 'お城の10か所を、順番に覚える', kind: 'walk', count: 10 },
  { id: 'place5', title: '場所に置いてみよう', goal: '言葉5つを、場所ごとに大げさな絵にして置く', kind: 'choice', count: 5, hints: true },
  { id: 'ten', title: '10個にちょうせん', goal: '言葉10個。前からと、後ろからも思い出す', kind: 'order', count: 10, hints: true, backward: true },
  { id: 'jump', title: '好きな場所から', goal: '「7番目は？」に、すぐ答える', kind: 'jump', count: 10 },
  { id: 'custom', title: '自分の宮殿を作ろう', goal: '自分の家や学校の道順で、宮殿を作る', kind: 'custom', count: 10 },
  { id: 'shogi', title: '将棋に使おう', goal: '四間飛車と美濃囲いの手順（8手）と、格言を覚える', kind: 'shogi', count: 10 },
]);
/** 毎日の練習が開く講。 */
export const PRACTICE_OPENS_AFTER = 'place5';
/** 毎日の練習の言葉の数。 */
export const PRACTICE_MIN = 5;
export const PRACTICE_MAX = 30;
export const PRACTICE_STEP = 2;
/** 毎日の練習で、次の回に増やす・減らす合格の割合。 */
export const PRACTICE_PASS = 0.8;

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

function shuffled(rng, list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng.next() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** いま使う宮殿の場所。自分の宮殿が10か所以上あればそれを使い、なければお城。 */
export function palaceLoci(custom = []) {
  const names = custom.map((name) => String(name).trim()).filter(Boolean);
  if (names.length >= 10) return names.slice(0, PRACTICE_MAX).map((name) => ({ name, emoji: '📍' }));
  return CASTLE_LOCI;
}

/** 明かりのついた場所の数(講を1つ終えるごとに5か所。最初から5か所)。 */
export function litLoci(lessonsCleared) {
  return Math.min(CASTLE_LOCI.length, LIGHTS_PER_LESSON * (1 + lessonsCleared.length));
}

/** 講を順に解放する。前の講を終えると次が開く(自分の宮殿の講は、とばしてもよい)。 */
export function lessonUnlocked(lessonsCleared, lessonId) {
  const index = PALACE_LESSONS.findIndex(({ id }) => id === lessonId);
  if (index <= 0) return index === 0;
  const before = PALACE_LESSONS[index - 1];
  return lessonsCleared.includes(before.id) || (before.id === 'custom' && lessonsCleared.includes('jump'));
}

export function practiceOpen(lessonsCleared) {
  return lessonsCleared.includes(PRACTICE_OPENS_AFTER);
}

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
 * @param {number} seed
 * @param {number} count
 * @param {{ name: string, emoji: string }[]} loci
 */
export function palaceWordSet(seed, count, loci = CASTLE_LOCI) {
  const rng = createRng(seed);
  const size = Math.min(count, loci.length);
  const words = shuffled(rng, MEMORY_WORDS);
  const items = words.slice(0, size);
  const distractors = words.slice(size, size * 2);
  const actions = actionsFor(rng, items.length);
  return {
    scenes: items.map((item, index) => scene(loci[index], item, actions[index])),
    distractors,
    pool: shuffled(rng, [...items, ...distractors]),
  };
}

/** 4択の選択肢(答えと、ほかの3つ)。 */
export function fourChoices(seed, answer, others) {
  const rng = createRng(seed);
  const pool = shuffled(rng, others.filter((item) => item !== answer)).slice(0, 3);
  return shuffled(rng, [answer, ...pool]);
}

/**
 * 順番に押した答えの採点。positionsは何番目が合ったか。
 * @param {string[]} expected
 * @param {string[]} answer
 */
export function scoreOrder(expected, answer) {
  const positions = expected.map((word, index) => answer[index] === word);
  const correct = positions.filter(Boolean).length;
  return { correct, total: expected.length, positions, accuracy: expected.length ? correct / expected.length : 0 };
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

/**
 * 講6の定跡の手順(8手)。四間飛車と美濃囲いを、対局の作戦カード・教室のコツと同じ手順(opening-formation.mjs)で作る。
 * @returns {{ label: string, usi: string }[]}
 */
export function shogiSequence() {
  const { steps } = openingFormationSteps('shiken', 'mino');
  return steps.slice(0, 10).map((step) => ({ label: openingStepLabel(step, 'black'), usi: step.usi }));
}

/** 講6の場面(定跡の手順か格言を、場所に置く)。 */
export function shogiScenes(seed, loci = CASTLE_LOCI, kind = 'moves') {
  const rng = createRng(seed);
  const items = kind === 'moves'
    ? shogiSequence().map(({ label }) => ({ word: label, emoji: '☗' }))
    : MEMORY_PROVERBS.map((proverb) => ({ word: proverb, emoji: '📜' }));
  const actions = actionsFor(rng, items.length);
  return items.slice(0, loci.length).map((item, index) => scene(loci[index], item, actions[index]));
}

/** 自分の宮殿の場所の名前を整える(空を除き、20字まで、30か所まで、同じ名前は1つ)。 */
export function cleanCustomLoci(names) {
  const seen = new Set();
  const result = [];
  for (const raw of names) {
    const name = String(raw ?? '').trim().slice(0, 20);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
    if (result.length >= PRACTICE_MAX) break;
  }
  return result;
}
