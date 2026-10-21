// 棋士ごとの、戦法と囲いの使用率(docs/player-abilities-design.mdの6-3)。
// 1つの戦法・囲いを毎回使う棋士はいないので、戦法の使用率(先手・後手で別)と、戦法ごとの囲いの使用率を持ち、
// 1局ごとに、その使用率で戦法と囲いを選ぶ。相手が居飛車党か振り飛車党かでも変える(対抗形の戦法は、相手が振り飛車のときに選ぶ)。
// 組み合わせは、CPUが指せる戦法と囲い(定跡案内の対応表)だけ。画面に依存しない。

import { OPPONENT_STYLES } from './ryuo-data.mjs';


/** 囲いの表示名。 */
export const CASTLE_LABELS = Object.freeze({
  'early-castle': '早囲い', funagakoi: '舟囲い', nakazumai: '中住まい', nakahara: '中原囲い', yagura: '金矢倉', 'doi-yagura': '土居矢倉',
  'kikusui-yagura': '菊水矢倉', gangi: '雁木', 'ibisha-anaguma': '居飛車穴熊', 'matsuo-anaguma': '松尾流穴熊', millennium: 'ミレニアム',
  'left-mino': '左美濃', elmo: 'エルモ囲い', mino: '美濃囲い', 'high-mino': '高美濃', 'half-mino': '片美濃', 'silver-crown': '銀冠',
  'furibisha-anaguma': '振り飛車穴熊',
});

/**
 * 戦法の目録。castlesは[囲い, 重み]。囲いが空('')の戦法は、囲いと一体(角換わり腰掛け銀・藤井システム)で、
 * 囲いを指定せず、CPUが相手の指し方に合わせて囲う。vsRangingは、相手が振り飛車のときに指す対抗形の戦法。
 * attackは、攻めっ気の強い戦法(1)・手厚い戦法(-1)。
 */
export const PRO_OPENINGS = Object.freeze([
  { id: 'kakugawari-kg', label: '角換わり腰掛け銀', strategy: 'kakugawari-koshikake-gin', rook: 'static', castles: [['', 1]], weight: 18, attack: 0 },
  { id: 'kakugawari', label: '角換わり', strategy: 'kakugawari', rook: 'static', castles: [['early-castle', 1]], weight: 10, attack: 0 },
  { id: 'kakugawari-45', label: '角換わり4五桂速攻', strategy: 'kakugawari-45-knight', rook: 'static', castles: [['early-castle', 1]], weight: 3, attack: 1 },
  { id: 'aigakari', label: '相掛かり', strategy: 'aigakari', rook: 'static', castles: [['funagakoi', 5], ['nakazumai', 3], ['nakahara', 2]], weight: 22, attack: 1 },
  { id: 'yagura', label: '矢倉', strategy: 'yagura-strategy', rook: 'static', castles: [['yagura', 7], ['doi-yagura', 2], ['kikusui-yagura', 1]], weight: 14, attack: -1 },
  { id: 'gangi', label: '雁木', strategy: 'ibisha', rook: 'static', castles: [['gangi', 1]], weight: 10, attack: 0 },
  { id: 'hayaguri', label: '早繰り銀', strategy: 'hayaguri-gin', rook: 'static', castles: [['funagakoi', 7], ['left-mino', 3]], weight: 4, attack: 1 },
  { id: 'bougin', label: '棒銀', strategy: 'bougin', rook: 'static', castles: [['funagakoi', 1]], weight: 2, attack: 1 },
  { id: 'right-shiken', label: '右四間飛車', strategy: 'right-shiken', rook: 'static', castles: [['elmo', 6], ['funagakoi', 4]], weight: 2, attack: 1 },
  {
    id: 'ibisha', label: '対抗形の居飛車', strategy: 'ibisha', rook: 'static', vsRanging: true,
    castles: [['ibisha-anaguma', 4], ['left-mino', 3], ['matsuo-anaguma', 1], ['millennium', 1], ['funagakoi', 1]], weight: 10, attack: -1,
  },
  { id: 'shiken', label: '四間飛車', strategy: 'shiken', rook: 'ranging', castles: [['mino', 5], ['furibisha-anaguma', 3], ['silver-crown', 2], ['high-mino', 1]], weight: 18, attack: 0 },
  { id: 'fujii-system', label: '藤井システム', strategy: 'fujii-system', rook: 'ranging', castles: [['', 1]], weight: 5, attack: 1 },
  { id: 'sangen', label: '三間飛車', strategy: 'sangen', rook: 'ranging', castles: [['mino', 6], ['high-mino', 2], ['furibisha-anaguma', 2]], weight: 16, attack: 0 },
  { id: 'gokigen', label: 'ゴキゲン中飛車', strategy: 'gokigen', rook: 'ranging', castles: [['high-mino', 5], ['mino', 3], ['furibisha-anaguma', 2]], weight: 14, attack: 1 },
  { id: 'mukai', label: '向かい飛車', strategy: 'mukai', rook: 'ranging', castles: [['mino', 7], ['silver-crown', 3]], weight: 10, attack: 0 },
  { id: 'ishida', label: '早石田', strategy: 'ishida', rook: 'ranging', castles: [['half-mino', 6], ['mino', 4]], weight: 6, attack: 1 },
]);
const OPENING_BY_ID = new Map(PRO_OPENINGS.map((opening) => [opening.id, opening]));
export const proOpening = (id) => OPENING_BY_ID.get(id) ?? null;
/** 戦法の囲いの使用率を、目録の重みのまま百分率にしたもの。 */
export function defaultCastleShares(id) {
  const opening = proOpening(id);
  return opening ? toPercent(Object.fromEntries(opening.castles)) : {};
}

/** 得意戦法(ryuo-data.mjsのOPPONENT_STYLES)を、戦法の目録と囲いに対応させる。 */
const STYLE_TO_OPENING = Object.freeze({
  yagura: ['yagura', 'yagura'], kakugawari: ['kakugawari', 'early-castle'], 'kakugawari-kg': ['kakugawari-kg', ''],
  aigakari: ['aigakari', 'funagakoi'], 'ibisha-anaguma': ['ibisha', 'ibisha-anaguma'], gangi: ['gangi', 'gangi'],
  'left-mino': ['ibisha', 'left-mino'], 'right-shiken': ['right-shiken', 'elmo'], hayaguri: ['hayaguri', 'funagakoi'],
  bougin: ['bougin', 'funagakoi'], 'shiken-mino': ['shiken', 'mino'], 'shiken-anaguma': ['shiken', 'furibisha-anaguma'],
  'shiken-silver-crown': ['shiken', 'silver-crown'], sangen: ['sangen', 'mino'], gokigen: ['gokigen', 'high-mino'],
  mukai: ['mukai', 'mino'], ishida: ['ishida', 'half-mino'], 'fujii-system': ['fujii-system', ''],
});
export function openingForStyle(styleId) {
  const [id, castle] = STYLE_TO_OPENING[styleId] ?? ['aigakari', 'funagakoi'];
  return { id, castle };
}

/** 後手で選びやすさを変える戦法(先手の角換わり、後手の雁木・ゴキゲン中飛車など)。 */
const GOTE_LEAN = Object.freeze({ 'kakugawari-kg': 0.75, kakugawari: 0.7, 'kakugawari-45': 0.5, gangi: 1.8, gokigen: 1.6, ishida: 0.7, yagura: 1.1 });

function gaussOf(rng) {
  const u = Math.max(rng.next(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/** 重みを、合計100の整数の百分率にする(端数は大きい順に配る)。0%になったものは除く。 */
export function toPercent(weights) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total) return {};
  const exact = entries.map(([id, weight]) => [id, (weight / total) * 100]);
  const floors = exact.map(([id, value]) => [id, Math.floor(value), value - Math.floor(value)]);
  let left = 100 - floors.reduce((sum, [, value]) => sum + value, 0);
  floors.sort((a, b) => b[2] - a[2]);
  for (const entry of floors) {
    if (left <= 0) break;
    entry[1] += 1;
    left -= 1;
  }
  return Object.fromEntries(floors.filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).map(([id, value]) => [id, value]));
}

/** 1つの戦法の使用率の上限(%)。毎回同じ戦法の棋士は作らない。 */
export const MAX_OPENING_SHARE = 60;

/** 上限を超えた戦法を削り、ほかへ配り直す。 */
function capShares(percent, cap) {
  const entries = Object.entries(percent);
  if (entries.length < 2) return percent;
  let over = 0;
  const capped = entries.map(([id, value]) => {
    if (value > cap) {
      over += value - cap;
      return [id, cap];
    }
    return [id, value];
  });
  const rest = capped.filter(([, value]) => value < cap);
  const restTotal = rest.reduce((sum, [, value]) => sum + value, 0) || 1;
  return toPercent(Object.fromEntries(capped.map(([id, value]) => [id, value < cap ? value + (over * value) / restTotal : value])));
}

/**
 * 使用率を作る。得意戦法(styles。先頭がいちばん)を上位にし、同じ党のほかの戦法にも少しずつ割り振る。
 * - 先手と後手で分ける(後手は雁木・ゴキゲン中飛車が増え、角換わりが減るなど)
 * - 戦法ごとの囲いは、目録の重みを乱数で揺らし、得意戦法の囲いを多めにする
 * @param {{ next(): number }} rng
 * @param {{ party: 'static' | 'ranging' | 'both', styles: string[] }} repertoire
 * @param {{ maxShare?: number, spread?: number }} [options] maxShareは1つの戦法の上限(%)、spreadは得意以外の戦法の数
 * @returns {{ black: Record<string, number>, white: Record<string, number>, castles: Record<string, Record<string, number>> }}
 */
export function createUsage(rng, repertoire, { maxShare = MAX_OPENING_SHARE, spread } = {}) {
  const styles = repertoire?.styles?.length ? repertoire.styles : ['aigakari'];
  const party = repertoire?.party ?? 'static';
  const favorites = styles.map((styleId) => openingForStyle(styleId));
  const weights = {};
  const favoriteShares = [30 + rng.next() * 25, 12 + rng.next() * 12, 8 + rng.next() * 8];
  favorites.forEach(({ id }, index) => { weights[id] = (weights[id] ?? 0) + favoriteShares[Math.min(index, 2)]; });
  // ほかの戦法: 同じ党(両方指す棋士は両方)から、目録の重みで2〜4個。対抗形の居飛車は、居飛車党はほぼ必ず持つ。
  const sides = party === 'both' ? ['static', 'ranging'] : [party];
  const pool = PRO_OPENINGS.filter((opening) => sides.includes(opening.rook) && !(opening.id in weights));
  const extra = spread ?? 2 + Math.floor(rng.next() * 3);
  for (let index = 0; index < extra && pool.length; index += 1) {
    const total = pool.reduce((sum, opening) => sum + opening.weight, 0);
    let roll = rng.next() * total;
    const pickIndex = Math.max(0, pool.findIndex((opening) => (roll -= opening.weight) <= 0));
    const [opening] = pool.splice(pickIndex, 1);
    weights[opening.id] = 3 + rng.next() * 7;
  }
  if (sides.includes('static') && !weights.ibisha) weights.ibisha = 4 + rng.next() * 6;
  const black = capShares(toPercent(weights), maxShare);
  const whiteWeights = Object.fromEntries(Object.entries(black).map(([id, value]) => [id, value * (GOTE_LEAN[id] ?? 1) * Math.exp(gaussOf(rng) * 0.15)]));
  const white = capShares(toPercent(whiteWeights), maxShare);
  const castles = {};
  for (const id of new Set([...Object.keys(black), ...Object.keys(white)])) {
    const opening = proOpening(id);
    if (!opening) continue;
    const favorite = favorites.find((entry) => entry.id === id)?.castle;
    const castleWeights = Object.fromEntries(opening.castles.map(([castle, weight]) => [
      castle, weight * Math.exp(gaussOf(rng) * 0.4) * (castle === favorite && opening.castles.length > 1 ? 2.5 : 1),
    ]));
    castles[id] = toPercent(castleWeights);
  }
  return { black, white, castles };
}

/** 使用率のうち、居飛車の割合(%)。 */
export function staticShare(usage) {
  const both = [usage?.black ?? {}, usage?.white ?? {}];
  let total = 0;
  let stat = 0;
  for (const table of both) {
    for (const [id, value] of Object.entries(table)) {
      total += value;
      if (proOpening(id)?.rook === 'static') stat += value;
    }
  }
  return total ? Math.round((stat / total) * 100) : 100;
}

/** 使用率から決める党。居飛車8割以上は居飛車党、2割以下は振り飛車党、その間はオールラウンダー。 */
export function partyOfUsage(usage) {
  const share = staticShare(usage);
  if (share >= 80) return 'static';
  if (share <= 20) return 'ranging';
  return 'both';
}

function weightedKey(rng, table) {
  const entries = Object.entries(table).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total) return null;
  let roll = rng.next() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries.at(-1)[0];
}

/**
 * 1局の戦法と囲いを、使用率で選ぶ。
 * - colorは、この棋士の手番(先手・後手で使用率を分ける)
 * - opponentRookは、相手の飛車の振り方(相手が振り飛車なら居飛車の戦法は対抗形に、居飛車なら対抗形の居飛車を選ばない)
 * @returns {{ id: string, label: string, strategy: string, castle: string, rook: 'static' | 'ranging', opening: string } | null}
 */
export function pickOpening(rng, usage, { color = 'black', opponentRook = null } = {}) {
  if (!usage) return null;
  const table = { ...(color === 'white' ? usage.white : usage.black) };
  if (opponentRook === 'static') delete table.ibisha;
  let id = weightedKey(rng, table) ?? Object.keys(usage.black ?? {})[0];
  if (!id) return null;
  // 相手が振り飛車なら、居飛車の戦法は対抗形(急戦か持久戦の囲い)で指す。
  if (opponentRook === 'ranging' && proOpening(id)?.rook === 'static' && id !== 'ibisha') id = 'ibisha';
  const opening = proOpening(id);
  if (!opening) return null;
  const castleTable = usage.castles?.[id] ?? Object.fromEntries(opening.castles);
  const castle = weightedKey(rng, castleTable) ?? opening.castles[0][0];
  return openingEntry(id, castle);
}

/** 戦法と囲いの写し(CPUへの詳細の指定と、画面の表示に使う。今のpending.styleと同じ形)。 */
export function openingEntry(id, castle) {
  const opening = proOpening(id);
  if (!opening) return null;
  const castleLabel = castle ? CASTLE_LABELS[castle] ?? '' : '';
  const label = castleLabel && opening.castles.length > 1 ? `${opening.label}（${castleLabel}）` : opening.label;
  return { id: `${id}${castle ? `:${castle}` : ''}`, opening: id, label, strategy: opening.strategy, castle, rook: opening.rook };
}

/**
 * 名鑑に出す使用率の行(先手・後手を合わせた、多い順)。囲いは、その戦法の中の割合。
 * @returns {{ id: string, label: string, rook: string, share: number, castles: { id: string, label: string, share: number }[] }[]}
 */
export function usageRows(usage) {
  if (!usage) return [];
  const merged = {};
  for (const table of [usage.black ?? {}, usage.white ?? {}]) {
    for (const [id, value] of Object.entries(table)) merged[id] = (merged[id] ?? 0) + value / 2;
  }
  return Object.entries(toPercent(merged)).map(([id, share]) => {
    const opening = proOpening(id);
    return {
      id,
      label: opening?.label ?? id,
      rook: opening?.rook ?? 'static',
      share,
      castles: Object.entries(usage.castles?.[id] ?? {}).filter(([castle]) => castle).map(([castle, castleShare]) => ({
        id: castle, label: CASTLE_LABELS[castle] ?? castle, share: castleShare,
      })),
    };
  });
}

/** 1期ごとの流行。使用率を少し揺らす(得意の順位は大きく変えない)。 */
export function driftUsage(rng, usage) {
  if (!usage) return usage;
  const shake = (table) => capShares(toPercent(Object.fromEntries(Object.entries(table).map(([id, value]) => [
    id, Math.max(1, value * Math.exp(gaussOf(rng) * 0.08)),
  ]))), MAX_OPENING_SHARE);
  return { black: shake(usage.black ?? {}), white: shake(usage.white ?? {}), castles: structuredClone(usage.castles ?? {}) };
}

/** 得意戦法(紹介用。多い順の上位3つのOPPONENT_STYLESのidに近いもの)を、使用率から決め直す。 */
export function favoriteStyleIds(usage, count = 3) {
  const rows = usageRows(usage).slice(0, count);
  return rows.map(({ id, castles }) => {
    const castle = castles[0]?.id ?? '';
    const exact = Object.entries(STYLE_TO_OPENING).find(([, [openingId, styleCastle]]) => openingId === id && styleCastle === castle);
    const loose = Object.entries(STYLE_TO_OPENING).find(([, [openingId]]) => openingId === id);
    return (exact ?? loose)?.[0] ?? OPPONENT_STYLES[0].id;
  });
}
