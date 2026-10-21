import type { ShogiEngine } from "../../core/engine.js";
import { completePlayInsight, loadPlayInsight, savePlayInsight, summarizePlayInsight } from "../../core/play-insight.mjs";
import { addReviewProblems, buildReviewProblem, loadReviewProblems, saveReviewProblems } from "../../core/review-problems.mjs";
import { loadReviewQueue, recordReviewResult, saveReviewQueue } from "../../core/review-queue.mjs";
import { STANDARD_SFEN } from "../../game-state";
import type { EngineFactory } from "./analysisEngines";
import { createScanEngine, scanGameMoves } from "./scanAnalysis";

type PlayInsight = ReturnType<typeof loadPlayInsight>;

type PlayInsightDeps = {
  storage: () => Storage | null;
  engineFactory: () => Promise<EngineFactory>;
  compact: () => boolean;
  /** 対局中は真。裏の解析を止めて、続きは次の機会にする。 */
  paused: () => boolean;
  /** 記録が変わったとき(1局の解析を終えたとき)。 */
  onUpdated: (insight: PlayInsight) => void;
};

/*
 * 自由対局の中身の記録(core/play-insight.mjs)のために、終えた対局を、対局用とは別のエンジンで裏で解析する
 * (docs/home-next-adaptive-design.mdの5章)。解析を待つ対局は保存してあるので、リロードしても続きから解析する。
 * 対局が始まったら止める(1局の途中なら、その対局は次の機会に読み直す)。
 * 見逃した短い詰みは、振り返りと同じく「あなたの対局から」の問題にして、復習の箱へ入れる。
 */
export function usePlayInsightAnalysis({ storage, engineFactory, compact, paused, onUpdated }: PlayInsightDeps) {
  let engine: ShogiEngine | null = null;
  let running = false;

  function saveMissedMates(mates: { sfen: string; length: number }[]) {
    const problems = mates.map(({ sfen, length }) => buildReviewProblem({ sfen, mateLength: length })).filter((problem) => problem !== null);
    if (!problems.length) return;
    const store = storage();
    saveReviewProblems(store, addReviewProblems(loadReviewProblems(store), problems));
    let queue = loadReviewQueue(store);
    for (const problem of problems) {
      // すでに復習の箱にある問題は、間隔を巻き戻さない。
      if (!queue.items[problem.id]) queue = recordReviewResult(queue, problem.id, { firstTry: false });
    }
    saveReviewQueue(store, queue);
  }

  async function processQueue() {
    if (running) return;
    running = true;
    try {
      for (;;) {
        if (paused()) break;
        const job = loadPlayInsight(storage()).queue[0];
        if (!job) break;
        if (!engine) engine = await createScanEngine(engineFactory);
        let summary = null;
        if (engine) {
          try {
            const scanned = await scanGameMoves({ worker: engine, moves: job.moves, compact: compact(), isCancelled: paused });
            if (scanned.cancelled) break;
            summary = summarizePlayInsight({ ...scanned, moves: job.moves, color: job.color, initialSfen: STANDARD_SFEN });
          } catch {
            summary = null;
          }
        }
        // エンジンが使えない・解析に失敗したときは、勝ち負けだけ残す(内容の強さは使わず、結果だけで見立てる)。
        if (summary) saveMissedMates(summary.mates);
        const updated = completePlayInsight(loadPlayInsight(storage()), job, summary);
        savePlayInsight(storage(), updated);
        onUpdated(updated);
      }
    } finally {
      running = false;
      dispose();
    }
  }

  function dispose() {
    engine?.quit();
    engine = null;
  }

  return { processQueue, dispose };
}
