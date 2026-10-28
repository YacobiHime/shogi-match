import type { ShogiEngine } from "../../core/engine.js";
import type { RelayGame, RelayMoveEntry } from "../../core/relay-game.mjs";
import { clearEngineGameProgress, loadEngineGameProgress, playEngineGame, saveEngineGameProgress } from "../../core/engine-game.mjs";
import { loadRelayStore, recallRelayGame, rememberRelayGame, saveRelayStore } from "../../core/relay-store.mjs";
import hiraganaFormationMaster from "../../data/hiragana_suisho_formations.json";
import type { EngineFactory } from "./analysisEngines";
import { createScanEngine } from "./scanAnalysis";

type EngineGameDeps = {
  engineFactory: () => Promise<EngineFactory>;
  storage: () => Storage | null;
};

/** 1回の読みの上限(遅い端末で止まらないように。読みは読む量で止めるのがふつう)。 */
const MAX_TIME_MS = 60000;

/*
 * 本局(docs/tournament-relay-design.mdの20章)を、対局用とは別の軽いエンジンで本当に指す。
 * 終わった本局は中継の保存(relay-store.mjs)に残し、次からはすぐ渡す。指している途中の手は1手ごとに残し、
 * 画面を離れて戻ったら続きから指す。手は、指したらすぐonMoveで渡す(保存していた手も、最初にまとめて渡す)。
 */
export function useEngineGame({ engineFactory, storage }: EngineGameDeps) {
  let engine: ShogiEngine | null = null;
  let generation = 0;
  let queue: Promise<unknown> = Promise.resolve();

  async function ensureEngine() {
    if (!engine) engine = await createScanEngine(engineFactory);
    return engine;
  }

  /**
   * 本局を指す(終わっていればその棋譜)。止めたらnull。エンジンを使えない環境では例外。
   * @param spec 本局の設定(relay-games.mjsの項目。winnerは決めない)
   */
  function play(spec: any, onMove: (entry: RelayMoveEntry, index: number) => void): Promise<RelayGame | null> {
    cancel();
    const id = generation;
    const previous = queue;
    const run = (async () => {
      await previous.catch(() => undefined);
      if (id !== generation) return null;
      const recalled = recallRelayGame(loadRelayStore(storage()), spec.key);
      if (recalled.game) {
        recalled.game.entries.forEach((entry: RelayMoveEntry, index: number) => onMove(entry, index));
        return recalled.game as RelayGame;
      }
      const resume = loadEngineGameProgress(storage(), spec.key) as RelayMoveEntry[];
      resume.forEach((entry, index) => onMove(entry, index));
      const worker = await ensureEngine();
      if (!worker) throw new Error("本局のエンジンを起動できませんでした");
      if (id !== generation) return null;
      worker.newGame();
      const search = async ({ moves, nodes, multiPv, searchMoves, threads }: {
        moves: string[]; nodes: number; multiPv: number; searchMoves?: string[]; threads?: number;
      }) => {
        worker.applyStrengthOptions({ multiPv: Math.max(1, multiPv) });
        await worker.setSearchThreads(threads ?? 1);
        worker.setPosition(`startpos${moves.length ? ` moves ${moves.join(" ")}` : ""}`);
        return worker.go({ nodes, maxTimeMs: MAX_TIME_MS, searchMoves });
      };
      const played = [...resume];
      const game = await playEngineGame({
        spec, search, formationMaster: hiraganaFormationMaster, resume, isCancelled: () => id !== generation,
        onMove: (entry: RelayMoveEntry, index: number) => {
          played[index] = entry;
          saveEngineGameProgress(storage(), spec.key, played);
          onMove(entry, index);
        },
      });
      if (game && id === generation) {
        saveRelayStore(storage(), rememberRelayGame(loadRelayStore(storage()), game));
        clearEngineGameProgress(storage(), spec.key);
      }
      return game as RelayGame | null;
    })();
    queue = run;
    return run;
  }

  /** 指している本局を止める(途中の手は残っている)。 */
  function cancel() {
    generation += 1;
    try {
      engine?.stop();
    } catch {
      // 止まっているエンジンは無視する。
    }
  }

  function dispose() {
    cancel();
    const current = engine;
    engine = null;
    void queue.finally(() => current?.quit());
  }

  return { play, cancel, dispose };
}
