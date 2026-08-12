const STRENGTH_SEARCH_SETTINGS = new Map([
  [1000, { nodes: 2000, multiPv: 12, moveRank: { min: 3, max: 12 }, maxScoreLoss: 1600 }],
  [5000, { nodes: 4000, multiPv: 10, moveRank: { min: 2, max: 10 }, maxScoreLoss: 1200 }],
  // 級位者の幅を一段で飛ばさず、探索量と許容損失を滑らかに変える。
  [10000, { nodes: 8000, multiPv: 8, moveRank: { min: 2, max: 8 }, maxScoreLoss: 900 }],
  [20000, { nodes: 15000, multiPv: 7, moveRank: { min: 1, max: 7 }, maxScoreLoss: 700 }],
  [30000, { nodes: 25000, multiPv: 6, moveRank: { min: 1, max: 6 }, maxScoreLoss: 500 }],
  [60000, { nodes: 50000, multiPv: 5, moveRank: { min: 1, max: 5 }, maxScoreLoss: 350 }],
  [100000, { nodes: 120000, multiPv: 3, moveRank: { min: 1, max: 3 }, maxScoreLoss: 220 }],
  [200000, { nodes: 220000, multiPv: 2, moveRank: { min: 1, max: 2 }, maxScoreLoss: 150 }],
  [300000, { nodes: 300000, multiPv: 2, moveRank: { min: 1, max: 2 }, maxScoreLoss: 100 }],
  // CSA会誌Vol.29の人間対局向け実測（48万nodesで将棋倶楽部24のR3381相当）を
  // 人間最高峰の目安として採用。エンジン差があるため表示上も「推定」とする。
  [480000, { nodes: 480000, multiPv: 1, moveRank: { min: 1, max: 1 }, maxScoreLoss: 0 }],
]);

export const CPU_STRENGTH_PRESETS = [
  { value: 1000, label: '入門', guide: '初心者向け' },
  { value: 5000, label: '初級', guide: '15〜11級目安' },
  { value: 10000, label: '易しい', guide: '10〜7級目安' },
  { value: 20000, label: 'やや易しい', guide: '6〜4級目安' },
  { value: 30000, label: 'ふつう', guide: '3〜1級目安' },
  { value: 60000, label: 'やや強い', guide: '初段目安' },
  { value: 100000, label: '強い', guide: '二段目安' },
  { value: 200000, label: '上級', guide: '二〜三段目安' },
  { value: 300000, label: 'かなり強い', guide: '三段目安' },
  { value: 480000, label: '藤井聡太並み', guide: '推定' },
];

/**
 * UIの強さプリセットから、探索量と選択する候補手の範囲を返す。
 * 低難易度でも将棋として不自然な下位候補を選びすぎないようにする。
 * @param {number} preset
 */
export function getStrengthSearchSettings(preset) {
  const settings = STRENGTH_SEARCH_SETTINGS.get(preset)
    ?? STRENGTH_SEARCH_SETTINGS.get(30000);
  return {
    nodes: settings.nodes,
    multiPv: settings.multiPv,
    moveRank: { ...settings.moveRank },
    maxScoreLoss: settings.maxScoreLoss,
  };
}
