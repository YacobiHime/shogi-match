// 架空の棋士の得意戦法。居飛車党・振り飛車党・両方指す(オールラウンダー)を決めて、得意戦法を2〜3個持たせる。
// 1局ごとに、その中から戦法を選ぶ(いちばんの得意戦法を多めに)。
// 割合は、近年のプロ公式戦の傾向(居飛車が大半で、角換わり・相掛かりが多い。振り飛車党は少数派で、上位ほど少ない)に寄せた仮の値。

import { OPPONENT_STYLES } from './ryuo-data.mjs';

/** 居飛車の戦法の選ばれやすさ。 */
export const STATIC_STYLE_WEIGHTS = Object.freeze({
  kakugawari: 12, 'kakugawari-kg': 18, aigakari: 25, yagura: 15, gangi: 10,
  'ibisha-anaguma': 8, 'left-mino': 5, hayaguri: 4, bougin: 2, 'right-shiken': 1,
});
/** 振り飛車の戦法の選ばれやすさ。 */
export const RANGING_STYLE_WEIGHTS = Object.freeze({
  'shiken-mino': 18, 'shiken-anaguma': 14, 'shiken-silver-crown': 8, sangen: 20, gokigen: 15, mukai: 12, ishida: 7, 'fujii-system': 6,
});

/** 組ごとの、振り飛車党と、両方指す棋士の割合。残りは居飛車党。 */
export const PARTY_SHARES = Object.freeze({
  1: { ranging: 0.1, both: 0.15 },
  2: { ranging: 0.13, both: 0.15 },
  3: { ranging: 0.15, both: 0.15 },
  4: { ranging: 0.18, both: 0.15 },
  5: { ranging: 0.2, both: 0.15 },
  6: { ranging: 0.25, both: 0.15 },
});
export const PARTY_LABELS = Object.freeze({ static: '居飛車党', ranging: '振り飛車党', both: 'オールラウンダー' });
/** 1局で、いちばんの得意戦法を選ぶ割合。 */
export const PRIMARY_STYLE_RATE = 0.6;

const STYLE_BY_ID = new Map(OPPONENT_STYLES.map((style) => [style.id, style]));

/** 期・画面で使う、戦法の写し。 */
export function styleEntry(id) {
  const style = STYLE_BY_ID.get(id) ?? OPPONENT_STYLES[0];
  return { id: style.id, label: style.label, strategy: style.strategy, castle: style.castle, rook: style.rook };
}

function weightedId(rng, weights, exclude = []) {
  const entries = Object.entries(weights).filter(([id]) => !exclude.includes(id));
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return entries.at(-1)[0];
}

/**
 * 得意戦法を作る。styles[0]が、いちばんの得意戦法。
 * @returns {{ party: 'static' | 'ranging' | 'both', styles: string[] }}
 */
export function createRepertoire(rng, group) {
  const share = PARTY_SHARES[group] ?? PARTY_SHARES[6];
  const roll = rng.next();
  const party = roll < share.ranging ? 'ranging' : roll < share.ranging + share.both ? 'both' : 'static';
  const count = 2 + (rng.next() < 0.4 ? 1 : 0);
  const styles = [];
  for (let index = 0; index < count; index += 1) {
    // 両方指す棋士は、居飛車と振り飛車を交互に足す。
    const side = party === 'both' ? (index % 2 === 0 ? (rng.next() < 0.5 ? 'static' : 'ranging') : (STYLE_BY_ID.get(styles[0]).rook === 'static' ? 'ranging' : 'static')) : party;
    styles.push(weightedId(rng, side === 'ranging' ? RANGING_STYLE_WEIGHTS : STATIC_STYLE_WEIGHTS, styles));
  }
  return { party, styles };
}

/** 1局の戦法を選ぶ。いちばんの得意戦法を多めに、ほかは等分。 */
export function pickGameStyle(rng, repertoire) {
  const styles = repertoire?.styles ?? [];
  if (!styles.length) return null;
  if (styles.length === 1 || rng.next() < PRIMARY_STYLE_RATE) return styleEntry(styles[0]);
  return styleEntry(styles[1 + Math.floor(rng.next() * (styles.length - 1))]);
}

/** 紹介用の言葉(例: 居飛車党・相掛かり、角換わり腰掛け銀)。 */
export function repertoireText(repertoire) {
  if (!repertoire) return '';
  return `${PARTY_LABELS[repertoire.party]}・${repertoire.styles.map((id) => styleEntry(id).label).join('、')}`;
}
