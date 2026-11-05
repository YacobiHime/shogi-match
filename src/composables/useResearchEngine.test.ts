import { describe, expect, it, vi } from "vitest";
import { useResearchEngine } from "./useResearchEngine";

/** 止めるまで読み続けるエンジンのまね。stopでbestmoveを返す。 */
function fakeEngine() {
  const calls: string[] = [];
  let pending: { resolve: (value: unknown) => void; candidates: unknown[] } | null = null;
  let onUpdate: ((update: unknown) => void) | null = null;
  const engine = {
    applyStrengthOptions: ({ multiPv }: { multiPv: number }) => calls.push(`multipv ${multiPv}`),
    setPosition: (position: string) => calls.push(`position ${position}`),
    go: (options: { infinite?: boolean; movetime?: number; onUpdate?: (update: unknown) => void }) => {
      calls.push(options.infinite ? "go infinite" : `go movetime ${options.movetime}`);
      onUpdate = options.onUpdate ?? null;
      return new Promise((resolve) => { pending = { resolve, candidates: [] }; });
    },
    stop: () => {
      calls.push("stop");
      const current = pending;
      pending = null;
      current?.resolve({ move: "7g7f", candidates: current.candidates, completedCandidates: [] });
    },
    setSearchThreads: async () => true,
    emit(update: { depth: number; candidates: unknown[] }) {
      if (pending) pending.candidates = update.candidates;
      onUpdate?.(update);
    },
  };
  return { engine, calls };
}

describe("研究の検討(止めるまで読む)", () => {
  it("新しい局面を読む前に前の探索を止め、ずっと読むときは go infinite", async () => {
    const { engine, calls } = fakeEngine();
    const research = useResearchEngine({ acquire: async () => engine as never });
    await research.start("startpos", "a", { multiPv: 3, go: {} });
    expect(research.running.value).toBe(true);
    await research.start("startpos moves 7g7f", "b", { multiPv: 5, go: { movetime: 3000 } });
    expect(calls).toEqual([
      "multipv 3", "position startpos", "go infinite",
      "stop",
      "multipv 5", "position startpos moves 7g7f", "go movetime 3000",
    ]);
    expect(research.searchedKey.value).toBe("b");
  });

  it("止めた古い読みの候補は、新しい局面に出さない", async () => {
    vi.useFakeTimers();
    const { engine } = fakeEngine();
    const research = useResearchEngine({ acquire: async () => engine as never });
    await research.start("startpos", "a", { multiPv: 1, go: {} });
    engine.emit({ depth: 10, candidates: [{ rank: 1, move: "2g2f" }] });
    vi.advanceTimersByTime(200);
    expect(research.candidates.value).toEqual([{ rank: 1, move: "2g2f" }]);
    await research.start("startpos moves 2g2f", "b", { multiPv: 1, go: {} });
    expect(research.candidates.value).toEqual([]);
    engine.emit({ depth: 12, candidates: [{ rank: 1, move: "8c8d" }] });
    vi.advanceTimersByTime(200);
    expect(research.candidates.value).toEqual([{ rank: 1, move: "8c8d" }]);
    expect(research.stats.value.depth).toBe(12);
    vi.useRealTimers();
  });

  it("エンジンを借りられなければ、理由を残して読まない", async () => {
    const research = useResearchEngine({ acquire: async () => { throw new Error("起動できません"); } });
    await research.start("startpos", "a", { multiPv: 1, go: {} });
    expect(research.running.value).toBe(false);
    expect(research.error.value).toBe("起動できません");
  });

  it("閉じると読みを止め、候補の数を1に戻して返す", async () => {
    const { engine, calls } = fakeEngine();
    const released = vi.fn();
    const research = useResearchEngine({ acquire: async () => engine as never, release: released });
    await research.start("startpos", "a", { multiPv: 4, go: {} });
    await research.dispose();
    expect(calls.slice(-2)).toEqual(["stop", "multipv 1"]);
    expect(released).toHaveBeenCalledWith(engine);
  });
});
