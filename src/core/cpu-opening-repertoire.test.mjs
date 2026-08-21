import { describe, expect, it } from "vitest";
import {
  CPU_OPENING_CATEGORY_IDS,
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

  it.each([
    ["static", "ibisha", "koshikake-gin"],
    ["ranging", "shiken", "sodebisha"],
    ["surprise", "onigoroshi", "ureshino"],
  ])("randomly chooses within the %s category", (category, first, last) => {
    expect(selectCpuOpeningRepertoire({
      configuredStrategy: category,
      cpuColor: "black",
      random: () => 0,
    }).strategyId).toBe(first);
    expect(selectCpuOpeningRepertoire({
      configuredStrategy: category,
      cpuColor: "black",
      random: () => 0.999,
    }).strategyId).toBe(last);
  });

  it("offers Pacman in the surprise pool only after 7六歩 against White", () => {
    expect(CPU_OPENING_CATEGORY_IDS.surprise).toContain("pacman");
    expect(selectCpuOpeningRepertoire({
      configuredStrategy: "surprise",
      cpuColor: "white",
      moves: ["7g7f"],
      random: () => 0.5,
    }).strategyId).toBe("pacman");
    expect(selectCpuOpeningRepertoire({
      configuredStrategy: "surprise",
      cpuColor: "white",
      moves: ["2g2f"],
      random: () => 0.5,
    }).strategyId).not.toBe("pacman");
  });

  it("does not expose Yababozu as a CPU strategy", () => {
    expect(CPU_OPENING_REPERTOIRES.yababozu).toBeUndefined();
    expect(selectCpuOpeningRepertoire({
      configuredStrategy: "yababozu",
      random: () => 0,
    })).toEqual(CPU_OPENING_REPERTOIRES.ibisha);
  });

  it("partitions all 19 supported CPU strategies without duplicates", () => {
    const ids = Object.values(CPU_OPENING_CATEGORY_IDS).flat();
    expect(ids).toHaveLength(19);
    expect(new Set(ids).size).toBe(19);
    expect(new Set(ids)).toEqual(new Set(Object.keys(CPU_OPENING_REPERTOIRES)));
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
