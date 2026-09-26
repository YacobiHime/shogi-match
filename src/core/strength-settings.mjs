// alpha: 自然さの効き具合。oversight*: 浅い読みでは良く見える手を深い読みで検証して選ぶ「見落とし」。
// 大きな悪手は見落としからだけ出るよう、通常抽選の最大評価損は実戦的な範囲に抑える。
const STRENGTH_SEARCH_SETTINGS = new Map([
  // valueは既存URL・保存データとの互換用識別値。実探索量はnodesを使う。
  // Lv0は探索せず、合法手を自然さだけで重み付けして選ぶ。
  [1000, { nodes: 0, multiPv: 1, maxScoreLoss: 0, bestMoveRate: 0, alpha: 1 }],
  [2000, { nodes: 100, multiPv: 4, maxScoreLoss: 1200, scoreTemperature: 1800, bestMoveRate: 0.01, alpha: 1, oversightRate: 0.80, oversightShallowLoss: 600, oversightNodes: 3000, oversightMaxLoss: 3000 }],
  [3000, { nodes: 180, multiPv: 5, maxScoreLoss: 1150, scoreTemperature: 1600, bestMoveRate: 0.01, alpha: 1, oversightRate: 0.70, oversightShallowLoss: 560, oversightNodes: 3000, oversightMaxLoss: 2800 }],
  [4000, { nodes: 280, multiPv: 5, maxScoreLoss: 1100, scoreTemperature: 1400, bestMoveRate: 0.02, alpha: 1, oversightRate: 0.60, oversightShallowLoss: 520, oversightNodes: 3000, oversightMaxLoss: 2600 }],
  [4500, { nodes: 400, multiPv: 6, maxScoreLoss: 1050, scoreTemperature: 1250, bestMoveRate: 0.02, alpha: 1, oversightRate: 0.50, oversightShallowLoss: 480, oversightNodes: 4000, oversightMaxLoss: 2400 }],
  [5000, { nodes: 500, multiPv: 6, maxScoreLoss: 1000, scoreTemperature: 1100, bestMoveRate: 0.03, alpha: 0.8, oversightRate: 0.42, oversightShallowLoss: 440, oversightNodes: 4000, oversightMaxLoss: 2200 }],
  [6000, { nodes: 650, multiPv: 6, maxScoreLoss: 1000, scoreTemperature: 950, bestMoveRate: 0.05, alpha: 0.8, oversightRate: 0.35, oversightShallowLoss: 400, oversightNodes: 5000, oversightMaxLoss: 2000 }],
  [7000, { nodes: 850, multiPv: 7, maxScoreLoss: 980, scoreTemperature: 900, bestMoveRate: 0.08, alpha: 0.8, oversightRate: 0.30, oversightShallowLoss: 370, oversightNodes: 5000, oversightMaxLoss: 1800 }],
  [8000, { nodes: 1100, multiPv: 7, maxScoreLoss: 960, scoreTemperature: 850, bestMoveRate: 0.12, alpha: 0.8, oversightRate: 0.26, oversightShallowLoss: 340, oversightNodes: 6000, oversightMaxLoss: 1600 }],
  [10000, { nodes: 1500, multiPv: 7, maxScoreLoss: 950, scoreTemperature: 800, bestMoveRate: 0.16, alpha: 0.8, oversightRate: 0.22, oversightShallowLoss: 310, oversightNodes: 8000, oversightMaxLoss: 1500 }],
  [12000, { nodes: 2000, multiPv: 8, maxScoreLoss: 940, scoreTemperature: 760, bestMoveRate: 0.20, alpha: 0.6, oversightRate: 0.18, oversightShallowLoss: 280, oversightNodes: 10000, oversightMaxLoss: 1400 }],
  [15000, { nodes: 2800, multiPv: 8, maxScoreLoss: 930, scoreTemperature: 730, bestMoveRate: 0.25, alpha: 0.6, oversightRate: 0.14, oversightShallowLoss: 260, oversightNodes: 12000, oversightMaxLoss: 1300 }],
  [20000, { nodes: 4000, multiPv: 8, maxScoreLoss: 920, scoreTemperature: 700, bestMoveRate: 0.30, alpha: 0.6, oversightRate: 0.10, oversightShallowLoss: 240, oversightNodes: 16000, oversightMaxLoss: 1200 }],
  [25000, { nodes: 5500, multiPv: 8, maxScoreLoss: 910, scoreTemperature: 675, bestMoveRate: 0.35, alpha: 0.6, oversightRate: 0.07, oversightShallowLoss: 220, oversightNodes: 20000, oversightMaxLoss: 1100 }],
  [30000, { nodes: 8000, multiPv: 9, maxScoreLoss: 900, scoreTemperature: 650, bestMoveRate: 0.42, alpha: 0.6, oversightRate: 0.04, oversightShallowLoss: 200, oversightNodes: 24000, oversightMaxLoss: 1000 }],
  [60000, { nodes: 11000, multiPv: 8, maxScoreLoss: 800, scoreTemperature: 520, bestMoveRate: 0.50, alpha: 0.4, oversightRate: 0.03, oversightShallowLoss: 200, oversightNodes: 36000, oversightMaxLoss: 900 }],
  [70000, { nodes: 15000, multiPv: 8, maxScoreLoss: 700, scoreTemperature: 440, bestMoveRate: 0.58, alpha: 0.4, oversightRate: 0.02, oversightShallowLoss: 200, oversightNodes: 48000, oversightMaxLoss: 900 }],
  [80000, { nodes: 22000, multiPv: 7, maxScoreLoss: 600, scoreTemperature: 360, bestMoveRate: 0.66, alpha: 0.4, oversightRate: 0.01, oversightShallowLoss: 200, oversightNodes: 66000, oversightMaxLoss: 900 }],
  [100000, { nodes: 32000, multiPv: 6, maxScoreLoss: 500, scoreTemperature: 280, bestMoveRate: 0.74, alpha: 0.4 }],
  [150000, { nodes: 45000, multiPv: 5, maxScoreLoss: 420, scoreTemperature: 220, bestMoveRate: 0.82, alpha: 0.3 }],
  [200000, { nodes: 65000, multiPv: 5, maxScoreLoss: 350, scoreTemperature: 170, bestMoveRate: 0.88, alpha: 0.3 }],
  [250000, { nodes: 95000, multiPv: 4, maxScoreLoss: 280, scoreTemperature: 120, bestMoveRate: 0.92, alpha: 0.2 }],
  [300000, { nodes: 140000, multiPv: 3, maxScoreLoss: 220, scoreTemperature: 80, bestMoveRate: 0.95, alpha: 0.2 }],
  [400000, { nodes: 240000, multiPv: 2, maxScoreLoss: 140, scoreTemperature: 45, bestMoveRate: 0.98, alpha: 0.2 }],
  // CSA会誌Vol.29の人間対局向け推定を最高難度の基準として維持する。
  [480000, { nodes: 480000, multiPv: 1, maxScoreLoss: 0, bestMoveRate: 1, alpha: 0 }],
]);

export const CPU_STRENGTH_PRESETS = [
  { level: 0, value: 1000, label: '駒の動きを覚えたて' },
  { level: 1, value: 2000, label: '十九級程度' },
  { level: 2, value: 3000, label: '十八級程度' },
  { level: 3, value: 4000, label: '十七級程度' },
  { level: 4, value: 4500, label: '十六級程度' },
  { level: 5, value: 5000, label: '十五級程度' },
  { level: 6, value: 6000, label: '十四級程度' },
  { level: 7, value: 7000, label: '十三級程度' },
  { level: 8, value: 8000, label: '十二級程度' },
  { level: 9, value: 10000, label: '十一級程度' },
  { level: 10, value: 12000, label: '十級程度' },
  { level: 11, value: 15000, label: '九級程度' },
  { level: 12, value: 20000, label: '八級程度' },
  { level: 13, value: 25000, label: '七級程度' },
  { level: 14, value: 30000, label: '六級程度' },
  { level: 15, value: 60000, label: '五級程度' },
  { level: 16, value: 70000, label: '四級程度' },
  { level: 17, value: 80000, label: '三級程度' },
  { level: 18, value: 100000, label: '二級程度' },
  { level: 19, value: 150000, label: '一級程度' },
  { level: 20, value: 200000, label: 'アマ初段程度' },
  { level: 21, value: 250000, label: 'アマ二段程度' },
  { level: 22, value: 300000, label: 'アマ三段程度' },
  { level: 23, value: 400000, label: 'アマ四〜五段程度' },
  { level: 24, value: 480000, label: '藤井聡太並み' },
];

/** Lv0は評価探索を使わず、合法手を自然さだけで選ぶ。 */
export function usesNaturalMoveOnly(preset) {
  return preset === 1000;
}

/** UIの強さ識別値から探索量と候補選択設定を返す。 */
export function getStrengthSearchSettings(preset) {
  const settings = STRENGTH_SEARCH_SETTINGS.get(preset)
    ?? STRENGTH_SEARCH_SETTINGS.get(30000);
  const result = {
    nodes: settings.nodes,
    multiPv: settings.multiPv,
    // 上位の自然な手を除外しないよう全レベルで1位から選ぶ。弱さは温度と最善手率で調整する。
    moveRank: { min: 1, max: settings.multiPv },
    maxScoreLoss: settings.maxScoreLoss,
    bestMoveRate: settings.bestMoveRate,
    naturalnessAlpha: settings.alpha,
    oversightRate: settings.oversightRate ?? 0,
    oversightShallowLoss: settings.oversightShallowLoss ?? 0,
    oversightNodes: settings.oversightNodes ?? 0,
    oversightMaxLoss: settings.oversightMaxLoss ?? 0,
    // 旧設定との互換キー。一様ランダムの着手は廃止したため常に無効。
    randomLegalRate: 0,
    randomFallback: false,
  };
  if (Number.isFinite(settings.scoreTemperature)) result.scoreTemperature = settings.scoreTemperature;
  return result;
}
