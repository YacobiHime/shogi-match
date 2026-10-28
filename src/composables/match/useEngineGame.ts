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

type SearchRequest = { moves: string[]; nodes: number; multiPv: number; searchMoves?: string[]; threads?: number };
type Waiting = {
  key: string;
  generation: number;
  order: number;
  request: SearchRequest;
  resolve: (value: any) => void;
  reject: (error: unknown) => void;
};

/** 1回の読みの上限(遅い端末で止まらないように。読みは読む量で止めるのがふつう)。 */
const MAX_TIME_MS = 60000;

class Cancelled extends Error {}

/*
 * 本局(docs/tournament-relay-design.mdの20章)を、対局用とは別の軽いエンジンで本当に指す。
 * 回戦の全局を同時に指す(20-9)。エンジンはengines台(既定1台)を並べ、各局の1回ずつの読みを順に割り当てる。
 * どの局の読みを先にするかはsetPriorityの関数で決める(小さいほど先。画面は、見ている局と、表示が追いついた局を先にする)。
 * 終わった本局は中継の保存(relay-store.mjs)に残し、次からはすぐ渡す。指している途中の手は1手ごとに残し、
 * 画面を離れて戻ったら続きから指す。手は、指したらすぐonMoveで渡す(保存していた手も、最初にまとめて渡す)。
 */
export function useEngineGame({ engineFactory, storage }: EngineGameDeps) {
  const workers: ShogiEngine[] = [];
  const busy = new Set<ShogiEngine>();
  const waiting: Waiting[] = [];
  let starting: Promise<void> | null = null;
  let size = 1;
  let generation = 0;
  let order = 0;
  let priorityOf: (key: string) => number = () => 0;
  const running = new Set<Promise<unknown>>();

  /** エンジンの台数(次に起動するときから)。 */
  function setEngines(count: number) {
    size = Math.max(1, Math.floor(count));
  }
  function setPriority(fn: (key: string) => number) {
    priorityOf = fn;
  }

  async function ensureEngines() {
    if (workers.length >= size) return;
    starting ??= (async () => {
      try {
        while (workers.length < size) {
          const worker = await createScanEngine(engineFactory);
          if (!worker) break;
          worker.newGame();
          workers.push(worker);
        }
      } finally {
        starting = null;
      }
    })();
    await starting;
    if (!workers.length) throw new Error("本局のエンジンを起動できませんでした");
  }

  /** 待っている読みを、空いたエンジンに割り当てる。 */
  function dispatch() {
    // 止めた本局の読みは捨てる。
    for (let index = waiting.length - 1; index >= 0; index -= 1) {
      if (waiting[index].generation !== generation) waiting.splice(index, 1)[0].reject(new Cancelled());
    }
    for (const worker of workers) {
      if (busy.has(worker)) continue;
      if (!waiting.length) return;
      let pick = 0;
      let bestScore = Infinity;
      waiting.forEach((item, index) => {
        const score = priorityOf(item.key);
        if (score < bestScore || (score === bestScore && item.order < waiting[pick].order)) {
          pick = index;
          bestScore = score;
        }
      });
      const [item] = waiting.splice(pick, 1);
      busy.add(worker);
      void (async () => {
        try {
          const { moves, nodes, multiPv, searchMoves, threads } = item.request;
          worker.applyStrengthOptions({ multiPv: Math.max(1, multiPv) });
          await worker.setSearchThreads(threads ?? 1);
          worker.setPosition(`startpos${moves.length ? ` moves ${moves.join(" ")}` : ""}`);
          item.resolve(await worker.go({ nodes, maxTimeMs: MAX_TIME_MS, searchMoves }));
        } catch (error) {
          item.reject(error);
        } finally {
          busy.delete(worker);
          dispatch();
        }
      })();
    }
  }

  function enqueue(key: string, id: number, request: SearchRequest) {
    if (id !== generation) return Promise.reject(new Cancelled());
    return new Promise<any>((resolve, reject) => {
      waiting.push({ key, generation: id, order: (order += 1), request, resolve, reject });
      dispatch();
    });
  }

  /**
   * 本局を指す(終わっていればその棋譜)。ほかの本局と同時に指せる。止めたらnull。エンジンを使えない環境では例外。
   * @param spec 本局の設定(engine-game.mjsのrealGameSpec。winnerは決めない)
   */
  function play(spec: any, onMove: (entry: RelayMoveEntry, index: number) => void): Promise<RelayGame | null> {
    const id = generation;
    const run = (async () => {
      const recalled = recallRelayGame(loadRelayStore(storage()), spec.key);
      if (recalled.game) {
        recalled.game.entries.forEach((entry: RelayMoveEntry, index: number) => onMove(entry, index));
        return recalled.game as RelayGame;
      }
      const resume = loadEngineGameProgress(storage(), spec.key) as RelayMoveEntry[];
      resume.forEach((entry, index) => onMove(entry, index));
      await ensureEngines();
      if (id !== generation) return null;
      const played = [...resume];
      try {
        const game = await playEngineGame({
          spec, formationMaster: hiraganaFormationMaster, resume, isCancelled: () => id !== generation,
          search: (request: SearchRequest) => enqueue(spec.key, id, request),
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
        return id === generation ? game as RelayGame | null : null;
      } catch (error) {
        if (error instanceof Cancelled || id !== generation) return null;
        throw error;
      }
    })();
    running.add(run);
    void run.catch(() => undefined).finally(() => running.delete(run));
    return run;
  }

  /** 指している本局を全部止める(途中の手は残っている)。 */
  function cancel() {
    generation += 1;
    dispatch();
    for (const worker of busy) {
      try {
        worker.stop();
      } catch {
        // 止まっているエンジンは無視する。
      }
    }
  }

  function dispose() {
    cancel();
    const current = [...workers];
    workers.length = 0;
    void Promise.allSettled([...running]).finally(() => current.forEach((worker) => worker.quit()));
  }

  return { play, cancel, dispose, setEngines, setPriority };
}
