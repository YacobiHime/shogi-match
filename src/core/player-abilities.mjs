// 棋士の能力値(パワプロの基本能力に当たる)。設計は docs/player-abilities-design.md。
// 8つの能力は、どれもCPUの強さ設定の「つまみ」に1つずつ対応する(player-character.mjsのapplyCharacter)。
// - 序盤・中盤・終盤: その局面での手の選び方の鋭さ
// - 攻め・受け: 相手玉に迫れる場面・自玉が危険な場面での鋭さ。差が棋風(攻め将棋⇔受け将棋)になる
// - 読み: 探索量(読みの深さ)
// - 詰み: 詰みを見つける確率
// - 安定感: 大きな悪手の出にくさ(1手の損の上限と悪手の回数)。自動対局では調子の波の小ささ
// 強さそのもの(レーティング)は変えず、能力は「どう強いか」の配分として持つ。保存するのは、能力の平均からの差(dev。±30まで)だけで、
// 画面に出す数(1〜100)は、レーティングから決まる平均に差を足して作る。だから、年を取って強さが変わると、能力も一緒に動く。

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export const ABILITIES = Object.freeze([
  { key: 'opening', label: '序盤', hint: '研究と作戦の組み立て。30手まで' },
  { key: 'middle', label: '中盤', hint: '大局観と形勢判断。31〜80手' },
  { key: 'ending', label: '終盤', hint: '寄せと受けの正確さ。81手から' },
  { key: 'attack', label: '攻め', hint: '相手玉に迫る鋭さ' },
  { key: 'defense', label: '受け', hint: '自玉が危ないときのしのぎ' },
  { key: 'reading', label: '読み', hint: '読みの深さと正確さ' },
  { key: 'mate', label: '詰み', hint: '詰みを見つける力' },
  { key: 'stability', label: '安定感', hint: '大きな悪手と調子の波の少なさ' },
]);
export const ABILITY_KEYS = Object.freeze(ABILITIES.map(({ key }) => key));

/**
 * 自動対局(ryuo-simulation.mjs)で、能力の差が勝ち負けに効く重み。能力を作るとき、この重みで平均をとった差が0になるように直す
 * (どこかが高い分、どこかが低い。レーティングが同じなら、自動対局の勝率も平均では同じ。D:4-7)。
 * 安定感は、調子の波(乱数の大きさ)として効くので、ここでは0。
 */
export const ABILITY_SIM_WEIGHTS = Object.freeze({ opening: 4, middle: 4, ending: 4, attack: 2, defense: 2, reading: 2, mate: 2, stability: 0 });
/** 能力の平均からの差の上限。 */
export const MAX_DEV = 30;

/** ランクの区切り(パワプロの区切りに近い)。 */
export const ABILITY_RANKS = Object.freeze([
  { rank: 'S', min: 90 }, { rank: 'A', min: 80 }, { rank: 'B', min: 70 }, { rank: 'C', min: 60 },
  { rank: 'D', min: 50 }, { rank: 'E', min: 40 }, { rank: 'F', min: 20 }, { rank: 'G', min: 0 },
]);
export function abilityRank(value) {
  return (ABILITY_RANKS.find(({ min }) => value >= min) ?? ABILITY_RANKS.at(-1)).rank;
}

/**
 * レーティングから決まる能力の平均。プロの平均がC〜Dになるように置く(パワプロの「ふつうのプロ」に近い)。
 * R1380(6組の平均)で約53(D)、R1500で約63(C)、R1760(1組の平均)で約81(A)、R2050で約92(S)、アマ(R1210前後)で約38(F)。
 * 上の方ほど伸びが鈍くなる形(ロジスティック)にして、強い棋士でも、とがった能力だけがSに届くようにする。
 */
export const ABILITY_CENTER_RATING = 1350;
export const ABILITY_SCALE = 280;
export function abilityBase(rating) {
  const r = Number.isFinite(rating) ? rating : 1500;
  return 100 / (1 + Math.exp(-(r - ABILITY_CENTER_RATING) / ABILITY_SCALE));
}

/** 画面に出す能力(1〜100の整数)。devがない棋士(古い保存)は、平均のまま。 */
export function abilityValues(member) {
  const base = abilityBase(member?.rating);
  const devs = member?.character?.abilities ?? {};
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, Math.round(clamp(base + (devs[key] ?? 0), 1, 100))]));
}

/** 棋風(攻め将棋⇔受け将棋、−1〜1)。攻めと受けの差で決める。 */
export function styleAttackOf(abilities) {
  if (!abilities) return 0;
  return Math.round(clamp(((abilities.attack ?? 0) - (abilities.defense ?? 0)) / 40, -1, 1) * 100) / 100 + 0;
}

function gaussOf(rng) {
  const u = Math.max(rng.next(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/** 特徴(特殊能力)が、能力の配分に寄せる向き(度合い1あたり)。 */
const TRAIT_LEANS = Object.freeze({
  'endgame-defense': { defense: 9, ending: 4 },
  'fast-attack': { attack: 9, ending: 4 },
  tsume: { mate: 12 },
  'deep-reading': { reading: 12 },
  'middle-strong': { middle: 12 },
  'opening-study': { opening: 12 },
  tenacious: { defense: 6, stability: 6 },
  'late-bloom': { ending: 8, opening: -8 },
  'endgame-collapse': { ending: -9, stability: -6 },
  'weak-defense': { defense: -12 },
  'loose-when-ahead': { stability: -12 },
  'big-stage': { stability: 4 },
  'big-stage-weak': { stability: -4 },
  'time-trouble': { ending: -6, reading: -4 },
  'grand-view': { middle: 10 },
  'demon-reading': { reading: 10 },
  comeback: { ending: 6, defense: 4 },
  'research-demon': { opening: 10 },
  'defense-master': { defense: 10 },
});

/** 重みつきの平均が0になるように直し、上限で丸める。 */
export function balanceDevs(raw) {
  let values = Object.fromEntries(ABILITY_KEYS.map((key) => [key, raw[key] ?? 0]));
  // 上限で丸めると平均がずれるので、丸めていない能力で、残りのずれを3回まで直す。
  for (let round = 0; round < 3; round += 1) {
    const free = ABILITY_KEYS.filter((key) => ABILITY_SIM_WEIGHTS[key] && (round === 0 || Math.abs(values[key]) < MAX_DEV));
    const freeWeight = free.reduce((sum, key) => sum + ABILITY_SIM_WEIGHTS[key], 0);
    if (!freeWeight) break;
    const totalWeight = ABILITY_KEYS.reduce((sum, key) => sum + ABILITY_SIM_WEIGHTS[key], 0);
    const excess = ABILITY_KEYS.reduce((sum, key) => sum + ABILITY_SIM_WEIGHTS[key] * values[key], 0);
    if (Math.abs(excess) < 0.5) break;
    const shift = round === 0 ? excess / totalWeight : excess / freeWeight;
    values = Object.fromEntries(ABILITY_KEYS.map((key) => [key, clamp(values[key] - (free.includes(key) ? shift : 0), -MAX_DEV, MAX_DEV)]));
  }
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, Math.round(values[key]) + 0]));
}

/**
 * 能力の配分を作る。棋風(attack)・特徴・年齢・得意戦法に合わせて寄せ、乱数でとがらせる。
 * 若手は読みと詰みが、ベテランは序盤(研究)と中盤(大局観)が高い。
 * @param {{ next(): number }} rng
 * @param {{ age: number, character?: { attack?: number, traits?: { id: string, degree: number }[] } }} member
 */
export function createAbilities(rng, { age, character }) {
  const raw = Object.fromEntries(ABILITY_KEYS.map((key) => [key, gaussOf(rng) * 10]));
  const attack = character?.attack ?? 0;
  raw.attack += 15 * attack;
  raw.defense -= 15 * attack;
  for (const { id, degree } of character?.traits ?? []) {
    for (const [key, lean] of Object.entries(TRAIT_LEANS[id] ?? {})) raw[key] += lean * (degree === 2 ? 1.6 : 1);
  }
  const youth = clamp((30 - age) / 10, -1.5, 1);
  raw.reading += 5 * youth;
  raw.mate += 5 * youth;
  raw.opening -= 5 * youth;
  raw.middle -= 3 * youth;
  return balanceDevs(raw);
}

/**
 * 1期ごとの能力の配分の変化(成長の型)。読み・詰み・終盤は20代で伸びて40代から下がり、序盤と中盤は40代まで伸びる。
 * 強さそのものの変化は、レーティング(ryuo-roster.mjsのageDrift)が受け持つ。ここは配分だけを少し動かす。
 */
export function ageAbilities(rng, abilities, { age }) {
  const next = { ...abilities };
  const sharp = age <= 28 ? 1 : age >= 42 ? -1 : 0;
  const wise = age <= 45 ? 1 : -0.5;
  next.reading += sharp * 0.8 + gaussOf(rng) * 1.2;
  next.mate += sharp * 0.8 + gaussOf(rng) * 1.2;
  next.ending += sharp * 0.4 + gaussOf(rng) * 1.2;
  next.opening += wise * 0.6 + gaussOf(rng) * 1.2;
  next.middle += wise * 0.6 + gaussOf(rng) * 1.2;
  for (const key of ['attack', 'defense', 'stability']) next[key] += gaussOf(rng) * 1.2;
  // 年を取ると、少しずつ受けに寄る(今までの棋風の変化と同じ向き)。
  if (age >= 45) {
    next.attack -= 0.4;
    next.defense += 0.4;
  }
  return balanceDevs(next);
}

/** いちばん高い能力と、いちばん低い能力(紹介の一言に使う)。 */
export function abilityHighlights(member) {
  const values = abilityValues(member);
  const devs = member?.character?.abilities ?? {};
  const sorted = [...ABILITIES].sort((a, b) => (devs[b.key] ?? 0) - (devs[a.key] ?? 0));
  const best = sorted[0];
  const worst = sorted.at(-1);
  return {
    best: { ...best, value: values[best.key], rank: abilityRank(values[best.key]) },
    worst: { ...worst, value: values[worst.key], rank: abilityRank(values[worst.key]) },
  };
}

/** 能力の型の一言(「終盤型」「攻め型」など)。いちばん高い能力が、平均より10以上高いときだけ。 */
export function abilityTypeLabel(member) {
  const devs = member?.character?.abilities;
  if (!devs) return '';
  const best = [...ABILITY_KEYS].sort((a, b) => (devs[b] ?? 0) - (devs[a] ?? 0))[0];
  if ((devs[best] ?? 0) < 10) return 'バランス型';
  return `${ABILITIES.find(({ key }) => key === best).label}型`;
}
