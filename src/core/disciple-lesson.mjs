// 師匠の1年(docs/disciple-mode-design.md)の、指導の引き出し(稽古のカード。9-3)と、スキルを覚える条件(19-4)。25章。
// 画面と保存に依存しない。カードの手札は弟子の状態から決まった順に配る(同じ状態なら同じ手札)。

import { createRng } from './ryuo-random.mjs';
import { PLAY_STYLES, STAT_KEYS } from './disciple-strength.mjs';

/**
 * 指導の引き出しのカード。pointsは稽古の出来、staminaは体力の増減、fitsはよく効く弟子、moodはやる気(合わない弟子にはmissMood)。
 * nextBonusは次のカードの出来に足す。
 */
export const LESSON_CARDS = Object.freeze([
  { id: 'tsume-make', kind: 'teach', label: '詰将棋を作ってあげる', text: 'この子に合わせた1問を作る', points: 30, stamina: -8, fits: ['ao'] },
  { id: 'my-kifu', kind: 'teach', label: '自分の棋譜を見せる', text: '師匠の実戦を一緒に並べる', points: 24, stamina: -5, fits: ['tsumugi'] },
  { id: 'vs', kind: 'teach', label: 'VS（一対一の練習将棋）', text: '盤をはさんで何局も指す', points: 34, stamina: -12, fits: ['minato'] },
  { id: 'notebook', kind: 'teach', label: '研究ノートを渡す', text: '師匠の研究を書いたノート', points: 22, stamina: 0, fits: ['tsumugi'], unlock: 'notebook' },
  { id: 'dojo', kind: 'teach', label: '道場に連れていく', text: '知らない大人と指す', points: 28, stamina: -10, fits: ['ao', 'minato'], unlock: 'dojo' },
  { id: 'praise', kind: 'word', label: 'ほめる', text: '解けたら、すぐにほめる', points: 18, stamina: 0, fits: ['minato'], mood: 1 },
  { id: 'strict', kind: 'word', label: 'あえて厳しく', text: '甘い手を見逃さない', points: 28, stamina: -4, fits: ['ao'], missMood: -1 },
  { id: 'think', kind: 'word', label: '一緒に考える', text: '答えを言わずに待つ', points: 22, stamina: -3, fits: ['tsumugi'] },
  { id: 'tea', kind: 'rest', label: 'お茶にする', text: 'ひと息つく。次のカードがよく効く', points: 6, stamina: 10, nextBonus: 8 },
  { id: 'early', kind: 'rest', label: '早めに切り上げる', text: '体力を残して終える', points: 4, stamina: 15 },
  // 一門の先輩が残す教え方(受け継ぎ。29章)。どの弟子にもよく効く(先輩はこの子のことも知っている)。
  { id: 'senpai-vs', kind: 'teach', label: '先輩と練習将棋', text: '一門の先輩が相手をしてくれる', points: 32, stamina: -8, fits: ['minato', 'tsumugi', 'ao'], inherit: 'reading' },
  { id: 'senpai-note', kind: 'teach', label: '先輩の研究ノート', text: '先輩が残したノートを読む', points: 28, stamina: -2, fits: ['minato', 'tsumugi', 'ao'], inherit: 'plan' },
  { id: 'senpai-talk', kind: 'word', label: '先輩の話を聞く', text: '大一番の心がまえを教わる', points: 24, stamina: 0, fits: ['minato', 'tsumugi', 'ao'], mood: 1, inherit: 'steady' },
  { id: 'senpai-tsume', kind: 'teach', label: '先輩の詰将棋', text: '先輩が作った詰将棋を解く', points: 30, stamina: -6, fits: ['minato', 'tsumugi', 'ao'], inherit: 'mate' },
].map((card) => Object.freeze(card)));
export const cardById = (id) => LESSON_CARDS.find((card) => card.id === id) ?? null;
/** はじめの引き出し(ほかのカードは仲間の絆や出かけた先で増える)。 */
export const STARTER_DECK = Object.freeze(['tsume-make', 'my-kifu', 'vs', 'praise', 'strict', 'think', 'tea', 'early']);
/** 合う弟子に使ったときの出来の増し。 */
export const FIT_BONUS = 10;
/** 1回の稽古で選ぶカードの数と、手札の枚数。 */
export const LESSON_ROUNDS = 3;
export const HAND_SIZE = 3;
/** 稽古の出来の線(よくできた・完璧)と、伸びの倍率。 */
export const LESSON_GRADES = Object.freeze([
  Object.freeze({ id: 'perfect', label: '完璧', min: 85, scale: 1.4 }),
  Object.freeze({ id: 'good', label: 'よくできた', min: 60, scale: 1.2 }),
  Object.freeze({ id: 'normal', label: 'ふつう', min: 30, scale: 1 }),
  Object.freeze({ id: 'poor', label: 'いまひとつ', min: 0, scale: 0.85 }),
]);

/** 弟子のいまの引き出し(はじめの引き出し＋増えたカード)。 */
export const lessonDeck = (state) => [...STARTER_DECK, ...(state.deck ?? [])].filter((id, index, list) => cardById(id) && list.indexOf(id) === index);

function seedOf(state, trainingId) {
  let hash = (Number(state.rng) ^ Math.imul((state.turn ?? 0) + 7, 0x9e3779b1)) >>> 0;
  for (const char of String(trainingId)) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
}

/**
 * この稽古の手札(3回ぶん、3枚ずつ)。同じ状態・同じ稽古なら同じ手札。1回の手札に同じカードは入れない。
 * @param {any} state
 * @param {string} trainingId
 * @returns {string[][]}
 */
export function lessonHands(state, trainingId) {
  const rng = createRng(seedOf(state, trainingId));
  const deck = lessonDeck(state);
  return Array.from({ length: LESSON_ROUNDS }, () => {
    const pool = [...deck];
    const hand = [];
    while (hand.length < HAND_SIZE && pool.length) hand.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    return hand;
  });
}

/** カードがこの弟子に合うか。 */
export const cardFits = (card, discipleId) => Boolean(card?.fits?.includes(discipleId));

/**
 * 選んだカードから、稽古の出来・伸びの倍率・体力とやる気の増減を出す。
 * @param {any} state
 * @param {readonly string[]} cardIds
 */
export function scoreLesson(state, cardIds) {
  let points = 0;
  let stamina = 0;
  let mood = 0;
  let bonus = 0;
  const steps = [];
  for (const id of cardIds) {
    const card = cardById(id);
    if (!card) continue;
    const fit = cardFits(card, state.discipleId);
    const gained = card.points + bonus + (fit ? FIT_BONUS : 0);
    points += gained;
    stamina += card.stamina;
    if (card.mood && fit) mood += card.mood;
    if (card.missMood && !fit) mood += card.missMood;
    bonus = card.nextBonus ?? 0;
    steps.push({ id, gained, fit });
  }
  const grade = LESSON_GRADES.find((entry) => points >= entry.min) ?? LESSON_GRADES.at(-1);
  return { points, stamina, mood: Math.max(-1, Math.min(1, mood)), grade, steps };
}

/**
 * おまかせ(やこび姫が選ぶ)。体力が少なければ休ませるカード、ほかは出来がいちばん上がるカード。
 * @param {any} state
 * @param {readonly string[]} hand
 * @param {readonly string[]} picked これまでに選んだカード
 */
export function autoPick(state, hand, picked = []) {
  const spent = picked.reduce((sum, id) => sum + (cardById(id)?.stamina ?? 0), 0);
  const tired = (Number(state.stamina) || 0) + spent < 35;
  const bonus = cardById(picked.at(-1) ?? '')?.nextBonus ?? 0;
  const value = (id) => {
    const card = cardById(id);
    if (!card) return -Infinity;
    if (tired) return card.stamina * 3 + card.points;
    return card.points + bonus + (cardFits(card, state.discipleId) ? FIT_BONUS : 0) + (card.missMood && !cardFits(card, state.discipleId) ? -12 : 0);
  };
  return [...hand].sort((a, b) => value(b) - value(a))[0] ?? hand[0];
}

// ---- スキルを覚える条件(19-4。25-3)

/**
 * 覚えられるスキルと条件。countは条件の回数(戦い方とかみ合うスキルは7割。20-5)、checkは状態から数える。
 * 効き目があるスキルだけを覚えさせる(disciple-strength.mjsのskillEffects)。
 */
export const SKILL_RULES = Object.freeze([
  { id: 'researcher', count: 10, text: '棋譜並べの稽古を10回', check: (state) => state.trainCounts?.kifu ?? 0 },
  { id: 'endgame-demon', count: 16, text: '詰将棋の稽古を16回', check: (state) => state.trainCounts?.tsume ?? 0 },
  { id: 'byoyomi', count: 10, text: '早指しの稽古を10回', check: (state) => state.trainCounts?.fast ?? 0 },
  { id: 'closer', count: 5, text: '大一番で5勝', check: (state) => state.bigWins ?? 0 },
  { id: 'adversity', count: 1, text: '劣勢から勝つ対局を観戦する', check: (state) => state.comebacks ?? 0 },
  {
    id: 'clairvoyance', count: 1, text: '「うっかり」を見抜いたあと、安定をBに',
    check: (state) => ((state.causes?.careless ?? 0) >= 3 && (state.stats?.steady ?? 0) >= 750 ? 1 : 0),
  },
  {
    id: 'fujii-curve', count: 1, text: '4つの能力がすべてA以上、安定がS、大一番で10勝',
    check: (state) => (STAT_KEYS.every((key) => (state.stats?.[key] ?? 0) >= 900) && (state.stats?.steady ?? 0) >= 1050 && (state.bigWins ?? 0) >= 10 ? 1 : 0),
  },
].map((rule) => Object.freeze(rule)));
/** スキルの数の上限(19-3)。 */
export const MAX_SKILLS = 6;

/** そのスキルの条件の回数(戦い方とかみ合うと7割)。 */
export function skillNeed(rule, style) {
  return PLAY_STYLES[style]?.skills.includes(rule.id) ? Math.max(1, Math.ceil(rule.count * 0.7)) : rule.count;
}

/**
 * いま条件を満たした、まだ覚えていないスキル。
 * @param {any} state
 * @returns {string[]}
 */
export function newSkills(state) {
  const owned = new Set(state.skills ?? []);
  if (owned.size >= MAX_SKILLS) return [];
  return SKILL_RULES.filter((rule) => !owned.has(rule.id) && rule.check(state) >= skillNeed(rule, state.style))
    .map((rule) => rule.id).slice(0, MAX_SKILLS - owned.size);
}

/**
 * スキルの進み具合(画面の一覧)。
 * @param {any} state
 */
export function skillProgress(state) {
  const owned = new Set(state.skills ?? []);
  return SKILL_RULES.map((rule) => ({ id: rule.id, text: rule.text, have: owned.has(rule.id), now: Math.min(rule.check(state), skillNeed(rule, state.style)), need: skillNeed(rule, state.style) }));
}
