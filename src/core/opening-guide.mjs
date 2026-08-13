export const OPENING_STRATEGIES = [
  {
    id: "shiken",
    label: "四間飛車",
    detectionNames: ["四間飛車", "ノーマル四間飛車"],
    blackMoves: ["7g7f", "6g6f", "2h6h"],
  },
  {
    id: "bougin",
    label: "棒銀",
    detectionNames: ["棒銀"],
    blackMoves: ["2g2f", "2f2e", "3i3h", "3h2g", "2g2f"],
  },
  {
    id: "right-shiken",
    label: "右四間飛車",
    detectionNames: ["右四間飛車"],
    blackMoves: ["7g7f", "6g6f", "5g5f", "4g4f", "3i4h", "4h4g", "2h4h"],
  },
];

export const OPENING_CASTLES = [
  {
    id: "mino",
    label: "美濃囲い",
    detectionNames: ["美濃囲い", "本美濃", "高美濃囲い", "銀冠"],
    blackMoves: ["5i4h", "4h3h", "3h2h", "3i3h", "4i4h", "6i5h"],
  },
  {
    id: "yagura",
    label: "矢倉",
    detectionNames: ["矢倉", "金矢倉", "銀矢倉", "総矢倉"],
    blackMoves: ["7g7f", "8h6f", "7i6h", "6h7g", "5i6h", "6h7i", "7i8h", "6i7h", "4i5h", "5h6h"],
  },
  {
    id: "elmo",
    label: "エルモ囲い",
    detectionNames: ["エルモ囲い"],
    blackMoves: ["7i6h", "6i7i", "5i6i", "6i7h"],
  },
];

export const OPENING_PRESETS = [
  { strategyId: "shiken", castleId: "mino", label: "四間飛車＋美濃囲い" },
  { strategyId: "bougin", castleId: "yagura", label: "棒銀＋矢倉" },
  { strategyId: "right-shiken", castleId: "elmo", label: "右四間飛車＋エルモ囲い" },
];

export function mirrorUsiMove(usi) {
  return usi.replace(/([1-9])([a-i])/g, (_, file, rank) => (
    `${10 - Number(file)}${String.fromCharCode(
      "a".charCodeAt(0) + "i".charCodeAt(0) - rank.charCodeAt(0),
    )}`
  ));
}

export function openingPlanSteps(strategyId, castleId, color = "black") {
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === strategyId);
  const castle = OPENING_CASTLES.find(({ id }) => id === castleId);
  const convert = color === "white" ? mirrorUsiMove : (move) => move;
  const seen = new Set();
  return [
    ...(strategy?.blackMoves ?? []).map((usi) => ({ usi: convert(usi), phase: "strategy" })),
    ...(castle?.blackMoves ?? []).map((usi) => ({ usi: convert(usi), phase: "castle" })),
  ].filter(({ usi }) => {
    if (seen.has(usi)) return false;
    seen.add(usi);
    return true;
  });
}

export function nextOpeningPlanMove({
  strategyId,
  castleId,
  color = "black",
  playedMoves = [],
  legalMoves = [],
  detectedFormations = [],
}) {
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === strategyId);
  const castle = OPENING_CASTLES.find(({ id }) => id === castleId);
  const detected = new Set(detectedFormations);
  const strategyComplete = strategy?.detectionNames.some((name) => detected.has(name)) ?? false;
  const castleComplete = castle?.detectionNames.some((name) => detected.has(name)) ?? false;
  const played = new Set(playedMoves);
  const legal = new Set(legalMoves);

  return openingPlanSteps(strategyId, castleId, color).find(({ usi, phase }) => (
    !(phase === "strategy" && strategyComplete)
    && !(phase === "castle" && castleComplete)
    && !played.has(usi)
    && legal.has(usi)
  )) ?? null;
}
