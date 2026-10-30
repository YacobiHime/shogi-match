// プレイヤー(あなた)の能力値。名鑑の棋士と同じ8つの能力・ランク・特殊能力の形で、最近の対局の中身から出す。
// 設計は docs/player-abilities-design.md の12章。画面に依存しない。
// - 能力の配分(どこが得意か): 最近の対局の要約(play-insight.mjsのaxes)を、能力ごとの「Lvと値の対応」でLvに直し、
//   その平均からの差を、名鑑の棋士と同じ「平均からの差(dev)」にする。
// - 全体の高さ: 竜王戦の世界の物差し。おすすめの難易度なら、6組の平均の棋士に7割勝てる棋士として置く(ryuo-strength.mjsの考え方)。

import {
  ABILITIES, ABILITY_KEYS, ABILITY_SIM_WEIGHTS, MAX_DEV, abilityBase, abilityRank, abilityTypeLabel, balanceDevs, phaseStrengths, styleAttackOf,
} from './player-abilities.mjs';
import { specialAbilityChips } from './player-character.mjs';
import { defaultCastleShares, favoriteStyleIds, partyOfUsage, proOpening, staticShare, toPercent, usageRows } from './opening-usage.mjs';
import { GROUP_MEAN_RATING, TOURNAMENT_TARGET_WIN_RATE, recommendedDifficulty, worldRating } from './ryuo-strength.mjs';
import { LOSS_AXES, RATE_AXES } from './play-insight.mjs';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * 集計の軸ごとの「Lvと値の対応」。強さの分かっているCPU(Lv1〜48)どうしの96局を、アプリと同じ段階解析で読み(棋力測定の表と同じデータ。
 * docs/skill-measure-design.mdの7章)、1局ずつの値をLvに直線で当てはめた。キーは集計の軸(play-insight.mjsのaxes)。
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
/**
 * 能力(player-abilities.mjsの項目)ごとに、どの集計の軸で測るか(docs/player-abilities-design.mdの13-7)。
 * 研究は序盤、大局観は中盤の1手の損、寄せは優勢での1手の損と詰みを逃さなかった割合、受けは劣勢での1手の損で測る。
 * 視野・発想は2026-10-30に足した軸(前の要約にはないので、新しい対局が解析されるまでは「まだ材料がない」)。
 */
export const ABILITY_AXES = Object.freeze({
  opening: ['opening'], judgment: ['middle'], vision: ['vision'], idea: ['idea'], reading: ['reading'],
  stability: ['stability'], attack: ['attack', 'mate'], defense: ['defense'],
});
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
        // 視野・発想は、2026-10-30より前の要約にはない(数えない)。
        totals[key].n += summary.axes[key]?.n ?? 0;
        totals[key].hit += summary.axes[key]?.hit ?? 0;
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
  judgment: { id: 'middle-strong', gold: 'grand-view' },
  vision: { id: 'wide-vision', gold: 'clairvoyance' },
  idea: { id: 'creative', gold: 'myoshu' },
  reading: { id: 'deep-reading', gold: 'demon-reading' },
  attack: { id: 'fast-attack' },
  defense: { id: 'endgame-defense', gold: 'defense-master' },
});
const WEAK_TRAITS = Object.freeze({ judgment: 'loose-when-ahead', vision: 'careless', defense: 'weak-defense' });
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
  opening: '研究は、作戦カードで戦法と囲いの手順を覚えると伸びるよ。',
  judgment: '中盤は、指す前に駒の損得と玉の堅さで「どちらが良いか」を比べると伸びるよ。',
  vision: '指す前に、相手の駒の利きを見渡して、タダで取られる駒や取れる駒がないか確かめよう。',
  idea: '問題集の手筋の問題で、捨て駒や両取りの形を覚えると、発想が伸びるよ。',
  reading: '候補手を2つ比べてから指すと、読みが伸びるよ。',
  stability: '大きな悪手が出やすいみたい。指す前に、タダで取られる駒がないか確かめよう。',
  attack: '有利なときは、相手玉の逃げ道をふさぐ手を探そう。短い詰将棋で詰みの筋に慣れると、寄せが伸びるよ。',
  defense: '不利なときは、あわてずに玉の逃げ道を広げる手を探そう。',
});

// ---- 得意戦法と棋風(docs/tournament-relay-design.mdの28章)
// 分身は、プレイヤーが対局で組んだ戦法・囲いの回数(コレクション。collection.mjsのformations)から、名鑑の棋士と同じ形の
// 使用率(opening-usage.mjs)を持つ。1局ごとに、その使用率で戦法と囲いを選び、序盤は定跡で指す(自分らしい分身)。

/**
 * 定跡図鑑の戦法(opening-guide.mjsのid)を、大会の戦法の目録(opening-usage.mjsのPRO_OPENINGS)の近い戦法へ寄せる。
 * 目録にない戦法(横歩取り・原始中飛車など)は、同じ系統の近い戦法に数える。奇襲と、どの形にもなる腰掛け銀は数えない。
 */
export const STRATEGY_TO_OPENING = Object.freeze({
  aigakari: 'aigakari', hineribisha: 'aigakari', yokofudori: 'aigakari', 'yokofudori-33-bishop': 'aigakari', 'aono-ryu': 'aigakari',
  'gangi-strategy': 'gangi', 'gangi-right-shiken': 'gangi',
  kakugawari: 'kakugawari', 'kakugawari-koshikake-gin': 'kakugawari-kg', 'kakugawari-45-knight': 'kakugawari-45',
  'yagura-strategy': 'yagura', 'suzume-zashi': 'yagura', 'yagura-37-silver': 'yagura', 'morishita-system': 'yagura',
  'hayaguri-gin': 'hayaguri', bougin: 'bougin', 'right-shiken': 'right-shiken', 'right-shiken-elmo': 'right-shiken',
  sodebisha: 'ibisha', 'chikatetsu-bisha': 'ibisha', torizashi: 'ibisha',
  shiken: 'shiken', 'fujii-system': 'fujii-system', sangen: 'sangen', 'first-78-rook': 'sangen', 'second-32-rook': 'sangen',
  ishida: 'ishida', 'shin-onigoroshi': 'ishida', nakabisha: 'gokigen', gokigen: 'gokigen', 'hashikaku-nakabisha': 'gokigen',
  mukai: 'mukai',
});
/** 得意戦法を持たせるのに要る、組んだ戦法の回数(合わせて)。少ないうちは、序盤をエンジンに任せる。 */
export const MY_REPERTOIRE_MIN_GAMES = 3;

/**
 * プレイヤーの得意戦法(名鑑の棋士と同じ形: 党・得意戦法・使用率)。組んだ戦法が少なければnull。
 * 囲いの使用率は、その戦法で組める囲いのうち、プレイヤーが組んだ回数の割合(組んだことがなければ、目録の重み)。
 * 居飛車を指すなら、相手が振り飛車のときの対抗形(ibisha)の囲いも、組んだ回数から決める。
 * @param {{ formations?: { [label: string]: { count?: number } } | object, catalog: { kind: string, id: string, label: string }[] }} input
 *   formationsは、コレクションの戦型の名前ごとの回数。catalogは、その名前の一覧(collection.mjsのcollectionCatalog)。
 * @returns {{ party: 'static' | 'ranging' | 'both', styles: string[], usage: any, games: number } | null}
 */
export function myRepertoire({ formations = {}, catalog }) {
  const weights = {};
  const castleCounts = {};
  let games = 0;
  for (const entry of catalog ?? []) {
    const count = Math.max(0, Math.trunc(/** @type {any} */ (formations)?.[entry.label]?.count ?? 0));
    if (!count) continue;
    if (entry.kind === 'castle') {
      castleCounts[entry.id] = (castleCounts[entry.id] ?? 0) + count;
      continue;
    }
    const opening = STRATEGY_TO_OPENING[entry.id];
    if (!opening) continue;
    weights[opening] = (weights[opening] ?? 0) + count;
    games += count;
  }
  if (games < MY_REPERTOIRE_MIN_GAMES) return null;
  const shares = toPercent(weights);
  const castles = {};
  const castleShares = (id) => {
    const opening = proOpening(id);
    const counted = Object.fromEntries((opening?.castles ?? []).filter(([castle]) => castle && castleCounts[castle]).map(([castle]) => [castle, castleCounts[castle]]));
    return Object.keys(counted).length ? toPercent(counted) : defaultCastleShares(id);
  };
  for (const id of Object.keys(shares)) castles[id] = castleShares(id);
  const usage = { black: shares, white: { ...shares }, castles };
  if (staticShare(usage) > 0 && !castles.ibisha) castles.ibisha = castleShares('ibisha');
  return { party: partyOfUsage(usage), styles: favoriteStyleIds(usage), usage, games };
}

/**
 * プレイヤーの棋風(攻め将棋⇔受け将棋、−1〜1)。能力の攻めと受けの差(名鑑の棋士と同じstyleAttackOf)に、
 * よく指す戦法の攻めっ気(目録のattack。急戦は攻め、矢倉・対抗形の持久戦は受け)を少し足す。
 * @param {Record<string, number> | null} abilities 能力の平均からの差(なければ戦法だけで決める)
 * @param {ReturnType<typeof myRepertoire>} repertoire
 */
export function myStyleAttack(abilities, repertoire) {
  const rows = usageRows(repertoire?.usage ?? null);
  const total = rows.reduce((sum, row) => sum + row.share, 0);
  const lean = total ? rows.reduce((sum, row) => sum + (proOpening(row.id)?.attack ?? 0) * row.share, 0) / total : 0;
  return Math.round(clamp(styleAttackOf(abilities) + 0.4 * lean, -1, 1) * 100) / 100 + 0;
}

/**
 * プレイヤーの能力。名鑑の棋士の能力の画面(PlayerAbilityPanel)と同じ形のview、比べるための棋士の形(member)、
 * いちばんの武器と伸びしろ、分析に使った対局と手の数。足りなければready: false。
 * @param {{ games: { summary: any }[], playerLevel: number, difficulty?: number | null, world?: number | null,
 *   repertoire?: ReturnType<typeof myRepertoire> }} input
 *   games: play-insight.mjsの最近の対局。playerLevel: レーティングのLv(小数)。difficulty: 竜王戦の難易度(なければおすすめ)。
 *   world: 世界の物差し(6組の平均を指させるLv。tournament-world.mjs)。あれば、こちらで世界の中のレーティングを出す。
 *   repertoire: 得意戦法(myRepertoire)。あれば、memberに持たせ、棋風と使用率の表示にも使う
 */
export function myAbilityProfile({ games, playerLevel, difficulty = null, world = null, repertoire = null }) {
  const { totals, moves, games: count } = collectAxes(games ?? []);
  if (moves < MY_ABILITY_MIN_MOVES) return { ready: false, games: count, moves, need: MY_ABILITY_MIN_MOVES - moves };
  // 集計の軸ごとのLvと、信じる度合い(手が少ないほど小さい)。
  const axisLevels = {};
  const axisWeights = {};
  for (const axis of new Set(Object.values(ABILITY_AXES).flat())) {
    const total = totals[axis];
    if (!total?.n || !AXIS_MODELS[axis]) continue;
    const value = 'sum' in total ? total.sum / total.n : total.hit / total.n;
    const level = axisLevel(axis, { n: total.n, value });
    if (level === null) continue;
    axisLevels[axis] = level;
    axisWeights[axis] = total.n / (total.n + AXIS_MODELS[axis].shrink);
  }
  // 能力のLvの平均(自動対局の重みと、信じる度合いで重みをつける。詰みの軸は割合が1に張りつくので入れない)。
  // 全体の高さは世界の物差しで決めるので、ここでは配分だけを見る。
  const primary = (key) => ABILITY_AXES[key][0];
  const centerKeys = ABILITY_KEYS.filter((key) => ABILITY_SIM_WEIGHTS[key] && primary(key) in axisLevels);
  const centerWeight = centerKeys.reduce((total, key) => total + ABILITY_SIM_WEIGHTS[key] * axisWeights[primary(key)], 0);
  const center = centerWeight
    ? centerKeys.reduce((total, key) => total + ABILITY_SIM_WEIGHTS[key] * axisWeights[primary(key)] * axisLevels[primary(key)], 0) / centerWeight
    : 0;
  if ('mate' in axisLevels) axisLevels.mate = Math.min(axisLevels.mate, center + MATE_CEILING);
  // 能力ごとのLvは、その能力の軸のLvを、信じる度合いで合わせる(寄せは、優勢での損と、詰みを逃さなかった割合)。
  const levels = {};
  const weights = {};
  for (const key of ABILITY_KEYS) {
    const axes = ABILITY_AXES[key].filter((axis) => axis in axisLevels);
    if (!axes.length || !(primary(key) in axisLevels)) continue;
    const weight = axes.reduce((total, axis) => total + axisWeights[axis], 0);
    levels[key] = axes.reduce((total, axis) => total + axisWeights[axis] * axisLevels[axis], 0) / weight;
    weights[key] = axisWeights[primary(key)];
  }
  const raw = Object.fromEntries(ABILITY_KEYS.map((key) => [
    key, key in levels ? clamp(POINTS_PER_LEVEL * weights[key] * (levels[key] - center), -MAX_DEV, MAX_DEV) : 0,
  ]));
  const devs = balanceDevs(raw);
  const trusted = new Set(Object.keys(weights).filter((key) => weights[key] >= 0.5));
  const usedDifficulty = Number.isFinite(difficulty) ? /** @type {number} */ (difficulty) : recommendedDifficulty(playerLevel);
  const rating = Number.isFinite(world) ? worldRating(playerLevel, /** @type {number} */ (world)) : worldRatingFor(playerLevel, usedDifficulty);
  const member = {
    rating,
    character: { abilities: devs, traits: traitsFor(devs, trusted), attack: myStyleAttack(devs, repertoire) },
    ...(repertoire ? { repertoire } : {}),
  };
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
      phases: phaseStrengths(values),
      specials: specialAbilityChips(member.character),
      staticShare: repertoire ? staticShare(repertoire.usage) : null,
      openings: usageRows(repertoire?.usage ?? null).slice(0, 6).map((row) => ({ ...row, record: '' })),
    },
    /** 分析に使えなかった能力(まだ材料のない能力。平均のまま出す)。 */
    missing: ABILITIES.filter(({ key }) => !(key in levels)).map(({ label }) => label),
    best: best && devs[best.key] > 0 ? { key: best.key, label: best.label, rank: abilityRank(values[best.key]) } : null,
    worst: worst && devs[worst.key] < 0 ? { key: worst.key, label: worst.label, rank: abilityRank(values[worst.key]), hint: GROWTH_HINTS[worst.key] } : null,
  };
}
