// プレイヤー(あなた)の能力値。名鑑の棋士と同じ8つの能力・ランク・特殊能力の形で、最近の対局の中身から出す。
// 設計は docs/player-abilities-design.md の12章。画面に依存しない。
// - 能力の配分(どこが得意か): 最近の対局の要約(play-insight.mjsのaxes)を、能力ごとの「Lvと値の対応」でLvに直し、
//   その平均からの差を、名鑑の棋士と同じ「平均からの差(dev)」にする。
// - 全体の高さ: 竜王戦の世界の物差し。おすすめの難易度なら、6組の平均の棋士に7割勝てる棋士として置く(ryuo-strength.mjsの考え方)。

import { ABILITIES, ABILITY_KEYS, ABILITY_SIM_WEIGHTS, MAX_DEV, abilityBase, abilityRank, abilityTypeLabel, balanceDevs } from './player-abilities.mjs';
import { specialAbilityChips } from './player-character.mjs';
import { GROUP_MEAN_RATING, TOURNAMENT_TARGET_WIN_RATE, recommendedDifficulty } from './ryuo-strength.mjs';
import { LOSS_AXES, RATE_AXES } from './play-insight.mjs';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * 能力ごとの「Lvと値の対応」。強さの分かっているCPU(Lv1〜48)どうしの96局を、アプリと同じ段階解析で読み(棋力測定の表と同じデータ。
 * docs/skill-measure-design.mdの7章)、1局ずつの値をLvに直線で当てはめた。
 * - loss: 1手の損(同じ読みの中の差、1000まで)の平均+10の対数 = a + b×Lv
 * - rate: 割合のロジット = a + b×Lv(読み: 最善手を指した割合、安定感: 損300以上の割合、詰み: 詰みを逃さなかった割合)
 * shrink: 手(詰みは機会)の数がこれだけあると、Lvの差を半分だけ信じる(少ない手の偶然で、能力をとがらせすぎない)。
 */
export const AXIS_MODELS = Object.freeze({
  opening: Object.freeze({ kind: 'loss', a: 6.0621, b: -0.0652, shrink: 60 }),
  middle: Object.freeze({ kind: 'loss', a: 6.7846, b: -0.06084, shrink: 60 }),
  ending: Object.freeze({ kind: 'loss', a: 6.9421, b: -0.05349, shrink: 60 }),
  attack: Object.freeze({ kind: 'loss', a: 6.4991, b: -0.05619, shrink: 60 }),
  defense: Object.freeze({ kind: 'loss', a: 6.389, b: -0.03891, shrink: 60 }),
  reading: Object.freeze({ kind: 'rate', a: -2.2923, b: 0.07151, shrink: 60 }),
  stability: Object.freeze({ kind: 'rate', a: 0.113, b: -0.07016, shrink: 60 }),
  mate: Object.freeze({ kind: 'rate', a: 1.2952, b: 0.06667, shrink: 8 }),
});
/**
 * 詰みは、Lv20あたりから上は、どのCPUもほとんど逃さない(割合が1に張りつく)。逃さなかっただけでは、
 * ほかの能力の平均よりこれだけ上までしか上げない(逃した分は、そのまま下げる)。
 */
export const MATE_CEILING = 4;
/** 能力の差を出すLvの範囲。 */
const MIN_AXIS_LEVEL = 0;
const MAX_AXIS_LEVEL = 49;
/** 能力のLvが1違うと、能力の値がいくつ違うか。 */
export const POINTS_PER_LEVEL = 2;
/** 能力を出すのに要る、測れた手の数(最近の対局から合わせて)。 */
export const MY_ABILITY_MIN_MOVES = 30;
/** プレイヤー用のEloの、1Lvあたりのレーティング(player-rating.mjsと同じ)。 */
const PLAYER_RATING_PER_LEVEL = 60;
/** 竜王戦のおすすめの難易度で、6組の平均の棋士に勝つ見込み(ryuo-strength.mjsと同じ7割)。 */
const TARGET_MARGIN = 400 * Math.log10(TOURNAMENT_TARGET_WIN_RATE / (1 - TOURNAMENT_TARGET_WIN_RATE));

/** 集計の値から、その能力のLv(小数)。値がなければnull。 */
export function axisLevel(key, { n, value }) {
  const model = AXIS_MODELS[key];
  if (!model || !n) return null;
  const y = model.kind === 'loss'
    ? Math.log(Math.max(0, value) + 10)
    : Math.log(clamp(value, 0.02, 0.98) / (1 - clamp(value, 0.02, 0.98)));
  return clamp((y - model.a) / model.b, MIN_AXIS_LEVEL, MAX_AXIS_LEVEL);
}

/**
 * 最近の対局の要約を、能力ごとに合わせる。2026-10-25より前の要約(axesなし)は、序盤・中盤・終盤と安定感だけを、
 * 前の集計(読みの損loss)から数える。
 * @param {{ summary: any }[]} games
 */
export function collectAxes(games) {
  const totals = {
    ...Object.fromEntries(LOSS_AXES.map((key) => [key, { n: 0, sum: 0 }])),
    ...Object.fromEntries(RATE_AXES.map((key) => [key, { n: 0, hit: 0 }])),
  };
  let moves = 0;
  let count = 0;
  for (const { summary } of games) {
    if (!summary) continue;
    count += 1;
    moves += summary.moves ?? 0;
    if (summary.axes) {
      for (const key of LOSS_AXES) {
        totals[key].n += summary.axes[key].n;
        totals[key].sum += summary.axes[key].sum;
      }
      for (const key of RATE_AXES) {
        totals[key].n += summary.axes[key].n;
        totals[key].hit += summary.axes[key].hit;
      }
    } else {
      for (const key of ['opening', 'middle', 'ending']) {
        totals[key].n += summary.phases?.[key]?.n ?? 0;
        totals[key].sum += summary.phases?.[key]?.sum ?? 0;
      }
      totals.stability.n += summary.moves ?? 0;
      totals.stability.hit += summary.big ?? 0;
    }
  }
  return { totals, moves, games: count };
}

/** 竜王戦の世界の物差しでの、プレイヤーのレーティング。おすすめより難しい難易度で指すほど、世界の中では低くなる。 */
export function worldRatingFor(playerLevel, difficulty) {
  const recommended = recommendedDifficulty(playerLevel);
  const delta = Number.isFinite(difficulty) ? difficulty - recommended : 0;
  return Math.round(GROUP_MEAN_RATING[6] + TARGET_MARGIN - PLAYER_RATING_PER_LEVEL * delta);
}

/**
 * 能力の差(dev)から、特殊能力(名鑑の棋士と同じ札)。とがった能力だけに付ける。
 * 得意: +10で「やや」、+18で「とても」、+25で金の札。苦手: −10で「やや」、−18で「とても」。
 */
const STRONG_TRAITS = Object.freeze({
  opening: { id: 'opening-study', gold: 'research-demon' },
  middle: { id: 'middle-strong', gold: 'grand-view' },
  attack: { id: 'fast-attack' },
  defense: { id: 'endgame-defense', gold: 'defense-master' },
  reading: { id: 'deep-reading', gold: 'demon-reading' },
  mate: { id: 'tsume' },
});
const WEAK_TRAITS = Object.freeze({ ending: 'endgame-collapse', defense: 'weak-defense', attack: 'loose-when-ahead' });
function traitsFor(devs, trusted) {
  const traits = [];
  for (const [key, { id, gold }] of Object.entries(STRONG_TRAITS)) {
    if (!trusted.has(key)) continue;
    if (gold && devs[key] >= 25) traits.push({ id: gold, degree: 1 });
    else if (devs[key] >= 10) traits.push({ id, degree: devs[key] >= 18 ? 2 : 1 });
  }
  for (const [key, id] of Object.entries(WEAK_TRAITS)) {
    if (trusted.has(key) && devs[key] <= -10) traits.push({ id, degree: devs[key] <= -18 ? 2 : 1 });
  }
  return traits;
}

/** 苦手な能力ごとの、やこび姫の一言(何をすれば伸びるか)。 */
const GROWTH_HINTS = Object.freeze({
  opening: '序盤は、作戦カードで戦法と囲いの手順を覚えると伸びるよ。',
  middle: '中盤は、指す前に「取られる駒はないか」を確かめると伸びるよ。',
  ending: '終盤は、詰みと必至の問題集で寄せの形に慣れると伸びるよ。',
  attack: '有利なときほど、相手の狙いを1手だけ確かめてから攻めよう。',
  defense: '不利なときは、あわてずに玉の逃げ道を広げる手を探そう。',
  reading: '候補手を2つ比べてから指すと、読みが伸びるよ。',
  mate: '短い詰将棋で、詰みの筋を見つける練習をしよう。',
  stability: '大きな悪手が出やすいみたい。指す前に、タダで取られる駒がないか確かめよう。',
});

/**
 * プレイヤーの能力。名鑑の棋士の能力の画面(PlayerAbilityPanel)と同じ形のview、比べるための棋士の形(member)、
 * いちばんの武器と伸びしろ、分析に使った対局と手の数。足りなければready: false。
 * @param {{ games: { summary: any }[], playerLevel: number, difficulty?: number | null }} input
 *   games: play-insight.mjsの最近の対局。playerLevel: レーティングのLv(小数)。difficulty: 竜王戦の難易度(なければおすすめ)
 */
export function myAbilityProfile({ games, playerLevel, difficulty = null }) {
  const { totals, moves, games: count } = collectAxes(games ?? []);
  if (moves < MY_ABILITY_MIN_MOVES) return { ready: false, games: count, moves, need: MY_ABILITY_MIN_MOVES - moves };
  const levels = {};
  const weights = {};
  for (const key of ABILITY_KEYS) {
    const total = totals[key];
    const value = total.n ? ('sum' in total ? total.sum / total.n : total.hit / total.n) : 0;
    const level = axisLevel(key, { n: total.n, value });
    if (level === null) continue;
    levels[key] = level;
    weights[key] = total.n / (total.n + AXIS_MODELS[key].shrink);
  }
  // 能力のLvの平均(自動対局の重みと、信じる度合いで重みをつける)。全体の高さは世界の物差しで決めるので、ここでは配分だけを見る。
  const centerKeys = Object.keys(levels).filter((key) => ABILITY_SIM_WEIGHTS[key] && key !== 'mate');
  const centerWeight = centerKeys.reduce((total, key) => total + ABILITY_SIM_WEIGHTS[key] * weights[key], 0);
  const center = centerWeight
    ? centerKeys.reduce((total, key) => total + ABILITY_SIM_WEIGHTS[key] * weights[key] * levels[key], 0) / centerWeight
    : 0;
  if ('mate' in levels) levels.mate = Math.min(levels.mate, center + MATE_CEILING);
  const raw = Object.fromEntries(ABILITY_KEYS.map((key) => [
    key, key in levels ? clamp(POINTS_PER_LEVEL * weights[key] * (levels[key] - center), -MAX_DEV, MAX_DEV) : 0,
  ]));
  const devs = balanceDevs(raw);
  const trusted = new Set(Object.keys(weights).filter((key) => weights[key] >= 0.5));
  const usedDifficulty = Number.isFinite(difficulty) ? /** @type {number} */ (difficulty) : recommendedDifficulty(playerLevel);
  const rating = worldRatingFor(playerLevel, usedDifficulty);
  const member = { rating, character: { abilities: devs, traits: traitsFor(devs, trusted) } };
  const base = abilityBase(rating);
  const values = Object.fromEntries(ABILITY_KEYS.map((key) => [key, Math.round(clamp(base + devs[key], 1, 100))]));
  const known = ABILITIES.filter(({ key }) => key in levels);
  const sorted = [...known].sort((a, b) => devs[b.key] - devs[a.key]);
  const best = sorted[0];
  const worst = sorted.at(-1);
  return {
    ready: true,
    games: count,
    moves,
    difficulty: usedDifficulty,
    member,
    view: {
      abilities: ABILITIES.map(({ key, label, hint }) => ({ key, label, hint, value: values[key], rank: abilityRank(values[key]) })),
      type: abilityTypeLabel(member),
      specials: specialAbilityChips(member.character),
      staticShare: null,
      openings: [],
    },
    /** 分析に使えなかった能力(まだ材料のない能力。平均のまま出す)。 */
    missing: ABILITIES.filter(({ key }) => !(key in levels)).map(({ label }) => label),
    best: best && devs[best.key] > 0 ? { key: best.key, label: best.label, rank: abilityRank(values[best.key]) } : null,
    worst: worst && devs[worst.key] < 0 ? { key: worst.key, label: worst.label, rank: abilityRank(values[worst.key]), hint: GROWTH_HINTS[worst.key] } : null,
  };
}
