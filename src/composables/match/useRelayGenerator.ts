import type { ShogiEngine } from "../../core/engine.js";
import { playRelayGame, type RelayGame, type RelayMoveEntry } from "../../core/relay-game.mjs";
import { loadRelayStore, recallRelayGame, rememberRelayGame, saveRelayStore } from "../../core/relay-store.mjs";
import hiraganaFormationMaster from "../../data/hiragana_suisho_formations.json";
import type { EngineFactory } from "./analysisEngines";
import { createScanEngine } from "./scanAnalysis";

type RelayGeneratorDeps = {
  engineFactory: () => Promise<EngineFactory>;
  /** スマホ・タブレット縦(読む量を減らす)。 */
  compact: () => boolean;
  storage: () => Storage | null;
};

/** 1手を読む量。指し手の自然さと、作る速さ(1手30〜150ミリ秒ほど)の兼ね合い。 */
const RELAY_NODES = { compact: 6000, wide: 12000 } as const;
/** 1回の読みの上限(遅い端末で止まらないように)。 */
const RELAY_MAX_TIME_MS = 2500;

/*
 * 大会のほかの対局の中継の棋譜を作る(docs/tournament-relay-design.mdの1章・3章)。
 * 残してある棋譜があればすぐ渡し、なければ、対局用とは別の軽いエンジンで、決まった勝ち負けと展開に沿って1手ずつ指す。
 * 作った手は、すぐにonMoveで渡す(再生は、作るのを待たずに始められる)。中継の画面を閉じたら止める。
 */
export function useRelayGenerator({ engineFactory, compact, storage }: RelayGeneratorDeps) {
  let engine: ShogiEngine | null = null;
  let generation = 0;
  let queue: Promise<unknown> = Promise.resolve();

  async function ensureEngine() {
    if (!engine) engine = await createScanEngine(engineFactory);
    return engine;
  }

  /**
   * 1局の棋譜を渡す。止めたらnull。エンジンを使えない環境では例外。
   * @param spec 中継の局の設定(relay-games.mjsの項目)
   */
  function play(spec: any, onMove: (entry: RelayMoveEntry, index: number) => void): Promise<RelayGame | null> {
    cancel();
    const id = generation;
    const previous = queue;
    const run = (async () => {
      await previous.catch(() => undefined);
      if (id !== generation) return null;
      const store = loadRelayStore(storage());
      const recalled = recallRelayGame(store, spec.key);
      if (recalled.game) {
        saveRelayStore(storage(), recalled.store);
        recalled.game.entries.forEach((entry: RelayMoveEntry, index: number) => onMove(entry, index));
        return recalled.game as RelayGame;
      }
      const worker = await ensureEngine();
      if (!worker) throw new Error("中継のエンジンを起動できませんでした");
      if (id !== generation) return null;
      worker.newGame();
      const nodes = compact() ? RELAY_NODES.compact : RELAY_NODES.wide;
      const search = async ({ moves, multiPv, searchMoves }: { moves: string[]; multiPv: number; searchMoves?: string[] }) => {
        worker.applyStrengthOptions({ multiPv: Math.max(1, multiPv) });
        worker.setPosition(`startpos${moves.length ? ` moves ${moves.join(" ")}` : ""}`);
        return worker.go({ nodes, maxTimeMs: RELAY_MAX_TIME_MS, searchMoves });
      };
      const game = await playRelayGame({
        spec, search, formationMaster: hiraganaFormationMaster, onMove, isCancelled: () => id !== generation,
      });
      if (game && id === generation) saveRelayStore(storage(), rememberRelayGame(loadRelayStore(storage()), game));
      return game;
    })();
    queue = run;
    return run;
  }

  /** 作っている棋譜を止める(次のplayの前と、画面を閉じたとき)。 */
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
