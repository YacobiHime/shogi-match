import { describe, expect, it } from "vitest";
import {
  CPU_OPENING_CATEGORY_IDS,
  CPU_OPENING_REPERTOIRES,
  configuredCpuBishopMove,
  configuredCpuFirstMove,
  selectCpuOpeningRepertoire,
  shouldForceConfiguredCpuOpening,
  shouldUseCpuOpening,
} from "./cpu-opening-repertoire.mjs";
import { OPENING_STRATEGIES } from "./opening-guide.mjs";

describe("CPU opening repertoire", () => {
  it.each([
    ["bishop-diagonal", "7g7f"],
    ["rook-pawn", "2g2f"],
    ["center-pawn", "5g5f"],
  ])("forces the requested first move for Black: %s", (setting, move) => {
    expect(configuredCpuFirstMove({
      configuredFirstMove: setting,
      cpuColor: "black",
      legalMoves: [move],
    })).toBe(move);
  });

  it("does not force a first move for White, later positions, or random mode", () => {
    expect(configuredCpuFirstMove({ configuredFirstMove: "random", cpuColor: "black" }))
      .toBeUndefined();
    expect(configuredCpuFirstMove({
      configuredFirstMove: "bishop-diagonal",
      cpuColor: "white",
      legalMoves: ["7g7f"],
    })).toBeUndefined();
    expect(configuredCpuFirstMove({
      configuredFirstMove: "bishop-diagonal",
      cpuColor: "black",
      cpuMoveCount: 1,
      legalMoves: ["7g7f"],
    })).toBeUndefined();
  });

  it.each([
    ["black", "open-close", [], ["7g7f"], "7g7f"],
    ["black", "open-close", ["7g7f"], ["6g6f"], "6g6f"],
    ["white", "open-close", [], ["3c3d"], "3c3d"],
    ["white", "open-close", ["3c3d"], ["4c4d"], "4c4d"],
    ["black", "exchange", ["7g7f"], ["8h2b+"], "8h2b+"],
    ["white", "exchange", ["3c3d"], ["2b8h+"], "2b8h+"],
  ])("turns the %s-side %s bishop setting into %s", (
    cpuColor, bishopPreference, cpuMoves, legalMoves, expected,
  ) => {
    expect(configuredCpuBishopMove({
      bishopPreference, cpuColor, cpuMoves, legalMoves,
    })).toBe(expected);
  });

  it("opens the diagonal but does not force an exchange while waiting for the opponent", () => {
    expect(configuredCpuBishopMove({
      bishopPreference: "invite-exchange",
      cpuColor: "black",
      legalMoves: ["7g7f"],
    })).toBe("7g7f");
    expect(configuredCpuBishopMove({
      bishopPreference: "invite-exchange",
      cpuColor: "black",
      cpuMoves: ["7g7f"],
      legalMoves: ["8h2b+"],
    })).toBeUndefined();
  });

  it("respects an explicitly configured strategy", () => {
    expect(selectCpuOpeningRepertoire({ configuredStrategy: "shiken" })).toEqual(
      CPU_OPENING_REPERTOIRES.shiken,
    );
  });

  it("treats a configured strategy as a preference that still receives an engine safety check", () => {
    expect(shouldForceConfiguredCpuOpening({
      configuredStrategy: "ranging",
      openingMove: "8b4b",
    })).toBe(false);
    expect(shouldForceConfiguredCpuOpening({
      configuredStrategy: "shiken",
      openingMove: "8b4b",
    })).toBe(false);
    expect(shouldForceConfiguredCpuOpening({
      configuredStrategy: "random",
      openingMove: "8b4b",
    })).toBe(false);
  });

  it("forces only the explicitly selected first move for a Black CPU", () => {
    expect(shouldForceConfiguredCpuOpening({
      configuredFirstMove: "bishop-diagonal",
      openingMove: "7g7f",
      cpuColor: "black",
      cpuMoveCount: 0,
    })).toBe(true);
    expect(shouldForceConfiguredCpuOpening({
      configuredFirstMove: "bishop-diagonal",
      openingMove: "2g2f",
      cpuColor: "black",
      cpuMoveCount: 1,
    })).toBe(false);
    expect(shouldForceConfiguredCpuOpening({
      configuredFirstMove: "bishop-diagonal",
      openingMove: "3c3d",
      cpuColor: "white",
      cpuMoveCount: 0,
    })).toBe(false);
    expect(shouldForceConfiguredCpuOpening({
      bishopPreference: "open-close",
      openingMove: "6g6f",
      cpuColor: "black",
      cpuMoveCount: 1,
      cpuMoves: ["7g7f"],
    })).toBe(true);
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

  it("keeps the existing automatic choice when every opening tendency is unselected", () => {
    expect(selectCpuOpeningRepertoire({
      cpuColor: "white",
      moves: ["2g2f"],
      bishopPreference: "",
      rookPreference: "",
      tempoPreference: "",
    })).toEqual(CPU_OPENING_REPERTOIRES.aigakari);
  });

  it("keeps choosing from the opponent move when the rook style is adaptive", () => {
    expect(selectCpuOpeningRepertoire({
      cpuColor: "white",
      moves: ["2g2f"],
      rookPreference: "adaptive",
    })).toEqual(CPU_OPENING_REPERTOIRES.aigakari);
  });

  it("selects a repertoire that opens or keeps closed the bishop diagonal", () => {
    expect(selectCpuOpeningRepertoire({
      cpuColor: "black", bishopPreference: "open", random: () => 0,
    }).strategyId).toBe("right-shiken");
    expect(selectCpuOpeningRepertoire({
      cpuColor: "black", bishopPreference: "closed", random: () => 0,
    }).strategyId).toBe("ibisha");

    const definitions = new Map(OPENING_STRATEGIES.map((strategy) => [strategy.id, strategy]));
    for (let index = 0; index < 20; index += 1) {
      const random = () => index / 20;
      const open = selectCpuOpeningRepertoire({
        cpuColor: "black", bishopPreference: "open", random,
      });
      const closed = selectCpuOpeningRepertoire({
        cpuColor: "black", bishopPreference: "closed", random,
      });
      expect(definitions.get(open.strategyId)?.blackMoves).toContain("7g7f");
      expect(definitions.get(open.strategyId)?.blackMoves).not.toContain("6g6f");
      expect(definitions.get(open.strategyId)?.blackMoves).not.toContain("8h2b+");
      expect(definitions.get(closed.strategyId)?.blackMoves).not.toContain("7g7f");
    }
  });

  it.each([
    ["open-close", "yagura-strategy"],
    ["exchange", "kakugawari"],
    ["invite-exchange", "right-shiken"],
  ])("selects a repertoire compatible with bishop behavior %s", (preference, strategyId) => {
    expect(selectCpuOpeningRepertoire({
      cpuColor: "black", bishopPreference: preference, random: () => 0,
    }).strategyId).toBe(strategyId);
  });

  it("combines rook and tempo tendencies when a compatible repertoire exists", () => {
    expect(selectCpuOpeningRepertoire({
      cpuColor: "black",
      rookPreference: "ranging",
      tempoPreference: "aggressive",
      random: () => 0,
    }).strategyId).toBe("ishida");
    expect(selectCpuOpeningRepertoire({
      cpuColor: "black",
      rookPreference: "static",
      tempoPreference: "castle-first",
      random: () => 0,
    }).strategyId).toBe("ibisha");
  });

  it("gives an explicitly selected strategy priority over opening tendencies", () => {
    expect(selectCpuOpeningRepertoire({
      configuredStrategy: "shiken",
      cpuColor: "black",
      bishopPreference: "closed",
      rookPreference: "static",
      tempoPreference: "attack-first",
    })).toEqual(CPU_OPENING_REPERTOIRES.shiken);
  });

  it("does not force book moves in check or after the opening", () => {
    expect(shouldUseCpuOpening({ ply: 12, cpuMoveCount: 6 })).toBe(true);
    expect(shouldUseCpuOpening({ ply: 12, cpuMoveCount: 6, inCheck: true })).toBe(false);
    expect(shouldUseCpuOpening({ ply: 12, cpuMoveCount: 6, lastMoveWasCapture: true })).toBe(false);
    expect(shouldUseCpuOpening({ ply: 32, cpuMoveCount: 6 })).toBe(false);
    expect(shouldUseCpuOpening({ ply: 20, cpuMoveCount: 16 })).toBe(false);
  });
});
