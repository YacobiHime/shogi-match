const STRENGTH_SEARCH_SETTINGS = new Map([
  [1000, { nodes: 8000, multiPv: 5, moveRank: { min: 2, max: 5 } }],
  // 級位者から将棋ウォーズ三段程度までを想定し、探索量と候補順位を段階化する。
  [10000, { nodes: 10000, multiPv: 4, moveRank: { min: 2, max: 4 } }],
  [30000, { nodes: 15000, multiPv: 4, moveRank: { min: 1, max: 4 } }],
  [100000, { nodes: 25000, multiPv: 3, moveRank: { min: 1, max: 3 } }],
  [300000, { nodes: 50000, multiPv: 2, moveRank: { min: 1, max: 2 } }],
  // CSA会誌Vol.29の人間対局向け実測（48万nodesで将棋倶楽部24のR3381相当）を
  // 人間最高峰の目安として採用。エンジン差があるため表示上も「推定」とする。
  [480000, { nodes: 480000, multiPv: 1, moveRank: { min: 1, max: 1 } }],
]);

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
  };
}
