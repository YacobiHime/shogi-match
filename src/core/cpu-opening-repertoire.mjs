import {
  bishopExchangeState,
  inferOpeningRookStyle,
  isOpeningPlanComplete,
  isIntegratedOpening,
  isStandaloneOpening,
  mirrorUsiMove,
  openingDefinitionRookStyle,
  openingPlanSteps,
  OPENING_CASTLES,
  OPENING_STRATEGIES,
} from "./opening-guide.mjs";
import { parseSfenBoard } from "./sfen-board.mjs";

const REPERTOIRES = {
  ibisha: { strategyId: "ibisha", castleId: "funagakoi", label: "居飛車＋舟囲い" },
  // 相掛かりの手順は5八玉・7八金まで含む。編集データでは3八銀型のため中住まいと重ねない。
  aigakari: { strategyId: "aigakari", castleId: "", label: "相掛かり" },
  kakugawari: { strategyId: "kakugawari", castleId: "", label: "角換わり" },
  "kakugawari-koshikake-gin": {
    strategyId: "kakugawari-koshikake-gin", castleId: "", label: "角換わり腰掛け銀",
  },
  "kakugawari-45-knight": { strategyId: "kakugawari-45-knight", castleId: "", label: "角換わり4五桂速攻" },
  "yagura-strategy": { strategyId: "yagura-strategy", castleId: "yagura", label: "矢倉戦法＋矢倉" },
  bougin: { strategyId: "bougin", castleId: "funagakoi", label: "棒銀＋舟囲い" },
  "right-shiken": { strategyId: "right-shiken", castleId: "elmo", label: "右四間飛車＋エルモ囲い" },
  "hayaguri-gin": { strategyId: "hayaguri-gin", castleId: "", label: "早繰り銀" },
  "koshikake-gin": { strategyId: "koshikake-gin", castleId: "", label: "腰掛け銀" },
  shiken: { strategyId: "shiken", castleId: "mino", label: "四間飛車＋美濃囲い" },
  "fujii-system": { strategyId: "fujii-system", castleId: "", label: "藤井システム" },
  sangen: { strategyId: "sangen", castleId: "mino", label: "三間飛車＋美濃囲い" },
  ishida: { strategyId: "ishida", castleId: "mino", label: "石田流＋美濃囲い" },
  nakabisha: { strategyId: "nakabisha", castleId: "", label: "中飛車" },
  gokigen: { strategyId: "gokigen", castleId: "", label: "ゴキゲン中飛車" },
  mukai: { strategyId: "mukai", castleId: "mino", label: "向かい飛車＋美濃囲い" },
  sodebisha: { strategyId: "sodebisha", castleId: "", label: "袖飛車" },
  onigoroshi: { strategyId: "onigoroshi", castleId: "mino", label: "鬼殺し＋美濃囲い" },
  pacman: { strategyId: "pacman", castleId: "", label: "パックマン" },
  ureshino: { strategyId: "ureshino", castleId: "", label: "嬉野流" },
};

const CATEGORY_POOLS = {
  static: [
    "ibisha", "aigakari", "kakugawari", "kakugawari-koshikake-gin", "kakugawari-45-knight",
    "yagura-strategy", "bougin", "right-shiken", "hayaguri-gin", "koshikake-gin",
  ],
  ranging: [
    "shiken", "fujii-system", "sangen", "ishida", "nakabisha",
    "gokigen", "mukai", "sodebisha",
  ],
  surprise: ["onigoroshi", "pacman", "ureshino"],
};

const BISHOP_STYLE_POOLS = {
  open: [
    "right-shiken", "ishida", "gokigen", "mukai", "onigoroshi",
  ],
  "open-close": ["yagura-strategy", "shiken", "fujii-system", "sangen"],
  exchange: ["kakugawari", "kakugawari-koshikake-gin", "kakugawari-45-knight"],
  "invite-exchange": [
    "right-shiken", "ishida", "gokigen", "mukai", "onigoroshi",
  ],
  closed: [
    "ibisha", "aigakari", "bougin", "hayaguri-gin", "koshikake-gin",
    "nakabisha", "sodebisha", "pacman", "ureshino",
  ],
};

const ROOK_STYLE_POOLS = {
  "rook-pawn": [
    "ibisha", "aigakari", "kakugawari", "kakugawari-koshikake-gin", "kakugawari-45-knight",
    "bougin", "hayaguri-gin", "koshikake-gin",
  ],
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

/**
 * 「おまかせ」で選ぶ戦法の出現比率（%の目安）。
 * [初級（Lv0〜10）, 級位者（Lv11〜20）, 有段者（Lv21〜34）, 高段・プロ級（Lv35〜40）]の順。
 * 将棋ウォーズの級位帯では振り飛車・棒銀・中飛車などの急戦や奇襲が多く、
 * 段位が上がるほど、プロ公式戦のように角換わり・相掛かり・矢倉が中心になる傾向を反映した概数。
 */
const OPENING_DISTRIBUTION = Object.freeze({
  ibisha: [10, 8, 6, 5],
  bougin: [14, 8, 3, 1],
  "hayaguri-gin": [4, 6, 6, 4],
  "koshikake-gin": [2, 4, 5, 4],
  "right-shiken": [8, 6, 3, 1],
  "yagura-strategy": [6, 7, 7, 10],
  aigakari: [3, 6, 9, 22],
  kakugawari: [1, 2, 2, 2],
  "kakugawari-koshikake-gin": [1, 4, 9, 18],
  "kakugawari-45-knight": [1, 2, 3, 4],
  shiken: [14, 11, 9, 6],
  "fujii-system": [1, 2, 3, 2],
  sangen: [7, 8, 7, 6],
  ishida: [5, 5, 4, 2],
  nakabisha: [8, 5, 2, 1],
  gokigen: [5, 7, 8, 5],
  mukai: [3, 4, 5, 5],
  sodebisha: [2, 1, 1, 0],
  onigoroshi: [3, 1, 0, 0],
  pacman: [1, 1, 0, 0],
  ureshino: [2, 2, 1, 0],
});

/**
 * 強さのLv（0〜40）から、戦法分布・囲い選びに使う棋力帯（0〜3）を返す。
 * Lv0〜10は六級程度まで、Lv11〜20は五級〜一級、Lv21〜34はアマ初段〜五段、Lv35以上はアマ六段〜プロ級。
 */
export function cpuOpeningTier(level) {
  if (!Number.isFinite(level)) return 1;
  if (level <= 10) return 0;
  if (level <= 20) return 1;
  if (level <= 34) return 2;
  return 3;
}

/**
 * 相手の構えに応じて組む囲いの候補。左ほど簡単な囲いで、棋力帯が上がるほど右側を選びやすい。
 * どの組み合わせも、組み込み定義と編集データの双方で先後とも完成まで進められることをテストしている。
 */
const ADAPTIVE_CASTLES = Object.freeze({
  ibisha: { static: ["yagura", "gangi", "nakazumai"], ranging: ["funagakoi", "elmo", "left-mino", "millennium"] },
  bougin: { static: ["yagura", "kanigakoi"], ranging: ["funagakoi", "elmo", "left-mino"] },
  "hayaguri-gin": { static: ["yagura", "kanigakoi"], ranging: ["funagakoi", "elmo", "left-mino", "millennium"] },
  "koshikake-gin": { static: ["yagura", "kanigakoi"], ranging: ["funagakoi", "elmo", "left-mino"] },
  "right-shiken": { static: ["yagura", "kanigakoi"], ranging: ["funagakoi", "elmo", "left-mino"] },
  "yagura-strategy": { static: ["yagura"], ranging: ["yagura"] },
  kakugawari: { static: ["nakazumai"], ranging: ["nakazumai"] },
  shiken: { static: ["mino", "high-mino", "silver-crown", "furibisha-anaguma"], ranging: ["mino", "kinmusou", "half-kinmusou"] },
  sangen: { static: ["mino", "high-mino", "silver-crown", "furibisha-anaguma"], ranging: ["mino", "kinmusou", "half-kinmusou"] },
  ishida: { static: ["mino", "high-mino", "silver-crown", "furibisha-anaguma"], ranging: ["mino", "kinmusou", "half-kinmusou"] },
  mukai: { static: ["mino", "high-mino", "silver-crown", "furibisha-anaguma"], ranging: ["kinmusou", "right-yagura", "mino"] },
  nakabisha: { static: ["half-mino", "furibisha-elmo"], ranging: ["half-kinmusou", "half-mino"] },
  gokigen: { static: ["half-mino", "furibisha-elmo"], ranging: ["half-kinmusou", "half-mino"] },
});

/** 相手に角交換されたとき、居飛車のCPUが切り替える角換わりの作戦。 */
const BISHOP_EXCHANGE_FALLBACKS = Object.freeze([
  ["kakugawari-koshikake-gin", [4, 5, 6, 6]],
  ["kakugawari-45-knight", [1, 1, 2, 2]],
]);

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

/** 対局準備で指定した角道の変化を、CPU側から見た実際の一手へ変換する。 */
export function configuredCpuBishopMove({
  bishopPreference = "",
  cpuColor = "white",
  cpuMoves = [],
  legalMoves = [],
  legalMoveDetails = [],
} = {}) {
  const moves = cpuColor === "black"
    ? { open: "7g7f", close: "6g6f", exchange: "8h2b+" }
    : { open: "3c3d", close: "4c4d", exchange: "2b8h+" };
  const played = new Set(cpuMoves);
  if (["open", "open-close", "exchange", "invite-exchange"].includes(bishopPreference)) {
    if (!played.has(moves.open) && legalMoves.includes(moves.open)) return moves.open;
  }
  if (
    bishopPreference === "open-close"
    && played.has(moves.open) && !played.has(moves.close)
    && legalMoves.includes(moves.close)
  ) return moves.close;
  if (
    bishopPreference === "exchange"
    && played.has(moves.open) && !played.has(moves.exchange)
  ) {
    const capture = legalMoveDetails.find(({ usi, pieceType, capturedPieceType }) => (
      legalMoves.includes(usi) && pieceType === "bishop" && capturedPieceType === "bishop"
    ));
    if (capture) return capture.usi;
    if (legalMoves.includes(moves.exchange)) return moves.exchange;
  }
  return undefined;
}

/** 角道設定に反するCPU着手を、定跡終了後のAI候補からも除外する。 */
export function cpuMoveMatchesBishopPreference({
  bishopPreference = "",
  cpuColor = "white",
  usi = "",
  pieceType = "",
  capturedPieceType = "",
} = {}) {
  if (!bishopPreference) return true;
  // 「交換待ち」「閉じて戦う」などでは、CPUの角から相手の角を取りに行かない。
  if (bishopPreference !== "exchange"
    && pieceType === "bishop" && capturedPieceType === "bishop") return false;
  const moves = cpuColor === "black"
    ? { open: "7g7f", close: "6g6f", reopen: "6f6e" }
    : { open: "3c3d", close: "4c4d", reopen: "4d4e" };
  if (bishopPreference === "exchange" && usi === moves.close) return false;
  if (bishopPreference === "closed" && usi === moves.open) return false;
  if (["open", "invite-exchange"].includes(bishopPreference) && usi === moves.close) return false;
  if (["closed", "open-close"].includes(bishopPreference) && usi === moves.reopen) return false;
  return true;
}

/** 明示された初手だけは、その1手に限ってAI候補より優先する。 */
export function shouldForceConfiguredCpuOpening({
  configuredFirstMove = "random",
  bishopPreference = "",
  openingMove = "",
  cpuColor = "white",
  cpuMoveCount = 0,
  cpuMoves = [],
} = {}) {
  const forceFirstMove = Boolean(
    openingMove
    && configuredFirstMove !== "random"
    && cpuColor === "black"
    && cpuMoveCount === 0
  );
  if (forceFirstMove) return true;
  return configuredCpuBishopMove({
    bishopPreference,
    cpuColor,
    cpuMoves,
    legalMoves: openingMove ? [openingMove] : [],
  }) === openingMove;
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

function repertoireMatchesBishopPreference(id, bishopPreference) {
  if (bishopPreference !== "closed") return true;
  return !openingPlanSteps("", REPERTOIRES[id].castleId).some(({ usi }) => usi === "7g7f");
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
    .filter((id) => repertoireIsAvailable(id, cpuColor, moves)
      && repertoireMatchesBishopPreference(id, bishopPreference));
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
  level = Number.NaN,
  random = Math.random,
} = {}) {
  if (Object.hasOwn(REPERTOIRES, configuredStrategy)
    && repertoireIsAvailable(configuredStrategy, cpuColor, moves)
    && repertoireMatchesBishopPreference(configuredStrategy, bishopPreference)) {
    return { ...REPERTOIRES[configuredStrategy] };
  }

  const tier = cpuOpeningTier(level);
  const categoryPool = CATEGORY_POOLS[configuredStrategy];
  if (categoryPool) {
    const eligible = categoryPool.filter((id) => repertoireIsAvailable(id, cpuColor, moves)
      && repertoireMatchesBishopPreference(id, bishopPreference));
    const categoryId = weightedChoice(distributionWeights(eligible, tier, cpuColor, moves), random)
      ?? randomChoice(eligible, random);
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

  // 「おまかせ」は、実戦の出現比率を棋力帯ごとに重み付けして選ぶ。
  const eligible = Object.keys(REPERTOIRES).filter((id) => (
    repertoireIsAvailable(id, cpuColor, moves) && repertoireMatchesBishopPreference(id, bishopPreference)
  ));
  const id = weightedChoice(distributionWeights(eligible, tier, cpuColor, moves), random) ?? "ibisha";
  return { ...REPERTOIRES[id] };
}

/**
 * 棋力帯の出現比率に、後手番での初手への応じ方を掛け合わせる。
 * 2六歩には相掛かり・角換わり、7六歩には振り飛車や矢倉が増える実戦の傾向を反映する。
 */
function distributionWeights(ids, tier, cpuColor, moves) {
  const firstMove = cpuColor === "white" ? moves[0] ?? "" : "";
  return ids.map((id) => {
    let weight = OPENING_DISTRIBUTION[id]?.[tier] ?? 0;
    if (firstMove === "2g2f") {
      if (["aigakari", "kakugawari", "kakugawari-koshikake-gin", "kakugawari-45-knight"].includes(id)) weight *= 2;
      if (RANGING_REPERTOIRE_IDS.has(id)) weight *= 0.7;
    } else if (firstMove === "7g7f") {
      if (id === "aigakari") weight *= 0.3;
      if (id === "yagura-strategy" || RANGING_REPERTOIRE_IDS.has(id)) weight *= 1.3;
    }
    return [id, weight];
  }).filter(([, weight]) => weight > 0);
}

const RANGING_REPERTOIRE_IDS = new Set(CATEGORY_POOLS.ranging);

/** 相手の構え（居飛車・振り飛車）を指し手と盤面から判定する。未確定ならundefined。 */
export function opponentOpeningStance({ opponentColor = "black", opponentMoves = [], currentSfen = "" } = {}) {
  const style = inferOpeningRookStyle({ color: opponentColor, playedMoves: opponentMoves, currentSfen });
  if (style) return style;
  // 3七・4七へ上がった銀は、飛車を振らずに攻める居飛車の合図。
  const board = parseSfenBoard(currentSfen);
  const convert = opponentColor === "white" ? mirrorUsiMove : (square) => square;
  return ["3g", "4g"].some((square) => {
    const piece = board.get(convert(square));
    return piece?.color === opponentColor && piece.kind === "S";
  }) ? "static" : undefined;
}

/** 囲いの候補に、棋力帯に応じた重みを付ける。上の帯ほど穴熊・銀冠など手数のかかる囲いを選ぶ。 */
function castleWeights(pool, tier) {
  const size = pool.length;
  return pool.map((id, index) => [id, [
    (size - index) ** 2,
    size - index,
    1,
    index + 1,
  ][tier]]);
}

/** 囲いの駒（歩以外）をすでに動かしていれば、別の囲いへ切り替えない。 */
function castleStarted(plan, color, cpuMoves) {
  if (!plan.castleId) return false;
  const pawnRank = color === "white" ? "c" : "g";
  const played = new Set(cpuMoves);
  return openingPlanSteps(plan.strategyId, plan.castleId, color)
    .some(({ usi, phase }) => phase === "castle" && usi[1] !== pawnRank && played.has(usi));
}

function planLabel(strategyId, castleId) {
  return [
    OPENING_STRATEGIES.find(({ id }) => id === strategyId)?.label,
    OPENING_CASTLES.find(({ id }) => id === castleId)?.label,
  ].filter(Boolean).join("＋");
}

/**
 * 囲いを指定しなかった作戦を、相手の構えに合わせて組み替えられる形にする。
 * 囲いは相手が居飛車か振り飛車かを見てから決めるため、最初は戦法の手順だけを持つ。
 */
export function createAdaptiveCpuPlan(plan, { adaptCastle = true, adaptStrategy = true } = {}) {
  if (!plan) return plan;
  const castleAdaptive = adaptCastle && Object.hasOwn(ADAPTIVE_CASTLES, plan.strategyId)
    && !isIntegratedOpening(plan.strategyId, "strategy");
  return {
    ...plan,
    castleId: castleAdaptive ? "" : plan.castleId,
    label: castleAdaptive ? planLabel(plan.strategyId, "") : plan.label,
    adaptCastle: castleAdaptive,
    adaptStrategy,
  };
}

/**
 * CPUの手番ごとに、相手の指し手に応じて作戦を更新する。
 * - 相手から角交換されたら、居飛車のCPUは角換わりの定跡を含む作戦へ切り替える。
 * - 相手が居飛車なら対居飛車、振り飛車なら対振り飛車の囲いを選ぶ。
 * 囲いの駒を動かし始めた後は、囲いを切り替えない。
 */
export function adaptCpuOpeningPlan({
  plan = /** @type {any} */ (null),
  cpuColor = "white",
  cpuMoves = [],
  opponentMoves = [],
  currentSfen = "",
  level = Number.NaN,
  random = Math.random,
} = {}) {
  if (!plan || (!plan.adaptCastle && !plan.adaptStrategy)) return plan;
  const tier = cpuOpeningTier(level);
  let next = plan;
  if (
    next.adaptStrategy && !next.exchangeHandled && currentSfen
    && bishopExchangeState(currentSfen, cpuColor) === "exchanged"
  ) {
    next = { ...next, exchangeHandled: true };
    const family = OPENING_STRATEGIES.find(({ id }) => id === next.strategyId)?.family;
    if (
      openingDefinitionRookStyle(next.strategyId, "strategy") === "static"
      && family !== "kakugawari" && cpuMoves.length <= 10
    ) {
      const strategyId = weightedChoice(
        BISHOP_EXCHANGE_FALLBACKS.map(([id, weights]) => [id, weights[tier]]),
        random,
      );
      next = {
        ...createAdaptiveCpuPlan(REPERTOIRES[strategyId], { adaptCastle: next.adaptCastle }),
        exchangeHandled: true,
        switchedFrom: plan.strategyId,
      };
    }
  }
  if (!next.adaptCastle) return next;
  const pools = ADAPTIVE_CASTLES[next.strategyId];
  if (!pools) return next;
  const opponentColor = cpuColor === "black" ? "white" : "black";
  // 構えが見えないまま駒組みが進んだ場合は、実戦で多い居飛車を仮定し、判明したら組み直す。
  const strategyComplete = () => isOpeningPlanComplete({
    strategyId: next.strategyId, castleId: "", color: cpuColor,
    playedMoves: cpuMoves, opponentMoves, currentSfen, completedPhases: { castle: true },
  });
  const stance = opponentOpeningStance({ opponentColor, opponentMoves, currentSfen })
    ?? (cpuMoves.length >= 3 || strategyComplete() ? "static" : undefined);
  if (!stance || next.castleStance === stance) return next;
  if (castleStarted(next, cpuColor, cpuMoves)) return next;
  const castleId = weightedChoice(castleWeights(pools[stance], tier), random);
  return { ...next, castleId, castleStance: stance, label: planLabel(next.strategyId, castleId) };
}

export { ADAPTIVE_CASTLES as CPU_ADAPTIVE_CASTLES, OPENING_DISTRIBUTION as CPU_OPENING_DISTRIBUTION };

/**
 * 「おまかせ」で、登録済みの戦法・囲いをランダムに組み合わせる割合。
 * 基本は実戦の出現比率（OPENING_DISTRIBUTION）で選び、珍しい形の練習になるランダムな組み合わせは
 * 低レベルでも2割までに抑える。高レベルほど減らし、最高レベルでは選ばない。
 */
export function randomOpeningCombinationRate(skill = 0.5) {
  const value = Number.isFinite(skill) ? Math.max(0, Math.min(1, skill)) : 0.5;
  return 0.2 * (1 - value);
}

// 自分と相手の飛車の方針から、囲い分類の対応戦型を決める。
function castleContextFor(ownStyle, opponentStyle) {
  if (!ownStyle || !opponentStyle) return undefined;
  if (ownStyle === "static") return opponentStyle === "ranging" ? "anti-ranging-static" : "aibisha";
  return opponentStyle === "static" ? "anti-static-ranging" : "double-ranging";
}

function stylesCompatible(left, right) {
  return !left || !right || left === "both" || right === "both" || left === right;
}

/**
 * 現在の局面で成立する戦法・囲い(呼び出し側で絞り込んだ定義)から、1局分の作戦をランダムに組む。
 * 戦法と一体の定義(アヒル囲い・右玉など)は相方と組み合わせない。
 * 相手の飛車の方針が分かっていれば、その戦型に合う囲いを優先する。
 * @param {{
 *   strategies?: { id: string, label: string }[],
 *   castles?: { id: string, label: string, contexts?: string[] }[],
 *   opponentRookStyle?: string,
 *   random?: () => number,
 * }} [options]
 * @returns {{ strategyId: string, castleId: string, label: string } | null}
 */
export function selectRandomOpeningCombination({
  strategies = [],
  castles = [],
  opponentRookStyle,
  random = Math.random,
} = {}) {
  const standaloneCastles = castles.filter(({ id }) => isStandaloneOpening(id, "castle"));
  const firstPicks = [
    ...strategies.map((definition) => ({ kind: "strategy", definition })),
    ...standaloneCastles.map((definition) => ({ kind: "castle", definition })),
  ];
  const first = randomChoice(firstPicks, random);
  if (!first) return null;
  if (first.kind === "castle") {
    return { strategyId: "", castleId: first.definition.id, label: first.definition.label };
  }
  const strategy = first.definition;
  if (isStandaloneOpening(strategy.id, "strategy")) {
    return { strategyId: strategy.id, castleId: "", label: strategy.label };
  }
  const style = openingDefinitionRookStyle(strategy.id, "strategy");
  const compatible = castles.filter(({ id }) => (
    !isStandaloneOpening(id, "castle")
    && stylesCompatible(style, openingDefinitionRookStyle(id, "castle"))
  ));
  const context = castleContextFor(style, opponentRookStyle);
  const fitting = context ? compatible.filter(({ contexts = [] }) => contexts.includes(context)) : [];
  const castle = randomChoice(fitting.length ? fitting : compatible, random);
  return {
    strategyId: strategy.id,
    castleId: castle?.id ?? "",
    label: [strategy.label, castle?.label].filter(Boolean).join("＋"),
  };
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
