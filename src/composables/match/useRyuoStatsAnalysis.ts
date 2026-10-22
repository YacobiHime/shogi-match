import type { Ref } from "vue";
import type { ShogiEngine } from "../../core/engine.js";
import { addAnalyzedGame, loadPlayInsight, savePlayInsight, summarizePlayInsight } from "../../core/play-insight.mjs";
import { summarizeGame } from "../../core/ryuo-stats.mjs";
import { STANDARD_SFEN } from "../../game-state";
import type { EngineFactory } from "./analysisEngines";
import { createScanEngine, scanGameMoves } from "./scanAnalysis";
import { saveMissedMates } from "./usePlayInsightAnalysis";

type RyuoAnalysisJob = { seasonId: number; index: number; moves: string[]; color: "black" | "white"; win: boolean; opponentId: string };

type RyuoStatsDeps = {
  season: Ref<any>;
  saveSeason: (season: unknown) => void;
  engineFactory: () => Promise<EngineFactory>;
  compact: () => boolean;
  /** 対局の中身の記録(core/play-insight.mjs)の保存先と、記録が変わったとき。同じ解析を、弱点の練習にも使う。 */
  storage: () => Storage | null;
  onInsight: (insight: ReturnType<typeof loadPlayInsight>) => void;
};

/*
 * 竜王戦の統計のために、終えた対局を、対局用とは別のエンジンで裏で解析する。
 * 依頼は期の保存(analysisQueue)に残すので、リロードしても続きから解析する。
 * 同じ解析から、対局の中身の要約も作り、弱点の練習の材料(play-insight)に足す(docs/home-next-adaptive-design.mdの14章)。
 * 見逃した短い詰みは、自由対局と同じく復習の箱へ入れる。
 */
export function useRyuoStatsAnalysis({ season, saveSeason, engineFactory, compact, storage, onInsight }: RyuoStatsDeps) {
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
    recordInsight(job, points, sfens);
    return summarizeGame({
      points, sfens, color: job.color, win: job.win, opponentRook, plies: job.moves.length,
    });
  }

  /** 対局の中身の要約を、弱点の練習の材料に足す。失敗しても、統計の記録は残す。 */
  function recordInsight(job: RyuoAnalysisJob, points: unknown[], sfens: string[]) {
    try {
      const summary = summarizePlayInsight({ points, sfens, moves: job.moves, color: job.color, initialSfen: STANDARD_SFEN });
      const store = storage();
      saveMissedMates(store, summary.mates);
      const level = season.value?.players?.[job.opponentId]?.level;
      const updated = addAnalyzedGame(loadPlayInsight(store), {
        at: Date.now(), level: Number.isFinite(level) ? level : 0, outcome: job.win ? "win" : "loss", color: job.color, event: "ryuo", summary,
      });
      savePlayInsight(store, updated);
      onInsight(updated);
    } catch {
      // 要約を作れなくても、統計の記録は残す。
    }
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
