const REPERTOIRES = {
  ibisha: { strategyId: "ibisha", castleId: "funagakoi", label: "居飛車＋舟囲い" },
  aigakari: { strategyId: "aigakari", castleId: "nakazumai", label: "相掛かり＋中住まい" },
  kakugawari: { strategyId: "kakugawari", castleId: "right-king", label: "角換わり＋右玉" },
  "yagura-strategy": { strategyId: "yagura-strategy", castleId: "yagura", label: "矢倉戦法＋矢倉" },
  bougin: { strategyId: "bougin", castleId: "funagakoi", label: "棒銀＋舟囲い" },
  "right-shiken": { strategyId: "right-shiken", castleId: "elmo", label: "右四間飛車＋エルモ囲い" },
  "hayaguri-gin": { strategyId: "hayaguri-gin", castleId: "right-king", label: "早繰り銀＋右玉" },
  "koshikake-gin": { strategyId: "koshikake-gin", castleId: "right-king", label: "腰掛け銀＋右玉" },
  shiken: { strategyId: "shiken", castleId: "mino", label: "四間飛車＋美濃囲い" },
  "fujii-system": { strategyId: "fujii-system", castleId: "mino", label: "藤井システム＋美濃囲い" },
  sangen: { strategyId: "sangen", castleId: "mino", label: "三間飛車＋美濃囲い" },
  ishida: { strategyId: "ishida", castleId: "mino", label: "石田流＋美濃囲い" },
  nakabisha: { strategyId: "nakabisha", castleId: "mino", label: "中飛車＋美濃囲い" },
  gokigen: { strategyId: "gokigen", castleId: "mino", label: "ゴキゲン中飛車＋美濃囲い" },
  mukai: { strategyId: "mukai", castleId: "mino", label: "向かい飛車＋美濃囲い" },
  sodebisha: { strategyId: "sodebisha", castleId: "mino", label: "袖飛車＋美濃囲い" },
  onigoroshi: { strategyId: "onigoroshi", castleId: "mino", label: "鬼殺し＋美濃囲い" },
  pacman: { strategyId: "pacman", castleId: "mino", label: "パックマン＋美濃囲い" },
  ureshino: { strategyId: "ureshino", castleId: "funagakoi", label: "嬉野流＋舟囲い" },
};

const CATEGORY_POOLS = {
  static: [
    "ibisha", "aigakari", "kakugawari", "yagura-strategy", "bougin",
    "right-shiken", "hayaguri-gin", "koshikake-gin",
  ],
  ranging: [
    "shiken", "fujii-system", "sangen", "ishida", "nakabisha",
    "gokigen", "mukai", "sodebisha",
  ],
  surprise: ["onigoroshi", "pacman", "ureshino"],
};

const BISHOP_STYLE_POOLS = {
  open: [
    "kakugawari", "yagura-strategy", "right-shiken", "shiken", "fujii-system",
    "sangen", "ishida", "gokigen", "mukai", "onigoroshi",
  ],
  closed: [
    "ibisha", "aigakari", "bougin", "hayaguri-gin", "koshikake-gin",
    "nakabisha", "sodebisha", "pacman", "ureshino",
  ],
};

const ROOK_STYLE_POOLS = {
  "rook-pawn": ["ibisha", "aigakari", "kakugawari", "bougin", "hayaguri-gin", "koshikake-gin"],
  static: [...CATEGORY_POOLS.static, "ureshino"],
  ranging: [...CATEGORY_POOLS.ranging],
};

const TEMPO_STYLE_POOLS = {
  balanced: ["ibisha", "aigakari", "yagura-strategy", "shiken", "sangen", "nakabisha"],
  aggressive: [
    "bougin", "right-shiken", "hayaguri-gin", "ishida", "gokigen", "sodebisha",
    "onigoroshi", "pacman",
  ],
  patient: ["yagura-strategy", "koshikake-gin", "shiken", "fujii-system", "sangen", "mukai", "ureshino"],
  "castle-first": ["ibisha", "yagura-strategy", "shiken", "sangen", "mukai", "ureshino"],
  "attack-first": ["bougin", "right-shiken", "hayaguri-gin", "ishida", "gokigen", "sodebisha", "onigoroshi"],
};

const BLACK_REPERTOIRE_WEIGHTS = [
  ["ibisha", 32],
  ["yagura-strategy", 20],
  ["aigakari", 16],
  ["shiken", 14],
  ["sangen", 9],
  ["nakabisha", 9],
];

const CONFIGURED_FIRST_MOVES = Object.freeze({
  "bishop-diagonal": "7g7f",
  "rook-pawn": "2g2f",
  "center-pawn": "5g5f",
});

/** 後手の練習用に、先手CPUの初手だけを指定する。 */
export function configuredCpuFirstMove({
  configuredFirstMove = "random",
  cpuColor = "white",
  cpuMoveCount = 0,
  legalMoves = [],
} = {}) {
  if (cpuColor !== "black" || cpuMoveCount !== 0) return undefined;
  const move = CONFIGURED_FIRST_MOVES[configuredFirstMove];
  return move && legalMoves.includes(move) ? move : undefined;
}

/** 明示された初手だけは、その1手に限ってAI候補より優先する。 */
export function shouldForceConfiguredCpuOpening({
  configuredFirstMove = "random",
  openingMove = "",
  cpuColor = "white",
  cpuMoveCount = 0,
} = {}) {
  return Boolean(
    openingMove
    && configuredFirstMove !== "random"
    && cpuColor === "black"
    && cpuMoveCount === 0
  );
}

function weightedChoice(entries, random) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = Math.max(0, Math.min(0.999999999, random())) * total;
  for (const [id, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return id;
  }
  return entries.at(-1)?.[0];
}

function repertoireIsAvailable(id, cpuColor, moves) {
  if (id === "pacman") return cpuColor === "white" && moves[0] === "7g7f";
  return Object.hasOwn(REPERTOIRES, id);
}

function randomChoice(ids, random) {
  if (ids.length === 0) return undefined;
  const index = Math.floor(Math.max(0, Math.min(0.999999999, random())) * ids.length);
  return ids[index];
}

function narrowByPreference(ids, preference, pools) {
  const pool = pools[preference];
  if (!pool) return ids;
  const allowed = new Set(pool);
  const narrowed = ids.filter((id) => allowed.has(id));
  // 組み合わせが空になる場合は、それ以前の有効な指定を維持する。
  return narrowed.length ? narrowed : ids;
}

function selectPreferredRepertoire({
  cpuColor,
  moves,
  bishopPreference,
  rookPreference,
  tempoPreference,
  random,
}) {
  const restrictiveRookPreference = rookPreference === "adaptive" ? "" : rookPreference;
  if (!bishopPreference && !restrictiveRookPreference && !tempoPreference) return undefined;
  let eligible = Object.keys(REPERTOIRES)
    .filter((id) => repertoireIsAvailable(id, cpuColor, moves));
  eligible = narrowByPreference(eligible, bishopPreference, BISHOP_STYLE_POOLS);
  // 「相手を見て決める」は既存の応手選択へ任せるため、絞り込まない。
  eligible = narrowByPreference(eligible, restrictiveRookPreference, ROOK_STYLE_POOLS);
  eligible = narrowByPreference(eligible, tempoPreference, TEMPO_STYLE_POOLS);
  const id = randomChoice(eligible, random);
  return id ? { ...REPERTOIRES[id] } : undefined;
}

/**
 * CPUが序盤に維持する作戦を一局につき一度だけ決める。
 * 後手では初手への自然な応手を優先し、それ以外は主要作戦から重み付きで選ぶ。
 */
export function selectCpuOpeningRepertoire({
  configuredStrategy = "random",
  cpuColor = "white",
  moves = [],
  bishopPreference = "",
  rookPreference = "",
  tempoPreference = "",
  random = Math.random,
} = {}) {
  if (Object.hasOwn(REPERTOIRES, configuredStrategy)
    && repertoireIsAvailable(configuredStrategy, cpuColor, moves)) {
    return { ...REPERTOIRES[configuredStrategy] };
  }

  const categoryPool = CATEGORY_POOLS[configuredStrategy];
  if (categoryPool) {
    const eligible = categoryPool.filter((id) => repertoireIsAvailable(id, cpuColor, moves));
    const categoryId = randomChoice(eligible, random);
    if (categoryId) return { ...REPERTOIRES[categoryId] };
  }

  const preferred = selectPreferredRepertoire({
    cpuColor,
    moves,
    bishopPreference,
    rookPreference,
    tempoPreference,
    random,
  });
  if (preferred) return preferred;

  let id;
  if (cpuColor === "white") {
    const firstMove = moves[0] ?? "";
    if (firstMove === "2g2f") id = "aigakari";
    else if (firstMove === "5g5f") id = "ibisha";
    else if (firstMove === "7g7f") {
      id = weightedChoice([["yagura-strategy", 52], ["shiken", 28], ["sangen", 20]], random);
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
export const CPU_OPENING_CATEGORY_IDS = Object.freeze({
  static: [...CATEGORY_POOLS.static],
  ranging: [...CATEGORY_POOLS.ranging],
  surprise: [...CATEGORY_POOLS.surprise],
});
export const CPU_OPENING_STRATEGY_IDS = Object.freeze(Object.keys(REPERTOIRES));
