import { describe, expect, it } from "vitest";
import {
  CPU_OPENING_REPERTOIRES,
  selectCpuOpeningRepertoire,
  shouldUseCpuOpening,
} from "./cpu-opening-repertoire.mjs";

describe("CPU opening repertoire", () => {
  it("respects an explicitly configured strategy", () => {
    expect(selectCpuOpeningRepertoire({ configuredStrategy: "shiken" })).toEqual(
      CPU_OPENING_REPERTOIRES.shiken,
    );
  });

  it("does not expose Yababozu as a CPU strategy", () => {
    expect(CPU_OPENING_REPERTOIRES.yababozu).toBeUndefined();
    expect(selectCpuOpeningRepertoire({
      configuredStrategy: "yababozu",
      random: () => 0,
    })).toEqual(CPU_OPENING_REPERTOIRES.ibisha);
  });

  it("answers 2六歩 with a common double-wing plan", () => {
    expect(selectCpuOpeningRepertoire({ moves: ["2g2f"] })).toEqual(
      CPU_OPENING_REPERTOIRES.aigakari,
    );
  });

  it("answers 7六歩 from a bounded set of standard plans", () => {
    const ids = [0, 0.6, 0.9].map((value) => selectCpuOpeningRepertoire({
      moves: ["7g7f"],
      random: () => value,
    }).strategyId);
    expect(ids).toEqual(["yagura-strategy", "shiken", "sangen"]);
  });

  it("does not force book moves in check or after the opening", () => {
    expect(shouldUseCpuOpening({ ply: 12, cpuMoveCount: 6 })).toBe(true);
    expect(shouldUseCpuOpening({ ply: 12, cpuMoveCount: 6, inCheck: true })).toBe(false);
    expect(shouldUseCpuOpening({ ply: 12, cpuMoveCount: 6, lastMoveWasCapture: true })).toBe(false);
    expect(shouldUseCpuOpening({ ply: 32, cpuMoveCount: 6 })).toBe(false);
    expect(shouldUseCpuOpening({ ply: 20, cpuMoveCount: 16 })).toBe(false);
  });
});
