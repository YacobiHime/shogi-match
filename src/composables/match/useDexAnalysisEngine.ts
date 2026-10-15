import { ShogiEngine } from "../../core/engine.js";
import { analysisPointsFromResults, analyzeKifuStaged } from "../../core/kifu-analysis-pipeline.mjs";
import { kifuAnalysisPlan } from "../../core/reference-kifu-analysis.mjs";
import {
  type AnalysisPoint,
  type EngineFactory,
  analysisEngineCount,
  createExtraEngines,
  engineLane,
  releaseEngines,
} from "./analysisEngines";

type DexAnalysisDeps = {
  /** 対局用のエンジンを起動して返す。起動できなければ例外にする。 */
  mainEngine: () => Promise<ShogiEngine>;
  /** 同じエンジンを使う助言探索が終わるのを待つ。 */
  waitForCoachSearches: () => Promise<unknown>;
  engineFactory: () => EngineFactory | null;
  compact: () => boolean;
};

/*
 * 図鑑で代表局を解析する。図鑑はホームの上に開くので対局の探索とは重ならないが、
 * 同じエンジンは一度に1つしか探索できないため、助言探索が終わるのを待ってから段階解析を始める。
 * 対局後の解析と同じく、解析の間だけエンジンを追加して局面を並行して読む。
 */
export function useDexAnalysisEngine({ mainEngine, waitForCoachSearches, engineFactory, compact }: DexAnalysisDeps) {
  let queue: Promise<unknown> = Promise.resolve();
  let running = false;
  let current: ShogiEngine | null = null;
  let extras: ShogiEngine[] = [];

  /** 順番待ちに並べ、対局用のエンジンを借りて読む。 */
  function enqueue<T>(task: (engine: ShogiEngine) => Promise<T>): Promise<T | undefined> {
    const run = queue.catch(() => undefined).then(async () => {
      const engine = await mainEngine();
      await waitForCoachSearches();
      running = true;
      current = engine;
      try {
        return await task(engine);
      } finally {
        releaseEngines(extras);
        extras = [];
        running = false;
        current = null;
      }
    });
    queue = run;
    return run;
  }

  const dexAnalysisEngine = {
    analyze({
      steps,
      level,
      results,
      isCancelled,
      onProgress,
      onPoints,
    }: {
      steps: { sfen: string; lastMove: string; label?: string }[];
      level: number;
      results: unknown[];
      isCancelled: () => boolean;
      onProgress: (progress: { stage: string; done: number; total: number }) => void;
      onPoints: (points: AnalysisPoint[]) => void;
    }) {
      return enqueue(async (engine) => {
        if (isCancelled()) return;
        const isCompact = compact();
        extras = await createExtraEngines(engineFactory(), analysisEngineCount(isCompact) - 1);
        if (isCancelled()) return;
        await analyzeKifuStaged({
          steps,
          lanes: [engine, ...extras].map((laneEngine) => engineLane(laneEngine, (sfen) => sfen)),
          plan: kifuAnalysisPlan(level, isCompact),
          results,
          isCancelled,
          onProgress,
          onResults: (latest: unknown[], contexts: unknown[]) => {
            if (!isCancelled()) onPoints(analysisPointsFromResults(steps, latest, contexts));
          },
        });
      });
    },
    /** 図鑑で分岐させた局面や投了図を、1局面だけ読む。解析と同じ順番待ちに並べる。 */
    searchPosition({ sfen, nodes, maxTimeMs, multiPv }: { sfen: string; nodes: number; maxTimeMs: number; multiPv: number }) {
      return enqueue(async (engine) => {
        engine.applyStrengthOptions({ multiPv });
        engine.setPosition(sfen);
        return engine.go({ nodes, maxTimeMs });
      });
    },
    // 図鑑の探索だけを止め、対局の探索には触れない。
    stop() {
      if (!running) return;
      current?.stop();
      for (const extra of extras) extra.stop();
    },
  };
  return dexAnalysisEngine;
}
