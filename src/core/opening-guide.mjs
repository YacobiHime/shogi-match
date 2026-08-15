export const OPENING_STRATEGIES = [
  {
    id: "ibisha",
    label: "居飛車",
    detectionNames: [],
    blackMoves: ["2g2f", "2f2e"],
  },
  {
    id: "aigakari",
    label: "相掛かり",
    detectionNames: ["相掛かり", "AlphaZero流相掛かり"],
    blackMoves: ["2g2f", "2f2e"],
  },
  {
    id: "kakugawari",
    label: "角換わり",
    detectionNames: ["角換わり", "一手損角換わり"],
    blackMoves: ["7g7f", "2g2f", "2f2e", "8h2b+"],
  },
  {
    id: "yagura-strategy",
    label: "矢倉戦法",
    detectionNames: ["矢倉", "金矢倉"],
    blackMoves: ["7g7f", "6g6f", "7i6h", "6h7g"],
  },
  {
    id: "shiken",
    label: "四間飛車",
    detectionNames: ["四間飛車", "ノーマル四間飛車"],
    blackMoves: ["7g7f", "6g6f", "2h6h"],
  },
  {
    id: "fujii-system",
    label: "藤井システム",
    detectionNames: ["藤井システム"],
    blackMoves: ["7g7f", "6g6f", "2h6h", "1g1f", "8h7g", "3i3h", "6i5h", "7i7h"],
  },
  {
    id: "sangen",
    label: "三間飛車",
    detectionNames: ["三間飛車", "ノーマル三間飛車"],
    blackMoves: ["7g7f", "6g6f", "2h7h"],
  },
  {
    id: "nakabisha",
    label: "中飛車",
    detectionNames: ["中飛車", "ゴキゲン中飛車"],
    blackMoves: ["5g5f", "2h5h"],
  },
  {
    id: "gokigen",
    label: "ゴキゲン中飛車",
    detectionNames: ["ゴキゲン中飛車"],
    blackMoves: ["5g5f", "2h5h", "7g7f"],
  },
  {
    id: "mukai",
    label: "向かい飛車",
    detectionNames: ["向かい飛車", "ダイレクト向かい飛車"],
    blackMoves: ["7g7f", "8h7g", "2h8h"],
  },
  {
    id: "ishida",
    label: "石田流",
    detectionNames: ["石田流", "早石田"],
    blackMoves: ["7g7f", "7f7e", "2h7h", "7h7f"],
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
  {
    id: "hayaguri-gin",
    label: "早繰り銀",
    detectionNames: ["早繰り銀"],
    blackMoves: ["3g3f", "3i4h", "4h3g", "3g4f"],
  },
  {
    id: "koshikake-gin",
    label: "腰掛け銀",
    detectionNames: ["腰掛け銀"],
    blackMoves: ["4g4f", "3i4h", "4h4g", "4g5f"],
  },
  {
    id: "sodebisha",
    label: "袖飛車",
    detectionNames: ["袖飛車"],
    blackMoves: ["3g3f", "2h3h"],
  },
  {
    id: "onigoroshi",
    label: "鬼殺し",
    detectionNames: ["鬼殺し"],
    blackMoves: ["7g7f", "7f7e", "8i7g"],
  },
  {
    id: "ureshino",
    label: "嬉野流",
    detectionNames: ["嬉野流"],
    blackMoves: ["6g6f", "7i6h", "6h6g"],
  },
];

export const OPENING_CASTLES = [
  {
    id: "mino",
    label: "美濃囲い",
    detectionNames: ["美濃囲い", "本美濃", "高美濃囲い", "銀冠"],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h"],
  },
  {
    id: "high-mino",
    label: "高美濃囲い",
    detectionNames: ["高美濃", "高美濃囲い"],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h", "4g4f", "5h4g"],
  },
  {
    id: "silver-crown",
    label: "銀冠",
    detectionNames: ["銀冠", "端玉銀冠"],
    blackMoves: ["2h6h", "5i4h", "4h3h", "3h2h", "3i3h", "6i5h", "4g4f", "5h4g", "2g2f", "3h2g", "4i3h"],
  },
  {
    id: "furibisha-anaguma",
    label: "振り飛車穴熊",
    detectionNames: ["振り飛車穴熊", "四枚穴熊", "銀冠穴熊"],
    blackMoves: ["2h6h", "1i1h", "5i4h", "4h3h", "3h2h", "2h1i", "3i2h"],
  },
  {
    id: "funagakoi",
    label: "舟囲い",
    detectionNames: ["舟囲い", "箱入り娘"],
    blackMoves: ["5i6h", "6h7h", "4i5h"],
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
  {
    id: "gangi",
    label: "雁木",
    detectionNames: ["雁木"],
    blackMoves: ["7g7f", "8h7g", "6g6f", "7i6h", "6h6g", "5i6h", "6h7i", "7i8h", "6i7h"],
  },
  {
    id: "left-mino",
    label: "左美濃",
    detectionNames: ["左美濃", "居角左美濃", "天守閣美濃"],
    blackMoves: ["7g7f", "8h6f", "7i7h", "5i6h", "6h7i", "7i8h", "6i6h"],
  },
  {
    id: "ibisha-anaguma",
    label: "居飛車穴熊",
    detectionNames: ["居飛車穴熊", "松尾流穴熊"],
    strictOrder: true,
    completionSquares: [
      ["9i", "K"], ["9h", "L"], ["8h", "S"], ["7h", "G"], ["7g", "N"],
    ],
    blackMoves: ["9i9h", "7g7f", "8h6f", "8i7g", "7i8h", "6i7h", "5i6i", "6i7i", "7i8i", "8i9i"],
  },
  {
    id: "millennium",
    label: "ミレニアム",
    detectionNames: ["ミレニアム", "振り飛車ミレニアム"],
    blackMoves: ["7g7f", "8h6f", "8i7g", "7i8h", "6i7i", "5i6h", "6h7h", "7h8i"],
  },
  {
    id: "right-king",
    label: "右玉",
    // 戦型判定は4八玉だけでも成立するため、補助では完成形を直接確認する。
    detectionNames: [],
    strictOrder: true,
    completionSquares: [
      ["4h", "K"], ["7h", "G"], ["6g", "S"],
      ["4g", "S"], ["3g", "N"], ["2i", "R"],
    ],
    blackMoves: [
      "7g7f", "6g6f", "7i6h", "6h6g", "3i4h", "4g4f",
      "4h4g", "3g3f", "6i7h", "5i4h", "2i3g", "2h2i",
    ],
  },
  {
    id: "kinmusou",
    label: "金無双",
    detectionNames: ["金無双", "離れ金無双", "銀冠金無双"],
    strictOrder: true,
    completionSquares: [
      ["3h", "K"], ["2h", "S"], ["4h", "G"], ["5h", "G"], ["6h", "R"],
    ],
    // 金無双を単独で選んでも、先に四間へ振って玉の退路と2八銀の場所を空ける。
    blackMoves: [
      "7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3i2h", "4i4h", "6i5h",
    ],
  },
  {
    id: "nakazumai",
    label: "中住まい",
    detectionNames: ["中住まい", "中原囲い"],
    blackMoves: ["5i5h", "4i3h", "6i7h"],
  },
  {
    id: "kanigakoi",
    label: "カニ囲い",
    detectionNames: ["カニ囲い"],
    blackMoves: ["6i7h", "7i6h", "5i6i", "4i5h"],
  },
  {
    id: "bonanza",
    label: "ボナンザ囲い",
    detectionNames: ["ボナンザ囲い"],
    blackMoves: ["7g7f", "8h6f", "7i7h", "7h7g", "5i6h", "6h7h", "6i6h", "4i5h"],
  },
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

function parseSfenBoard(sfen) {
  const boardPart = String(sfen ?? "").trim().split(/\s+/)[0];
  const ranks = boardPart.split("/");
  if (ranks.length !== 9) return new Map();
  const board = new Map();
  ranks.forEach((rank, rankIndex) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) {
        file -= Number(symbol);
      } else if (symbol === "+") {
        promoted = true;
      } else {
        board.set(`${file}${String.fromCharCode(97 + rankIndex)}`, {
          color: symbol === symbol.toUpperCase() ? "black" : "white",
          kind: `${promoted ? "+" : ""}${symbol.toUpperCase()}`,
        });
        file -= 1;
        promoted = false;
      }
    }
  });
  return board;
}

function matchesCompletionSquares(definition, currentSfen, color) {
  if (!definition?.completionSquares?.length || !currentSfen) return undefined;
  const board = parseSfenBoard(currentSfen);
  return definition.completionSquares.every(([blackSquare, kind]) => {
    const square = color === "white" ? mirrorUsiMove(blackSquare) : blackSquare;
    const piece = board.get(square);
    return piece?.color === color && piece.kind === kind;
  });
}

function definitionDetectedComplete(definition, detected, currentSfen, color) {
  const exact = matchesCompletionSquares(definition, currentSfen, color);
  if (exact !== undefined) return exact;
  return definition?.detectionNames.some((name) => detected.has(name)) ?? false;
}

export function nextOpeningPlanMove({
  strategyId,
  castleId,
  color = "black",
  playedMoves = [],
  legalMoves = [],
  detectedFormations = [],
  currentSfen = "",
}) {
  const strategy = OPENING_STRATEGIES.find(({ id }) => id === strategyId);
  const castle = OPENING_CASTLES.find(({ id }) => id === castleId);
  const detected = new Set(detectedFormations);
  const strategyComplete = definitionDetectedComplete(strategy, detected, currentSfen, color);
  const castleComplete = definitionDetectedComplete(castle, detected, currentSfen, color);
  const played = new Set(playedMoves);
  const legal = new Set(legalMoves);

  const steps = openingPlanSteps(strategyId, castleId, color);
  for (const phase of ["strategy", "castle"]) {
    const definition = phase === "strategy" ? strategy : castle;
    const complete = phase === "strategy" ? strategyComplete : castleComplete;
    if (!definition || complete) continue;
    const pending = steps.filter((entry) => entry.phase === phase && !played.has(entry.usi));
    if (definition.strictOrder) {
      const next = pending[0];
      if (next) return legal.has(next.usi) ? next : null;
      continue;
    }
    const next = pending.find(({ usi }) => legal.has(usi));
    if (next) return next;
  }
  return null;
}

export function isOpeningPlanComplete({
  strategyId,
  castleId,
  color = "black",
  playedMoves = [],
  detectedFormations = [],
  currentSfen = "",
}) {
  if (!strategyId && !castleId) return false;
  const detected = new Set(detectedFormations);
  const played = new Set(playedMoves);
  const steps = openingPlanSteps(strategyId, castleId, color);
  const phaseComplete = (id, phase, entries) => {
    if (!id) return true;
    const definitions = phase === "strategy" ? OPENING_STRATEGIES : OPENING_CASTLES;
    const definition = definitions.find(({ id: candidateId }) => candidateId === id);
    if (!definition) return false;
    const exact = matchesCompletionSquares(definition, currentSfen, color);
    if (exact !== undefined) return exact;
    if (definition.detectionNames.some((name) => detected.has(name))) return true;
    return entries.length > 0 && entries.every(({ usi }) => played.has(usi));
  };
  return phaseComplete(
    strategyId,
    "strategy",
    steps.filter(({ phase }) => phase === "strategy"),
  ) && phaseComplete(
    castleId,
    "castle",
    steps.filter(({ phase }) => phase === "castle"),
  );
}

export function openingFollowupCount(random = Math.random) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
  return 3 + Math.floor(normalized * 3);
}

/** 相手の定跡進行に対し、形作りより先に必要となる応手を返す。 */
export function openingUrgentResponse({
  strategyId,
  color = "black",
  moveHistory = [],
  legalMoves = [],
}) {
  if (strategyId !== "aigakari") return null;
  const played = new Set(moveHistory);
  const legal = new Set(legalMoves);
  const lastMove = moveHistory.at(-1);
  if (
    color === "black"
    && lastMove === "8d8e"
    && played.has("2g2f") && played.has("2f2e")
    && legal.has("6i7h")
  ) {
    return {
      usi: "6i7h",
      reason: "相手が8五歩まで伸ばしたから、先に7八金で角頭を守ろう！",
    };
  }
  if (
    color === "white"
    && lastMove === "2f2e"
    && played.has("8c8d")
    && legal.has("4a3b")
  ) {
    return {
      usi: "4a3b",
      reason: "相手が2五歩まで伸ばしたから、先に3二金で角頭を守ろう！",
    };
  }
  return null;
}

function comparableOpeningScore(score) {
  if (score?.type === "cp" && Number.isFinite(score.value)) return score.value;
  if (score?.type === "mate" && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - score.value;
    if (score.value < 0) return -100000 + Math.abs(score.value);
  }
  return undefined;
}

/** 固定手順がAI上位候補から外れる、または大きく評価を落とす場合は安全な手へ差し替える。 */
export function chooseSafeOpeningMove(plannedMove, candidates = [], maxScoreLoss = 250) {
  const ranked = [...candidates]
    .filter(({ rank, move }) => Number.isInteger(rank) && rank >= 1 && typeof move === "string")
    .sort((left, right) => left.rank - right.rank);
  const best = ranked.find(({ rank }) => rank === 1);
  if (!plannedMove || !best?.move) return plannedMove
    ? { usi: plannedMove, source: "plan", scoreLoss: 0 }
    : null;
  const planned = ranked.find(({ move }) => move === plannedMove);
  if (!planned) return { usi: best.move, source: "ai", scoreLoss: undefined };
  const bestScore = comparableOpeningScore(best.score);
  const plannedScore = comparableOpeningScore(planned.score);
  if (bestScore === undefined || plannedScore === undefined) {
    return { usi: plannedMove, source: "plan", scoreLoss: 0 };
  }
  const scoreLoss = bestScore - plannedScore;
  return scoreLoss >= maxScoreLoss
    ? { usi: best.move, source: "ai", scoreLoss }
    : { usi: plannedMove, source: "plan", scoreLoss };
}
