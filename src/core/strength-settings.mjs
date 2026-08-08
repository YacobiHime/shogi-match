const STRENGTH_SEARCH_SETTINGS = new Map([
  [1000, { nodes: 8000, multiPv: 5, moveRank: { min: 2, max: 5 } }],
  [10000, { nodes: 22000, multiPv: 4, moveRank: { min: 1, max: 4 } }],
  [30000, { nodes: 45000, multiPv: 3, moveRank: { min: 1, max: 3 } }],
  [100000, { nodes: 100000, multiPv: 3, moveRank: { min: 1, max: 3 } }],
  [300000, { nodes: 300000, multiPv: 1, moveRank: { min: 1, max: 1 } }],
  [1000000, { nodes: 1000000, multiPv: 1, moveRank: { min: 1, max: 1 } }],
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
