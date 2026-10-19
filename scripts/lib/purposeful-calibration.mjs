// 比較計測用の仮調整。既定に採用する値は、計測後にstrength-settings.mjsへ移す。
export function purposefulCalibration(strength) {
  const level = strength.level;
  const anchors = [[11, 0.25], [20, 0.65], [30, 0.9], [35, 0.98], [39, 0.995]];
  const upper = Math.max(1, anchors.findIndex(([point]) => point >= level));
  const [lo, a] = anchors[upper - 1];
  const [hi, b] = anchors[upper];
  const engineBestVisibility = a + (b - a) * (level - lo) / (hi - lo);
  const nodeScale = level <= 30 ? 1 : level <= 35 ? 1 - 0.25 * (level - 30) / 5 : 0.75 + 0.15 * (level - 35) / 4;
  const temperatureScale = level <= 15 ? 1 - 0.35 * (level - 11) / 4 : level <= 30 ? 0.65 : Math.max(0.001, 0.65 * (35 - level) / 5);
  const floor = level <= 15 ? 62 + (level - 11) * 109.5 : level <= 20 ? 500 + (level - 15) * 100 : 1000;
  return { ...strength, logicHybrid: true, nodes: Math.max(floor, Math.round(strength.nodes * nodeScale)),
    scoreTemperature: Math.max(1, Math.round(strength.scoreTemperature * temperatureScale)), engineBestVisibility, engineTopVisibility: engineBestVisibility / 2,
    consistentCandidateScores: true, trustedEngineRate: level >= 35 ? 0.99 : 0 };
}
