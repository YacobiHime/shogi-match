// 師匠の1年(docs/disciple-mode-design.mdの11章・29章)の、一門と、育成に連れていく仲間。
// 育て終えた弟子は一門に入り(記録の枠をまたいで1つだけ持つ。師匠はひとり)、次の育成で仲間として連れていける(11-1)。
// 一門の先輩は、能力が高いほど顔を出したときの伸びが大きく、いちばん高い能力から「教え方」のカードを1枚、引き出しに残す(受け継ぎ)。
// 画面に依存しない。

import { STAT_KEYS } from './disciple-strength.mjs';

export const DISCIPLE_ICHIMON_KEY = 'yacobihime:shogi-match:disciple-ichimon:v1';
const ICHIMON_VERSION = 1;
/** 一門に残す人数の上限(古い順に外す)。 */
export const ICHIMON_MAX = 30;
/** 育成に連れていく仲間の数(11章)。 */
export const TEAM_SIZE = 4;

/** はじめからいる仲間(百花と研究会の2人)。likesは顔を出しやすい稽古。 */
export const BASE_FRIENDS = Object.freeze([
  Object.freeze({ id: 'momoka', name: '百花', likes: Object.freeze(['tsume', 'kifu']), portrait: 'sakurano-momoka-320.webp', power: 0 }),
  Object.freeze({ id: 'hayase', name: '早瀬', likes: Object.freeze(['jissen', 'shisho']), portrait: '', power: 0 }),
  Object.freeze({ id: 'makabe', name: '真壁', likes: Object.freeze(['fast', 'jissen']), portrait: '', power: 0 }),
]);

/** 能力ごとの稽古(一門の先輩が顔を出しやすい稽古)。 */
const TRAINING_OF = Object.freeze({ reading: 'jissen', plan: 'kifu', steady: 'fast', mate: 'tsume' });
/** 能力ごとに受け継ぐ教え方のカード(disciple-lesson.mjsのLESSON_CARDS)。 */
export const INHERIT_CARDS = Object.freeze({ reading: 'senpai-vs', plan: 'senpai-note', steady: 'senpai-talk', mate: 'senpai-tsume' });
/** 一門の先輩の伸びの上乗せ(能力の平均で0〜、四段になった先輩はさらに)。 */
export const SENPAI_POWER = Object.freeze({ from: 600, span: 1000, max: 0.5, pro: 0.2 });

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/**
 * 育て終えた弟子の、一門の名簿の行。
 * @param {any} state 終わった育成
 */
export function ichimonEntry(state) {
  const stats = Object.fromEntries(STAT_KEYS.map((key) => [key, Math.round(Number(state.stats?.[key]) || 0)]));
  const top = STAT_KEYS.reduce((best, key) => (stats[key] > stats[best] ? key : best), STAT_KEYS[0]);
  return {
    id: String(state.seed),
    discipleId: String(state.discipleId ?? ''),
    name: String(state.name ?? ''),
    kind: String(state.end?.kind ?? ''),
    best: String(state.end?.best ?? ''),
    rank: String(state.end?.rank ?? ''),
    kishiNumber: state.shoreikai?.kishiNumber ?? null,
    stats,
    top,
    skills: [...(state.skills ?? [])],
    turn: Number(state.end?.turn ?? state.turn) || 0,
    // 終わったときの年齢(四段になった弟子が名簿に入るときの歳。31章)。
    age: Math.floor(((Number(state.startAge) || 12) * 12 + Math.floor((Number(state.end?.turn ?? state.turn) || 0) / 2)) / 12),
  };
}

/** @param {Storage | null | undefined} storage */
export function loadIchimon(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(DISCIPLE_ICHIMON_KEY) ?? 'null');
    if (parsed?.version === ICHIMON_VERSION && Array.isArray(parsed.members)) return { version: ICHIMON_VERSION, members: parsed.members.filter((m) => m && m.id) };
  } catch {
    // 読めなければ空の一門。
  }
  return { version: ICHIMON_VERSION, members: [] };
}

/** @param {Storage | null | undefined} storage @param {{ members: any[] }} ichimon */
export function saveIchimon(storage, ichimon) {
  try {
    storage?.setItem(DISCIPLE_ICHIMON_KEY, JSON.stringify({ version: ICHIMON_VERSION, members: ichimon.members }));
  } catch {
    // 保存できなくても遊べる。
  }
}

/**
 * 終わった育成の弟子を一門に入れる(同じ育成は1回だけ)。入れたあとの一門と、状態(入った印つき)と、何人目かを返す。
 * @param {{ version: number, members: any[] }} ichimon
 * @param {any} state
 * @returns {{ ichimon: { version: number, members: any[] }, state: any, count: number, joined: boolean }}
 */
export function joinIchimon(ichimon, state) {
  if (!state?.end || state.ichimonJoined) return { ichimon, state, count: Number(state?.ichimonJoined) || 0, joined: false };
  const entry = ichimonEntry(state);
  const others = ichimon.members.filter((member) => member.id !== entry.id);
  const members = [...others, entry].slice(-ICHIMON_MAX);
  return { ichimon: { version: ICHIMON_VERSION, members }, state: { ...state, ichimonJoined: members.length }, count: members.length, joined: true };
}

/**
 * 一門の先輩を、育成に連れていく仲間の形にする。
 * @param {any} entry 一門の名簿の行
 */
export function senpaiFriend(entry) {
  const mean = STAT_KEYS.reduce((sum, key) => sum + (Number(entry.stats?.[key]) || 0), 0) / STAT_KEYS.length;
  const power = clamp((mean - SENPAI_POWER.from) / SENPAI_POWER.span, 0, SENPAI_POWER.max) + (entry.kind === 'pro' ? SENPAI_POWER.pro : 0);
  const training = TRAINING_OF[entry.top] ?? 'jissen';
  return {
    id: `ichimon-${entry.id}`,
    name: entry.name,
    likes: [training, 'shisho'],
    portrait: '',
    power: Math.round(power * 100) / 100,
    senpai: true,
    title: entry.kind === 'pro' ? '一門の先輩（四段）' : `一門の先輩（${entry.best || '研修会'}）`,
    card: INHERIT_CARDS[entry.top] ?? null,
  };
}

/**
 * 連れていける仲間(はじめからの3人と一門の先輩。先輩は新しい順)。
 * @param {{ members: any[] }} ichimon
 * @returns {any[]}
 */
export const friendPool = (ichimon) => [...BASE_FRIENDS, ...[...(ichimon?.members ?? [])].reverse().map(senpaiFriend)];

/**
 * はじめに選んでおく仲間(はじめからの3人と、いちばん新しい先輩)。
 * @param {readonly any[]} pool
 */
export const defaultTeam = (pool) => pool.slice(0, TEAM_SIZE).map((friend) => friend.id);

/**
 * 選んだidから、育成に連れていく仲間(4人まで。知らないidは外す)。選ばなければはじめからの3人。
 * @param {readonly any[]} pool
 * @param {readonly string[] | null | undefined} ids
 */
export function pickTeam(pool, ids) {
  if (!ids) return BASE_FRIENDS.map((friend) => ({ ...friend }));
  const picked = ids.map((id) => pool.find((friend) => friend.id === id)).filter(Boolean).slice(0, TEAM_SIZE);
  return picked.length ? picked.map((friend) => ({ ...friend, likes: [...friend.likes] })) : BASE_FRIENDS.map((friend) => ({ ...friend }));
}

/** 顔を出した仲間の重み(稽古の伸びの`friends`。先輩は能力のぶん重い)。 */
export function friendWeight(team, ids) {
  return ids.reduce((sum, id) => sum + 1 + (team.find((friend) => friend.id === id)?.power ?? 0), 0);
}
