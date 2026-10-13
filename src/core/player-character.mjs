// 架空の棋士の個性。棋風(攻め⇔受け)と、場面を限った特徴(得意・苦手)。
// 特徴は「どんな場面で」×「強さ設定のどのつまみが、どれだけ変わるか」で表す。Lvそのものは変えない。
// - 探索量(nodes): 読みの深さ
// - 手の選び方の鋭さ(scoreTemperature・bestMoveRate・maxScoreLoss): 良い手を選ぶ割合
// - 悪手の抑え(moveLossCap・blunderLimit・oversightRate): 大きな悪手や見落としの出にくさ
// - 棋風の重み(style): 最善手に近い候補の中で、攻めの手と受けの手のどちらを選びやすいか
// - 詰みが見える手数(mateHorizon): 何手詰めまで確実に詰ますか
// 設計は docs/tournament-design.md の「棋風と特徴」。

import { TOP_NODES } from './strength-settings.mjs';
import { attackersOf, findKing, isKingAttacked, opponentOf, parseSfenState, relativeFile, squareXY, xySquare } from './piece-movement.mjs';

/** 局面の区切り(手数)。竜王戦の統計(ryuo-stats.mjs)と同じ。 */
export const PHASE_LIMITS = Object.freeze({ opening: 30, middle: 80 });
/** 度合い。1: やや、2: とても。 */
export const DEGREE_WORDS = Object.freeze({ 1: 'やや', 2: 'とても' });
/** 形勢の区切り(手番側から見た評価値)。 */
export const BEHIND_SCORE = -300;
export const FAR_AHEAD_SCORE = 800;
/** 玉の周り(玉と8近傍)のうち、相手の利きがあるマスがこれ以上なら「玉が危険」とみなす。 */
export const KING_DANGER_SQUARES = 3;

/**
 * 棋風の重みを掛ける範囲(最善手との評価値の差)と、棋風が働く割合。
 * attack(-1〜1)の絶対値にSTYLE_RATEを掛けた割合で、範囲内の好みの手を選ぶ。
 */
export const STYLE_MARGIN = 80;
export const STYLE_RATE = 0.6;

/** 強さに応じた、詰みが見える手数(手数はplyで、相手の応手を含む)。技量(0〜1)から決める。 */
export function baseMateHorizon(skill) {
  if (!Number.isFinite(skill)) return 1;
  if (skill >= 1) return Infinity;
  if (skill >= 0.9) return 15;
  if (skill >= 0.75) return 11;
  if (skill >= 0.6) return 7;
  if (skill >= 0.45) return 5;
  if (skill >= 0.25) return 3;
  return 1;
}

/**
 * 特徴の一覧。labelは度合いの言葉(やや・とても)を入れて紹介文にする。
 * kind: strength(得意)・weakness(苦手)。whenは場面、effectは度合いごとの効果。
 */
export const TRAITS = Object.freeze([
  {
    id: 'endgame-defense', kind: 'strength', label: (d) => `終盤の受けが${DEGREE_WORDS[d]}正確`,
    when: { phase: 'ending', kingDanger: true },
    effect: (d) => ({ steady: d, sharpen: d * 0.5, style: -0.3 * d }),
  },
  {
    id: 'fast-attack', kind: 'strength', label: (d) => `寄せが${DEGREE_WORDS[d]}速い`,
    when: { phase: 'ending', attackChance: true },
    effect: (d) => ({ sharpen: d * 0.5, style: 0.4 * d }),
  },
  {
    id: 'tsume', kind: 'strength', label: (d) => `詰将棋が${DEGREE_WORDS[d]}得意`,
    when: {},
    effect: (d) => ({ mateHorizon: 2 * d }),
  },
  {
    id: 'deep-reading', kind: 'strength', label: (d) => `読みが${DEGREE_WORDS[d]}深い`,
    when: {},
    effect: (d) => ({ nodes: d === 2 ? 1.6 : 1.3 }),
  },
  {
    id: 'middle-strong', kind: 'strength', label: (d) => `中盤が${DEGREE_WORDS[d]}強い`,
    when: { phase: 'middle' },
    effect: (d) => ({ nodes: d === 2 ? 1.4 : 1.2, sharpen: d * 0.3 }),
  },
  {
    id: 'opening-study', kind: 'strength', label: (d) => `序盤の研究が${DEGREE_WORDS[d]}深い`,
    when: { phase: 'opening' },
    effect: (d) => ({ steady: d, sharpen: d * 0.4 }),
  },
  {
    id: 'vs-ranging', kind: 'strength', label: (d) => `対振り飛車が${DEGREE_WORDS[d]}得意`,
    when: { opponentRook: 'ranging' },
    effect: (d) => ({ sharpen: d * 0.4 }),
  },
  {
    id: 'vs-static', kind: 'strength', label: (d) => `対居飛車が${DEGREE_WORDS[d]}得意`,
    when: { opponentRook: 'static' },
    effect: (d) => ({ sharpen: d * 0.4 }),
  },
  {
    id: 'tenacious', kind: 'strength', label: (d) => `劣勢でも${d === 2 ? 'まったく' : 'あまり'}崩れない`,
    when: { behind: true },
    effect: (d) => ({ steady: d, style: -0.3 * d }),
  },
  {
    id: 'endgame-collapse', kind: 'weakness', label: (d) => `終盤での頓死が${d === 2 ? 'とても' : 'やや'}多い`,
    when: { phase: 'ending', kingDanger: true },
    effect: (d) => ({ overlook: d }),
  },
  {
    id: 'weak-defense', kind: 'weakness', label: (d) => `受けが${DEGREE_WORDS[d]}苦手`,
    when: { kingDanger: true },
    effect: (d) => ({ sharpen: -0.5 * d }),
  },
  {
    id: 'loose-when-ahead', kind: 'weakness', label: (d) => `優勢になると${DEGREE_WORDS[d]}緩みやすい`,
    when: { farAhead: true },
    effect: (d) => ({ sharpen: -0.5 * d, loose: d }),
  },
]);

const TRAIT_BY_ID = new Map(TRAITS.map((trait) => [trait.id, trait]));
export const traitById = (id) => TRAIT_BY_ID.get(id) ?? null;

/** 同時に持たない組。 */
const EXCLUSIVE = [
  ['endgame-defense', 'endgame-collapse'], ['endgame-defense', 'weak-defense'],
  ['vs-ranging', 'vs-static'], ['tenacious', 'weak-defense'],
];

export function traitLabel({ id, degree }) {
  const trait = traitById(id);
  return trait ? trait.label(degree === 2 ? 2 : 1) : '';
}

/** 棋風の言葉。 */
export function attackStyleLabel(attack) {
  if (!Number.isFinite(attack)) return 'バランス型';
  if (attack >= 0.6) return '激しい攻め将棋';
  if (attack >= 0.25) return '攻め将棋';
  if (attack <= -0.6) return '手厚い受け将棋';
  if (attack <= -0.25) return '受け将棋';
  return 'バランス型';
}

/** 棋士の紹介に使う、個性の要約。 */
export function describeCharacter(character) {
  if (!character) return { style: 'バランス型', strengths: [], weaknesses: [] };
  const traits = character.traits ?? [];
  return {
    style: attackStyleLabel(character.attack),
    strengths: traits.filter(({ id }) => traitById(id)?.kind === 'strength').map(traitLabel),
    weaknesses: traits.filter(({ id }) => traitById(id)?.kind === 'weakness').map(traitLabel),
  };
}

// ---- 個性を作る

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function gaussOf(rng) {
  const u = Math.max(rng.next(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/** 攻めっ気に寄る戦法と、受けに寄る戦法。 */
const AGGRESSIVE_STYLES = new Set(['ishida', 'hayaguri', 'bougin', 'right-shiken', 'gokigen', 'aigakari']);
const SOLID_STYLES = new Set(['ibisha-anaguma', 'shiken-anaguma', 'shiken-silver-crown', 'yagura']);

/** 特徴ごとの持ちやすさ。棋風・年齢・得意戦法で変える。 */
function traitWeights({ attack, age, rook }) {
  const young = age <= 30;
  const veteran = age >= 45;
  return {
    'endgame-defense': 1 + Math.max(0, -attack) * 2,
    'fast-attack': 1 + Math.max(0, attack) * 2 + (young ? 0.5 : 0),
    tsume: 1 + (young ? 1 : 0),
    'deep-reading': 1,
    'middle-strong': 1 + (veteran ? 1 : 0),
    'opening-study': 1 + (veteran ? 1 : 0),
    'vs-ranging': rook === 'static' ? 1.5 : 0.2,
    'vs-static': rook === 'ranging' ? 1.5 : 0.2,
    tenacious: 1 + Math.max(0, -attack) * 1.5,
    'endgame-collapse': 1 + (age >= 50 ? 1.5 : 0),
    'weak-defense': 1 + Math.max(0, attack) * 1.5,
    'loose-when-ahead': 1,
  };
}

function poisson(rng, mean) {
  const limit = Math.exp(-mean);
  let count = 0;
  let product = rng.next();
  while (product > limit && count < 4) {
    count += 1;
    product *= rng.next();
  }
  return count;
}

function pickTraits(rng, weights, kind, count, chosen) {
  for (let index = 0; index < count; index += 1) {
    const pool = TRAITS.filter((trait) => trait.kind === kind
      && !chosen.some(({ id }) => id === trait.id)
      && !EXCLUSIVE.some(([a, b]) => (a === trait.id && chosen.some(({ id }) => id === b)) || (b === trait.id && chosen.some(({ id }) => id === a))));
    const total = pool.reduce((sum, trait) => sum + weights[trait.id], 0);
    if (!(total > 0)) return;
    let roll = rng.next() * total;
    const trait = pool.find((entry) => (roll -= weights[entry.id]) <= 0) ?? pool.at(-1);
    chosen.push({ id: trait.id, degree: 1 });
  }
}

/**
 * 棋士の個性を作る。強い棋士ほど得意を多く、苦手を少なく持つ。多くの棋士は、得意0〜1個、苦手0〜1個。
 * @param {{ next(): number }} rng
 * @param {{ rating: number, age: number, style?: { id: string, rook: string } }} member
 */
export function createCharacter(rng, { rating, age, style }) {
  let attack = gaussOf(rng) * 0.4;
  if (style && AGGRESSIVE_STYLES.has(style.id)) attack += 0.2;
  if (style && SOLID_STYLES.has(style.id)) attack -= 0.2;
  if (age <= 25) attack += 0.1;
  attack = Math.round(clamp(attack, -1, 1) * 100) / 100 + 0; // -0を0にする(保存で変わらないように)。
  const weights = traitWeights({ attack, age, rook: style?.rook });
  const traits = [];
  pickTraits(rng, weights, 'strength', poisson(rng, clamp(0.8 + (rating - 1500) / 400, 0.3, 2.2)), traits);
  pickTraits(rng, weights, 'weakness', poisson(rng, clamp(0.5 - (rating - 1500) / 800, 0.1, 1)), traits);
  const strongChance = clamp(0.25 + (rating - 1500) / 1000, 0.1, 0.5);
  for (const trait of traits) {
    const chance = traitById(trait.id).kind === 'strength' ? strongChance : 0.3;
    trait.degree = rng.next() < chance ? 2 : 1;
  }
  return { attack, traits };
}

/** 1期ごとの個性の変化。年を取ると、終盤の特徴が変わりやすい。 */
export function ageCharacter(rng, character, { age, rating, style }) {
  const next = { attack: character.attack, traits: character.traits.map((trait) => ({ ...trait })) };
  next.attack = Math.round(clamp(next.attack + gaussOf(rng) * 0.03 - (age >= 45 ? 0.01 : 0), -1, 1) * 100) / 100 + 0;
  const weights = traitWeights({ attack: next.attack, age, rook: style?.rook });
  if (age >= 50) next.traits = next.traits.filter(({ id }) => !((id === 'fast-attack' || id === 'tsume') && rng.next() < 0.1));
  if (rng.next() < 0.04) pickTraits(rng, weights, 'strength', 1, next.traits);
  if (rng.next() < (age >= 50 ? 0.06 : 0.02)) pickTraits(rng, weights, 'weakness', 1, next.traits);
  for (const trait of next.traits) if (trait.degree === 1 && rng.next() < 0.03 + Math.max(0, rating - 1600) / 5000) trait.degree = 2;
  return next;
}

// ---- 局面の判定

function zoneDanger(board, kingSquare, attacker) {
  if (!kingSquare) return 0;
  const { x, y } = squareXY(kingSquare);
  let count = 0;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const square = xySquare(x + dx, y + dy);
      if (square && attackersOf(board, square, attacker).length) count += 1;
    }
  }
  return count;
}

/** 飛車の振り方。飛車が盤上になければnull。 */
export function rookStyleOf(board, color) {
  for (const [square, piece] of board) {
    if (piece.color === color && piece.kind === 'R') return relativeFile(square, color) >= 5 ? 'ranging' : 'static';
  }
  return null;
}

/**
 * 手番側(CPU)から見た局面の場面。探索の前に分かることだけを調べる。形勢(advantage)と詰みは、探索のあとに足す。
 * @param {{ sfen: string, ply: number }} options plyは、これまでの手数。
 */
export function characterSituation({ sfen, ply }) {
  const { board, turn: me } = parseSfenState(sfen);
  const opp = opponentOf(me);
  const phase = ply < PHASE_LIMITS.opening ? 'opening' : ply < PHASE_LIMITS.middle ? 'middle' : 'ending';
  return {
    phase,
    kingDanger: isKingAttacked(board, me) || zoneDanger(board, findKing(board, me), opp) >= KING_DANGER_SQUARES,
    attackChance: isKingAttacked(board, opp) || zoneDanger(board, findKing(board, opp), me) >= KING_DANGER_SQUARES,
    opponentRook: rookStyleOf(board, opp),
  };
}

function matches(when, situation) {
  if (when.phase && when.phase !== situation.phase) return false;
  if (when.kingDanger && !situation.kingDanger) return false;
  if (when.attackChance && !situation.attackChance) return false;
  if (when.opponentRook && when.opponentRook !== situation.opponentRook) return false;
  if (when.behind && !(situation.advantage <= BEHIND_SCORE)) return false;
  if (when.farAhead && !(situation.advantage >= FAR_AHEAD_SCORE)) return false;
  return true;
}

/** この場面で働く特徴。 */
export function activeTraits(character, situation) {
  return (character?.traits ?? []).filter(({ id }) => {
    const trait = traitById(id);
    return trait && matches(trait.when, situation);
  });
}

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * 強さ設定に、棋風と、この場面で働く特徴を反映する。元の設定は変えない。
 * 探索の前(advantage未定)に呼べば探索量が、探索のあとに呼べば手の選び方が決まる。
 * @param {object} strength getStrengthSearchSettingsの結果
 * @param {{ attack: number, traits: { id: string, degree: number }[] } | null} character
 * @param {ReturnType<typeof characterSituation> & { advantage?: number }} situation
 * @param {{ skill: number }} options
 */
export function applyCharacter(strength, character, situation, { skill }) {
  const next = { ...strength, mateHorizon: baseMateHorizon(skill) };
  if (!character) return next;
  let nodes = 1;
  let sharpen = 0;
  let steady = 0;
  let overlook = 0;
  let loose = 0;
  let mate = 0;
  let style = character.attack ?? 0;
  const active = activeTraits(character, situation);
  for (const { id, degree } of active) {
    const effect = traitById(id).effect(degree === 2 ? 2 : 1);
    nodes *= effect.nodes ?? 1;
    sharpen += effect.sharpen ?? 0;
    steady = Math.max(steady, effect.steady ?? 0);
    overlook = Math.max(overlook, effect.overlook ?? 0);
    loose = Math.max(loose, effect.loose ?? 0);
    mate += effect.mateHorizon ?? 0;
    style += effect.style ?? 0;
  }
  next.activeTraits = active.map(({ id }) => id);
  // 最善手だけを指す設定(Lv40「藤井聡太並み」)は、上限なので、探索量も手の選び方も変えない。
  const bestOnly = next.bestMoveRate >= 1;
  // 読みが深くても、Lv40を超えないように、Lv40未満の探索量の上限(TOP_NODES)で止める。
  if (nodes !== 1 && !bestOnly && Number.isFinite(next.nodes) && next.nodes > 0) next.nodes = Math.round(Math.min(TOP_NODES, next.nodes * nodes));
  if (sharpen !== 0 && !bestOnly) {
    const k = clamp(sharpen, -1, 1) * 0.25;
    if (Number.isFinite(next.scoreTemperature)) next.scoreTemperature = Math.max(1, Math.round(next.scoreTemperature * (1 - k)));
    if (Number.isFinite(next.maxScoreLoss)) next.maxScoreLoss = Math.max(0, Math.round(next.maxScoreLoss * (1 - k)));
    if (Number.isFinite(next.bestMoveRate)) {
      next.bestMoveRate = round2(clamp(k >= 0 ? next.bestMoveRate + (1 - next.bestMoveRate) * k : next.bestMoveRate * (1 + k), 0, 1));
    }
  }
  if (steady > 0) {
    // 悪手と数える損(300)より小さい損まで。見落としも減らす。
    next.moveLossCap = Math.min(next.moveLossCap ?? Infinity, steady === 2 ? 150 : 250);
    next.blunderLimit = 0;
    if (next.oversightRate) next.oversightRate = round2(next.oversightRate * (steady === 2 ? 0.2 : 0.5));
  }
  if (overlook > 0) {
    // 自玉の危険を見落とす。浅く読むと良く見えて、深く読むと悪い手を、ときどき選ぶ。
    next.oversightRate = round2(Math.max(next.oversightRate ?? 0, overlook === 2 ? 0.35 : 0.18));
    next.oversightShallowLoss = Math.max(next.oversightShallowLoss ?? 0, 300);
    next.oversightNodes = Math.max(next.oversightNodes ?? 0, Math.min(70000, Math.max(3000, (next.nodes ?? 0) * 3)));
    next.oversightMaxLoss = Math.max(next.oversightMaxLoss ?? 0, 2500);
    next.moveLossCap = Math.max(next.moveLossCap ?? 0, 2500);
    next.blunderLimit = Math.max(next.blunderLimit ?? 0, 2 + overlook);
    next.blunderCooldown = Math.min(next.blunderCooldown ?? 0, 4);
  }
  if (loose > 0) {
    next.moveLossCap = Math.max(next.moveLossCap ?? 0, loose === 2 ? 800 : 500);
    next.blunderLimit = Math.max(next.blunderLimit ?? 0, 1 + loose);
  }
  next.mateHorizon += mate;
  const attack = clamp(style, -1, 1);
  if (Math.abs(attack) >= 0.05 && !bestOnly) {
    next.style = { attack: round2(attack), margin: STYLE_MARGIN, rate: STYLE_RATE };
    // 好みの手を比べられるよう、候補を3つ以上読む(ふだんの手の選び方の範囲moveRankは変えない)。
    if (Number.isFinite(next.multiPv) && next.multiPv < 3) next.multiPv = 3;
  }
  return next;
}
