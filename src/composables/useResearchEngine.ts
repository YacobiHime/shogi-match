import { ref, shallowRef } from "vue";
import type { ShogiEngine } from "../core/engine.js";

/**
 * 研究モードの検討(docs/research-mode-design.mdの3-3)。1つのエンジンで今の局面を読み続け、途中の候補と読みの情報を出す。
 * 同じエンジンは一度に1つの探索しか処理できないので、新しい局面を読む前に、前の探索を止めて bestmove を待つ。
 * 古い局面の読みが新しい局面に出ないよう、読みごとに世代の印を付け、古い世代の知らせは捨てる。
 */

export type ResearchCandidate = {
  rank: number;
  move: string;
  pv?: string[];
  depth?: number;
  score?: { type: "cp" | "mate"; value: number };
};
export type ResearchStats = { depth?: number; nodes?: number; nps?: number; elapsedMs: number };
export type ResearchGo = { movetime?: number; depth?: number; nodes?: number };

/** 途中の候補を画面へ出す間隔(ms)。読みの途中の知らせは多いので、まとめて出す。 */
const FLUSH_MS = 160;

export function useResearchEngine({ acquire, release }: {
  /** 読むエンジンを借りる(起動していなければ起動する)。 */
  acquire: () => Promise<ShogiEngine>;
  /** 研究を閉じるときに、借りたエンジンを返す(設定を戻す)。 */
  release?: (engine: ShogiEngine) => void;
}) {
  const running = ref(false);
  const candidates = shallowRef<ResearchCandidate[]>([]);
  const stats = ref<ResearchStats>({ elapsedMs: 0 });
  /** いま読んでいる局面の印(画面の局面と合っているかを見る)。 */
  const searchedKey = ref("");
  const error = ref("");

  let engine: ShogiEngine | null = null;
  let current: Promise<unknown> | null = null;
  let generation = 0;
  /** 頼まれた読みの番号(いちばん新しい頼みだけを始める)。 */
  let startTicket = 0;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: { candidates: ResearchCandidate[]; depth?: number; nodes?: number; nps?: number } | null = null;
  let startedAt = 0;

  function flush(id: number) {
    flushTimer = null;
    if (id !== generation || !pending) return;
    candidates.value = pending.candidates;
    stats.value = {
      depth: pending.depth ?? stats.value.depth,
      nodes: pending.nodes ?? stats.value.nodes,
      nps: pending.nps ?? stats.value.nps,
      elapsedMs: Date.now() - startedAt,
    };
    pending = null;
  }

  /** 読みを止め、エンジンが止まるのを待つ。 */
  async function stop() {
    generation += 1;
    const searching = current;
    current = null;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    pending = null;
    if (searching && engine) {
      try {
        engine.stop();
      } catch {
        // 止まっていれば何もしない。
      }
      await searching.catch(() => undefined);
    }
    running.value = false;
  }

  /**
   * 局面を読む。positionはUSIの「startpos moves …」か「<SFEN> moves …」(千日手が分かるよう手順で渡す)。
   * goが空ならずっと読む(止めるまで)。
   */
  async function start(position: string, key: string, { multiPv, go }: { multiPv: number; go: ResearchGo }) {
    // 止めるのを待つあいだに次の読みを頼まれたら、この読みは始めない。
    // 待ったあとに世代を読むと、続けて頼んだ2つの読みが同じ世代になり、両方がエンジンへ go を送ってしまう(10-4)。
    const ticket = ++startTicket;
    await stop();
    if (ticket !== startTicket) return;
    const id = generation;
    error.value = "";
    try {
      if (!engine) engine = await acquire();
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      return;
    }
    if (id !== generation) return;
    const worker = engine;
    candidates.value = [];
    stats.value = { elapsedMs: 0 };
    searchedKey.value = key;
    running.value = true;
    startedAt = Date.now();
    try {
      worker.applyStrengthOptions({ multiPv });
      worker.setPosition(position);
    } catch (cause) {
      running.value = false;
      error.value = cause instanceof Error ? cause.message : String(cause);
      return;
    }
    const limited = Boolean(go.movetime || go.depth || go.nodes);
    current = worker.go({
      ...go,
      infinite: !limited,
      onUpdate: (update: { depth?: number; nodes?: number; nps?: number; candidates: ResearchCandidate[] }) => {
        if (id !== generation) return;
        pending = { candidates: update.candidates, depth: update.depth, nodes: update.nodes, nps: update.nps };
        if (!flushTimer) flushTimer = setTimeout(() => flush(id), FLUSH_MS);
      },
    } as Parameters<ShogiEngine["go"]>[0]).then((result: { candidates?: ResearchCandidate[]; completedCandidates?: ResearchCandidate[] } | null) => {
      if (id !== generation) return;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      if (pending) flush(id);
      // 止めたときは、全順位が同じ深さで読めた最後の回を残す(順位の入れ替わりの途中を出さない)。
      const settled = result?.completedCandidates?.length ? result.completedCandidates : result?.candidates;
      if (settled?.length) candidates.value = settled;
      stats.value = { ...stats.value, elapsedMs: Date.now() - startedAt };
    }).catch((cause: unknown) => {
      if (id === generation) error.value = cause instanceof Error ? cause.message : String(cause);
    }).finally(() => {
      if (id === generation) running.value = false;
    });
  }

  /** 研究を閉じる。読みを止め、エンジンの候補の数を1に戻して返す。 */
  async function dispose() {
    await stop();
    if (engine) {
      try {
        engine.applyStrengthOptions({ multiPv: 1 });
      } catch {
        // 終了済みのエンジンは無視する。
      }
      release?.(engine);
    }
    engine = null;
  }

  return { running, candidates, stats, searchedKey, error, start, stop, dispose };
}
