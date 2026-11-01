// 棋士の暮らし(docs/pro-year-design.mdの10章)。棋士の1年の、公式戦のあいだの日の遊び(研究会・将棋まつり)と、
// 対局料・賞金・研究の道具の表。日付と表だけを持つ純粋な処理で、1年の進め方(pro-year.mjs)からも画面からも呼ぶ。
// 金額はゲームの値(実物は非公表のものが多い。単位は万円)。

import { describeCharacter, specialAbilityChips, attackStyleLabel } from './player-character.mjs';
import { repertoireText } from './ryuo-repertoire.mjs';

// ---- 対局料と賞金(10-2の3)

/** 竜王戦のランキング戦の組ごとの対局料(上の組ほど高い)。 */
export const GROUP_FEES = Object.freeze({ 1: 20, 2: 16, 3: 12, 4: 9, 5: 7, 6: 5 });
/** 順位戦のクラスごとの対局料。 */
export const JUNNI_FEES = Object.freeze({ C2: 8, C1: 12, B2: 18, B1: 26, A: 40 });

/**
 * 1局の対局料(勝っても負けても、1局ごと。両者に出る)。
 * @param {{ type: string, title?: boolean, need?: number, cls?: string | null, group?: number | null }} stage
 */
export function gameFee({ type, title = false, need = 1, cls = null, group = null }) {
  if (type === 'blocks') return 5;
  if (type === 'groups') return GROUP_FEES[group ?? 6] ?? 5;
  if (type === 'knockout') return 10;
  if (type === 'league') return 20;
  if (type === 'junni') return JUNNI_FEES[cls ?? 'C2'] ?? 8;
  if (type === 'series') return title ? (need >= 4 ? 100 : 60) : 20;
  return 0;
}

/** 賞金(タイトル獲得・優勝)。 */
export const PRIZES = Object.freeze({
  ryuo: 3000, meijin: 2000, eio: 1000, kisei: 800, oi: 800, oza: 800, osho: 800, kio: 800,
  asahi: 500, nhk: 400, jt: 400, shinjin: 150,
});
export const prizeOf = (eventId) => PRIZES[eventId] ?? 0;

/** 金額の言葉(「1,234万円」)。 */
export const moneyText = (value) => `${Math.round(Number(value) || 0).toLocaleString('ja-JP')}万円`;

// ---- 研究の道具(10-2の4)

/** 研究の道具。買うと、次の公式戦の札に「事前研究」が出る(D:5-1 ご褒美の使い道)。 */
export const GEAR = Object.freeze([
  { level: 1, name: '研究用のノートパソコン', price: 30, prep: '相手の得意戦法が分かる' },
  { level: 2, name: '研究用のデスクトップ', price: 80, prep: 'この対局の作戦と囲いの読みが当たる' },
  { level: 3, name: '研究用の高性能パソコン', price: 200, prep: '相手の特殊能力と棋風まで分かる' },
]);

/**
 * 次に買える道具と、それまでの残り(D:5-2 あと少しが見える)。
 * @param {number} gear いま持っている段(0〜3)
 * @param {number} money 持っているお金
 */
export function nextGear(gear, money) {
  const item = GEAR.find((entry) => entry.level === (gear ?? 0) + 1) ?? null;
  if (!item) return null;
  return { ...item, need: Math.max(0, item.price - (money ?? 0)), affordable: (money ?? 0) >= item.price };
}

/**
 * 事前研究(次の公式戦の札)。道具の段で、分かることが増える。
 * @param {number} gear
 * @param {any} opponent 1年の棋士の写し(repertoire・character)
 * @param {{ label?: string } | null} style この対局の相手の作戦(pending.style)
 * @returns {{ gear: number, repertoire: string, plan: string, attack: string, abilities: string[] } | null}
 */
export function gearPrep(gear, opponent, style) {
  if (!gear || !opponent) return null;
  const prep = { gear, repertoire: '', plan: '', attack: '', abilities: /** @type {string[]} */ ([]) };
  prep.repertoire = opponent.repertoire ? repertoireText(opponent.repertoire) : opponent.style?.label ?? '';
  if (gear >= 2) prep.plan = style?.label ?? '';
  if (gear >= 3) {
    prep.attack = opponent.character ? describeCharacter(opponent.character).style : attackStyleLabel(NaN);
    prep.abilities = specialAbilityChips(opponent.character).map((chip) => chip.label);
  }
  return prep;
}
