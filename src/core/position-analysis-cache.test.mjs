import { describe, expect, it } from "vitest";
import { createPositionAnalysisCache } from "./position-analysis-cache.mjs";

describe("position analysis cache", () => {
  it("reuses a search only when it satisfies the requested budget", () => {
    const cache = createPositionAnalysisCache();
    const candidates = [{ rank: 1, move: "7g7f" }];
    cache.set("startpos", candidates, { multiPv: 5, nodes: 60000 });
    expect(cache.get("startpos", { multiPv: 3, nodes: 20000 })).toBe(candidates);
    expect(cache.get("startpos", { multiPv: 6, nodes: 20000 })).toBeNull();
    expect(cache.get("startpos", { multiPv: 3, nodes: 80000 })).toBeNull();
  });

  it("evicts the least recently used position", () => {
    const cache = createPositionAnalysisCache(2);
    cache.set("a", [1]);
    cache.set("b", [2]);
    cache.get("a");
    cache.set("c", [3]);
    expect(cache.get("a")).toEqual([1]);
    expect(cache.get("b")).toBeNull();
  });
});
