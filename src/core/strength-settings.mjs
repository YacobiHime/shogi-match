const STRENGTH_SEARCH_SETTINGS = new Map([
  [1000, { nodes: 2000, multiPv: 12, moveRank: { min: 3, max: 12 }, maxScoreLoss: 1600 }],
  // 「ふつう」を6級程度の基準点として、上下を滑らかにする。
  // 級位帯では探索量だけでなく、意図的に選ぶ候補順位と許容評価損も広げる。
  [5000, { nodes: 1500, multiPv: 12, moveRank: { min: 5, max: 12 }, maxScoreLoss: 2000 }],
  [10000, { nodes: 2500, multiPv: 12, moveRank: { min: 4, max: 12 }, maxScoreLoss: 1600 }],
  [20000, { nodes: 4000, multiPv: 10, moveRank: { min: 3, max: 10 }, maxScoreLoss: 1200 }],
  [30000, { nodes: 11000, multiPv: 8, moveRank: { min: 2, max: 7 }, maxScoreLoss: 800 }],
  [60000, { nodes: 15000, multiPv: 7, moveRank: { min: 2, max: 7 }, maxScoreLoss: 700 }],
  [100000, { nodes: 25000, multiPv: 6, moveRank: { min: 1, max: 6 }, maxScoreLoss: 500 }],
  [200000, { nodes: 50000, multiPv: 5, moveRank: { min: 1, max: 5 }, maxScoreLoss: 350 }],
  [300000, { nodes: 120000, multiPv: 3, moveRank: { min: 1, max: 3 }, maxScoreLoss: 220 }],
  // CSA会誌Vol.29の人間対局向け実測（48万nodesで将棋倶楽部24のR3381相当）を
  // 人間最高峰の目安として採用。エンジン差があるため表示上も「推定」とする。
  [480000, { nodes: 480000, multiPv: 1, moveRank: { min: 1, max: 1 }, maxScoreLoss: 0 }],
]);

export const CPU_STRENGTH_PRESETS = [
  { value: 1000, label: '入門', guide: '駒の動かし方練習' },
  { value: 5000, label: '初級', guide: '15〜12級目安' },
  { value: 10000, label: '易しい', guide: '11〜9級目安' },
  { value: 20000, label: 'やや易しい', guide: '8〜7級目安' },
  { value: 30000, label: 'ふつう', guide: '6級目安' },
  { value: 60000, label: 'やや強い', guide: '5〜3級目安' },
  { value: 100000, label: '強い', guide: '2〜1級目安' },
  { value: 200000, label: '上級', guide: '初段目安' },
  { value: 300000, label: 'かなり強い', guide: '二〜三段目安' },
  { value: 480000, label: '藤井聡太並み', guide: '推定' },
];

/** 入門は評価探索を使わず、合法手をランダムに指す練習用CPUとする。 */
export function usesRandomLegalMove(preset) {
  return preset === 1000;
}

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
