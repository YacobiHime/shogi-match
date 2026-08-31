const STRENGTH_SEARCH_SETTINGS = new Map([
  // valueは既存URL・保存データとの互換用識別値。実探索量はnodesを使う。
  [1000, { nodes: 500, multiPv: 16, moveRank: { min: 8, max: 16 }, maxScoreLoss: 3600, scoreTemperature: 2600, bestMoveRate: 0 }],
  [5000, { nodes: 500, multiPv: 16, moveRank: { min: 8, max: 16 }, maxScoreLoss: 3600, scoreTemperature: 2600, bestMoveRate: 0.03 }],
  [6000, { nodes: 650, multiPv: 16, moveRank: { min: 7, max: 16 }, maxScoreLoss: 3300, scoreTemperature: 2400, bestMoveRate: 0.05 }],
  [7000, { nodes: 850, multiPv: 16, moveRank: { min: 6, max: 16 }, maxScoreLoss: 3000, scoreTemperature: 2200, bestMoveRate: 0.08 }],
  [8000, { nodes: 1100, multiPv: 15, moveRank: { min: 6, max: 15 }, maxScoreLoss: 2700, scoreTemperature: 1900, bestMoveRate: 0.12 }],
  [10000, { nodes: 1500, multiPv: 14, moveRank: { min: 5, max: 14 }, maxScoreLoss: 2400, scoreTemperature: 1600, bestMoveRate: 0.16 }],
  [12000, { nodes: 2000, multiPv: 14, moveRank: { min: 5, max: 14 }, maxScoreLoss: 2100, scoreTemperature: 1400, bestMoveRate: 0.20 }],
  [15000, { nodes: 2800, multiPv: 13, moveRank: { min: 4, max: 13 }, maxScoreLoss: 1800, scoreTemperature: 1200, bestMoveRate: 0.25 }],
  [20000, { nodes: 4000, multiPv: 12, moveRank: { min: 3, max: 12 }, maxScoreLoss: 1500, scoreTemperature: 950, bestMoveRate: 0.30 }],
  [25000, { nodes: 5500, multiPv: 11, moveRank: { min: 3, max: 11 }, maxScoreLoss: 1250, scoreTemperature: 800, bestMoveRate: 0.35 }],
  [30000, { nodes: 8000, multiPv: 9, moveRank: { min: 2, max: 9 }, maxScoreLoss: 900, scoreTemperature: 650, bestMoveRate: 0.42 }],
  [60000, { nodes: 11000, multiPv: 8, moveRank: { min: 2, max: 8 }, maxScoreLoss: 800, scoreTemperature: 520, bestMoveRate: 0.50 }],
  [70000, { nodes: 15000, multiPv: 8, moveRank: { min: 2, max: 8 }, maxScoreLoss: 700, scoreTemperature: 440, bestMoveRate: 0.58 }],
  [80000, { nodes: 22000, multiPv: 7, moveRank: { min: 2, max: 7 }, maxScoreLoss: 600, scoreTemperature: 360, bestMoveRate: 0.66 }],
  [100000, { nodes: 32000, multiPv: 6, moveRank: { min: 2, max: 6 }, maxScoreLoss: 500, scoreTemperature: 280, bestMoveRate: 0.74 }],
  [150000, { nodes: 45000, multiPv: 5, moveRank: { min: 2, max: 5 }, maxScoreLoss: 420, scoreTemperature: 220, bestMoveRate: 0.82 }],
  [200000, { nodes: 65000, multiPv: 5, moveRank: { min: 2, max: 5 }, maxScoreLoss: 350, scoreTemperature: 170, bestMoveRate: 0.88 }],
  [250000, { nodes: 95000, multiPv: 4, moveRank: { min: 2, max: 4 }, maxScoreLoss: 280, scoreTemperature: 120, bestMoveRate: 0.92 }],
  [300000, { nodes: 140000, multiPv: 3, moveRank: { min: 2, max: 3 }, maxScoreLoss: 220, scoreTemperature: 80, bestMoveRate: 0.95 }],
  [400000, { nodes: 240000, multiPv: 2, moveRank: { min: 2, max: 2 }, maxScoreLoss: 140, scoreTemperature: 45, bestMoveRate: 0.98 }],
  // CSA会誌Vol.29の人間対局向け推定を最高難度の基準として維持する。
  [480000, { nodes: 480000, multiPv: 1, moveRank: { min: 1, max: 1 }, maxScoreLoss: 0, bestMoveRate: 1 }],
]);

export const CPU_STRENGTH_PRESETS = [
  { level: 0, value: 1000, label: '駒の動かし方練習' },
  { level: 1, value: 5000, label: '十五級程度' },
  { level: 2, value: 6000, label: '十四級程度' },
  { level: 3, value: 7000, label: '十三級程度' },
  { level: 4, value: 8000, label: '十二級程度' },
  { level: 5, value: 10000, label: '十一級程度' },
  { level: 6, value: 12000, label: '十級程度' },
  { level: 7, value: 15000, label: '九級程度' },
  { level: 8, value: 20000, label: '八級程度' },
  { level: 9, value: 25000, label: '七級程度' },
  { level: 10, value: 30000, label: '六級程度' },
  { level: 11, value: 60000, label: '五級程度' },
  { level: 12, value: 70000, label: '四級程度' },
  { level: 13, value: 80000, label: '三級程度' },
  { level: 14, value: 100000, label: '二級程度' },
  { level: 15, value: 150000, label: '一級程度' },
  { level: 16, value: 200000, label: 'アマ初段程度' },
  { level: 17, value: 250000, label: 'アマ二段程度' },
  { level: 18, value: 300000, label: 'アマ三段程度' },
  { level: 19, value: 400000, label: 'アマ四〜五段程度' },
  { level: 20, value: 480000, label: '藤井聡太並み' },
];

/** Lv0は評価探索を使わず、合法手をランダムに指す練習用CPUとする。 */
export function usesRandomLegalMove(preset) {
  return preset === 1000;
}

/** UIの強さ識別値から探索量と候補選択設定を返す。 */
export function getStrengthSearchSettings(preset) {
  const settings = STRENGTH_SEARCH_SETTINGS.get(preset)
    ?? STRENGTH_SEARCH_SETTINGS.get(30000);
  const result = {
    nodes: settings.nodes,
    multiPv: settings.multiPv,
    moveRank: { ...settings.moveRank },
    maxScoreLoss: settings.maxScoreLoss,
    bestMoveRate: settings.bestMoveRate,
  };
  if (Number.isFinite(settings.scoreTemperature)) result.scoreTemperature = settings.scoreTemperature;
  return result;
}
