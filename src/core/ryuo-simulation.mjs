// 棋士どうしの自動対局(docs/player-abilities-design.mdの6-1、docs/rating-realism-design.md)。
// 勝ち負けは、レーティングの差からElo式(400。実物の棋士レーティングと同じ)で決める。先手の有利と、能力の配分・戦法の相性・
// 特殊能力は、レーティングに直した小さな上乗せ(合わせて±STYLE_EDGE_MAXまで)にして足す。
// どう勝ったか(序盤・中盤・終盤の形勢)は、序盤→中盤→終盤と形勢を進める対局のまねで、決まった勝ち負けに合う展開を選ぶ。
// だから、序盤型が逃げ切る・終盤型が逆転する、という勝ち方の違いは残り、勝率はレーティングの差どおりになる。画面に依存しない。

import { matchupBonus } from './player-character.mjs';
import { winProbability } from './ryuo-strength.mjs';
import { pickGameStyle, styleEntry } from './ryuo-repertoire.mjs';
import { staticShare } from './opening-usage.mjs';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** 局面ごとの乱数の大きさ(レーティング)。勝ち方の展開を作るのに使う(勝ち負けはElo式で先に決める)。 */
export const PHASE_NOISE = 160;
/** 能力の差1あたりの、形勢(レーティング)の動き。 */
export const ABILITY_POINT = 4;
/** レーティングの差を、序盤・中盤・終盤に分ける割合(合わせて1)。 */
export const PHASE_SHARES = Object.freeze([0.25, 0.35, 0.4]);
/** 先手の有利(レーティング)。プロの先手勝率は約52.5%で、Elo式では約17の差にあたる。 */
export const FIRST_MOVE_EDGE = 17;
/** 能力の配分・戦法の相性・特殊能力の上乗せの上限(レーティング)。差0なら勝率を約58.5%まで動かす。 */
export const STYLE_EDGE_MAX = 60;
/** 決まった勝ち負けに合う展開を、何回まで引き直すか。合わなければ、最後の展開を裏返す。 */
const STORY_TRIES = 80;
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
/** 逆転の名手の、勝ち負けへの上乗せ(レーティング。劣勢になる局のぶんを平均した値)。 */
const COMEBACK_EDGE = 25;
/**
 * 安定感による、レーティングの差の効き方(倍率の幅)。安定感の高い棋士どうしは差どおりに、低い棋士どうしは番狂わせが増える。
 * 差0の勝率(5割)は変えない。
 */
const STABILITY_SCALE = 0.15;

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
 * @returns {{
 *   aWins: boolean, how: string, aColor: 'black' | 'white', openings: { a: string | null, b: string | null },
 *   castles: { a: string | null, b: string | null }, phases: number[], probability: number,
 * }}
 *   probabilityは、この1局のaの勝率(レーティングの差・先手・上乗せから、Elo式で)。castlesは、戦法といっしょに選んだ囲い。
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

  const style = matchupBonus(a.character, bRook) - matchupBonus(b.character, aRook);
  const delta = ratingOf(a) - ratingOf(b) + style;
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
  const abilityEdge = [
    ABILITY_POINT * (dev(a, 'opening') - dev(b, 'opening')),
    ABILITY_POINT * (dev(a, 'middle') - dev(b, 'middle'))
      + (ABILITY_POINT / 2) * (dev(a, 'attack') + dev(a, 'defense') - dev(b, 'attack') - dev(b, 'defense')),
    ABILITY_POINT * (dev(a, 'ending') - dev(b, 'ending'))
      + (ABILITY_POINT / 2) * (dev(a, 'reading') - dev(b, 'reading') + dev(a, 'mate') - dev(b, 'mate')),
  ];
  const bigEdge = big
    ? BIG_STAGE_ELO * (traitDegree(a, 'big-stage') - traitDegree(a, 'big-stage-weak') - traitDegree(b, 'big-stage') + traitDegree(b, 'big-stage-weak'))
    : 0;
  const firstMove = color === 'black' ? FIRST_MOVE_EDGE : -FIRST_MOVE_EDGE;
  // 勝ち負け: レーティングの差 + 先手 + 能力・相性・特殊能力の上乗せ(上限つき)を、Elo式の勝率にする。
  const comebackEdge = COMEBACK_EDGE * (traitDegree(a, 'comeback') - traitDegree(b, 'comeback'));
  const edge = clamp(
    style + abilityEdge[0] + abilityEdge[1] + abilityEdge[2] + gold(0) + gold(1) + gold(2) + bigEdge + comebackEdge,
    -STYLE_EDGE_MAX,
    STYLE_EDGE_MAX,
  );
  const scale = clamp(1 + (dev(a, 'stability') + dev(b, 'stability')) / 400, 1 - STABILITY_SCALE, 1 + STABILITY_SCALE);
  const probability = winProbability((ratingOf(a) - ratingOf(b)) * scale + edge + firstMove, 0);
  const aWins = rng.next() < probability;

  /** 展開(序盤・中盤・終盤のあとの形勢。aから見た値)を1つ作る。 */
  const story = () => {
    const p1 = PHASE_SHARES[0] * delta + abilityEdge[0] + firstMove + gold(0) + bloom(0) + gaussOf(rng) * noise;
    const p2 = p1 + PHASE_SHARES[1] * delta + abilityEdge[1] + gold(1) + gaussOf(rng) * noise;
    let p3 = p2 + PHASE_SHARES[2] * delta + abilityEdge[2] + gold(2) + bloom(2) + gaussOf(rng) * noise;
    // 安定感の低い棋士は、優勢から崩れることがある。
    if (p2 > 0) p3 -= (p2 * clamp(-dev(a, 'stability'), 0, 30)) / 120;
    else p3 += (-p2 * clamp(-dev(b, 'stability'), 0, 30)) / 120;
    // 逆転の名手は、中盤を終えて劣勢なら、終盤で取り返す。
    if (p2 < 0 && traitDegree(a, 'comeback')) p3 += COMEBACK_ELO;
    if (p2 > 0 && traitDegree(b, 'comeback')) p3 -= COMEBACK_ELO;
    return [p1, p2, p3 + bigEdge];
  };
  let phases = story();
  for (let tries = 1; tries < STORY_TRIES && (phases[2] > 0) !== aWins; tries += 1) phases = story();
  // 引き直しても合わない(大差の番狂わせ)ときは、最後の展開を裏返す(負けた側から見た展開にする)。
  if ((phases[2] > 0) !== aWins) phases = phases.map((value) => -value);
  const sign = aWins ? 1 : -1;
  return {
    aWins,
    how: classifyWin([phases[0] * sign, phases[1] * sign, phases[2] * sign]),
    aColor: color,
    openings: { a: aOpening?.opening ?? null, b: bOpening?.opening ?? null },
    castles: { a: aOpening?.castle || null, b: bOpening?.castle || null },
    phases: phases.map((value) => Math.round(value)),
    probability,
  };
}

/**
 * 対局の記録(トーナメント表の結果・番勝負の1局)に残す形。blackは先手のid、openingsは棋士のidごとの戦法。
 * storyは、序盤・中盤・終盤のあとの形勢(先手から見たレーティングの単位)、castlesは棋士のidごとの囲い。
 * どちらも、中継の棋譜を展開どおりに作るのに使う(docs/tournament-relay-design.mdの3章)。前の保存の記録にはない。
 */
export function gameRecordOf(result, aId, bId) {
  const sign = result.aColor === 'black' ? 1 : -1;
  return {
    black: result.aColor === 'black' ? aId : bId,
    how: result.how,
    openings: { [aId]: result.openings.a, [bId]: result.openings.b },
    castles: { [aId]: result.castles?.a ?? null, [bId]: result.castles?.b ?? null },
    story: (result.phases ?? []).map((value) => value * sign + 0),
  };
}
