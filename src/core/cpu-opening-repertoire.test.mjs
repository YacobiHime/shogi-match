import { describe, expect, it } from "vitest";
import {
  CPU_OPENING_CATEGORY_IDS,
  CPU_OPENING_REPERTOIRES,
  configuredCpuBishopMove,
  configuredCpuFirstMove,
  cpuMoveMatchesBishopPreference,
  randomOpeningCombinationRate,
  selectCpuOpeningRepertoire,
  selectRandomOpeningCombination,
  shouldForceConfiguredCpuOpening,
  shouldUseCpuOpening,
} from "./cpu-opening-repertoire.mjs";
import { Position } from "tsshogi";
import { enumerateLegalMoves, STANDARD_SFEN } from "../game-state.ts";
import {
  OPENING_CASTLES,
  OPENING_STRATEGIES,
  availableOpeningDefinitions,
  isStandaloneOpening,
  nextOpeningPlanMove,
  openingDefinitionRookStyle,
} from "./opening-guide.mjs";

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

  it.each(["open", "open-close", "invite-exchange", "closed"])(
    "prevents the CPU bishop from initiating an exchange in %s mode",
    (bishopPreference) => {
      expect(cpuMoveMatchesBishopPreference({
        bishopPreference,
        cpuColor: "white",
        usi: "6f8h+",
        pieceType: "bishop",
        capturedPieceType: "bishop",
      })).toBe(false);
    },
  );

  it("allows a CPU-initiated bishop exchange only in exchange mode", () => {
    expect(cpuMoveMatchesBishopPreference({
      bishopPreference: "exchange",
      usi: "6f8h+",
      pieceType: "bishop",
      capturedPieceType: "bishop",
    })).toBe(true);
  });

  it.each(["black", "white"])("captures a bishop that moved from its home square as %s", (cpuColor) => {
    const usi = cpuColor === "black" ? "8h3c+" : "2b7g+";
    expect(configuredCpuBishopMove({
      bishopPreference: "exchange", cpuColor,
      cpuMoves: [cpuColor === "black" ? "7g7f" : "3c3d"],
      legalMoves: [usi],
      legalMoveDetails: [{ usi, pieceType: "bishop", capturedPieceType: "bishop" }],
    })).toBe(usi);
  });

  it.each(["black", "white"])("does not close the diagonal after exchange mode leaves the book as %s", (cpuColor) => {
    expect(cpuMoveMatchesBishopPreference({
      bishopPreference: "exchange", cpuColor,
      usi: cpuColor === "black" ? "6g6f" : "4c4d",
    })).toBe(false);
  });

  it("does not choose a right-king plan that opens the diagonal in closed mode", () => {
    for (const configuredStrategy of ["hayaguri-gin", "koshikake-gin"]) {
      expect(selectCpuOpeningRepertoire({
        configuredStrategy, bishopPreference: "closed", cpuColor: "black", random: () => 0,
      }).castleId).not.toBe("right-king");
    }
  });

  it("keeps open and closed diagonal settings after the opening book ends", () => {
    expect(cpuMoveMatchesBishopPreference({
      bishopPreference: "closed", cpuColor: "black", usi: "7g7f",
    })).toBe(false);
    expect(cpuMoveMatchesBishopPreference({
      bishopPreference: "open", cpuColor: "black", usi: "6g6f",
    })).toBe(false);
    expect(cpuMoveMatchesBishopPreference({
      bishopPreference: "open-close", cpuColor: "white", usi: "4d4e",
    })).toBe(false);
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
      random: () => 0.3,
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

  it("partitions all 21 supported CPU strategies without duplicates", () => {
    const ids = Object.values(CPU_OPENING_CATEGORY_IDS).flat();
    expect(ids).toHaveLength(21);
    expect(new Set(ids).size).toBe(21);
    expect(new Set(ids)).toEqual(new Set(Object.keys(CPU_OPENING_REPERTOIRES)));
  });

  function shares(options, samples = 400) {
    const counts = new Map();
    for (let index = 0; index < samples; index += 1) {
      const { strategyId } = selectCpuOpeningRepertoire({ ...options, random: () => (index + 0.5) / samples });
      counts.set(strategyId, (counts.get(strategyId) ?? 0) + 1);
    }
    const share = (ids) => ids.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0) / samples;
    return { counts, share };
  }
  const RANGING = CPU_OPENING_CATEGORY_IDS.ranging;
  const PRO_MAIN = ["aigakari", "kakugawari", "kakugawari-koshikake-gin", "kakugawari-45-knight", "yagura-strategy"];

  it("leans toward popular amateur openings at low levels and professional openings at high levels", () => {
    const beginner = shares({ cpuColor: "black", level: 3 });
    const professional = shares({ cpuColor: "black", level: 40 });
    // 級位帯は振り飛車・棒銀が多く、プロ級は角換わり・相掛かり・矢倉が中心になる。
    expect(beginner.share(RANGING)).toBeGreaterThan(0.4);
    expect(professional.share(RANGING)).toBeLessThan(0.3);
    expect(professional.share(PRO_MAIN)).toBeGreaterThan(0.55);
    expect(beginner.share(PRO_MAIN)).toBeLessThan(0.2);
    expect(beginner.share(["bougin"])).toBeGreaterThan(professional.share(["bougin"]));
    // 奇襲はプロ級では選ばない。
    expect(professional.share(CPU_OPENING_CATEGORY_IDS.surprise)).toBe(0);
    expect(beginner.share(CPU_OPENING_CATEGORY_IDS.surprise)).toBeGreaterThan(0);
  });

  it("answers 2六歩 with more double-wing and Bishop Exchange plans than 7六歩", () => {
    const afterRookPawn = shares({ cpuColor: "white", moves: ["2g2f"], level: 21 });
    const afterBishopDiagonal = shares({ cpuColor: "white", moves: ["7g7f"], level: 21 });
    const doubleWing = ["aigakari", "kakugawari", "kakugawari-koshikake-gin", "kakugawari-45-knight"];
    expect(afterRookPawn.share(doubleWing)).toBeGreaterThan(afterBishopDiagonal.share(doubleWing));
    expect(afterBishopDiagonal.share(RANGING)).toBeGreaterThan(afterRookPawn.share(RANGING));
  });

  it("keeps the automatic distribution when every opening tendency is unselected or adaptive", () => {
    const random = () => 0.42;
    const automatic = selectCpuOpeningRepertoire({ cpuColor: "white", moves: ["2g2f"], level: 12, random });
    expect(selectCpuOpeningRepertoire({
      cpuColor: "white", moves: ["2g2f"], level: 12, random,
      bishopPreference: "", rookPreference: "", tempoPreference: "",
    })).toEqual(automatic);
    expect(selectCpuOpeningRepertoire({
      cpuColor: "white", moves: ["2g2f"], level: 12, random, rookPreference: "adaptive",
    })).toEqual(automatic);
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

describe("おまかせの作戦のランダムな組み合わせ", () => {
  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function availableAtStart(color) {
    const position = Position.newBySFEN(STANDARD_SFEN);
    const legalMoves = enumerateLegalMoves(position).map(({ usi }) => usi);
    const context = { color, playedMoves: [], moveHistory: [], legalMoves, currentSfen: STANDARD_SFEN };
    return {
      strategies: availableOpeningDefinitions({ ...context, definitions: OPENING_STRATEGIES, kind: "strategy" }),
      castles: availableOpeningDefinitions({ ...context, definitions: OPENING_CASTLES, kind: "castle" }),
      legalMoves,
    };
  }

  it("ランダムな組み合わせは低レベルでも2割までに抑え、高レベルほど減らす", () => {
    expect(randomOpeningCombinationRate(0)).toBeCloseTo(0.2);
    expect(randomOpeningCombinationRate(0.5)).toBeCloseTo(0.1);
    expect(randomOpeningCombinationRate(1)).toBe(0);
    const rates = Array.from({ length: 11 }, (_, index) => randomOpeningCombinationRate(index / 10));
    expect(rates.every((rate, index) => index === 0 || rate <= rates[index - 1])).toBe(true);
  });

  it("局面で成立する登録済みの戦法と、飛車の方針が合う囲いを組む", () => {
    const { strategies, castles, legalMoves } = availableAtStart("black");
    const strategyIds = new Set(strategies.map(({ id }) => id));
    const castleIds = new Set(castles.map(({ id }) => id));
    const random = seededRandom(20260927);
    const picked = new Set();
    for (let i = 0; i < 400; i += 1) {
      const plan = selectRandomOpeningCombination({ strategies, castles, random });
      expect(plan).not.toBeNull();
      if (plan.strategyId) expect(strategyIds.has(plan.strategyId)).toBe(true);
      if (plan.castleId) expect(castleIds.has(plan.castleId)).toBe(true);
      if (!plan.strategyId) expect(isStandaloneOpening(plan.castleId, "castle")).toBe(true);
      if (isStandaloneOpening(plan.strategyId, "strategy")) expect(plan.castleId).toBe("");
      if (plan.strategyId && plan.castleId) {
        const strategyStyle = openingDefinitionRookStyle(plan.strategyId, "strategy");
        const castleStyle = openingDefinitionRookStyle(plan.castleId, "castle");
        if (strategyStyle && castleStyle) expect(castleStyle).toBe(strategyStyle);
      }
      picked.add(`${plan.strategyId}+${plan.castleId}`);
    }
    // 少数の定番だけでなく、登録済みの幅広い組み合わせから選ぶ。
    expect(picked.size).toBeGreaterThan(40);
    expect(new Set([...picked].map((key) => key.split("+")[0])).size).toBeGreaterThan(15);
    // 組んだ作戦は、開始局面から案内手を指し始められる。
    for (const key of [...picked].slice(0, 30)) {
      const [strategyId, castleId] = key.split("+");
      const next = nextOpeningPlanMove({
        strategyId, castleId, color: "black", playedMoves: [], opponentMoves: [], moveHistory: [],
        legalMoves, currentSfen: STANDARD_SFEN,
      });
      expect(next, key).toBeTruthy();
      expect(legalMoves).toContain(next.usi);
    }
  });

  it("相手の飛車の方針が分かれば、その戦型に合う囲いを選ぶ", () => {
    const ibisha = OPENING_STRATEGIES.find(({ id }) => id === "ibisha");
    const random = seededRandom(3);
    for (let i = 0; i < 50; i += 1) {
      const plan = selectRandomOpeningCombination({
        strategies: [ibisha], castles: OPENING_CASTLES, opponentRookStyle: "ranging", random,
      });
      const castle = OPENING_CASTLES.find(({ id }) => id === plan.castleId);
      expect(castle.contexts).toContain("anti-ranging-static");
    }
  });

  it("戦法と一体の定義は相方と組み合わせない", () => {
    const ahiru = OPENING_STRATEGIES.find(({ id }) => id === "ahiru");
    const rightKing = OPENING_CASTLES.find(({ id }) => id === "right-king");
    expect(selectRandomOpeningCombination({ strategies: [ahiru], castles: OPENING_CASTLES, random: () => 0 }))
      .toMatchObject({ strategyId: "ahiru", castleId: "" });
    expect(selectRandomOpeningCombination({ strategies: [], castles: [rightKing], random: () => 0 }))
      .toMatchObject({ strategyId: "", castleId: "right-king" });
    expect(selectRandomOpeningCombination({ strategies: [], castles: [] })).toBeNull();
  });
});
