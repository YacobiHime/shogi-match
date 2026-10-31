// 自分の記憶の宮殿を作る(docs/brain-training-design.mdの11-6のステップ1)。
// 場所の種類を選び、カードの束から自分の場所にあるものを歩く順番に並べる。名前の変更・入れ替え・消す(取り消せる)。
// 宮殿は10か所でできあがり、1つ30か所まで、3つまで(使い分けで混ざりを防ぐ。B14)。画面と保存の仕組みに依存しない。

import { PLACE_KINDS } from '../data/palace-cards.mjs';

export const PALACE_MAX = 3;
export const LOCI_MAX = 30;
export const LOCI_READY = 10;
export const LOCUS_NAME_MAX = 16;
export const PALACE_NAME_MAX = 12;

const PLACE_IDS = new Set(PLACE_KINDS.map(({ id }) => id));

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanName(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** 1か所(名前・絵・似た場所の組)。名前が空なら捨てる。 */
export function cleanLocus(value) {
  if (!isPlainObject(value)) return null;
  const name = cleanName(value.name, LOCUS_NAME_MAX);
  if (!name) return null;
  const emoji = typeof value.emoji === 'string' && value.emoji.length <= 8 && value.emoji.trim() ? value.emoji : '📍';
  const group = typeof value.group === 'string' && /^[a-z]{1,10}$/.test(value.group) ? value.group : '';
  return { name, emoji, group };
}

/** 1つの宮殿。場所は30か所まで。 */
export function cleanPalace(value) {
  if (!isPlainObject(value) || typeof value.id !== 'string' || !/^p\d{1,2}$/.test(value.id)) return null;
  const loci = Array.isArray(value.loci) ? value.loci.map(cleanLocus).filter(Boolean).slice(0, LOCI_MAX) : [];
  const place = PLACE_IDS.has(value.place) ? value.place : 'free';
  const fallback = PLACE_KINDS.find(({ id }) => id === place)?.defaultName ?? '自分の宮殿';
  return { id: value.id, name: cleanName(value.name, PALACE_NAME_MAX) || fallback, place, loci };
}

/** 宮殿の一覧。3つまで、同じidは1つ。 */
export function cleanPalaces(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    const palace = cleanPalace(raw);
    if (!palace || seen.has(palace.id)) continue;
    seen.add(palace.id);
    result.push(palace);
    if (result.length >= PALACE_MAX) break;
  }
  return result;
}

/** 10か所以上並べた宮殿は使える。 */
export function palaceReady(palace) {
  return Boolean(palace) && palace.loci.length >= LOCI_READY;
}

/**
 * 新しい宮殿を作る。3つあれば作らない(null)。
 * @param {ReturnType<typeof cleanPalaces>} palaces
 * @param {{ place: string, name?: string }} input
 */
export function createPalace(palaces, { place, name = '' }) {
  if (palaces.length >= PALACE_MAX) return null;
  let number = 1;
  while (palaces.some(({ id }) => id === `p${number}`)) number += 1;
  const kind = PLACE_KINDS.find(({ id }) => id === place) ?? PLACE_KINDS.at(-1);
  const palace = { id: `p${number}`, name: cleanName(name, PALACE_NAME_MAX) || kind.defaultName, place: kind.id, loci: [] };
  return { palaces: [...palaces, palace], palace };
}

/** 一覧の中の宮殿を差し替える。 */
export function replacePalace(palaces, palace) {
  return palaces.map((item) => (item.id === palace.id ? palace : item));
}

/** 一覧から宮殿を消す。 */
export function removePalace(palaces, id) {
  return palaces.filter((item) => item.id !== id);
}

/** 2つの場所が似ているか(同じ組か、同じ名前)。 */
export function similarLoci(a, b) {
  if (!a || !b) return false;
  return a.name === b.name || (Boolean(a.group) && a.group === b.group);
}

/**
 * 場所を1つ足す。30か所あれば足さない(full)。similarは、1つ前の場所と似ているか(やこび姫がひとこと言う)。
 * @param {NonNullable<ReturnType<typeof cleanPalace>>} palace
 * @param {{ name: string, emoji?: string, group?: string }} card
 */
export function addLocus(palace, card) {
  const locus = cleanLocus(card);
  if (!locus) return { palace, similar: false, full: false, added: false };
  if (palace.loci.length >= LOCI_MAX) return { palace, similar: false, full: true, added: false };
  const similar = similarLoci(palace.loci.at(-1), locus);
  return { palace: { ...palace, loci: [...palace.loci, locus] }, similar, full: false, added: true };
}

/** 場所の名前を自分の呼び方に変える(「ソファ」→「おばあちゃんの座いす」)。空にはしない。 */
export function renameLocus(palace, index, name) {
  const cleaned = cleanName(name, LOCUS_NAME_MAX);
  if (!cleaned || !palace.loci[index]) return palace;
  const loci = palace.loci.map((locus, at) => (at === index ? { ...locus, name: cleaned } : locus));
  return { ...palace, loci };
}

/** 場所の順番を入れ替える(fromの場所をtoへ)。 */
export function moveLocus(palace, from, to) {
  if (!palace.loci[from] || to < 0 || to >= palace.loci.length || from === to) return palace;
  const loci = [...palace.loci];
  const [moved] = loci.splice(from, 1);
  loci.splice(to, 0, moved);
  return { ...palace, loci };
}

/** 場所を消す。消した場所と位置を返すので、取り消しで戻せる(UD:5-2)。 */
export function removeLocus(palace, index) {
  if (!palace.loci[index]) return { palace, removed: null, index };
  const loci = palace.loci.filter((_, at) => at !== index);
  return { palace: { ...palace, loci }, removed: palace.loci[index], index };
}

/** 消した場所を元の位置へ戻す。 */
export function restoreLocus(palace, index, locus) {
  if (!locus || palace.loci.length >= LOCI_MAX) return palace;
  const loci = [...palace.loci];
  loci.splice(Math.max(0, Math.min(index, loci.length)), 0, locus);
  return { ...palace, loci };
}

/** 宮殿の名前を変える。 */
export function renamePalace(palace, name) {
  const cleaned = cleanName(name, PALACE_NAME_MAX);
  return cleaned ? { ...palace, name: cleaned } : palace;
}

/** となりどうしが似ている場所の組(番号)。並べ終えたあとの見直しに使う。 */
export function similarNeighbors(palace) {
  const pairs = [];
  palace.loci.forEach((locus, index) => {
    if (index > 0 && similarLoci(palace.loci[index - 1], locus)) pairs.push(index);
  });
  return pairs;
}
