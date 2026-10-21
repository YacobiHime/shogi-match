// 架空の棋士の個性。棋風(攻め⇔受け)と、場面を限った特徴(得意・苦手)。
// 特徴は「どんな場面で」×「強さ設定のどのつまみが、どれだけ変わるか」で表す。Lvそのものは変えない。
// - 探索量(nodes): 読みの深さ
// - 手の選び方の鋭さ(scoreTemperature・bestMoveRate・maxScoreLoss): 良い手を選ぶ割合
// - 悪手の抑え(moveLossCap・blunderLimit・oversightRate): 大きな悪手や見落としの出にくさ
// - 棋風の重み(style): 最善手に近い候補の中で、攻めの手と受けの手のどちらを選びやすいか
// - 詰みを見つける確率(mateFinding): n手詰めを、どれだけの確率で詰ますか
// 効果は、そのレベルの元の値に対する割合や確率のずらしで掛け、レベルに応じて上がり幅が変わるようにする。
// 設計は docs/tournament-design.md の「棋風と特徴」。

import { TOP_NODES } from './strength-settings.mjs';
import { ABILITY_KEYS, ageAbilities, createAbilities, styleAttackOf } from './player-abilities.mjs';
import { attackersOf, findKing, isKingAttacked, opponentOf, parseSfenState, relativeFile, squareXY, xySquare } from './piece-movement.mjs';

/** 局面の区切り(手数)。竜王戦の統計(ryuo-stats.mjs)と同じ。 */
export const PHASE_LIMITS = Object.freeze({ opening: 30, middle: 80 });
/** 度合い。1: やや、2: とても。 */
export const DEGREE_WORDS = Object.freeze({ 1: 'やや', 2: 'とても' });
/** 形勢の区切り(手番側から見た評価値)。 */
export const BEHIND_SCORE = -300;
export const FAR_AHEAD_SCORE = 800;
/** 互角とみなす形勢の幅(勝負強さの特殊能力が働く)。 */
export const CLOSE_SCORE = 300;
/** 玉の周り(玉と8近傍)のうち、相手の利きがあるマスがこれ以上なら「玉が危険」とみなす。 */
export const KING_DANGER_SQUARES = 3;

/**
 * 棋風の重みを掛ける範囲(最善手との評価値の差)と、棋風が働く割合。
 * attack(-1〜1)の絶対値にSTYLE_RATEを掛けた割合で、範囲内の好みの手を選ぶ。
 */
export const STYLE_MARGIN = 80;
/** 悪手を抑える特徴で、1手の損の上限をこれより下げない。 */
const MIN_STEADY_LOSS_CAP = 80;
/** 頓死の特徴で、見落としの割合をずらす元の値の下限。 */
const OVERLOOK_FLOOR = 0.02;
/** 詰将棋の特徴で、詰みを見つける確率をずらす幅(ロジット、度合い1あたり)。 */
const MATE_TRAIT_LOGIT = 1;
export const STYLE_RATE = 0.6;

/**
 * 詰みを見つける確率の形。n手詰め(plyで、相手の応手を含む)を見つける確率は、
 * 1 / (1 + exp(-slope × (center - n)))。centerは確率が半分になる手数で、強いほど長い。
 * 技量0で約1.5手、技量0.5で約7手、技量0.9で約13手。Lv40(技量1)は、最善手だけを指すので使わない。
 */
export const MATE_SLOPE = 0.7;
export function mateCenter(skill) {
  const s = clamp(Number.isFinite(skill) ? skill : 0, 0, 1);
  return 1.5 + 13 * s ** 1.1;
}

/** 強さに応じた、詰みを見つける確率の設定。 */
export function baseMateFinding(skill) {
  if (skill >= 1) return { center: Infinity, slope: MATE_SLOPE };
  return { center: Math.round(mateCenter(skill) * 100) / 100, slope: MATE_SLOPE };
}

/** n手詰めを見つける確率。 */
export function mateFindProbability(finding, plies) {
  if (!finding || !(plies > 0)) return 0;
  if (finding.center === Infinity) return 1;
  return 1 / (1 + Math.exp(-finding.slope * (finding.center - plies)));
}

/** 確率を、ロジット(対数オッズ)でずらす。0や1に近いほど、ずれ幅は小さくなる。 */
export function shiftProbability(probability, delta) {
  const p = clamp(probability, 1e-4, 1 - 1e-4);
  return 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + delta)));
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
    effect: (d) => ({ mate: d }),
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
    // 物語の人物(天鷺羽音)だけが持つ特徴。乱数の棋士には付けない(traitWeightsで0)。
    // 序盤は並み、中盤から読みで上回り、終盤がいちばん正確。effectは場面(situation)で変わる。
    id: 'late-bloom', kind: 'strength', label: (d) => `序盤より中盤、中盤より終盤と、指すほど${d === 2 ? 'ぐんぐん' : ''}強くなる`,
    when: {},
    effect: (d, situation) => {
      if (situation?.phase === 'opening') return { sharpen: -0.3 };
      if (situation?.phase === 'middle') return { sharpen: 0.3 * d, nodes: d === 2 ? 1.2 : 1.1 };
      return { sharpen: 0.5 * d, steady: d, nodes: d === 2 ? 1.3 : 1.15 };
    },
  },
  {
    // 大舞台に強い: 互角の終盤で手の選び方が鋭い。自動対局では、決勝・番勝負で強くなる(ryuo-simulation.mjs)。
    id: 'big-stage', kind: 'strength', label: (d) => `大舞台に${DEGREE_WORDS[d]}強い`,
    when: { phase: 'ending', close: true },
    effect: (d) => ({ sharpen: 0.4 * d }),
  },
  // ---- 金の特殊能力(超特殊能力)。1組の上位とタイトル保持者だけが持つ。度合いはなく、「とても」より少し強く効く。
  {
    id: 'grand-view', kind: 'strength', tier: 'gold', label: () => '大局観',
    hint: '中盤の形勢判断が正確。中盤の手の選び方がとても鋭く、悪手が少ない',
    when: { phase: 'middle' },
    effect: () => ({ sharpen: 1, steady: 1, nodes: 1.2 }),
  },
  {
    id: 'demon-reading', kind: 'strength', tier: 'gold', label: () => '鬼の読み',
    hint: 'いつも深く正確に読む。読みの量が大きく増え、見落としがほとんどない',
    when: {},
    effect: () => ({ nodes: 1.7, steady: 1 }),
  },
  {
    id: 'comeback', kind: 'strength', tier: 'gold', label: () => '逆転の名手',
    hint: '劣勢になると、最善に近い手の中から、相手が間違えやすい勝負手を選ぶ',
    when: { behind: true },
    effect: () => ({ sharpen: 0.8, steady: 1, style: 0.5 }),
  },
  {
    id: 'research-demon', kind: 'strength', tier: 'gold', label: () => '研究の鬼',
    hint: '序盤の研究が深く、序盤の悪手がほとんどない',
    when: { phase: 'opening' },
    effect: () => ({ sharpen: 1, steady: 2 }),
  },
  {
    id: 'defense-master', kind: 'strength', tier: 'gold', label: () => '受けの達人',
    hint: '自玉が危ないとき、悪手がほとんどなく、手厚く受ける',
    when: { kingDanger: true },
    effect: () => ({ sharpen: 0.8, steady: 2, style: -0.4 }),
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
  {
    id: 'big-stage-weak', kind: 'weakness', label: (d) => `大舞台で${d === 2 ? 'とても' : 'やや'}硬くなる`,
    when: { phase: 'ending', close: true },
    effect: (d) => ({ sharpen: -0.4 * d }),
  },
  {
    // 持ち時間の使い方が下手: 終盤に時間が足りなくなる(読みが浅くなる)。
    id: 'time-trouble', kind: 'weakness', label: (d) => `終盤で時間に${d === 2 ? 'とても' : 'やや'}追われる`,
    when: { phase: 'ending' },
    effect: (d) => ({ nodes: d === 2 ? 0.6 : 0.8, sharpen: -0.25 * d }),
  },
]);

const TRAIT_BY_ID = new Map(TRAITS.map((trait) => [trait.id, trait]));
export const traitById = (id) => TRAIT_BY_ID.get(id) ?? null;
/** 金の特殊能力か。 */
export const isGoldTrait = (id) => traitById(id)?.tier === 'gold';
/** 金の特殊能力。 */
export const GOLD_TRAIT_IDS = Object.freeze(TRAITS.filter(({ tier }) => tier === 'gold').map(({ id }) => id));

/** 同時に持たない組。 */
const EXCLUSIVE = [
  ['endgame-defense', 'endgame-collapse'], ['endgame-defense', 'weak-defense'],
  ['vs-ranging', 'vs-static'], ['tenacious', 'weak-defense'],
  ['big-stage', 'big-stage-weak'], ['defense-master', 'weak-defense'], ['defense-master', 'endgame-collapse'],
  ['demon-reading', 'time-trouble'],
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

/** 棋士の紹介に使う、個性の要約。金の特殊能力は、得意の先頭に並べる。 */
export function describeCharacter(character) {
  if (!character) return { style: 'バランス型', strengths: [], weaknesses: [], gold: [] };
  const traits = character.traits ?? [];
  return {
    style: attackStyleLabel(character.attack),
    gold: traits.filter(({ id }) => isGoldTrait(id)).map(traitLabel),
    strengths: traits.filter(({ id }) => traitById(id)?.kind === 'strength' && !isGoldTrait(id)).map(traitLabel),
    weaknesses: traits.filter(({ id }) => traitById(id)?.kind === 'weakness').map(traitLabel),
  };
}

/**
 * 特殊能力の札(名鑑)。tierは gold(金)・blue(得意)・red(苦手)。hintは、どの場面でどう効くかの1行。
 * @param {{ traits?: { id: string, degree: number }[] } | null | undefined} character
 */
export function specialAbilityChips(character) {
  const order = { gold: 0, blue: 1, red: 2 };
  return (character?.traits ?? [])
    .map(({ id, degree }) => {
      const trait = traitById(id);
      if (!trait) return null;
      const tier = trait.tier === 'gold' ? 'gold' : trait.kind === 'strength' ? 'blue' : 'red';
      return { id, tier, label: traitLabel({ id, degree }), hint: trait.hint ?? TRAIT_HINTS[id] ?? '' };
    })
    .filter((chip) => chip !== null)
    .sort((a, b) => order[a.tier] - order[b.tier]);
}

/** 特殊能力の、場面と効き方の1行。 */
const TRAIT_HINTS = Object.freeze({
  'endgame-defense': '終盤で自玉が危ないとき、悪手が少なく、受けの手を選びやすい',
  'fast-attack': '終盤で相手玉に迫れるとき、攻めの手を鋭く選ぶ',
  tsume: '詰みが見えたとき、詰みを見つけやすい',
  'deep-reading': 'いつも、ふだんより深く読む',
  'middle-strong': '中盤で、深く読み、手の選び方が鋭い',
  'opening-study': '序盤で、悪手が少なく、手の選び方が鋭い',
  'vs-ranging': '相手が振り飛車のとき、手の選び方が鋭い。自動対局でも少し強い',
  'vs-static': '相手が居飛車のとき、手の選び方が鋭い。自動対局でも少し強い',
  tenacious: '劣勢のとき、悪手が少なく、粘り強く受ける',
  'late-bloom': '序盤は並み、中盤から読みで上回り、終盤がいちばん正確',
  'big-stage': '互角の終盤で、手の選び方が鋭い。決勝や番勝負に強い',
  'endgame-collapse': '終盤で自玉が危ないとき、詰みや大きな損を見落としやすい',
  'weak-defense': '自玉が危ないとき、手の選び方が鈍い',
  'loose-when-ahead': '大きく優勢になると、大きな悪手が出やすい',
  'big-stage-weak': '互角の終盤で、手の選び方が鈍い。決勝や番勝負に弱い',
  'time-trouble': '終盤で、読みが浅くなり、手の選び方が鈍い',
});

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
    'big-stage': 0.8,
    'big-stage-weak': 0.6,
    'time-trouble': 0.5 + (veteran ? 0.5 : 0),
    // 物語の人物だけの特徴と、金の特殊能力(addGoldTraitで別に付ける)は、ふつうには選ばない。
    'late-bloom': 0,
    ...Object.fromEntries(GOLD_TRAIT_IDS.map((id) => [id, 0])),
  };
}

/** 金の特殊能力を持つ確率。1組の上位(R1800前後)から持ち始め、強いほど持ちやすい。 */
export function goldTraitChance(rating) {
  return clamp((rating - 1780) / 320, 0, 0.7);
}

/** いちばん高い能力に合う、金の特殊能力。 */
const GOLD_FOR_ABILITY = Object.freeze({
  opening: 'research-demon', middle: 'grand-view', ending: 'comeback', attack: 'comeback',
  defense: 'defense-master', reading: 'demon-reading', mate: 'demon-reading', stability: 'grand-view',
});

/** 金の特殊能力を1つ足す(まだ持っていなければ)。いちばん高い能力に合うものを選ぶ。 */
export function addGoldTrait(character) {
  if (!character?.abilities || (character.traits ?? []).some(({ id }) => isGoldTrait(id))) return character;
  const best = [...ABILITY_KEYS].sort((a, b) => (character.abilities[b] ?? 0) - (character.abilities[a] ?? 0))[0];
  const id = GOLD_FOR_ABILITY[best];
  const blocked = EXCLUSIVE.some(([a, b]) => (a === id && character.traits.some((trait) => trait.id === b)) || (b === id && character.traits.some((trait) => trait.id === a)));
  if (blocked) return character;
  return { ...character, traits: [...character.traits, { id, degree: 1 }] };
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
  // 能力の配分(player-abilities.mjs)。棋風は、配分の攻めと受けの差で決め直す。
  const abilities = createAbilities(rng, { age, character: { attack, traits } });
  let character = { attack: styleAttackOf(abilities), traits, abilities };
  if (rng.next() < goldTraitChance(rating)) character = addGoldTrait(character);
  return character;
}

/** 保存してあった、能力のない個性に、能力を足す(名簿の版2から3への移し替え)。 */
export function withAbilities(rng, character, { age, rating }) {
  if (character?.abilities) return character;
  const base = character ?? { attack: 0, traits: [] };
  const abilities = createAbilities(rng, { age, character: base });
  let next = { attack: styleAttackOf(abilities), traits: base.traits.map((trait) => ({ ...trait })), abilities };
  if (rng.next() < goldTraitChance(rating)) next = addGoldTrait(next);
  return next;
}

/** 1期ごとの個性の変化。年を取ると、終盤の特徴が変わりやすい。 */
export function ageCharacter(rng, character, { age, rating, style }) {
  const next = { attack: character.attack, traits: character.traits.map((trait) => ({ ...trait })) };
  if (character.abilities) {
    // 能力の配分が少し動き、棋風は配分の攻めと受けの差から決め直す。
    next.abilities = ageAbilities(rng, character.abilities, { age });
    next.attack = styleAttackOf(next.abilities);
  } else {
    next.attack = Math.round(clamp(next.attack + gaussOf(rng) * 0.03 - (age >= 45 ? 0.01 : 0), -1, 1) * 100) / 100 + 0;
  }
  const weights = traitWeights({ attack: next.attack, age, rook: style?.rook });
  if (age >= 50) next.traits = next.traits.filter(({ id }) => !((id === 'fast-attack' || id === 'tsume') && rng.next() < 0.1));
  if (rng.next() < 0.04) pickTraits(rng, weights, 'strength', 1, next.traits);
  if (rng.next() < (age >= 50 ? 0.06 : 0.02)) pickTraits(rng, weights, 'weakness', 1, next.traits);
  for (const trait of next.traits) if (trait.degree === 1 && !isGoldTrait(trait.id) && rng.next() < 0.03 + Math.max(0, rating - 1600) / 5000) trait.degree = 2;
  // 強くなった棋士は、まれに金の特殊能力を得る。
  if (next.abilities && rng.next() < goldTraitChance(rating) * 0.1) return addGoldTrait(next);
  return next;
}

// ---- 特徴が出た場面

/**
 * 対局中のCPUの手の記録から、特徴が手の選び方に表れた場面を取り出す。特徴ごとに最初の1回だけ。
 * - 終盤での頓死が多い: 見落とし(oversight)の手
 * - 詰将棋が得意: 詰ます手(mate)
 * - 寄せが速い・終盤の受けが正確・劣勢でも崩れない: 棋風で選んだ手(style)
 * @param {{ ply: number, kind: string, traits: string[] }[]} moves plyは、その手を指す前の手数。
 * @returns {{ id: string, ply: number }[]}
 */
export function summarizeTraitMoments(moves) {
  const RULES = [
    ['endgame-collapse', 'oversight'], ['tsume', 'mate'],
    ['fast-attack', 'style'], ['endgame-defense', 'style'], ['tenacious', 'style'],
    ['comeback', 'style'], ['defense-master', 'style'],
  ];
  const moments = [];
  for (const [id, kind] of RULES) {
    const move = (moves ?? []).find((entry) => entry.kind === kind && entry.traits?.includes(id));
    if (move) moments.push({ id, ply: move.ply });
  }
  return moments.sort((a, b) => a.ply - b.ply);
}

const MOMENT_TEXT = Object.freeze({
  'endgame-collapse': '終盤での頓死の癖が出ていたよ。',
  tsume: '詰将棋の得意な人らしく、詰みをしっかり読み切っていたね。',
  'fast-attack': '寄せの速さが出ていたよ。',
  'endgame-defense': '終盤の正確な受けが出ていたよ。',
  tenacious: '劣勢でも崩れない粘りが出ていたよ。',
  comeback: '劣勢から勝負手を放ってきたね。「逆転の名手」らしい一手だったよ。',
  'defense-master': '「受けの達人」らしい、手厚い受けだったよ。',
});

/** 特徴が出た場面の、やこび姫の一言(手数は1から数える)。 */
export function traitMomentText({ id, ply }) {
  return MOMENT_TEXT[id] ? `${ply + 1}手目、${MOMENT_TEXT[id]}` : '';
}

// ---- 自動対局での相性

/** 対振り飛車・対居飛車が得意な棋士が、その相手と当たったときの、自動対局のレーティングの上乗せ(度合い1あたり)。 */
export const MATCHUP_ELO = 25;

/**
 * 自動対局で、相手の飛車の振り方に対する得意を、レーティングの上乗せにする。
 * @param {{ traits?: { id: string, degree: number }[] } | null | undefined} character
 * @param {'static' | 'ranging' | null | undefined} opponentRook 相手の(いちばんの得意戦法の)飛車の振り方
 */
export function matchupBonus(character, opponentRook) {
  if (!character || !opponentRook) return 0;
  const id = opponentRook === 'ranging' ? 'vs-ranging' : 'vs-static';
  const trait = character.traits?.find((entry) => entry.id === id);
  return trait ? MATCHUP_ELO * (trait.degree === 2 ? 2 : 1) : 0;
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
  if (when.close && !(Math.abs(situation.advantage) <= CLOSE_SCORE)) return false;
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
 * 能力の配分(平均からの差、±30まで)の、この場面での効き方。どれも特徴の「やや」と同じくらいを上限にする。
 * - 序盤・中盤・終盤: その局面で、差30で手の選び方が「やや」鋭い(sharpen 0.5)
 * - 攻め・受け: 相手玉に迫れる・自玉が危ない場面で、差40でsharpen 0.5
 * - 読み: 探索量を、差30で×1.41、−30で×0.71
 * - 詰み: 詰みを見つける確率を、差15ごとにロジット1ずらす
 * - 安定感: 差12以上で悪手を抑える(25以上で「とても」)、−15以下で悪手が増える
 * @param {Record<string, number>} abilities
 * @param {{ phase?: string, kingDanger?: boolean, attackChance?: boolean }} situation
 */
export function abilityEffect(abilities, situation) {
  const dev = (key) => clamp(abilities?.[key] ?? 0, -30, 30);
  let sharpen = 0;
  if (situation?.phase) sharpen += dev(situation.phase) / 60;
  if (situation?.attackChance) sharpen += dev('attack') / 80;
  if (situation?.kingDanger) sharpen += dev('defense') / 80;
  const stability = dev('stability');
  return {
    nodes: 2 ** (dev('reading') / 60),
    sharpen,
    steady: stability >= 25 ? 2 : stability >= 12 ? 1 : 0,
    loose: stability <= -15 ? 1 : 0,
    mate: dev('mate') / 15,
  };
}

/**
 * 強さ設定に、棋風と、この場面で働く特徴を反映する。元の設定は変えない。
 * 探索の前(advantage未定)に呼べば探索量が、探索のあとに呼べば手の選び方が決まる。
 * @param {object} strength getStrengthSearchSettingsの結果
 * @param {{ attack: number, traits: { id: string, degree: number }[] } | null} character
 * @param {ReturnType<typeof characterSituation> & { advantage?: number }} situation
 * @param {{ skill: number }} options
 */
export function applyCharacter(strength, character, situation, { skill }) {
  const next = { ...strength, mateFinding: baseMateFinding(skill) };
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
    const effect = traitById(id).effect(degree === 2 ? 2 : 1, situation);
    nodes *= effect.nodes ?? 1;
    sharpen += effect.sharpen ?? 0;
    steady = Math.max(steady, effect.steady ?? 0);
    overlook = Math.max(overlook, effect.overlook ?? 0);
    loose = Math.max(loose, effect.loose ?? 0);
    mate += effect.mate ?? 0;
    style += effect.style ?? 0;
  }
  next.activeTraits = active.map(({ id }) => id);
  // 能力の配分(平均からの差)を、同じつまみで効かせる。上下の合計が0に近いので、強さ全体はLvのまま、場面ごとに強弱が出る。
  if (character.abilities) {
    const effect = abilityEffect(character.abilities, situation);
    nodes *= effect.nodes;
    sharpen += effect.sharpen;
    steady = Math.max(steady, effect.steady);
    loose = Math.max(loose, effect.loose);
    mate += effect.mate;
  }
  // 最善手だけを指す設定(Lv40「藤井聡太並み」)は、上限なので、探索量も手の選び方も変えない。
  const bestOnly = next.bestMoveRate >= 1;
  // 読みが深くても、Lv40を超えないように、Lv40未満の探索量の上限(TOP_NODES)で止める。
  if (nodes !== 1 && !bestOnly && Number.isFinite(next.nodes) && next.nodes > 0) next.nodes = Math.max(1, Math.round(Math.min(TOP_NODES, next.nodes * nodes)));
  if (sharpen !== 0 && !bestOnly) {
    const k = clamp(sharpen, -1, 1) * 0.25;
    if (Number.isFinite(next.scoreTemperature)) next.scoreTemperature = Math.max(1, Math.round(next.scoreTemperature * (1 - k)));
    if (Number.isFinite(next.maxScoreLoss)) next.maxScoreLoss = Math.max(0, Math.round(next.maxScoreLoss * (1 - k)));
    if (Number.isFinite(next.bestMoveRate)) {
      next.bestMoveRate = round2(clamp(k >= 0 ? next.bestMoveRate + (1 - next.bestMoveRate) * k : next.bestMoveRate * (1 + k), 0, 1));
    }
  }
  if (steady > 0 && !bestOnly) {
    // 悪手を抑える。1手で失ってよい損の上限を、そのレベルの元の値の7割(やや)・4割(とても)にし、
    // 大きな悪手の回数と見落としの割合も減らす。もとから悪手の少ない強いレベルほど、変化は小さい。
    if (Number.isFinite(next.moveLossCap)) next.moveLossCap = Math.max(MIN_STEADY_LOSS_CAP, Math.round(next.moveLossCap * (steady === 2 ? 0.4 : 0.7)));
    if (Number.isFinite(next.blunderLimit)) next.blunderLimit = Math.max(0, next.blunderLimit - steady);
    if (next.oversightRate) next.oversightRate = round2(next.oversightRate * (1 - 0.35 * steady));
  }
  if (overlook > 0 && !bestOnly) {
    // 自玉の危険を見落とす(浅く読むと良く見えて、深く読むと悪い手を選ぶ)。見落としの確率を、ロジットで+0.9(やや)・+1.8(とても)ずらす。
    // もとの割合が0のレベルは、2%からずらす(強いレベルほど、頓死もまれ)。
    next.oversightRate = round2(shiftProbability(Math.max(next.oversightRate ?? 0, OVERLOOK_FLOOR), 0.9 * overlook));
    next.oversightShallowLoss = Math.max(next.oversightShallowLoss ?? 0, 300);
    next.oversightNodes = Math.max(next.oversightNodes ?? 0, Math.min(70000, Math.max(3000, (next.nodes ?? 0) * 3)));
    next.oversightMaxLoss = Math.max(next.oversightMaxLoss ?? 0, 2500);
    next.moveLossCap = Math.max(next.moveLossCap ?? 0, 2500);
    next.blunderLimit = (next.blunderLimit ?? 0) + overlook;
    next.blunderCooldown = Math.min(next.blunderCooldown ?? 0, 4);
  }
  if (loose > 0 && !bestOnly) {
    // 優勢で緩む。1手で失ってよい損の上限を、元の値の1.5倍(やや)・2倍(とても)に広げ、大きな悪手を1〜2回増やす。
    if (Number.isFinite(next.moveLossCap)) next.moveLossCap = Math.round(next.moveLossCap * (1 + 0.5 * loose));
    next.blunderLimit = (next.blunderLimit ?? 0) + loose;
  }
  if (next.logicHybrid && next.perception && !bestOnly) {
    const adjust = (probability, delta) => !Number.isFinite(probability) || delta === 0 || (probability >= 1 && delta > 0) ? probability
      : round2(shiftProbability(delta < 0 ? Math.min(probability, 0.98) : probability, delta));
    next.perception = { ...next.perception };
    for (const key of ["freeCapture", "exchange", "threat"]) {
      next.perception[key] = adjust(next.perception[key], 0.35 * sharpen);
    }
    for (const key of ["hanging", "hangingLastMoveMajor", "hangingLastMoveMinor", "defendMate"]) {
      next.perception[key] = adjust(next.perception[key], 0.35 * sharpen + 0.4 * steady - 0.9 * overlook - 0.4 * loose);
    }
    for (const key of ["mate1", "mate3"]) next.perception[key] = adjust(next.perception[key], 0.5 * mate);
  }
  // 詰将棋が得意: n手詰めを見つける確率を、ロジットで+1.0(やや)・+2.0(とても)ずらす(中心の手数が約1.4・2.9手延びるのと同じ)。
  // 確率が半分前後の長さの詰みで最も上がり、そのレベルで確実に解ける短い詰みや、とても長い詰みでは、あまり変わらない。
  // 詰みの能力が低い棋士は、逆に中心の手数が縮む(1手より短くはしない)。
  if (mate !== 0 && next.mateFinding.center !== Infinity) {
    const center = next.mateFinding.center + (MATE_TRAIT_LOGIT * mate) / next.mateFinding.slope;
    next.mateFinding = { ...next.mateFinding, center: Math.round(Math.max(1, center) * 100) / 100 };
  }
  const attack = clamp(style, -1, 1);
  if (Math.abs(attack) >= 0.05 && !bestOnly) {
    next.style = { attack: round2(attack), margin: STYLE_MARGIN, rate: STYLE_RATE };
    // 好みの手を比べられるよう、候補を3つ以上読む(ふだんの手の選び方の範囲moveRankは変えない)。
    if (Number.isFinite(next.multiPv) && next.multiPv < 3) next.multiPv = 3;
  }
  return next;
}
