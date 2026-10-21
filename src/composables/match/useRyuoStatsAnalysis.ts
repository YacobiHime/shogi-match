import type { Ref } from "vue";
import type { ShogiEngine } from "../../core/engine.js";
import { summarizeGame } from "../../core/ryuo-stats.mjs";
import type { EngineFactory } from "./analysisEngines";
import { createScanEngine, scanGameMoves } from "./scanAnalysis";

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
    if (!statsEngine) statsEngine = await createScanEngine(engineFactory);
    return statsEngine;
  }

  async function analyzeGameRecord(job: RyuoAnalysisJob) {
    const opponentRook = season.value?.players?.[job.opponentId]?.style?.rook ?? null;
    const failed = { failed: true, win: job.win, opponentRook, plies: job.moves.length };
    const worker = await ensureStatsEngine();
    if (!worker) return failed;
    const { points, sfens } = await scanGameMoves({ worker, moves: job.moves, compact: compact() });
    return summarizeGame({
      points, sfens, color: job.color, win: job.win, opponentRook, plies: job.moves.length,
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
