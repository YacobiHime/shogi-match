// CPUの強さは「技量」(0〜1)という1つの値から、探索量や候補選択の設定を連続的に決める。
// 各レベルの技量は、CPU同士の自動対局で隣接レベルの勝率差がそろうように校正する
// (scripts/cpu-level-selfplay.mjs、docs/difficulty-calibration.md)。

const MIN_NODES = 50;
const TOP_NODES = 480000;
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

// 表示名はぴよ将棋の段級位の目安(1レベルでR約80)に合わせる。
// valueは既存URL(engine_nodes)・保存データとの互換用識別値で、実探索量ではない。
// 旧版と同じ表示名のレベルには旧版の値を割り当て、名前の意味を保ったまま強さだけ正す。
// skillは校正結果。Lv0は探索せず自然さだけで選ぶ。
// 二十六〜十六級(Lv1〜11)は、Lv0と十五級の間を技量で等分した値で、自己対局では校正していない。
// この区間の強さの差は、主に読まない手の割合(約94%〜37%)の差である。
export const CPU_STRENGTH_PRESETS = [
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
];

/**
 * 今の表にない識別値を、同じ段級位のレベルへ対応付ける。
 * 2026-10-07に、重なっていたアマ段位を1段位1レベルにした。削ったレベルの値(旧版の初段〜四段の値を含む)は、
 * 同じ段位の残したレベルへ引き継ぐ。
 */
const LEGACY_STRENGTH_VALUES = new Map([
  [200000, 225000],
  [250000, 265000],
  [280000, 265000],
  [300000, 320000],
  [340000, 320000],
  [360000, 400000],
  [408000, 400000],
  [416000, 424000],
  [432000, 424000],
  [448000, 440000],
  [464000, 456000],
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
    'visionWidth', 'engineVision', 'moveLossCap', 'carefulRate', 'blunderLimit', 'blunderCooldown', 'simplicity',
  ]) {
    if (Number.isFinite(settings[key])) result[key] = settings[key];
  }
  return result;
}

/** UIの強さ識別値から探索量と候補選択設定を返す。 */
export function getStrengthSearchSettings(preset) {
  return searchSettingsForSkill(strengthPresetFor(preset).skill);
}
