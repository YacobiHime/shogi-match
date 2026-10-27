// 棋力(このゲームのCPUと五分に指せるLv)を、CPUとの対局の勝ち負けと、指した手の評価値の損から推定する
// (2026-10-27の作り直し。docs/skill-measure-design.mdの11章)。勝ち負け(測定の対局と、測る前の実績)と、
// 最初に選んだ目安の幅が本体で、手の損は少ない局数で絞り込む補助。結果は目安として扱う。
// 損とLvの対応は、強さの分かっているCPUどうしの対局を、アプリと同じ段階解析で読んで作った表で決める(7・8章)。

import { levelRating } from './player-rating.mjs';
import { CPU_STRENGTH_PRESETS } from './strength-settings.mjs';

/** 1手の損失の上限。1手の大悪手で平均が崩れすぎないようにする。 */
const LOSS_CAP = 1000;
/** 着手前の形勢がこれ以上(どちら向きでも)の局面は、差が付いていて評価値の損が測りにくいので除く。 */
const DECIDED_STANDING = 1500;
/** 勝ち負けがないとき(ふだんの対局の解析)に、手の損だけで診断するのに要る手の数の下限。 */
export const MIN_MEASURED_MOVES = 10;
/** 勝ち負けがあるときに、手の損も合わせて使う手の数の下限。これより少なければ、勝ち負けと目安だけで診断する。 */
const MIN_MOVES_WITH_RESULTS = 6;
/**
 * 手の損を数えるのは、この手数より後の手だけ。人は定跡を覚えていて序盤の損がほとんどないが、表を作った弱いCPUは
 * 定跡を知らず序盤でも損をするので、序盤の手を数えると人が強く出すぎる(序盤24手を損0にすると平均+9Lv。11章)。
 */
export const OPENING_PLY = 30;
/**
 * 手の損の重み(分散を1/重みに広げる)。手の損の表はCPUの間違い方から作ったもので、人の間違い方(小さな損が少なく、
 * ときどき大悪手)では強めに出る。勝ち負けと目安を本体にし、手の損は絞り込みの補助にする(11章)。
 */
const MOVE_WEIGHT = 1 / 3;
/** 最初に選んだ目安の幅の外側の裾(標準偏差、Lv)。幅を間違えて選んでも、勝ち負けで戻れるように。 */
const BAND_TAIL = 5;
/** 測る前の実績として数える、最近のCPUとの対局の数(レーティングの履歴から)。 */
export const PRIOR_HISTORY_GAMES = 15;
/** 1手の損を対数にするときに足す値(損0の手を扱えるように)。 */
const LOG_OFFSET = 10;
/**
 * 勝ち負けの起こりやすさの、1Lvあたりのレーティング差。段級位の表は1Lv＝R60だが、測定のまねの96局の勝ち負けに
 * Elo式を当てはめると、1Lvあたり約R75だった(2026-10-25。docs/skill-measure-design.mdの8章)。
 */
const RATING_PER_LEVEL = 75;
const MAX_LEVEL = CPU_STRENGTH_PRESETS.at(-1).level;

/**
 * Lvごとの「1手の損(上限1000)＋10」の対数の平均を、中盤(31〜80手目)・終盤に分けた表
 * (単調に減るようにならした表、[Lv, 値])。終盤は損が大きいので、その手の局面の表と比べる。
 * 序盤(30手目まで)の手は数えない(OPENING_PLY)ので、序盤の表は持たない。
 * 強さの分かっているCPU(Lv1〜48)どうしの96局を、アプリと同じ段階解析で読み、両方の側の手を数えた(2026-10-25)。
 * desktopはPCの解析(全局面2万ノード)、compactはスマホ・タブレット縦の解析(全局面6千ノード)。読みが浅いと損が大きく出るので分ける。
 * Lv36より上は損がほとんど変わらない(解析の読みより強い手の違いは見分けられない)。そこは勝ち負けで補う。
 */
export const LOG_LOSS_TABLES = Object.freeze({
  desktop: Object.freeze({
    middle: Object.freeze([[2.3, 6.25], [6, 6.17], [9, 5.39], [12, 5.33], [14, 5.07], [17, 4.78], [20, 4.7], [22, 4.08], [27, 4.01], [32, 3.75], [34, 3.72], [36, 3.27], [40, 3.26], [44, 3.1], [46, 3.07], [48, 2.96]]),
    ending: Object.freeze([[1, 6.25], [7, 6.18], [24, 4.52], [30, 4.15], [35, 3.72], [42, 3.34], [47, 3.13]]),
  }),
  compact: Object.freeze({
    middle: Object.freeze([[2.3, 6.28], [6, 5.99], [9, 5.32], [12, 5.16], [15, 4.96], [18, 4.83], [20, 4.68], [22, 4.1], [24, 3.99], [28, 3.97], [32, 3.69], [34, 3.66], [36, 3.58], [40, 3.35], [45, 3.18], [48, 3.15]]),
    ending: Object.freeze([[1, 6.16], [8.4, 6.07], [28.7, 4.22], [34, 3.95], [37, 3.9], [40, 3.45], [45, 3.38]]),
  }),
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
export const MAX_DIAGNOSED_LEVEL = 47;

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
 * 診断に使える手(形勢に大差が付く前の手)の、評価値の損・着手前の形勢・手数。測れる手が足りなかった対局から、
 * 次の対局へ持ち越すときにも使う(continueMeasure)。
 * @param {any[]} points 棋譜解析の点
 * @param {'black' | 'white'} color 測定する側
 * @returns {{ loss: number, standing: number, ply: number }[]}
 */
export function measurableMoves(points, color) {
  return (points ?? [])
    .filter((point) => point.moveMeasure && point.moveMeasure.mover === color && Math.abs(point.moveMeasure.standing) < DECIDED_STANDING)
    .map((point) => ({ loss: lossOf(point.moveMeasure), standing: point.moveMeasure.standing, ply: point.ply }));
}

/** 手数から、中盤・終盤の表の名前(PHASESと同じ区切り)。手数の分からない古い持ち越しの手は中盤。 */
function phaseKeyOf(ply) {
  if (!Number.isFinite(ply)) return 'middle';
  return ply <= PHASES[1].until ? 'middle' : 'ending';
}

/** 手の損を数える手か(序盤の手は数えない)。手数の分からない古い持ち越しの手は数える。 */
const countsMove = (/** @type {{ ply?: number }} */ { ply }) => !Number.isFinite(ply) || /** @type {number} */ (ply) > OPENING_PLY;

/** 勝ち負けの起こりやすさ。相手のLvとの差から、Elo式の勝つ確率(1Lv＝RATING_PER_LEVEL)。引き分けは勝ちと負けの中間。 */
function resultLikelihood(level, { opponent, score }) {
  const win = 1 / (1 + 10 ** (-(RATING_PER_LEVEL * (level - opponent)) / 400));
  return score >= 1 ? win : score <= 0 ? 1 - win : Math.sqrt(win * (1 - win));
}

/**
 * Lv(0〜MAX_LEVEL、0.25刻み)ごとの起こりやすさから、推定のLv(平均)とばらつき(標準偏差)を出す。
 * 目安の幅: 幅の中は同じ、外は裾(BAND_TAIL)で下がる。
 * 勝ち負け: 測定の対局と、測る前の実績(resultLikelihood)。
 * 手の損: 対数の損の平均が、そのLvで、指した手の局面(中盤・終盤)の表の値を手数で平均した値のまわりに、
 * 1手のばらつき/√手数と局ごとのばらつきを1/MOVE_WEIGHTに広げた幅で散らばるとする。手の損を使わないときはcount 0。
 * @param {{
 *   logMean: number, count: number, phaseCounts: { [key: string]: number },
 *   results: { opponent: number, score: number }[], tables: { [key: string]: readonly (readonly number[])[] },
 *   band: readonly number[] | null,
 * }} input
 */
function posteriorLevel({ logMean, count, phaseCounts, results, tables, band }) {
  const variance = (MOVE_LOG_SD ** 2 / Math.max(1, count) + GAME_LOG_SD ** 2) / MOVE_WEIGHT;
  let total = 0;
  let sum = 0;
  let squares = 0;
  for (let level = 0; level <= MAX_LEVEL; level += 0.25) {
    let weight = 1;
    if (band) {
      const outside = level < band[0] ? band[0] - level : level > band[1] ? level - band[1] : 0;
      weight *= Math.exp(-(outside ** 2) / (2 * BAND_TAIL ** 2));
    }
    if (count) {
      const expected = Object.entries(phaseCounts)
        .reduce((acc, [key, phaseCount]) => acc + phaseCount * tableValue(tables[key], level), 0) / count;
      weight *= Math.exp(-((logMean - expected) ** 2) / (2 * variance));
    }
    for (const result of results) weight *= resultLikelihood(level, result);
    total += weight;
    sum += level * weight;
    squares += level * level * weight;
  }
  const mean = sum / total;
  return { level: mean, spread: Math.sqrt(Math.max(0, squares / total - mean * mean)) };
}

/**
 * 測る前の目安。最初に選んだ札の幅と、最近のCPUとの対局の勝ち負け(レーティングの履歴。最大PRIOR_HISTORY_GAMES局)。
 * 測定を始めるときに作って、続けて測る間は持ち越す(測定の対局そのものは、勝ち負けとして別に数える)。
 * @param {{ band?: readonly number[] | null, history?: readonly any[] }} [input]
 *   history: レーティングの履歴(player-rating.mjsのhistory。opponentLevelとoutcomeを持つ対局だけを数える)
 * @returns {{ band: number[] | null, results: { opponent: number, score: number }[] }}
 */
export function measurePrior({ band = null, history = [] } = {}) {
  const scores = /** @type {{ [key: string]: number }} */ ({ win: 1, draw: 0.5, loss: 0 });
  const results = (history ?? [])
    .filter((entry) => Number.isFinite(entry?.opponentLevel) && entry.opponentLevel >= 1 && entry.outcome in scores)
    .slice(-PRIOR_HISTORY_GAMES)
    .map((entry) => ({ opponent: entry.opponentLevel, score: scores[entry.outcome] }));
  const validBand = Array.isArray(band) && band.length === 2 && band.every(Number.isFinite) && band[0] <= band[1];
  return { band: validBand ? [band[0], band[1]] : null, results };
}

/**
 * @param {any[]} points 棋譜解析の点。moveMeasure({ mover, loss, measureLoss, standing })を持つ点だけを使う
 * @param {'black' | 'white'} color 診断する側
 * @param {{ loss: number, standing: number, ply?: number }[]} [carried] 前の測定対局から持ち越した手(measurableMoves)
 * @param {{
 *   results?: { opponent: number, score: number }[],
 *   plan?: 'desktop' | 'compact',
 *   prior?: { band?: readonly number[] | null, results?: { opponent: number, score: number }[] } | null,
 * }} [options] results: 測定対局の勝ち負け(相手のLvと、勝ち1・引き分け0.5・負け0。持ち越した対局の分も)。
 *   plan: 解析の読みの深さ(PCかスマホ・タブレット縦か)。prior: 測る前の目安(measurePrior)。
 * @returns {{
 *   insufficient: boolean, count: number, averageLoss?: number | null, level?: number, spread?: number,
 *   rating?: number, ratingLow?: number, ratingHigh?: number, label?: string,
 *   reliability?: 'reference' | 'estimate' | 'stable',
 * }} countは手の損を数えた手の数(序盤を除く)。insufficientが真のときは、countだけを持つ
 *   (勝ち負けがなく、手の損だけでは手が足りない)。
 */
export function estimateSkill(points, color, carried = [], { results = [], plan = 'desktop', prior = null } = {}) {
  const moves = [...measurableMoves(points, color), ...carried]
    .filter(countsMove)
    .map(({ loss, ply }) => ({ loss: Math.min(LOSS_CAP, Math.max(0, loss)), phase: phaseKeyOf(ply) }));
  const count = moves.length;
  if (!results.length && count < MIN_MEASURED_MOVES) return { insufficient: true, count };
  // 勝ち負けがあるときは、手が少なければ手の損を使わない(勝ち負けと目安だけで診断する)。
  const used = count >= (results.length ? MIN_MOVES_WITH_RESULTS : MIN_MEASURED_MOVES) ? moves : [];
  const average = count ? moves.reduce((sum, { loss }) => sum + loss, 0) / count : null;
  const logMean = used.length ? used.reduce((sum, { loss }) => sum + Math.log(loss + LOG_OFFSET), 0) / used.length : 0;
  const phaseCounts = used.reduce((counts, { phase }) => ({ ...counts, [phase]: (counts[phase] ?? 0) + 1 }), /** @type {{ [key: string]: number }} */ ({}));
  const tables = LOG_LOSS_TABLES[plan] ?? LOG_LOSS_TABLES.desktop;
  const { level, spread } = posteriorLevel({
    logMean,
    count: used.length,
    phaseCounts,
    results: [...(prior?.results ?? []), ...results],
    tables,
    band: prior?.band ?? null,
  });
  return {
    insufficient: false,
    count,
    averageLoss: average === null ? null : Math.round(average),
    level,
    spread,
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
 * 棋力測定の最初の相手を決める札(docs/skill-measure-design.mdの9章)。自分で選んだ目安の幅の、下の方のLvから始める。
 * 前は、はじめての案内からLv24(1級)で始め、強すぎて萎えることがあった。思っているより下げるのが、たいてい正しい(G:4-10)。
 * 弱すぎたら、続けて測るとき(measureFollowUp)に相手を上げる。
 * level: 最初の相手のLv(段級位の表のLv)。band: 札の目安の幅(Lv)。診断の事前の目安にする(measurePrior。11章)。
 */
export const MEASURE_START_CHOICES = Object.freeze([
  Object.freeze({ id: 'new', label: '指し始めたばかり', description: '駒の動きは分かる。対局はまだあまりしていない', level: 4, band: Object.freeze([1, 9]) }),
  Object.freeze({ id: 'kyu-low', label: '15級〜10級くらい', description: '囲いを組んで指せる。駒をタダで取られることもある', level: 11, band: Object.freeze([10, 15]) }),
  Object.freeze({ id: 'kyu', label: '9級〜1級くらい', description: '戦法と囲いを組んで、終盤まで指せる', level: 17, band: Object.freeze([16, 24]) }),
  Object.freeze({ id: 'dan', label: '初段以上', description: '定跡を知っている。道場やアプリで段を持っている', level: 26, band: Object.freeze([25, MAX_DIAGNOSED_LEVEL]) }),
]);
/** 今までの記録から始めるとき、記録のLvから下げる幅(上と同じく、少しやさしい相手から)。 */
export const MEASURE_START_RATED_OFFSET = 2;

/**
 * 棋力測定の最初の相手の札。対局の記録(レーティング)がある人には、いちばん上に「いつもの強さから」を足す。
 * 札ごとに、最初の相手の段級位(「21級くらい」)を添える(押す前に相手が分かるように)。
 * 「いつもの強さから」は目安の幅を持たない(実績の勝ち負けを目安にする。measurePrior)。
 * @param {{ ratedLevel?: number | null }} [options] ratedLevel: レーティングに当たるLv。記録がなければnull
 * @returns {{ id: string, label: string, description: string, level: number, opponent: string, band: readonly number[] | null }[]}
 */
export function measureStartChoices({ ratedLevel = null } = {}) {
  const opponentOf = (/** @type {number} */ level) => gradeOf(level);
  const choices = MEASURE_START_CHOICES.map((choice) => ({ ...choice, opponent: opponentOf(choice.level) }));
  if (ratedLevel === null || !Number.isFinite(ratedLevel)) return choices;
  const level = Math.min(Math.floor(MAX_DIAGNOSED_LEVEL), Math.max(1, Math.round(ratedLevel) - MEASURE_START_RATED_OFFSET));
  return [
    { id: 'rated', label: 'いつもの強さから', description: `今の記録は${gradeOf(Math.round(ratedLevel))}くらい`, level, opponent: opponentOf(level), band: null },
    ...choices,
  ];
}
/** Lvの段級位の名前(「21級」「アマ初段」)。 */
function gradeOf(/** @type {number} */ level) {
  const label = CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)?.label ?? '';
  return label.replace(/程度$/, '');
}

/**
 * 確かめの1局を勧める、推定の幅(標準偏差、Lv)。推定の幅がこれ以上なら、推定したLvの相手ともう1局指す
 * (上げ下げ式。勝てば上がり、負ければ下がる)。測定のまねの96局で、3局までこの決め方で指すと、
 * 平均2.8局で誤差1.7Lv(1局だけなら3.5Lv。docs/skill-measure-design.mdの11章)。
 */
export const CONFIRM_SPREAD = 3;

/**
 * 測定対局のあとに、もう1局指すかと、その相手のLv。
 * - 診断できない(勝ち負けがない): 勝ったら強く、負けたら弱くした相手ともう1局(kind: 'more')。
 * - 推定の幅が広い: 推定したLvの相手ともう1局(kind: 'confirm')。勝ち負けが五分になる相手ほど、結果から分かることが多い。
 *   勝てば推定が上がって次の相手も上がり、負ければ下がる(上げ下げ式。11章)。
 * 最初の1局を含めてMAX_MEASURE_GAMES局まで。それ以外はnull。
 * @param {{
 *   estimate: { insufficient: boolean, level?: number, spread?: number },
 *   games: number,
 *   opponent: number,
 *   outcome: 'win' | 'loss' | 'draw',
 * }} options games: この対局を含めて指した測定対局の数、opponent: この対局の相手のLv
 * @returns {{ kind: 'more' | 'confirm', level: number } | null}
 */
export function measureFollowUp({ estimate, games, opponent, outcome }) {
  if (games >= MAX_MEASURE_GAMES) return null;
  if (estimate.insufficient) return { kind: 'more', level: nextMeasureLevel({ level: opponent, outcome }) };
  if ((estimate.spread ?? 0) < CONFIRM_SPREAD || !Number.isFinite(estimate.level)) return null;
  return { kind: 'confirm', level: Math.min(MAX_DIAGNOSED_LEVEL, Math.max(1, Math.round(/** @type {number} */ (estimate.level)))) };
}

/**
 * 対局の保存から、棋力測定の状態(持ち越した手・はじめての案内の答え・測定の前の設定)を読み直す。
 * 形がおかしいものは捨てる。測定の対局でなければnull。
 * @param {unknown} value 保存した{ carry, welcome, settingsBefore, prior }
 * @returns {{
 *   carry: { moves: { loss: number, standing: number, ply?: number }[], games: number, results: { opponent: number, score: number }[] } | null,
 *   welcome: '' | 'some' | 'player',
 *   settingsBefore: { [key: string]: unknown } | null,
 *   prior: { band: number[] | null, results: { opponent: number, score: number }[] },
 * } | null}
 */
export function restoredMeasureState(value) {
  if (!value || typeof value !== 'object') return null;
  const { carry, welcome, settingsBefore, prior } = /** @type {{ [key: string]: any }} */ (value);
  const finite = (number) => typeof number === 'number' && Number.isFinite(number);
  const moves = Array.isArray(carry?.moves)
    ? carry.moves.filter((move) => finite(move?.loss) && finite(move?.standing)).map(({ loss, standing, ply }) => ({ loss, standing, ...(Number.isInteger(ply) ? { ply } : {}) }))
    : [];
  const games = Number.isInteger(carry?.games) ? Math.min(MAX_MEASURE_GAMES - 1, Math.max(0, carry.games)) : 0;
  const resultsOf = (/** @type {unknown} */ list) => (Array.isArray(list)
    ? list
      .filter((result) => finite(result?.opponent) && [0, 0.5, 1].includes(result?.score))
      .map(({ opponent, score }) => ({ opponent, score }))
    : []);
  const results = resultsOf(carry?.results);
  const band = Array.isArray(prior?.band) && prior.band.length === 2 && prior.band.every(finite) ? [prior.band[0], prior.band[1]] : null;
  return {
    carry: games > 0 ? { moves, games, results } : null,
    welcome: welcome === 'some' || welcome === 'player' ? welcome : '',
    settingsBefore: settingsBefore && typeof settingsBefore === 'object' && !Array.isArray(settingsBefore) ? settingsBefore : null,
    // 前の版の保存(目安なし)は、目安なしで測る。
    prior: { band, results: resultsOf(prior?.results).slice(-PRIOR_HISTORY_GAMES) },
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
