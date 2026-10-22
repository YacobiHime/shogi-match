// CPUの強さは「技量」(0〜1)という1つの値から、探索量や候補選択の設定を連続的に決める。
// 各レベルは、CPU同士の自動対局で従来の強さを目安に校正する（多少の弱化は許容）。
// (scripts/cpu-level-selfplay.mjs、docs/difficulty-calibration.md)。

const MIN_NODES = 50;
export const TOP_NODES = 480000;
/**
 * 最高技量(Lv40「藤井聡太並み」)だけの探索量とスレッド数。Lv1〜39の曲線(TOP_NODES)とは別に持つ。
 * 2026-10-02に48万から72万nodesへ1.5倍にし、2スレッドで読んで待ち時間を以前より短くした。
 */
const TOP_LEVEL_NODES = 720000;
const TOP_LEVEL_THREADS = 2;
/** これ未満の技量では、目に付く手だけを読む「視野の狭さ」で弱くする。 */
const VISION_SKILL_END = 0.6;
/**
 * この技量で、読まない手がなくなり、1手の損失上限と悪手の回数制限を常に守るようになる。
 * それ未満は、読まないLv0から段差なくつなぐための区間。
 */
const CAREFUL_SKILL_END = 0.05;
/** これ未満の技量では、浅い読みで良く見える悪手を選ぶ「見落とし」を混ぜる。 */
const OVERSIGHT_SKILL_END = 0.75;
/**
 * もとの校正のこのLv以下では、危険への態度(riskAttitude)を持つ。優勢・互角では道の細い最善手を避けて無難な手を、
 * 劣勢では相手が間違えやすい勝負手を選ぶ(cpu-move-choice.mjsのchooseRiskAwareMove)。
 */
export const RISK_MAX_LEVEL = 30;
/** 危険を見積もる追加探索の探索量の下限。 */
const RISK_PROBE_MIN_NODES = 1000;

/** 1手の損失上限の下限。見落とし(深い読みで300以上の損)を選べる幅を残す。 */
const MIN_MOVE_LOSS_CAP = 400;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
/** 設定表を読みやすくするため、上2桁に丸める。 */
const roundSignificant = (value) => {
  if (value < 100) return Math.round(value);
  const unit = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / unit) * unit;
};
const round2 = (value) => Math.round(value * 100) / 100;
const round3 = (value) => Math.round(value * 1000) / 1000;

/**
 * 技量(0〜1)から探索量と候補選択の設定を作る。0は探索しない自然さだけの着手、1は最善手だけの着手。
 * どの設定も技量が上がるほど強くなる方向にだけ動く。
 * - naturalMoveRate: 読まずに、合法手を自然さ^alphaで選ぶ割合。Lv0(技量0)だけが1で、ほかは0。
 * - visionWidth・engineVision: 目に付く手の数。自然さの上位visionWidth手と探索上位engineVision手だけを読んで選ぶ。
 * - alpha: 自然さの効き具合。oversight*: 浅い読みでは良く見える手を深い読みで検証して選ぶ「見落とし」。
 * - moveLossCap: 1手で失ってよい評価値の上限。blunderLimit・blunderCooldown: 大きな悪手の1局の回数と間隔(CPUの手数)。
 *   carefulRate: 上限と回数制限を守る手の割合。
 * - simplicity: 分かりやすい手(歩の取り合い・取り返し・交換・攻め)を好み、目的のない手を避ける度合い(0〜1)。
 */
export function strengthParametersForSkill(skill) {
  if (!Number.isFinite(skill)) throw new Error('技量は有限の数値にしてください');
  const s = clamp01(skill);
  if (s === 0) return { nodes: 0, multiPv: 1, maxScoreLoss: 0, bestMoveRate: 0, alpha: 1, naturalMoveRate: 1, simplicity: 1 };
  const nodes = roundSignificant(MIN_NODES * (TOP_NODES / MIN_NODES) ** s);
  if (s === 1) {
    return {
      nodes: TOP_LEVEL_NODES, searchThreads: TOP_LEVEL_THREADS,
      multiPv: 1, maxScoreLoss: 0, bestMoveRate: 1, alpha: 0, naturalMoveRate: 0,
    };
  }
  // 少ないノード数で大きなMultiPVにすると候補順位も評価値もノイズになるため、探索量に合わせて抑える。
  const widest = s < 0.5 ? 4 + Math.round(s * 8) : Math.round(8 - (s - 0.5) * 14);
  const multiPv = Math.max(2, Math.min(widest, Math.max(4, Math.ceil(Math.log2(nodes)))));
  const settings = {
    nodes,
    multiPv,
    maxScoreLoss: roundSignificant(1200 * (1 - s) ** 0.7),
    scoreTemperature: roundSignificant(1800 * (40 / 1800) ** s),
    bestMoveRate: round2(s ** 2),
    alpha: Math.round((1 - s) * 10) / 10,
    // 読まない手は、人間には「手ですらない」手に見えやすい。Lv0とのつなぎの区間にだけ残す。
    naturalMoveRate: s < CAREFUL_SKILL_END ? round2((1 - s / CAREFUL_SKILL_END) ** 1.5) : 0,
  };
  if (s < VISION_SKILL_END) {
    const progress = s / VISION_SKILL_END;
    Object.assign(settings, {
      visionWidth: Math.round(3 + 9 * progress),
      engineVision: Math.round(multiPv * progress ** 2),
    });
  }
  // 1手で失ってよい評価値の上限。見落とし・目に付いた手・候補の抽選のどれにも掛け、対局を台無しにする手を防ぐ。
  // 低レベルでも大駒をただで渡すほどの損(1,000超)はまれにし、上のレベルほど締める。
  const moveLossCap = roundSignificant(Math.max(MIN_MOVE_LOSS_CAP, 1300 * (1 - s) ** 3));
  // 危険への態度。弱いほど強く(1)、RISK_MAX_LEVELで半分になり、それより上のレベルでは持たない。
  const riskSkillEnd = CALIBRATION_PRESETS[RISK_MAX_LEVEL].skill;
  if (s <= riskSkillEnd) {
    Object.assign(settings, {
      riskAttitude: round2(1 - 0.5 * s / riskSkillEnd),
      riskProbeNodes: Math.max(RISK_PROBE_MIN_NODES, nodes),
    });
  }
  if (s < OVERSIGHT_SKILL_END) {
    const progress = s / OVERSIGHT_SKILL_END;
    Object.assign(settings, {
      oversightRate: round2(0.5 * (1 - progress)),
      oversightShallowLoss: roundSignificant(600 - 400 * progress),
      oversightNodes: roundSignificant(Math.min(70000, Math.max(3000, nodes * 5))),
      oversightMaxLoss: Math.min(moveLossCap, roundSignificant(3000 - 2100 * progress)),
    });
  }
  Object.assign(settings, {
    moveLossCap,
    carefulRate: round2(Math.min(1, s / CAREFUL_SKILL_END)),
    // 大きな悪手は1局で数回まで、続けて出さない。人間の級位者も悪手は指すが、毎回は崩れない。
    blunderLimit: Math.max(1, Math.round(5 * (1 - s) ** 4)),
    blunderCooldown: Math.round(3 + 14 * s),
    // 歩の取り合い・取り返し・駒の交換など、分かりやすい手と局面を好む度合い。
    simplicity: round2((1 - s) ** 1.5),
  });
  return settings;
}

/**
 * もとの校正(2026-09-27〜10-19のLv0〜40)。強さの設定(探索量・候補の選び方)は、このLv(小数も可)で引く。
 * 表示のLv(CPU_STRENGTH_PRESETS)は、2026-10-22の段級位の作り直し(docs/level-ladder-design.md)で、
 * このLvのどこの強さを使うか(source)を持つ形にした。表示名・識別値はこの表では使わない。
 * Lv1〜10はロジックAIで指していた(新しい表では使わない)。
 */
export const CALIBRATION_PRESETS = Object.freeze([
  { level: 0, value: 1000, skill: 0, label: '駒の動きを覚えたて' },
  { level: 1, value: 1100, skill: 0.002, label: '二十六級程度' },
  { level: 2, value: 1200, skill: 0.004, label: '二十五級程度' },
  { level: 3, value: 1300, skill: 0.007, label: '二十四級程度' },
  { level: 4, value: 1400, skill: 0.009, label: '二十三級程度' },
  { level: 5, value: 1500, skill: 0.011, label: '二十二級程度' },
  { level: 6, value: 1600, skill: 0.013, label: '二十一級程度' },
  { level: 7, value: 1800, skill: 0.015, label: '二十級程度' },
  { level: 8, value: 2000, skill: 0.017, label: '十九級程度' },
  { level: 9, value: 3000, skill: 0.02, label: '十八級程度' },
  { level: 10, value: 4000, skill: 0.022, label: '十七級程度' },
  { level: 11, value: 4500, skill: 0.024, label: '十六級程度' },
  { level: 12, value: 5000, skill: 0.026, label: '十五級程度' },
  { level: 13, value: 6000, skill: 0.051, label: '十四級程度' },
  { level: 14, value: 7000, skill: 0.067, label: '十三級程度' },
  { level: 15, value: 8000, skill: 0.084, label: '十二級程度' },
  { level: 16, value: 10000, skill: 0.101, label: '十一級程度' },
  { level: 17, value: 12000, skill: 0.115, label: '十級程度' },
  { level: 18, value: 15000, skill: 0.13, label: '九級程度' },
  { level: 19, value: 20000, skill: 0.145, label: '八級程度' },
  { level: 20, value: 25000, skill: 0.165, label: '七級程度' },
  { level: 21, value: 30000, skill: 0.188, label: '六級程度' },
  { level: 22, value: 60000, skill: 0.207, label: '五級程度' },
  { level: 23, value: 65000, skill: 0.222, label: '五級程度' },
  { level: 24, value: 70000, skill: 0.238, label: '四級程度' },
  { level: 25, value: 75000, skill: 0.253, label: '四級程度' },
  { level: 26, value: 80000, skill: 0.267, label: '三級程度' },
  { level: 27, value: 90000, skill: 0.281, label: '三級程度' },
  { level: 28, value: 100000, skill: 0.295, label: '二級程度' },
  { level: 29, value: 125000, skill: 0.311, label: '二級程度' },
  { level: 30, value: 150000, skill: 0.328, label: '一級程度' },
  { level: 31, value: 175000, skill: 0.344, label: '一級程度' },
  { level: 32, value: 225000, skill: 0.437, label: 'アマ初段程度' },
  { level: 33, value: 265000, skill: 0.53, label: 'アマ二段程度' },
  { level: 34, value: 320000, skill: 0.638, label: 'アマ三段程度' },
  { level: 35, value: 400000, skill: 0.72, label: 'アマ四段程度' },
  { level: 36, value: 424000, skill: 0.801, label: 'アマ五段程度' },
  { level: 37, value: 440000, skill: 0.858, label: 'アマ六段程度' },
  { level: 38, value: 456000, skill: 0.915, label: 'アマ七段程度' },
  { level: 39, value: 472000, skill: 0.972, label: 'プロ級' },
  { level: 40, value: 480000, skill: 1, label: '藤井聡太並み' },
].map((preset) => Object.freeze(preset)));

/** もとの校正のLv(小数)での技量。整数のLvの間は直線で補う。 */
export function calibrationSkill(source) {
  const level = Math.min(40, Math.max(0, Number(source) || 0));
  const lo = Math.floor(level);
  const hi = Math.ceil(level);
  const low = CALIBRATION_PRESETS[lo].skill;
  return hi === lo ? low : round3(low + (CALIBRATION_PRESETS[hi].skill - low) * (level - lo));
}

/**
 * 表示のLvと段級位(2026-10-22の作り直し。docs/level-ladder-design.md)。
 * - Lv0はそのまま、Lv1〜15は15級〜1級(1級位に1Lv)、Lv16〜35はアマ初段〜七段(六段までは1つの段に3Lv、七段は2Lv)、
 *   Lv36〜39はプロの道、Lv40「藤井聡太並み」は設定を変えない。
 * - sourceは、もとの校正(CALIBRATION_PRESETS)のどのLv(小数)の強さを使うか。自己対局で隣の差が等しくなるように測って決める
 *   (docs/difficulty-calibration.md の2026-10-22の節)。skillはsourceでの技量(棋風の詰みの見え方などに使う)。
 * - valueは既存URL(engine_nodes)・保存データとの互換用識別値で、実探索量ではない。前の表と同じ名前のLvには、前の値を引き継ぐ。
 * @type {[level: number, value: number, source: number, label: string][]}
 */
const LADDER = [
  [0, 1000, 0, '駒の動きを覚えたて'],
  [1, 5000, 11.93, '15級程度'],
  [2, 6000, 12.08, '14級程度'],
  [3, 7000, 12.15, '13級程度'],
  [4, 8000, 12.29, '12級程度'],
  [5, 10000, 12.47, '11級程度'],
  [6, 12000, 12.58, '10級程度'],
  [7, 15000, 12.67, '9級程度'],
  [8, 20000, 12.79, '8級程度'],
  [9, 25000, 12.89, '7級程度'],
  [10, 30000, 13.6, '6級程度'],
  [11, 60000, 14.9, '5級程度'],
  [12, 70000, 20.2, '4級程度'],
  [13, 80000, 28.98, '3級程度'],
  [14, 100000, 30.78, '2級程度'],
  [15, 150000, 31.75, '1級程度'],
  [16, 200000, 32.45, 'アマ初段程度'],
  [17, 225000, 33.05, 'アマ初段程度'],
  [18, 240000, 33.29, 'アマ初段程度'],
  [19, 250000, 33.53, 'アマ二段程度'],
  [20, 265000, 33.76, 'アマ二段程度'],
  [21, 280000, 34, 'アマ二段程度'],
  [22, 300000, 34.55, 'アマ三段程度'],
  [23, 320000, 35.03, 'アマ三段程度'],
  [24, 340000, 35.24, 'アマ三段程度'],
  [25, 360000, 35.44, 'アマ四段程度'],
  [26, 400000, 35.65, 'アマ四段程度'],
  [27, 408000, 35.85, 'アマ四段程度'],
  [28, 416000, 36.05, 'アマ五段程度'],
  [29, 424000, 36.26, 'アマ五段程度'],
  [30, 432000, 36.47, 'アマ五段程度'],
  [31, 436000, 36.68, 'アマ六段程度'],
  [32, 440000, 36.89, 'アマ六段程度'],
  [33, 448000, 37.16, 'アマ六段程度'],
  [34, 456000, 37.48, 'アマ七段程度'],
  [35, 464000, 37.8, 'アマ七段程度'],
  [36, 466000, 38.11, '奨励会三段程度'],
  [37, 468000, 38.41, '若手プロ程度'],
  [38, 470000, 38.7, 'トッププロ程度'],
  [39, 472000, 39, 'タイトル保持者程度'],
  [40, 480000, 40, '藤井聡太並み'],
];
export const CPU_STRENGTH_PRESETS = Object.freeze(LADDER.map(([level, value, source, label]) => Object.freeze({
  level, value, source, skill: calibrationSkill(source), label,
})));

/**
 * 今の表にない識別値を、同じ段級位(なくなった級は15級)のレベルへ対応付ける。
 * - 2026-10-22の作り直しで、26級〜16級(1100〜4500)をなくし、5級〜1級の2つ目のLv(65000など)を1つにした。
 * - それより前(2026-10-07)に、重なっていたアマ段位を1段位1レベルにしたときの値は、作り直しで同じ段の値に戻った。
 */
const LEGACY_STRENGTH_VALUES = new Map([
  ...[1100, 1200, 1300, 1400, 1500, 1600, 1800, 2000, 3000, 4000, 4500].map((value) => [value, 5000]),
  [65000, 60000],
  [75000, 70000],
  [90000, 80000],
  [125000, 100000],
  [175000, 150000],
]);
export const DEFAULT_STRENGTH_VALUE = 30000;

/** URL・保存データの強さ指定を、表示中のプリセットの識別値へ丸める。 */
export function normalizeStrengthValue(value) {
  if (!Number.isFinite(value)) return DEFAULT_STRENGTH_VALUE;
  if (LEGACY_STRENGTH_VALUES.has(value)) return LEGACY_STRENGTH_VALUES.get(value);
  return CPU_STRENGTH_PRESETS.reduce((nearest, { value: candidate }) => (
    Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest
  ), DEFAULT_STRENGTH_VALUE);
}

/** 識別値に対応するプリセットを返す。 */
export function strengthPresetFor(value) {
  const normalized = normalizeStrengthValue(value);
  return CPU_STRENGTH_PRESETS.find((preset) => preset.value === normalized);
}

/** Lv0は評価探索を使わず、合法手を自然さだけで選ぶ。 */
export function usesNaturalMoveOnly(preset) {
  return strengthPresetFor(preset).skill === 0;
}

/** 技量から、着手選択が使う形の設定を返す。自動対局の校正でも使う。 */
export function searchSettingsForSkill(skill) {
  const settings = strengthParametersForSkill(skill);
  const result = {
    nodes: settings.nodes,
    multiPv: settings.multiPv,
    // 上位の自然な手を除外しないよう全レベルで1位から選ぶ。弱さは温度と最善手率で調整する。
    moveRank: { min: 1, max: settings.multiPv },
    maxScoreLoss: settings.maxScoreLoss,
    bestMoveRate: settings.bestMoveRate,
    naturalnessAlpha: settings.alpha,
    naturalMoveRate: settings.naturalMoveRate,
    oversightRate: settings.oversightRate ?? 0,
    oversightShallowLoss: settings.oversightShallowLoss ?? 0,
    oversightNodes: settings.oversightNodes ?? 0,
    oversightMaxLoss: settings.oversightMaxLoss ?? 0,
    // 作戦の定跡手を評価値より優先する幅の倍率。低レベルほど、多少悪くても決めた形を作り続ける。
    openingPlanScoreScale: Math.round((1 + 2 * (1 - clamp01(skill))) * 100) / 100,
    // 探索スレッド数の上限。端末のコア数に合わせてさらに減らす。
    searchThreads: settings.searchThreads ?? 1,
    // 旧設定との互換キー。一様ランダムの着手は廃止したため常に無効。
    randomLegalRate: 0,
    randomFallback: false,
  };
  if (Number.isFinite(settings.scoreTemperature)) result.scoreTemperature = settings.scoreTemperature;
  // 最高技量は最善手だけを指すため、悪手の上限や素人らしさを持たない。
  for (const key of [
    'visionWidth', 'engineVision', 'riskAttitude', 'riskProbeNodes', 'moveLossCap', 'carefulRate', 'blunderLimit', 'blunderCooldown', 'simplicity',
  ]) {
    if (Number.isFinite(settings[key])) result[key] = settings[key];
  }
  return result;
}

/** UIの強さ識別値から探索量と候補選択設定を返す。 */
export function getStrengthSearchSettings(preset) {
  const selected = strengthPresetFor(preset);
  // Lv0(読まない)とLv40(藤井聡太並み)は、技量の曲線の両端のまま。
  if (selected.level === 0 || selected.level >= 40) return searchSettingsForSkill(selected.skill);
  if (LOGIC_HYBRID_DEFAULT) return sourceLevelSettings(selected.source);
  return { ...searchSettingsForSkill(selected.skill), ...hybridSettingsForLevel(selected.source) };
}

/**
 * 表示のLvが、もとの校正のどのLv(小数)の強さを使うか(CPU_STRENGTH_PRESETSのsource)。
 * 2026-10-21の低級帯の付け替えを、2026-10-22の段級位の作り直しで全部のLvに広げた。
 * @param {number} level 表示のLv
 */
export function sourceLevelOf(level) {
  return CPU_STRENGTH_PRESETS.find((preset) => preset.level === level)?.source ?? 0;
}

/** もとの校正(段階4)の、整数のLvの設定。 */
function calibratedSettingsAtLevel(level) {
  return calibratedHybridSearchSettings(level, searchSettingsForSkill(CALIBRATION_PRESETS[level].skill));
}

/** 2つの設定を、数は直線で(どちらも整数なら整数に丸める)、入れ子はそれぞれ、それ以外は近いほうで混ぜる。 */
function blendSettings(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') {
    const value = a + (b - a) * t;
    return Number.isInteger(a) && Number.isInteger(b) ? Math.round(value) : Math.round(value * 1000) / 1000;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((key) => [key, blendSettings(a[key], b[key], t)]));
  }
  if (a === undefined) return b;
  if (b === undefined) return a;
  return t < 0.5 ? a : b;
}

/**
 * もとの校正のLv(小数、11〜39)の設定。整数のLvの間は、2つの設定を混ぜる(Lv12とLv13の段差をなだらかにつなぐ)。
 * @param {number} source
 */
export function sourceLevelSettings(source) {
  const level = Math.min(39, Math.max(11, source));
  const lo = Math.floor(level);
  const hi = Math.ceil(level);
  const low = calibratedSettingsAtLevel(lo);
  if (hi === lo) return low;
  return blendSettings(low, calibratedSettingsAtLevel(hi), level - lo);
}

/**
 * 同じLvの旧CPUとの自動対局で調整した、目的のある候補の読み方。
 * @param {number} level
 * @param {ReturnType<typeof searchSettingsForSkill>} settings 技量の曲線から作った、校正前の設定。
 */
export function calibratedHybridSearchSettings(level, settings) {
  if (!(level >= 11 && level <= 39)) return settings;
  const nodeScale = level <= 30 ? 1 : level <= 35 ? 1 - 0.5 * (level - 30) / 5 : 0.5 + 0.4 * (level - 35) / 4;
  const temperatureScale = level <= 15 ? 1 - 0.35 * (level - 11) / 4 : level <= 30 ? 0.65
    : level <= 35 ? Math.max(0.001, 0.65 * (35 - level) / 5) : (level - 35) / 4;
  const floor = level === 12 ? 63 : level === 13 ? 350 : level <= 15 ? 62 + (level - 11) * 109.5 : level <= 20 ? 500 + (level - 15) * 40 : 700;
  const shallowAnchors = [[11, 0.85], [12, 0.83], [13, 0.32], [14, 0.3], [15, 0.2], [20, 0]];
  const upper = Math.max(1, shallowAnchors.findIndex(([point]) => point >= Math.min(20, level)));
  const [lo, a] = shallowAnchors[upper - 1];
  const [hi, b] = shallowAnchors[upper];
  const multiPv = level >= 35 ? Math.min(3, settings.multiPv) : settings.multiPv;
  return {
    ...settings, ...hybridSettingsForLevel(level), logicHybrid: true,
    nodes: Math.round(Math.max(floor, settings.nodes * nodeScale)), multiPv,
    moveRank: { min: 1, max: multiPv },
    candidateNodes: level === 39 ? Math.max(1000, Math.round(settings.nodes * nodeScale * 0.1)) : undefined,
    scoreTemperature: Math.max(1, Math.round(settings.scoreTemperature * temperatureScale)),
    consistentCandidateScores: true, trustedEngineRate: level >= 35 ? 0.99 - 0.05 * (level - 35) / 4 : 0,
    shallowReadRate: level >= 20 ? 0 : a + (b - a) * (level - lo) / (hi - lo),
    shallowTemperature: level === 11 ? 360 : level === 12 ? 320 : level === 13 ? 175 : level >= 15 ? 70 : 420 - (level - 11) * 87.5,
    shallowDepth: level <= 12 ? 1 : level < 15 ? 2 : 4,
  };
}

/**
 * ロジックAI(logic-ai.mjsのLv1〜10)で指すLv。段級位の作り直し(2026-10-22)で、新しい表のLv1(15級)がエンジンで指す強さになり、
 * ロジックAIで指すLvはなくなった(null)。ファイルは、教室の練習相手などに使い道が出たときのために残す。
 * @type {number | null}
 */
export const CPU_LOGIC_AI_LEVEL = null;

/** 全対局で目的と局面の気づきを使う。比較用の旧方式は開発スクリプト内だけに残す。 */
export const LOGIC_HYBRID_DEFAULT = true;

/** Lv11〜39の気づき・エンジン候補の視認・ロジックの重み。点の間は直線で補う。 */
export function hybridSettingsForLevel(level) {
  const anchors = [11, 20, 30, 35, 39];
  const lv = Math.max(11, Math.min(39, Number(level) || 11));
  const upper = Math.max(1, anchors.findIndex((point) => point >= lv));
  const t = (lv - anchors[upper - 1]) / (anchors[upper] - anchors[upper - 1]);
  const interpolate = (values) => values[upper - 1] + (values[upper] - values[upper - 1]) * t;
  const engineBestVisibility = interpolate([0.25, 0.65, 0.9, 0.98, 0.995]);
  const perception = {};
  // Lv10の気づきからLv20の1.0へつなぐ。Lv11はLv10の値から始める。
  for (const [key, value] of Object.entries({
    freeCapture: 0.95, hangingLastMoveMajor: 0.98, hangingLastMoveMinor: 0.92,
    hanging: 0.85, exchange: 0.75, threat: 0.55, mate1: 0.9, mate3: 0.3, defendMate: 0.8, followPlan: 0.95,
  })) perception[key] = value + (1 - value) * Math.min(1, (lv - 11) / 9);
  return {
    logicHybrid: LOGIC_HYBRID_DEFAULT, engineBestVisibility, engineTopVisibility: engineBestVisibility / 2,
    logicBonusCap: interpolate([200, 120, 60, 40, 20]),
    takePolicyRate: interpolate([0.48, 0.3, 0.1, 0, 0]), perception,
  };
}
