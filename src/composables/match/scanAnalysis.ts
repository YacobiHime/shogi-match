import { ShogiEngine } from "../../core/engine.js";
import { analysisPointsFromResults, analyzeKifuStaged, STAGED_ANALYSIS_PLANS } from "../../core/kifu-analysis-pipeline.mjs";
import { formatHintMove } from "../../core/match-assists.mjs";
import { appendUsiMove, createGameRecord, STANDARD_SFEN } from "../../game-state";
import { type EngineFactory, engineLane, movesPosition } from "./analysisEngines";

/*
 * 終えた対局を、対局用とは別の軽いエンジンで、1手ずつ浅く読む(裏の解析)。
 * 竜王戦の統計(useRyuoStatsAnalysis.ts)と、自由対局の中身の記録(usePlayInsightAnalysis.ts)が使う。
 */

/** 裏の解析用のエンジンを作る。使えない環境(WASMを動かせないなど)ではnull。 */
export async function createScanEngine(engineFactory: () => Promise<EngineFactory>): Promise<ShogiEngine | null> {
  try {
    const created = new ShogiEngine({ factory: await engineFactory(), hashMb: 16 });
    await created.init();
    await created.ready();
    created.newGame();
    return created;
  } catch {
    return null;
  }
}

/**
 * 平手の初期局面からの手順を、1手ずつ浅く読む。pointsは棋譜解析の点、sfensは0手目からの局面。
 * isCancelledが真になったら途中でやめ、cancelledを真にして返す。
 */
export async function scanGameMoves({ worker, moves, compact, isCancelled = () => false }: {
  worker: ShogiEngine; moves: string[]; compact: boolean; isCancelled?: () => boolean;
}) {
  const replay = createGameRecord(STANDARD_SFEN);
  const steps = [{ sfen: replay.position.sfen, lastMove: "", label: "" }];
  for (const move of moves) {
    let label = "";
    try {
      label = formatHintMove(move, replay.position.sfen);
    } catch { /* ラベルは無くてもよい */ }
    appendUsiMove(replay, move);
    steps.push({ sfen: replay.position.sfen, lastMove: move, label });
  }
  const base = STAGED_ANALYSIS_PLANS[compact ? "mobile" : "desktop"];
  const plan = { ...base, scan: compact ? { nodes: 4000, maxTimeMs: 500, multiPv: 2 } : { nodes: 8000, maxTimeMs: 700, multiPv: 2 } };
  let results: unknown[] = [];
  let contexts: unknown[] = [];
  await analyzeKifuStaged({
    steps,
    lanes: [engineLane(worker, (_sfen, ply) => movesPosition("startpos", moves, ply))],
    plan,
    stages: ["scan"],
    isCancelled,
    onResults: (latest: unknown[], latestContexts: unknown[]) => { results = latest; contexts = latestContexts; },
  });
  return {
    cancelled: isCancelled(),
    points: analysisPointsFromResults(steps, results, contexts),
    sfens: steps.map((step) => step.sfen),
  };
}
