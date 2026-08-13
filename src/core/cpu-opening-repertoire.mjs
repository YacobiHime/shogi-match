const REPERTOIRES = {
  ibisha: { strategyId: "ibisha", castleId: "funagakoi", label: "居飛車＋舟囲い" },
  aigakari: { strategyId: "aigakari", castleId: "nakazumai", label: "相掛かり＋中住まい" },
  kakugawari: { strategyId: "kakugawari", castleId: "right-king", label: "角換わり＋右玉" },
  yagura: { strategyId: "yagura-strategy", castleId: "yagura", label: "矢倉戦法＋矢倉" },
  shiken: { strategyId: "shiken", castleId: "mino", label: "四間飛車＋美濃囲い" },
  sangen: { strategyId: "sangen", castleId: "mino", label: "三間飛車＋美濃囲い" },
  nakabisha: { strategyId: "gokigen", castleId: "mino", label: "中飛車＋美濃囲い" },
};

const CONFIGURED_STRATEGY_MAP = {
  ibisha: "ibisha",
  shiken: "shiken",
  sangen: "sangen",
  nakabisha: "nakabisha",
  yagura: "yagura",
};

const BLACK_REPERTOIRE_WEIGHTS = [
  ["ibisha", 32],
  ["yagura", 20],
  ["aigakari", 16],
  ["shiken", 14],
  ["sangen", 9],
  ["nakabisha", 9],
];

function weightedChoice(entries, random) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = Math.max(0, Math.min(0.999999999, random())) * total;
  for (const [id, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return id;
  }
  return entries.at(-1)?.[0];
}

/**
 * CPUが序盤に維持する作戦を一局につき一度だけ決める。
 * 後手では初手への自然な応手を優先し、それ以外は主要作戦から重み付きで選ぶ。
 */
export function selectCpuOpeningRepertoire({
  configuredStrategy = "random",
  cpuColor = "white",
  moves = [],
  random = Math.random,
} = {}) {
  const configured = CONFIGURED_STRATEGY_MAP[configuredStrategy];
  if (configured) return { ...REPERTOIRES[configured] };

  let id;
  if (cpuColor === "white") {
    const firstMove = moves[0] ?? "";
    if (firstMove === "2g2f") id = "aigakari";
    else if (firstMove === "5g5f") id = "ibisha";
    else if (firstMove === "7g7f") {
      id = weightedChoice([["yagura", 52], ["shiken", 28], ["sangen", 20]], random);
    } else id = "ibisha";
  } else {
    id = weightedChoice(BLACK_REPERTOIRE_WEIGHTS, random);
  }
  return { ...REPERTOIRES[id] };
}

export function shouldUseCpuOpening({
  ply = 0,
  cpuMoveCount = 0,
  inCheck = false,
  lastMoveWasCapture = false,
} = {}) {
  return !inCheck && !lastMoveWasCapture && ply < 32 && cpuMoveCount < 16;
}

export { REPERTOIRES as CPU_OPENING_REPERTOIRES };
