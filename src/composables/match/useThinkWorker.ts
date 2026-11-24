// 理由で指す棋士の考え方(reason-think.mjs)を、Workerで動かす(docs/disciple-mode-design.mdの34-17)。
// 1手に1〜2秒かかるので、画面の糸で動かすと観戦の盤が止まる。Workerが使えない環境では、その場で考える。
import ThinkWorker from "../../core/reason-think-worker.mjs?worker&inline";
import { thinkHere } from "../../core/reason-think.mjs";

type ThinkRequest = { sfen: string; levels: Record<string, number>; planMove: string | null; seed: number; budgetMs?: number };

export function createThinker() {
  let worker: Worker | null = null;
  let broken = false;
  let sequence = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: unknown) => void }>();

  function ensure(): Worker | null {
    if (worker || broken) return worker;
    try {
      worker = new ThinkWorker();
      worker.onmessage = (event: MessageEvent) => {
        const { id, result, error } = event.data ?? {};
        const waiter = pending.get(id);
        if (!waiter) return;
        pending.delete(id);
        if (error) waiter.reject(new Error(error));
        else waiter.resolve(result);
      };
      worker.onerror = () => {
        broken = true;
        for (const waiter of pending.values()) waiter.reject(new Error("think worker failed"));
        pending.clear();
        worker?.terminate();
        worker = null;
      };
    } catch {
      broken = true;
      worker = null;
    }
    return worker;
  }

  /** 1手を考える(Workerが使えなければ、その場で)。 */
  async function think(request: ThinkRequest) {
    const target = ensure();
    if (!target) return thinkHere(request);
    const id = ++sequence;
    try {
      return await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        target.postMessage({ id, request });
      });
    } catch {
      return thinkHere(request);
    }
  }

  function dispose() {
    worker?.terminate();
    worker = null;
    pending.clear();
  }

  return { think, dispose };
}
