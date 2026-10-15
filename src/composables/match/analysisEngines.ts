import { ShogiEngine } from "../../core/engine.js";

export type EngineFactory = (options?: any) => Promise<any>;

/** 棋譜解析の評価値グラフの1点。対局後の解析・図鑑・竜王戦の統計で共通。 */
export type AnalysisPoint = {
  ply: number;
  graphValue: number;
  label: string;
  scoreLabel: string;
  bestMove?: string;
  pv?: string[];
  score?: { type: "cp" | "mate"; value: number };
  secondScore?: { type: "cp" | "mate"; value: number };
  annotation?: {
    kind: "blunder" | "mistake" | "dubious" | "good" | "brilliant";
    label: string;
    mover: "black" | "white";
  } | null;
};

export type LaneOptions = { nodes: number; multiPv: number; maxTimeMs: number; fresh?: boolean };

/*
 * 棋譜解析の間だけ、局面を並行して読むエンジンを追加する。対局用のエンジンと合わせた数を返す。
 * 1つあたり数十MBのメモリを使うため、スマホではメモリとコアに余裕のある端末だけ2つにする。
 */
export function analysisEngineCount(compact: boolean) {
  const cores = Number(globalThis.navigator?.hardwareConcurrency) || 2;
  const memory = Number((globalThis.navigator as { deviceMemory?: number } | undefined)?.deviceMemory) || 4;
  if (compact) return cores >= 6 && memory >= 4 ? 2 : 1;
  return Math.max(1, Math.min(4, cores - 1));
}

/** 解析用のエンジンを追加で起動する。起動できなかった分は除き、起動できた分だけ返す。 */
export async function createExtraEngines(factory: EngineFactory | null, count: number): Promise<ShogiEngine[]> {
  if (!factory || count < 1) return [];
  const created = await Promise.all(Array.from({ length: count }, async () => {
    const extra = new ShogiEngine({ factory, hashMb: 16 });
    try {
      await extra.init();
      await extra.ready();
      extra.newGame();
      return extra;
    } catch {
      // 追加のエンジンを起動できなくても、対局用のエンジンだけで解析を続ける。
      extra.quit();
      return null;
    }
  }));
  return created.filter((extra): extra is ShogiEngine => Boolean(extra));
}

export function releaseEngines(engines: ShogiEngine[]) {
  for (const extra of engines) {
    try {
      extra.stop();
      extra.quit();
    } catch { /* 終了済みのエンジンは無視する */ }
  }
}

/**
 * 段階解析(analyzeKifuStaged)の1レーン。positionForで、読ませる局面のUSIの指定を作る。
 * 神の一手の浅い読みは、深い読みの結果が残らないよう置換表を消してから読む(fresh)。
 */
export function engineLane(laneEngine: ShogiEngine, positionFor: (sfen: string, ply: number) => string) {
  return async (sfen: string, options: LaneOptions, ply: number) => {
    if (options.fresh) {
      laneEngine.newGame();
      await laneEngine.ready();
    }
    laneEngine.applyStrengthOptions({ multiPv: options.multiPv });
    laneEngine.setPosition(positionFor(sfen, ply));
    return laneEngine.go({ nodes: options.nodes, maxTimeMs: options.maxTimeMs });
  };
}

/** 初期局面からの手順で読ませる指定。千日手を正しく判定できるよう、局面ではなく手順を渡す。 */
export function movesPosition(base: string, moves: readonly string[], ply: number) {
  return `${base}${ply ? ` moves ${moves.slice(0, ply).join(" ")}` : ""}`;
}
