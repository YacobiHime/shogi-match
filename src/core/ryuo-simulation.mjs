// 棋士どうしの自動対局を、序盤→中盤→終盤と形勢を進める簡単な対局のまねで決める(docs/player-abilities-design.mdの6-1)。
// レーティングの差は3つの局面に分けて足し(合わせると今までのElo式とほぼ同じ勝率)、能力の配分の差・戦法の相性・特殊能力が、
// どの局面で形勢を動かすかを決める。だから、序盤型が逃げ切る・終盤型が逆転する、という勝ち方の違いが出る。
// 乱数は局面ごとに足し、安定感の低い棋士どうしほど大きくする(調子の波)。画面に依存しない。

import { matchupBonus } from './player-character.mjs';
import { pickGameStyle, styleEntry } from './ryuo-repertoire.mjs';
import { staticShare } from './opening-usage.mjs';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * 局面ごとの乱数の大きさ(レーティング)。3つを合わせると標準偏差約277で、レーティングの差に対する勝率が、
 * Elo式(400)とほぼ同じになる(差0で5割、差200で約76%)。
 */
export const PHASE_NOISE = 160;
/** 能力の差1あたりの、形勢(レーティング)の動き。 */
export const ABILITY_POINT = 4;
/** レーティングの差を、序盤・中盤・終盤に分ける割合(合わせて1)。 */
export const PHASE_SHARES = Object.freeze([0.25, 0.35, 0.4]);
/** 先手の有利(プロの先手勝率は約52%)。 */
export const FIRST_MOVE_EDGE = 20;
/** 大舞台に強い(弱い)の、決勝・番勝負での上乗せ(度合い1あたり)。 */
export const BIG_STAGE_ELO = 30;

/** 金の特殊能力の、自動対局での効き(どの局面で、どれだけ形勢を動かすか)。 */
const GOLD_EFFECTS = Object.freeze({
  'research-demon': { phase: 0, value: 25 },
  'grand-view': { phase: 1, value: 25 },
  'demon-reading': { phase: 2, value: 25 },
});
/** 逆転の名手: 中盤を終えて劣勢なら、終盤で取り返す。 */
const COMEBACK_ELO = 60;

/** 勝ち方の種類と、表示の言葉(勝った側から見た言い方)。 */
export const HOW_LABELS = Object.freeze({
  opening: '序盤でリードを奪い、押し切った',
  middle: '中盤で抜け出した',
  ending: '終盤の競り合いを制した',
  comeback: '終盤で逆転した',
  recover: '序盤の不利を挽回した',
});

function gaussOf(rng) {
  const u = Math.max(rng.next(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

const dev = (member, key) => clamp(member?.character?.abilities?.[key] ?? 0, -30, 30);
const traitDegree = (member, id) => {
  const trait = member?.character?.traits?.find((entry) => entry.id === id);
  return trait ? (trait.degree === 2 ? 2 : 1) : 0;
};

/** 棋士のふだんの飛車の振り方(使用率の居飛車の割合、なければいちばんの得意戦法)。 */
export function usualRook(member) {
  const usage = member?.repertoire?.usage;
  if (usage) return staticShare(usage) >= 50 ? 'static' : 'ranging';
  const primary = member?.repertoire?.styles?.[0];
  return primary ? styleEntry(primary).rook : member?.style?.rook ?? null;
}

/** 勝ち方の種類。w1・w2・w3は、勝った側から見た、序盤・中盤・終盤のあとの形勢。 */
export function classifyWin([w1, w2]) {
  if (w2 <= -80) return 'comeback';
  if (w1 <= -80) return 'recover';
  if (w1 >= 120) return 'opening';
  if (w2 >= 150) return 'middle';
  return 'ending';
}

/**
 * 1局を決める。aColorは、aの手番(省略すると乱数)。bigは、決勝・番勝負などの大事な対局。
 * @param {{ next(): number }} rng
 * @param {any} a
 * @param {any} b
 * @param {{ ratingOf?: (member: any) => number, big?: boolean, aColor?: 'black' | 'white' | null }} [options]
 * @returns {{ aWins: boolean, how: string, aColor: 'black' | 'white', openings: { a: string | null, b: string | null }, phases: number[] }}
 */
export function simulateMemberGame(rng, a, b, { ratingOf = (member) => member.rating, big = false, aColor = null } = {}) {
  const color = aColor ?? (rng.next() < 0.5 ? 'black' : 'white');
  // 戦型: 先手が先に、相手のふだんの振り方を見て選び、後手は先手の選んだ戦法を見て選ぶ。
  const [first, second] = color === 'black' ? [a, b] : [b, a];
  const firstOpening = first?.repertoire ? pickGameStyle(rng, first.repertoire, { color: 'black', opponentRook: usualRook(second) }) : null;
  const firstRook = firstOpening?.rook ?? usualRook(first);
  const secondOpening = second?.repertoire ? pickGameStyle(rng, second.repertoire, { color: 'white', opponentRook: firstRook }) : null;
  const secondRook = secondOpening?.rook ?? usualRook(second);
  const [aOpening, bOpening] = color === 'black' ? [firstOpening, secondOpening] : [secondOpening, firstOpening];
  const [aRook, bRook] = color === 'black' ? [firstRook, secondRook] : [secondRook, firstRook];

  const delta = ratingOf(a) - ratingOf(b) + matchupBonus(a.character, bRook) - matchupBonus(b.character, aRook);
  const noise = PHASE_NOISE * clamp(1 - (dev(a, 'stability') + dev(b, 'stability')) / 150, 0.7, 1.3);
  const gold = (phase) => {
    let value = 0;
    for (const [id, effect] of Object.entries(GOLD_EFFECTS)) {
      if (effect.phase !== phase) continue;
      if (traitDegree(a, id)) value += effect.value;
      if (traitDegree(b, id)) value -= effect.value;
    }
    return value;
  };
  // 序盤より中盤、中盤より終盤と強くなる(羽音)。合わせると0。
  const bloom = (phase) => (traitDegree(a, 'late-bloom') - traitDegree(b, 'late-bloom')) * (phase === 0 ? -10 : phase === 2 ? 10 : 0);

  const p1 = PHASE_SHARES[0] * delta
    + ABILITY_POINT * (dev(a, 'opening') - dev(b, 'opening'))
    + (color === 'black' ? FIRST_MOVE_EDGE : -FIRST_MOVE_EDGE)
    + gold(0) + bloom(0) + gaussOf(rng) * noise;
  const p2 = p1 + PHASE_SHARES[1] * delta
    + ABILITY_POINT * (dev(a, 'middle') - dev(b, 'middle'))
    + (ABILITY_POINT / 2) * (dev(a, 'attack') + dev(a, 'defense') - dev(b, 'attack') - dev(b, 'defense'))
    + gold(1) + gaussOf(rng) * noise;
  let p3 = p2 + PHASE_SHARES[2] * delta
    + ABILITY_POINT * (dev(a, 'ending') - dev(b, 'ending'))
    + (ABILITY_POINT / 2) * (dev(a, 'reading') - dev(b, 'reading') + dev(a, 'mate') - dev(b, 'mate'))
    + gold(2) + bloom(2) + gaussOf(rng) * noise;
  // 安定感の低い棋士は、優勢から崩れることがある。
  if (p2 > 0) p3 -= (p2 * clamp(-dev(a, 'stability'), 0, 30)) / 120;
  else p3 += (-p2 * clamp(-dev(b, 'stability'), 0, 30)) / 120;
  // 逆転の名手は、中盤を終えて劣勢なら、終盤で取り返す。
  if (p2 < 0 && traitDegree(a, 'comeback')) p3 += COMEBACK_ELO;
  if (p2 > 0 && traitDegree(b, 'comeback')) p3 -= COMEBACK_ELO;
  if (big) p3 += BIG_STAGE_ELO * (traitDegree(a, 'big-stage') - traitDegree(a, 'big-stage-weak') - traitDegree(b, 'big-stage') + traitDegree(b, 'big-stage-weak'));
  const aWins = p3 > 0;
  const sign = aWins ? 1 : -1;
  return {
    aWins,
    how: classifyWin([p1 * sign, p2 * sign, p3 * sign]),
    aColor: color,
    openings: { a: aOpening?.opening ?? null, b: bOpening?.opening ?? null },
    phases: [Math.round(p1), Math.round(p2), Math.round(p3)],
  };
}

/** 対局の記録(トーナメント表の結果・番勝負の1局)に残す形。blackは先手のid、openingsは棋士のidごとの戦法。 */
export function gameRecordOf(result, aId, bId) {
  return {
    black: result.aColor === 'black' ? aId : bId,
    how: result.how,
    openings: { [aId]: result.openings.a, [bId]: result.openings.b },
  };
}
