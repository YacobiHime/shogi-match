// CPUの強さは「技量」(0〜1)という1つの値から、探索量や候補選択の設定を連続的に決める。
// 各レベルの技量は、CPU同士の自動対局で隣接レベルの勝率差がそろうように校正する
// (scripts/cpu-level-selfplay.mjs、docs/difficulty-calibration.md)。

const MIN_NODES = 50;
const TOP_NODES = 480000;
/** これ未満の技量では、読まずに見た目の自然さだけで指す手を混ぜる。 */
const NATURAL_MOVE_SKILL_END = 0.4;
/** これ未満の技量では、浅い読みで良く見える悪手を選ぶ「見落とし」を混ぜる。 */
const OVERSIGHT_SKILL_END = 0.75;

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
 * - naturalMoveRate: 読まずに、合法手を自然さ^alphaで選ぶ割合。駒をただで取られる手も含む。
 * - alpha: 自然さの効き具合。oversight*: 浅い読みでは良く見える手を深い読みで検証して選ぶ「見落とし」。
 */
export function strengthParametersForSkill(skill) {
  if (!Number.isFinite(skill)) throw new Error('技量は有限の数値にしてください');
  const s = clamp01(skill);
  if (s === 0) return { nodes: 0, multiPv: 1, maxScoreLoss: 0, bestMoveRate: 0, alpha: 1, naturalMoveRate: 1 };
  const nodes = roundSignificant(MIN_NODES * (TOP_NODES / MIN_NODES) ** s);
  if (s === 1) return { nodes, multiPv: 1, maxScoreLoss: 0, bestMoveRate: 1, alpha: 0, naturalMoveRate: 0 };
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
    // Lv0(常に読まない)から段差なく減らす。
    naturalMoveRate: s < NATURAL_MOVE_SKILL_END ? round2((1 - s / NATURAL_MOVE_SKILL_END) ** 1.8) : 0,
  };
  if (s < OVERSIGHT_SKILL_END) {
    const progress = s / OVERSIGHT_SKILL_END;
    Object.assign(settings, {
      oversightRate: round2(0.5 * (1 - progress)),
      oversightShallowLoss: roundSignificant(600 - 400 * progress),
      oversightNodes: roundSignificant(Math.min(70000, Math.max(3000, nodes * 5))),
      oversightMaxLoss: roundSignificant(3000 - 2100 * progress),
    });
  }
  return settings;
}

// 表示名はぴよ将棋の段級位の目安(1レベルでR約80)に合わせる。
// valueは既存URL(engine_nodes)・保存データとの互換用識別値で、実探索量ではない。
// 旧版と同じ表示名のレベルには旧版の値を割り当て、名前の意味を保ったまま強さだけ正す。
// skillは校正結果。Lv0は探索せず自然さだけで選ぶ。
export const CPU_STRENGTH_PRESETS = [
  { level: 0, value: 1000, skill: 0, label: '駒の動きを覚えたて' },
  { level: 1, value: 5000, skill: 0.013, label: '十五級程度' },
  { level: 2, value: 6000, skill: 0.017, label: '十四級程度' },
  { level: 3, value: 7000, skill: 0.024, label: '十三級程度' },
  { level: 4, value: 8000, skill: 0.037, label: '十二級程度' },
  { level: 5, value: 10000, skill: 0.049, label: '十一級程度' },
  { level: 6, value: 12000, skill: 0.063, label: '十級程度' },
  { level: 7, value: 15000, skill: 0.073, label: '九級程度' },
  { level: 8, value: 20000, skill: 0.087, label: '八級程度' },
  { level: 9, value: 25000, skill: 0.097, label: '七級程度' },
  { level: 10, value: 30000, skill: 0.109, label: '六級程度' },
  { level: 11, value: 60000, skill: 0.118, label: '五級程度' },
  { level: 12, value: 65000, skill: 0.133, label: '五級程度' },
  { level: 13, value: 70000, skill: 0.15, label: '四級程度' },
  { level: 14, value: 75000, skill: 0.176, label: '四級程度' },
  { level: 15, value: 80000, skill: 0.196, label: '三級程度' },
  { level: 16, value: 90000, skill: 0.215, label: '三級程度' },
  { level: 17, value: 100000, skill: 0.235, label: '二級程度' },
  { level: 18, value: 125000, skill: 0.255, label: '二級程度' },
  { level: 19, value: 150000, skill: 0.274, label: '一級程度' },
  { level: 20, value: 175000, skill: 0.294, label: '一級程度' },
  { level: 21, value: 200000, skill: 0.317, label: 'アマ初段程度' },
  { level: 22, value: 225000, skill: 0.342, label: 'アマ初段程度' },
  { level: 23, value: 250000, skill: 0.373, label: 'アマ二段程度' },
  { level: 24, value: 265000, skill: 0.413, label: 'アマ二段程度' },
  { level: 25, value: 280000, skill: 0.467, label: 'アマ二段程度' },
  { level: 26, value: 300000, skill: 0.507, label: 'アマ三段程度' },
  { level: 27, value: 320000, skill: 0.553, label: 'アマ三段程度' },
  { level: 28, value: 340000, skill: 0.589, label: 'アマ三段程度' },
  { level: 29, value: 360000, skill: 0.624, label: 'アマ四段程度' },
  { level: 30, value: 400000, skill: 0.656, label: 'アマ四段程度' },
  { level: 31, value: 408000, skill: 0.682, label: 'アマ四段程度' },
  { level: 32, value: 416000, skill: 0.714, label: 'アマ五段程度' },
  { level: 33, value: 424000, skill: 0.754, label: 'アマ五段程度' },
  { level: 34, value: 432000, skill: 0.782, label: 'アマ五段程度' },
  { level: 35, value: 440000, skill: 0.812, label: 'アマ六段程度' },
  { level: 36, value: 448000, skill: 0.848, label: 'アマ六段程度' },
  { level: 37, value: 456000, skill: 0.885, label: 'アマ七段程度' },
  { level: 38, value: 464000, skill: 0.922, label: 'アマ七段程度' },
  { level: 39, value: 472000, skill: 0.961, label: 'プロ級' },
  { level: 40, value: 480000, skill: 1, label: '藤井聡太並み' },
];

/** 旧版にだけあった識別値(十九〜十六級)は、最も弱い段級位のレベルへ対応付ける。 */
const LEGACY_STRENGTH_VALUES = new Map([
  [2000, 5000],
  [3000, 5000],
  [4000, 5000],
  [4500, 5000],
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
    // 旧設定との互換キー。一様ランダムの着手は廃止したため常に無効。
    randomLegalRate: 0,
    randomFallback: false,
  };
  if (Number.isFinite(settings.scoreTemperature)) result.scoreTemperature = settings.scoreTemperature;
  return result;
}

/** UIの強さ識別値から探索量と候補選択設定を返す。 */
export function getStrengthSearchSettings(preset) {
  return searchSettingsForSkill(strengthPresetFor(preset).skill);
}
