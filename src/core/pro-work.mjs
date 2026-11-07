// 棋士の1年の「棋士の仕事」(docs/pro-year-design.mdの14-3の1)。画面に依存しない。
// 今ある遊び(駒落ちの指導対局・問題集の詰将棋・中継の次の一手クイズ)を、週の行動の「仕事」として呼ぶ。
// ここは依頼の決め方と出来高の計算だけ。遊びそのものは対局画面・問題集・中継の画面が受け持つ。

import { createRng } from './ryuo-random.mjs';
import { mergeGains } from './pro-avatar.mjs';

/** 解説の仕事が開くファンの数(本戦・リーグ入りでも開く)。D:5-1 解放のご褒美。 */
export const KAISETSU_FANS = 300;

/**
 * 仕事の目録。dayは週の月曜からの日数(0=月・5=土・6=日)。scoreMaxは遊んだときの出来(詰将棋は解けた数、解説は当たった数)。
 * 謝礼とファンは「基本＋出来1つごとの上乗せ」。quickは「さっと済ませる」ときの出来。
 */
export const WORKS = Object.freeze({
  shidou: Object.freeze({
    id: 'shidou', label: '指導', title: '将棋サロンの指導対局', icon: '指', day: 6, client: '駅前の将棋サロン',
    note: '駒落ちの指導対局を1局。勝ち負けより、楽しんでもらおう',
    fee: 10, feePer: 0, fans: 10, fansPer: 0, scoreMax: 0, quick: 0,
    gains: Object.freeze({ defense: 2, vision: 1 }), gainsPer: Object.freeze({}),
    play: '指導対局を指す',
  }),
  tsume: Object.freeze({
    id: 'tsume', label: '詰将棋', title: '詰将棋欄の監修', icon: '詰', day: 0, client: '将棋新報',
    note: '今月号の詰将棋欄の3問を、作者の答えどおりに詰むか確かめる',
    fee: 0, feePer: 5, fans: 5, fansPer: 0, scoreMax: 3, quick: 2,
    gains: Object.freeze({ attack: 2, reading: 1 }), gainsPer: Object.freeze({ attack: 1 }),
    play: '詰将棋3問を解く',
  }),
  kaisetsu: Object.freeze({
    id: 'kaisetsu', label: '解説', title: '大盤解説', icon: '解', day: 5, client: '将棋会館の大盤解説会',
    note: '注目局を見ながら、次の一手を5問当てる',
    fee: 15, feePer: 3, fans: 20, fansPer: 5, scoreMax: 5, quick: 2,
    gains: Object.freeze({ judgment: 2, idea: 1 }), gainsPer: Object.freeze({ judgment: 0.5 }),
    play: '大盤解説をする',
  }),
});
export const WORK_IDS = Object.freeze(Object.keys(WORKS));
export const workDef = (id) => WORKS[id] ?? null;

/**
 * その週の依頼(0〜2件)。週の始めの日と種で決まる(同じ週は何度見ても同じ)。
 * @param {{ weekStart: string, seed: number, kaisetsuOpen: boolean, kaisetsuGame?: any, slots: number, lastWeek?: boolean }} input
 * @returns {string[]} 仕事のid
 */
export function workOffers({ weekStart, seed, kaisetsuOpen, kaisetsuGame = null, slots, lastWeek = false }) {
  if (slots <= 0 || lastWeek) return [];
  let hash = (seed ^ 0x6f1c2b) >>> 0;
  for (const ch of weekStart) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rng = createRng(hash);
  const pool = ['shidou', 'tsume'];
  if (kaisetsuOpen && kaisetsuGame) pool.push('kaisetsu');
  // 解説が開いていて、注目局があれば、いつも1件に入れる(開いたご褒美が見えるように)。
  const picked = pool.includes('kaisetsu') ? ['kaisetsu'] : [];
  const rest = pool.filter((id) => !picked.includes(id));
  // 3週に1週くらいは依頼が1件だけ(毎週同じ並びにならないように)。
  const count = rng.next() < 0.3 ? 1 : 2;
  while (picked.length < count && rest.length) picked.push(rest.splice(Math.floor(rng.next() * rest.length), 1)[0]);
  return picked.sort((a, b) => WORK_IDS.indexOf(a) - WORK_IDS.indexOf(b));
}

/**
 * 仕事の出来高(謝礼・ファン・分身の経験)。
 * @param {string} id
 * @param {{ score?: number, quick?: boolean }} [result]
 */
export function workReward(id, { score = 0, quick = false } = {}) {
  const def = workDef(id);
  if (!def) return { fee: 0, fans: 0, gains: {}, score: 0, quick };
  const value = Math.max(0, Math.min(def.scoreMax, Math.round(quick ? def.quick : Number(score) || 0)));
  const fee = def.fee + def.feePer * value;
  const fans = def.fans + def.fansPer * value;
  // 上乗せの経験は、さっと済ませたときは入らない(遊んだ分だけ育つ。14-3の1)。
  const extra = quick ? {} : Object.fromEntries(Object.entries(def.gainsPer).map(([key, per]) => [key, Math.floor(per * value)]));
  return { fee, fans, gains: mergeGains(def.gains, extra), score: value, quick };
}

/** 出来の言葉(「3問中2問」「5問中4問当たり」)。 */
export function workScoreText(id, score) {
  const def = workDef(id);
  if (!def?.scoreMax) return '';
  return id === 'kaisetsu' ? `${def.scoreMax}問中${score}問当たり` : `${def.scoreMax}問中${score}問`;
}
