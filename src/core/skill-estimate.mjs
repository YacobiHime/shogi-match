// 棋譜解析の結果から、対局で指した手の評価値の損と対局の勝ち負けを見て、棋力(レーティングと級・段)を推定する。
// 損とLvの対応は、強さの分かっているCPUどうしの対局を、アプリと同じ段階解析で読んで作った表で決める
// (2026-10-24の作り直し。docs/skill-measure-design.mdの7章)。結果は目安として扱う。

import { levelRating } from './player-rating.mjs';
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

/** 1手の損失の上限。1手の大悪手で平均が崩れすぎないようにする。 */
const LOSS_CAP = 1000;
/** 着手前の形勢がこれ以上(どちら向きでも)の局面は、差が付いていて評価値の損が測りにくいので除く。 */
const DECIDED_STANDING = 1500;
/** 診断に必要な、測れる手の数の下限。 */
export const MIN_MEASURED_MOVES = 10;
/** 1手の損を対数にするときに足す値(損0の手を扱えるように)。 */
const LOG_OFFSET = 10;
/** 1LvあたりのレーティングR(player-rating.mjsと同じ)。勝ち負けの起こりやすさに使う。 */
const RATING_PER_LEVEL = 60;
const MAX_LEVEL = CPU_STRENGTH_PRESETS.at(-1).level;

/**
 * Lvごとの「1手の損(上限1000)＋10」の対数の平均(単調に減るようにならした表、[Lv, 値])。
 * 強さの分かっているCPU(Lv1〜48)どうしの96局を、アプリと同じ段階解析で読み、両方の側の手を数えた(2026-10-24)。
 * desktopはPCの解析(全局面2万ノード)、compactはスマホ・タブレット縦の解析(全局面6千ノード)。読みが浅いと損が大きく出るので分ける。
 * Lv36より上は損がほとんど変わらない(解析の読みより強い手の違いは見分けられない)。そこは勝ち負けで補う。
 */
export const LOG_LOSS_TABLES = Object.freeze({
  desktop: Object.freeze([[1.5, 5.38], [5, 5.07], [8, 5], [10, 4.95], [13, 4.77], [17, 4.65], [20, 4.43], [23, 3.85], [26, 3.64], [29, 3.63], [32, 3.34], [38, 3.17], [44, 3.05], [47, 2.92]]),
  compact: Object.freeze([[1, 5.48], [2, 5.39], [5, 5.03], [8, 5.02], [10, 4.99], [13, 4.81], [17, 4.67], [20, 4.35], [23, 3.9], [26, 3.71], [29, 3.65], [33, 3.39], [39, 3.21], [46, 3.09]]),
});
/** 1手の対数の損のばらつき(標準偏差)と、局ごとの調子のばらつき。同じ96局から測った。 */
const MOVE_LOG_SD = 1.45;
const GAME_LOG_SD = 0.24;
/**
 * Lvごとの1手の損(素の損、上限1000)の平均の表(単調に減る、[Lv, 平均])。R内容(play-insight.mjs)の換算に使う。
 */
const RAW_LOSS_TABLE = Object.freeze([[1.5, 466], [6, 363], [12, 305], [17, 272], [20, 226], [23, 171], [26, 150], [29, 147], [32, 124], [34, 121], [39, 113], [46, 90]]);

/** 表を折れ線でつなぐ。両端より外は端の値。 */
function tableValue(table, level) {
  if (level <= table[0][0]) return table[0][1];
  if (level >= table.at(-1)[0]) return table.at(-1)[1];
  const index = table.findIndex(([at]) => at >= level);
  const [fromLevel, from] = table[index - 1];
  const [toLevel, to] = table[index];
  return from + (to - from) * (level - fromLevel) / (toLevel - fromLevel);
}

/** 診断の上端のLv(表のいちばん強いところ)。これより強い人も、ここまでで診断する。 */
export const MAX_DIAGNOSED_LEVEL = Math.ceil(LOG_LOSS_TABLES.desktop.at(-1)[0]);

/**
 * 平均損失(素の損、上限1000)を、Lv(小数)へ変換する(RAW_LOSS_TABLEの逆)。範囲外は両端のLvにそろえる。
 * 棋力診断は手の損の対数と勝ち負けで決める(estimateSkill)。これは、最近の対局の平均損失しかないR内容のための換算。
 */
export function levelForAverageLoss(loss) {
  const table = RAW_LOSS_TABLE;
  if (loss >= table[0][1]) return 0;
  if (loss <= table.at(-1)[1]) return table.at(-1)[0];
  const index = table.findIndex(([, average]) => average <= loss);
  const [fromLevel, from] = table[index - 1];
  const [toLevel, to] = table[index];
  return fromLevel + (toLevel - fromLevel) * (from - loss) / (from - to);
}

const presetForLevel = (level) => {
  const rounded = Math.min(MAX_LEVEL, Math.max(0, Math.round(level)));
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === rounded);
};

/**
 * 1手の損。指した手が、解析のいちばん良い手なら0、2番目の手なら同じ読みの中の差にする(kifu-analysis-pipeline.mjsのmeasureLoss)。
 * 古い解析(measureLossがない)は、着手前と着手後の評価値の差(loss)を使う。
 */
const lossOf = (measure) => (Number.isFinite(measure.measureLoss) ? measure.measureLoss : measure.loss);

/**
 * 診断に使える手(形勢に大差が付く前の手)の、評価値の損と着手前の形勢。測れる手が足りなかった対局から、
 * 次の対局へ持ち越すときに使う(下のcontinueMeasure)。
 * @param {any[]} points 棋譜解析の点
 * @param {'black' | 'white'} color 測定する側
 * @returns {{ loss: number, standing: number }[]}
 */
export function measurableMoves(points, color) {
  return (points ?? [])
    .map((point) => point.moveMeasure)
    .filter((measure) => measure && measure.mover === color && Math.abs(measure.standing) < DECIDED_STANDING)
    .map((measure) => ({ loss: lossOf(measure), standing: measure.standing }));
}

/**
 * Lv(0〜MAX_LEVEL、0.25刻み)ごとの起こりやすさから、推定のLv(平均)とばらつき(標準偏差)を出す。
 * 手の損: 対数の損の平均が、そのLvの表の値のまわりに、1手のばらつき/√手数と局ごとのばらつきで散らばるとする。
 * 勝ち負け: 相手のLvとの差から、Elo式の勝つ確率(1Lv=R60)。引き分けは勝ちと負けの中間。
 * @param {{ logMean: number, count: number, results: { opponent: number, score: number }[], table: readonly (readonly number[])[] }} input
 */
function posteriorLevel({ logMean, count, results, table }) {
  const variance = MOVE_LOG_SD ** 2 / count + GAME_LOG_SD ** 2;
  let total = 0;
  let sum = 0;
  let squares = 0;
  for (let level = 0; level <= MAX_LEVEL; level += 0.25) {
    let weight = Math.exp(-((logMean - tableValue(table, level)) ** 2) / (2 * variance));
    for (const { opponent, score } of results) {
      const win = 1 / (1 + 10 ** (-(RATING_PER_LEVEL * (level - opponent)) / 400));
      weight *= score >= 1 ? win : score <= 0 ? 1 - win : Math.sqrt(win * (1 - win));
    }
    total += weight;
    sum += level * weight;
    squares += level * level * weight;
  }
  const mean = sum / total;
  return { level: mean, spread: Math.sqrt(Math.max(0, squares / total - mean * mean)) };
}

/**
 * @param {any[]} points 棋譜解析の点。moveMeasure({ mover, loss, measureLoss, standing })を持つ点だけを使う
 * @param {'black' | 'white'} color 診断する側
 * @param {{ loss: number, standing: number }[]} [carried] 前の測定対局から持ち越した手(measurableMoves)
 * @param {{
 *   results?: { opponent: number, score: number }[],
 *   plan?: 'desktop' | 'compact',
 * }} [options] results: 測定対局の勝ち負け(相手のLvと、勝ち1・引き分け0.5・負け0。持ち越した対局の分も)。
 *   plan: 解析の読みの深さ(PCかスマホ・タブレット縦か)。
 * @returns {{
 *   insufficient: boolean, count: number, averageLoss?: number, level?: number,
 *   rating?: number, ratingLow?: number, ratingHigh?: number, label?: string,
 *   reliability?: 'reference' | 'estimate' | 'stable',
 * }} insufficientが真のときは、countだけを持つ(測れる手が足りない)。
 */
export function estimateSkill(points, color, carried = [], { results = [], plan = 'desktop' } = {}) {
  const losses = [...measurableMoves(points, color), ...carried].map(({ loss }) => Math.min(LOSS_CAP, Math.max(0, loss)));
  const count = losses.length;
  if (count < MIN_MEASURED_MOVES) return { insufficient: true, count };
  const average = losses.reduce((sum, loss) => sum + loss, 0) / count;
  const logMean = losses.reduce((sum, loss) => sum + Math.log(loss + LOG_OFFSET), 0) / count;
  const table = LOG_LOSS_TABLES[plan] ?? LOG_LOSS_TABLES.desktop;
  const { level, spread } = posteriorLevel({ logMean, count, results, table });
  return {
    insufficient: false,
    count,
    averageLoss: Math.round(average),
    level,
    rating: levelRating(level),
    // 推定のばらつき(標準偏差)ぶんの幅。
    ratingLow: levelRating(Math.max(0, level - spread)),
    ratingHigh: levelRating(Math.min(MAX_LEVEL, level + spread)),
    label: presetForLevel(level).label,
    reliability: spread >= 7 ? 'reference' : spread >= 4 ? 'estimate' : 'stable',
  };
}

/**
 * 測れる手が足りなかったときに、続けて指す測定対局の数の上限(最初の1局を含む)。
 * 2局を合わせると、力の差が大きい組み合わせでもほぼ足りる(docs/skill-measure-design.mdの2章)。
 */
export const MAX_MEASURE_GAMES = 3;
/**
 * 続けて測るときに、相手のLvを動かす幅。勝ったら上げ、負けたら下げて、形勢が早く決まらない相手に近づける。
 * 段級位の作り直し(2026-10-22)の前は8(1LvあたりR80)。新しい表(R60)では、近い幅の6にする。
 */
export const MEASURE_LEVEL_STEP = 6;

/**
 * 測れる手が足りなかった対局の次に指す、測定対局の相手のLv。診断の範囲(Lv1〜診断の上端)に収める。
 * @param {{ level: number, outcome: 'win' | 'loss' | 'draw' }} options level: いまの相手のLv、outcome: プレイヤーから見た結果
 */
export function nextMeasureLevel({ level, outcome }) {
  const step = outcome === 'win' ? MEASURE_LEVEL_STEP : outcome === 'loss' ? -MEASURE_LEVEL_STEP : 0;
  return Math.min(Math.floor(MAX_DIAGNOSED_LEVEL), Math.max(1, level + step));
}

/**
 * 対局の保存から、棋力測定の状態(持ち越した手・はじめての案内の答え・測定の前の設定)を読み直す。
 * 形がおかしいものは捨てる。測定の対局でなければnull。
 * @param {unknown} value 保存した{ carry, welcome, settingsBefore }
 * @returns {{
 *   carry: { moves: { loss: number, standing: number }[], games: number, results: { opponent: number, score: number }[] } | null,
 *   welcome: '' | 'some' | 'player',
 *   settingsBefore: { [key: string]: unknown } | null,
 * } | null}
 */
export function restoredMeasureState(value) {
  if (!value || typeof value !== 'object') return null;
  const { carry, welcome, settingsBefore } = /** @type {{ [key: string]: any }} */ (value);
  const finite = (number) => typeof number === 'number' && Number.isFinite(number);
  const moves = Array.isArray(carry?.moves)
    ? carry.moves.filter((move) => finite(move?.loss) && finite(move?.standing)).map(({ loss, standing }) => ({ loss, standing }))
    : [];
  const games = Number.isInteger(carry?.games) ? Math.min(MAX_MEASURE_GAMES - 1, Math.max(0, carry.games)) : 0;
  const results = Array.isArray(carry?.results)
    ? carry.results
      .filter((result) => finite(result?.opponent) && [0, 0.5, 1].includes(result?.score))
      .map(({ opponent, score }) => ({ opponent, score }))
    : [];
  return {
    carry: games > 0 ? { moves, games, results } : null,
    welcome: welcome === 'some' || welcome === 'player' ? welcome : '',
    settingsBefore: settingsBefore && typeof settingsBefore === 'object' && !Array.isArray(settingsBefore) ? settingsBefore : null,
  };
}

/** 診断した棋力に近い、CPUのLvのレーティング(おすすめの強さの目安に使う)。 */
export function estimatedLevelRating(estimate) {
  return levelRating(presetForLevel(estimate.level).level);
}

/** 序盤・中盤・終盤を分ける手数。 */
const PHASES = [
  { key: 'opening', label: '序盤', until: 30 },
  { key: 'middle', label: '中盤', until: 80 },
  { key: 'ending', label: '終盤', until: Infinity },
];

/**
 * 棋力測定の結果に添える統計。診断と同じ手(形勢に大差が付いた局面を除く)から、局面ごとの平均損失と、
 * 悪手・好手の数、最も損をした手を数える。悪手・好手の数は、解析が付けた評価(classifyAnalyzedMove)を数える。
 * @param {any[]} points 棋譜解析の点
 * @param {'black' | 'white'} color 測定する側
 */
export function measureStatistics(points, color) {
  const own = (points ?? []).filter((point) => point.moveMeasure?.mover === color);
  const measured = own.filter((point) => Math.abs(point.moveMeasure.standing) < DECIDED_STANDING);
  const phases = PHASES.map(({ key, label, until }, index) => {
    const from = index === 0 ? 0 : PHASES[index - 1].until;
    const losses = measured
      .filter((point) => point.ply > from && point.ply <= until)
      .map((point) => Math.min(LOSS_CAP, point.moveMeasure.loss));
    return {
      key, label, count: losses.length,
      averageLoss: losses.length ? Math.round(losses.reduce((sum, loss) => sum + loss, 0) / losses.length) : null,
    };
  });
  const kinds = { blunder: 0, mistake: 0, dubious: 0, good: 0, brilliant: 0 };
  for (const point of own) {
    const kind = point.annotation?.kind;
    if (kind && kind in kinds) kinds[kind] += 1;
  }
  const worst = measured.reduce((max, point) => (!max || point.moveMeasure.loss > max.moveMeasure.loss ? point : max), null);
  return {
    moves: own.length,
    measuredMoves: measured.length,
    phases,
    kinds,
    worst: worst && worst.moveMeasure.loss >= 300
      ? { ply: worst.ply, label: worst.label ?? `${worst.ply}手目`, loss: Math.round(worst.moveMeasure.loss) }
      : null,
  };
}
