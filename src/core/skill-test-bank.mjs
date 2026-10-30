// 棋力テストの問題の束(docs/skill-assessment-design.mdの4-3)。自己対局から作った問題(src/data/skill-test-items.mjs)と、
// 問題集の詰将棋に、人に合わせた難しさ(b、Lv)を付ける。問題集のデータを読むので、棋力テストの画面からだけ読む
// (対局画面から静的にimportしない。AGENTS.md)。

import { SKILL_TEST_ITEMS, SKILL_TEST_MATE_CPU_B } from '../data/skill-test-items.mjs';
import { JISSEN_SET, TSUME_SET } from './problem-set.mjs';
import { ABILITY_OF_TYPE } from './skill-test.mjs';

/**
 * 詰将棋の手数の目安(Lv)。1手詰め＝17級くらい(Lv8)、3手詰め＝9級くらい(Lv16)、5手詰め＝1級くらい(Lv24)、
 * 7手詰め＝アマ二段くらい(Lv30)。
 * 公式の基準はないので、手数ごとの難しさの目安として置き、確かめ(8章)と集めた答え(7章)で直す。
 */
export const MATE_ANCHORS = Object.freeze({ 1: 8, 3: 16, 5: 24, 7: 30 });
/** 実戦詰将棋(盤に駒が多い)は、同じ手数でも見つけにくい。 */
const JISSEN_EXTRA = 2;
/** 手数ごとの問題の並び(やさしい順)による幅。最初の問題を−2、最後を＋2。 */
const ORDER_SPAN = 4;
const MIN_B = 0;
const MAX_B = 47;
const clamp = (value) => Math.min(MAX_B, Math.max(MIN_B, value));

/** 詰将棋の問題の難しさ(手数の目安＋実戦かどうか＋並び)。 */
export function mateDifficulty(problem, count = 30) {
  const base = MATE_ANCHORS[problem.plies] ?? MATE_ANCHORS[7] + 2 * ((problem.plies ?? 7) - 7);
  const order = count > 1 ? ((problem.number - 1) / (count - 1)) * ORDER_SPAN - ORDER_SPAN / 2 : 0;
  return clamp(base + (problem.source === 'jissen' ? JISSEN_EXTRA : 0) + order);
}

const MATE_PROBLEMS = [...TSUME_SET, ...JISSEN_SET];
/**
 * 解かせたいちばん強いLv(34)でもほとんど解けなかった問題(cpuBが40以上)は出さない。難しさが測れず、
 * 弱いLvだけが解けて強いLvが解けない(答えの手が狭すぎるなど、強さと関係のない)問題も混じっていたため。
 */
const MAX_CPU_B = 40;
const measured = (cpuB) => Number.isFinite(cpuB) && cpuB < MAX_CPU_B;

/**
 * CPUで測った難しさ(cpuB)を人に合わせる補正(Lv)。CPUは人より読みが正確で、同じLvでも問題を解きやすい。
 * 詰将棋は「手数の目安」と「CPUに解かせた難しさ」の両方があるので、その差の中央値を、自己対局から作った問題にも足す。
 * 種類ごとの補正は、確かめと集めた答えで直す(同じ値から始める)。
 */
export const CPU_TO_HUMAN_OFFSET = (() => {
  const gaps = MATE_PROBLEMS
    .filter(({ id }) => measured(SKILL_TEST_MATE_CPU_B[id]))
    .map((problem) => mateDifficulty(problem) - SKILL_TEST_MATE_CPU_B[problem.id])
    .sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
})();
export const TYPE_OFFSETS = Object.freeze({
  take: CPU_TO_HUMAN_OFFSET,
  save: CPU_TO_HUMAN_OFFSET,
  tactic: CPU_TO_HUMAN_OFFSET,
  defend: CPU_TO_HUMAN_OFFSET,
  judge: CPU_TO_HUMAN_OFFSET,
});

/**
 * @typedef {{
 *   id: string, type: string, ability: string, b: number, guess: number, sfen: string,
 *   accepted?: readonly string[], choices?: readonly string[], best?: string, pv?: readonly string[], problem?: any,
 *   line?: readonly string[], threat?: string, threatMate?: number, target?: string, tesuji?: string, targets?: readonly string[], gap?: number,
 * }} SkillTestItem
 */

/** @type {readonly SkillTestItem[]} */
export const SKILL_TEST_BANK = Object.freeze([
  ...SKILL_TEST_ITEMS.filter(({ cpuB }) => measured(cpuB)).map((item) => Object.freeze({
    ...item,
    ability: ABILITY_OF_TYPE[item.type],
    b: clamp(item.cpuB + (TYPE_OFFSETS[item.type] ?? 0)),
    guess: item.choices ? 1 / 3 : 0,
  })),
  ...MATE_PROBLEMS.map((problem) => Object.freeze({
    id: problem.id,
    type: 'mate',
    ability: ABILITY_OF_TYPE.mate,
    b: mateDifficulty(problem),
    guess: 0,
    sfen: problem.sfen,
    problem,
  })),
]);
