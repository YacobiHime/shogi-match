// 棋士の能力値(パワプロの基本能力に当たる)。設計は docs/player-abilities-design.md(項目は13章の案1「考える順番」、13-7)。
// 8つの能力は「何が強いか」の物差しで、人が1手を決める順番(見る→方針→候補→読む→確かめる)に1つずつ対応し、
// どれも人間らしいCPUのつまみに1つずつつながる(player-character.mjsのabilityEffect、human-model.mjsのcharacterHuman)。
// - 研究: 序盤の作戦と定跡(序盤の手の選び方の鋭さ)
// - 大局観: 形勢判断と方針(判断のぶれと大局観の重み)
// - 視野: 当たり・タダの駒・両取り・遠くの利きに気づく(見落とし率)
// - 発想: 捨て駒・手筋・勝負手を思いつく(最善手と上位の手が候補に入る率)
// - 読み: 深く正確に読む(探索量と取り合いの手数)
// - 安定感: 大きな悪手の少なさ(指す前の確認と、1局の悪手の回数)。自動対局では調子の波の小ささ
// - 寄せ: 相手玉に迫り、詰ませる(攻めの場面の鋭さと、自分の詰みを見つける確率)
// - 受け: 詰めろに気づき、しのぐ(相手の詰めろに気づく手数と、守りの場面の鋭さ)
// 寄せと受けの差が棋風(攻め将棋⇔受け将棋)になる。序盤・中盤・終盤の強さは、能力から計算して帯で見せる(phaseStrengths。保存しない)。
// 前の項目(序盤・中盤・終盤・攻め・受け・読み・詰み・安定感)で保存した配分は、読むときに移しかえる(abilityDevs)。
// 強さそのもの(レーティング)は変えず、能力は「どう強いか」の配分として持つ。保存するのは、能力の平均からの差(dev。±30まで)だけで、
// 画面に出す数(1〜100)は、レーティングから決まる平均に差を足して作る。だから、年を取って強さが変わると、能力も一緒に動く。

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export const ABILITIES = Object.freeze([
  { key: 'opening', label: '研究', hint: '序盤の作戦と定跡' },
  { key: 'judgment', label: '大局観', hint: '形勢判断と方針の正しさ' },
  { key: 'vision', label: '視野', hint: '当たり・両取り・遠くの利きに気づく' },
  { key: 'idea', label: '発想', hint: '捨て駒・手筋・勝負手を思いつく' },
  { key: 'reading', label: '読み', hint: '深く正確に読む' },
  { key: 'stability', label: '安定感', hint: '大きな悪手と調子の波の少なさ' },
  { key: 'attack', label: '寄せ', hint: '相手玉に迫り、詰ませる' },
  { key: 'defense', label: '受け', hint: '詰めろに気づき、しのぐ' },
]);
export const ABILITY_KEYS = Object.freeze(ABILITIES.map(({ key }) => key));

/**
 * 自動対局(ryuo-simulation.mjs)で、能力の差が勝ち負けに効く重み。能力を作るとき、この重みで平均をとった差が0になるように直す
 * (どこかが高い分、どこかが低い。レーティングが同じなら、自動対局の勝率も平均では同じ。D:4-7)。
 * 安定感は、調子の波(乱数の大きさ)として効くので、ここでは0。寄せと受けは、相手の受けと寄せとのかみ合わせで効く。
 */
export const ABILITY_SIM_WEIGHTS = Object.freeze({ opening: 4, judgment: 4, vision: 3, idea: 2, reading: 2, stability: 0, attack: 2, defense: 2 });

/** 前の項目(2026-10-30より前)の配分か。前の項目にしかない「中盤」「終盤」を持っていれば前の形。 */
export function isLegacyAbilities(devs) {
  return Boolean(devs && typeof devs === 'object' && ('middle' in devs || 'ending' in devs));
}

/** 文字列から決まる、-1〜1の値(移しかえの視野・発想に、棋士ごとの違いを少し足す)。 */
function hashUnit(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (hash % 2001) / 1000 - 1;
}

/**
 * 前の項目の配分を、今の項目へ移しかえる(13-7)。序盤→研究、中盤→大局観、読み・安定感はそのまま、
 * 寄せ＝攻め＋終盤の半分＋詰みの半分、受け＝受け＋終盤の半分、視野＝(読み＋安定感)の半分、発想＝(詰み＋中盤)の半分
 * (視野と発想には、配分から決まる小さな違い±6を足す)。最後に、自動対局の重みで平均を0に直す。同じ配分からは、いつも同じ結果になる。
 * @param {Record<string, number>} devs
 */
export function migrateAbilityDevs(devs) {
  if (!isLegacyAbilities(devs)) return devs;
  const get = (key) => clamp(Number(devs[key]) || 0, -MAX_DEV, MAX_DEV);
  const seed = ['opening', 'middle', 'ending', 'attack', 'defense', 'reading', 'mate', 'stability'].map(get).join(',');
  return balanceDevs({
    opening: get('opening'),
    judgment: get('middle'),
    vision: (get('reading') + get('stability')) / 2 + 6 * hashUnit(`v${seed}`),
    idea: (get('mate') + get('middle')) / 2 + 6 * hashUnit(`i${seed}`),
    reading: get('reading'),
    stability: get('stability'),
    attack: get('attack') + get('ending') / 2 + get('mate') / 2,
    defense: get('defense') + get('ending') / 2,
  });
}

/** 移しかえた配分を覚える(同じ配分を何度も読む自動対局のため)。 */
const migrated = new WeakMap();

/**
 * 棋士の個性(character)の能力の配分を、今の項目で読む。前の項目で保存した配分は移しかえる。なければnull。
 * @param {{ abilities?: Record<string, number> } | null | undefined} character
 * @returns {Record<string, number> | null}
 */
export function abilityDevs(character) {
  const devs = character?.abilities;
  if (!devs || typeof devs !== 'object') return null;
  if (!isLegacyAbilities(devs)) return devs;
  if (!migrated.has(devs)) migrated.set(devs, migrateAbilityDevs(devs));
  return migrated.get(devs);
}
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
  const devs = abilityDevs(member?.character) ?? {};
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
  'endgame-defense': { defense: 11 },
  'fast-attack': { attack: 11 },
  tsume: { attack: 8, idea: 4 },
  'deep-reading': { reading: 12 },
  'middle-strong': { judgment: 12 },
  'opening-study': { opening: 12 },
  'wide-vision': { vision: 12 },
  tenacious: { defense: 6, stability: 6 },
  'late-bloom': { attack: 4, defense: 4, opening: -8 },
  'endgame-collapse': { defense: -9, stability: -6 },
  'weak-defense': { defense: -12 },
  'loose-when-ahead': { stability: -6, judgment: -6 },
  careless: { vision: -12 },
  'big-stage': { stability: 4 },
  'big-stage-weak': { stability: -4 },
  'time-trouble': { reading: -6, vision: -4 },
  'grand-view': { judgment: 10 },
  'demon-reading': { reading: 10 },
  clairvoyance: { vision: 10 },
  creative: { idea: 12 },
  myoshu: { idea: 10 },
  comeback: { attack: 6, defense: 4 },
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
 * 若手は読み・発想・視野が、ベテランは研究と大局観が高い。
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
  raw.idea += 4 * youth;
  raw.vision += 2 * youth;
  raw.opening -= 5 * youth;
  raw.judgment -= 3 * youth;
  return balanceDevs(raw);
}

/**
 * 1期ごとの能力の配分の変化(成長の型)。読み・発想・視野は20代で伸びて40代から下がり、研究と大局観は40代まで伸びる。
 * 強さそのものの変化は、レーティング(ryuo-roster.mjsのageDrift)が受け持つ。ここは配分だけを少し動かす。
 * 前の項目の配分は、先に今の項目へ移しかえる。
 */
export function ageAbilities(rng, abilities, { age }) {
  const next = { ...migrateAbilityDevs(abilities) };
  for (const key of ABILITY_KEYS) next[key] = Number(next[key]) || 0;
  const sharp = age <= 28 ? 1 : age >= 42 ? -1 : 0;
  const wise = age <= 45 ? 1 : -0.5;
  next.reading += sharp * 0.8 + gaussOf(rng) * 1.2;
  next.idea += sharp * 0.8 + gaussOf(rng) * 1.2;
  next.vision += sharp * 0.4 + gaussOf(rng) * 1.2;
  next.opening += wise * 0.6 + gaussOf(rng) * 1.2;
  next.judgment += wise * 0.6 + gaussOf(rng) * 1.2;
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
  const devs = abilityDevs(member?.character) ?? {};
  const sorted = [...ABILITIES].sort((a, b) => (devs[b.key] ?? 0) - (devs[a.key] ?? 0));
  const best = sorted[0];
  const worst = sorted.at(-1);
  return {
    best: { ...best, value: values[best.key], rank: abilityRank(values[best.key]) },
    worst: { ...worst, value: values[worst.key], rank: abilityRank(values[worst.key]) },
  };
}

/** 終盤型とみなす、読み・寄せ・受けのそれぞれの下限と、平均の下限。 */
const ENDGAME_EACH = 6;
const ENDGAME_MEAN = 10;
/** 型の一言で、能力の名前のままでは言いにくいもの。 */
const TYPE_NAMES = Object.freeze({ stability: '安定型' });

/**
 * 能力の型の一言(「研究型」「視野型」など)。いちばん高い能力が、平均より10以上高いときだけ。
 * 読み・寄せ・受けがそろって高い(どれも+6以上、平均+10以上)ときは「終盤型」。
 */
export function abilityTypeLabel(member) {
  const devs = abilityDevs(member?.character);
  if (!devs) return '';
  const end = ['reading', 'attack', 'defense'].map((key) => devs[key] ?? 0);
  if (end.every((value) => value >= ENDGAME_EACH) && end.reduce((sum, value) => sum + value, 0) / 3 >= ENDGAME_MEAN) return '終盤型';
  const best = [...ABILITY_KEYS].sort((a, b) => (devs[b] ?? 0) - (devs[a] ?? 0))[0];
  if ((devs[best] ?? 0) < 10) return 'バランス型';
  return TYPE_NAMES[best] ?? `${ABILITIES.find(({ key }) => key === best).label}型`;
}

/**
 * 序盤・中盤・終盤の強さ(名鑑とノートの帯。13-7)。能力から計算し、保存しない。将棋ファンの「序盤は○、終盤は○」の言い方を残す。
 * 序盤＝研究7割と大局観3割、中盤＝大局観・視野・発想の平均、終盤＝読み・寄せ・受けの平均。
 * @param {Record<string, number>} values 画面に出す能力(abilityValues)
 * @returns {{ key: 'opening' | 'middle' | 'ending', label: string, value: number, rank: string }[]}
 */
export function phaseStrengths(values) {
  const v = (key) => Number(values?.[key]) || 0;
  const rows = [
    { key: 'opening', label: '序盤', value: 0.7 * v('opening') + 0.3 * v('judgment') },
    { key: 'middle', label: '中盤', value: (v('judgment') + v('vision') + v('idea')) / 3 },
    { key: 'ending', label: '終盤', value: (v('reading') + v('attack') + v('defense')) / 3 },
  ];
  return rows.map((row) => {
    const value = Math.round(clamp(row.value, 1, 100));
    return { ...row, key: /** @type {'opening' | 'middle' | 'ending'} */ (row.key), value, rank: abilityRank(value) };
  });
}
