import type { Ref } from "vue";
import { ShogiEngine } from "../../core/engine.js";
import { analysisPointsFromResults, analyzeKifuStaged, STAGED_ANALYSIS_PLANS } from "../../core/kifu-analysis-pipeline.mjs";
import { formatHintMove } from "../../core/match-assists.mjs";
import { summarizeGame } from "../../core/ryuo-stats.mjs";
import { appendUsiMove, createGameRecord, STANDARD_SFEN } from "../../game-state";
import { type EngineFactory, engineLane, movesPosition } from "./analysisEngines";

type RyuoAnalysisJob = { seasonId: number; index: number; moves: string[]; color: "black" | "white"; win: boolean; opponentId: string };

type RyuoStatsDeps = {
  season: Ref<any>;
  saveSeason: (season: unknown) => void;
  engineFactory: () => Promise<EngineFactory>;
  compact: () => boolean;
};

/*
 * 竜王戦の統計のために、終えた対局を、対局用とは別のエンジンで裏で解析する。
 * 依頼は期の保存(analysisQueue)に残すので、リロードしても続きから解析する。
 */
export function useRyuoStatsAnalysis({ season, saveSeason, engineFactory, compact }: RyuoStatsDeps) {
  let statsEngine: ShogiEngine | null = null;
  let running = false;

  async function ensureStatsEngine(): Promise<ShogiEngine | null> {
    if (statsEngine) return statsEngine;
    try {
      const created = new ShogiEngine({ factory: await engineFactory(), hashMb: 16 });
      await created.init();
      await created.ready();
      created.newGame();
      statsEngine = created;
      return created;
    } catch {
      return null;
    }
  }

  async function analyzeGameRecord(job: RyuoAnalysisJob) {
    const opponentRook = season.value?.players?.[job.opponentId]?.style?.rook ?? null;
    const failed = { failed: true, win: job.win, opponentRook, plies: job.moves.length };
    const worker = await ensureStatsEngine();
    if (!worker) return failed;
    const replay = createGameRecord(STANDARD_SFEN);
    const steps = [{ sfen: replay.position.sfen, lastMove: "", label: "" }];
    for (const move of job.moves) {
      let label = "";
      try {
        label = formatHintMove(move, replay.position.sfen);
      } catch { /* ラベルは無くてもよい */ }
      appendUsiMove(replay, move);
      steps.push({ sfen: replay.position.sfen, lastMove: move, label });
    }
    const isCompact = compact();
    const base = STAGED_ANALYSIS_PLANS[isCompact ? "mobile" : "desktop"];
    const plan = { ...base, scan: isCompact ? { nodes: 4000, maxTimeMs: 500, multiPv: 2 } : { nodes: 8000, maxTimeMs: 700, multiPv: 2 } };
    let results: unknown[] = [];
    let contexts: unknown[] = [];
    await analyzeKifuStaged({
      steps,
      lanes: [engineLane(worker, (_sfen, ply) => movesPosition("startpos", job.moves, ply))],
      plan,
      stages: ["scan"],
      onResults: (latest: unknown[], latestContexts: unknown[]) => { results = latest; contexts = latestContexts; },
    });
    const points = analysisPointsFromResults(steps, results, contexts);
    return summarizeGame({
      points, sfens: steps.map((step) => step.sfen), color: job.color, win: job.win, opponentRook, plies: job.moves.length,
    });
  }

  /** 保存してある解析の依頼を、1局ずつ順に解析して、統計の記録として残す。 */
  async function processQueue() {
    if (running) return;
    running = true;
    try {
      for (;;) {
        const job = season.value?.analysisQueue?.[0] as RyuoAnalysisJob | undefined;
        if (!job) break;
        let record: object;
        try {
          record = await analyzeGameRecord(job);
        } catch {
          record = { failed: true, win: job.win, opponentRook: null, plies: job.moves.length };
        }
        const current = season.value;
        // 解析のあいだに、別の期に変わっていたら、記録は捨てる。
        if (!current || current.id !== job.seasonId) break;
        const updated = {
          ...current,
          analysis: { ...current.analysis, [job.index]: record },
          analysisQueue: (current.analysisQueue ?? []).filter((queued: RyuoAnalysisJob) => queued.index !== job.index),
        };
        season.value = updated;
        saveSeason(updated);
      }
    } finally {
      running = false;
      dispose();
    }
  }

  function dispose() {
    statsEngine?.quit();
    statsEngine = null;
  }

  return { processQueue, dispose };
}
