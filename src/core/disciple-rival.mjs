// 師匠の1年(docs/disciple-mode-design.mdの2章・12-2・30章)の、羽音の一門。
// 羽音は同じ時期に弟子をとったライバルの師匠。羽音の弟子は研修会・奨励会の「同期」として弟子と同じ世界にいて、
// 例会の相手を選ぶときに同期が選ばれやすい決まり(kenshukai.mjs・shoreikai.mjsの同期)で、自然に何度も当たる。
// 羽音の弟子の強さは、弟子の強さに少しの差(edge)を足したもの。差は例会ごとに少しずつ揺れる(勝ったり負けたりする)。
// 画面に依存しない。研修会・奨励会の世界の会員を、羽音の弟子に書き換えて使う。

import { CLASS_RATINGS } from './kenshukai.mjs';
import { RANK_RATINGS, SANDAN, rankLabel } from './shoreikai.mjs';

/** 羽音の弟子(名前は仮)。 */
export const RIVAL_DISCIPLE = Object.freeze({ name: '氷室 凛', master: '羽音' });
/** はじめの差(羽音の弟子は少し強いところから始まる)と、揺れ方。 */
export const RIVAL_EDGE = Object.freeze({ start: 0.6, mean: -0.6, pull: 0.15, swing: 0.6, min: -2, max: 2 });
/** 研修会の世界の物差し(disciple-run.mjsのOPPONENT_BASE_LEVEL・OPPONENT_CLASS_STEPと同じ)。 */
const KEN_BASE = 17;
const KEN_STEP = 2.2;
/** 奨励会の物差し(disciple-run.mjsのSHOREIKAI_BASE_LEVEL・SHOREIKAI_LEVEL_PER_RATINGと同じ)。 */
const SHO_BASE = 39;
const SHO_PER_RATING = 11.5 / (1490 - 1150);

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/** 羽音の弟子の記録のはじめ(育成の状態の`rival`)。 */
export const createRival = () => ({ id: null, name: RIVAL_DISCIPLE.name, edge: RIVAL_EDGE.start, wins: 0, losses: 0, met: 0, ahead: false, gone: '', last: '' });

/** 羽音の弟子のいまのLv(弟子のLvに差を足す。CPUの上限Lv49まで)。 */
export const rivalLevel = (discipleLevel, rival) => clamp(discipleLevel + (Number(rival?.edge) || 0), 12, 49);

/** 研修会で、そのLvの人がいるはずのクラスのレーティング(世界の昇級のまねが、そのクラスへ動かす)。 */
export const kenshukaiRatingFor = (level) => Math.round(CLASS_RATINGS[0] + (25 * (level - KEN_BASE)) / KEN_STEP);
/** 奨励会で、そのLvになるレーティング(disciple-run.mjsのshoreikaiOpponentLevelの逆)。 */
export const shoreikaiRatingFor = (level) => Math.round(RANK_RATINGS[0] + (level - SHO_BASE) / SHO_PER_RATING);
/** 奨励会で、そのレーティングの人の段級(三段の手前まで)。 */
export const shoreikaiRankFor = (rating) => {
  let rank = 0;
  for (let index = 0; index < SANDAN; index += 1) if (rating >= RANK_RATINGS[index]) rank = index;
  return rank;
};

/**
 * 研修会の世界の1人を、羽音の弟子に書き換える(入会したクラスの、同期でない人)。
 * @param {any} rival 書き換えてよい記録
 * @param {any} run 研修会の挑戦(書き換えてよい)
 * @param {{ level: number, ageYears: number }} options
 */
export function placeRivalInKenshukai(rival, run, { level, ageYears }) {
  const members = Object.values(run.world.members);
  const member = members.find((m) => m.cls === run.cls && !m.peer) ?? members.find((m) => Math.abs(m.cls - run.cls) <= 1 && !m.peer);
  if (!member) return false;
  Object.assign(member, { name: rival.name, peer: true, rival: true, talent: 0, age: ageYears, woman: true });
  syncMember(member, rival, level, 'kenshukai');
  rival.id = member.id;
  return true;
}

/**
 * 奨励会の世界に、羽音の弟子を入れる(編入の同期の1人を書き換える。強さに合う段級から)。
 * @param {any} rival 書き換えてよい記録
 * @param {any} run 奨励会の挑戦(書き換えてよい)
 * @param {{ level: number, ageYears: number }} options
 */
export function placeRivalInShoreikai(rival, run, { level, ageYears }) {
  const member = run.world.members[run.peers?.[0] ?? ''];
  if (!member) return false;
  // storyの印: ほかの奨励会員のように勝手に伸びたり辞めたりしない(shoreikai.mjsのmemberMonth)。
  Object.assign(member, { name: rival.name, peer: true, rival: true, story: 'rival-disciple', talent: 0, age: ageYears });
  const rating = shoreikaiRatingFor(rivalLevel(level, rival));
  member.rank = shoreikaiRankFor(rating);
  member.dan = rankLabel(member.rank);
  syncMember(member, rival, level, 'shoreikai');
  rival.id = member.id;
  rival.ahead = false;
  return true;
}

/** 会員の強さと年齢を合わせる。 */
function syncMember(member, rival, level, kind) {
  const target = rivalLevel(level, rival);
  member.rating = kind === 'kenshukai' ? kenshukaiRatingFor(target) : shoreikaiRatingFor(target);
  member.rivalLevel = Math.round(target * 10) / 10;
}

/**
 * 例会の前に、羽音の弟子の強さを弟子に合わせ、差を少し揺らす。世界からいなくなっていたら、先に進んだ(奨励会へ・四段に)印。
 * @param {any} rival 書き換えてよい記録
 * @param {any} run 研修会か奨励会の挑戦(書き換えてよい)
 * @param {{ level: number, ageYears: number, kind: 'kenshukai' | 'shoreikai', rng: { next(): number } }} options
 * @returns {string} いなくなったときの知らせ(なければ空)
 */
export function syncRival(rival, run, { level, ageYears, kind, rng }) {
  if (!rival?.id || rival.gone) return '';
  const member = run.world.members[rival.id];
  if (!member) {
    if (kind === 'kenshukai') {
      if (rival.ahead) return '';
      rival.ahead = true;
      return `羽音の弟子の${rival.name}が、ひと足先に奨励会へ編入した`;
    }
    rival.gone = 'pro';
    return `羽音の弟子の${rival.name}が、ひと足先に四段に昇段した`;
  }
  rival.edge = clamp(rival.edge * (1 - RIVAL_EDGE.pull) + RIVAL_EDGE.mean * RIVAL_EDGE.pull + (rng.next() - 0.5) * RIVAL_EDGE.swing, RIVAL_EDGE.min, RIVAL_EDGE.max);
  member.age = ageYears;
  syncMember(member, rival, level, kind);
  return '';
}

/**
 * 羽音の弟子との局の結果を数える。
 * @param {any} rival 書き換えてよい記録
 * @param {boolean} win 弟子が勝ったか
 */
export function noteRivalGame(rival, win) {
  rival.met += 1;
  if (win) rival.wins += 1;
  else rival.losses += 1;
  rival.last = win ? 'win' : 'loss';
}

/** 会員が羽音の弟子か。 */
export const isRivalMember = (member) => Boolean(member?.rival);
