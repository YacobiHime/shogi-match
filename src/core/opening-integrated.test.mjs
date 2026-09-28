import { describe, expect, it } from "vitest";
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import * as builtIn from "./opening-guide.mjs";

async function importProduction() {
  const original = process.env.VITEST;
  process.env.VITEST = "false";
  try {
    return await import("./opening-guide.mjs?production-integrated");
  } finally {
    process.env.VITEST = original;
  }
}

const production = await importProduction();

// 先手から見た相手（後手）の応手。角道を開け、こちらの駒組みを妨げない手だけを使う。
const OPPONENT_SCRIPT = ["3c3d", "1c1d", "9c9d", "4a3b", "6a5b", "7a7b", "1d1e", "9d9e"];

/** 補助の案内だけを指し続け、中断されずに作戦全体が完成するまでの手順を返す。 */
function playGuidedPlan(guide, { strategyId = "", castleId = "", color, maxPlies = 90 }) {
  const convert = color === "white" ? guide.mirrorUsiMove : (move) => move;
  const opponentScript = OPPONENT_SCRIPT.map(convert);
  const opponentRecaptures = ["3a2b", "3c2b"].map(convert);
  const record = createGameRecord();
  const moveHistory = [];
  const playerParity = color === "black" ? 0 : 1;
  let scriptIndex = 0;
  let kingShuffle = 0;
  for (let ply = 0; ply < maxPlies; ply += 1) {
    const legalMoves = enumerateLegalMoves(record.position).map(({ usi }) => usi);
    const playedMoves = moveHistory.filter((_, index) => index % 2 === playerParity);
    const opponentMoves = moveHistory.filter((_, index) => index % 2 !== playerParity);
    const options = {
      strategyId, castleId, color, playedMoves, opponentMoves, moveHistory,
      legalMoves, currentSfen: record.position.sfen,
    };
    let usi;
    if (ply % 2 === playerParity) {
      if (guide.isOpeningPlanComplete(options)) return { complete: true, moveHistory };
      const interruption = guide.openingPlanInterruption(options);
      if (interruption) return { complete: false, interruption, moveHistory };
      usi = guide.nextOpeningPlanMove(options)?.usi;
      if (!usi) return { complete: false, moveHistory };
    } else {
      const lastMove = moveHistory.at(-1) ?? "";
      const recapture = lastMove.endsWith("+")
        && opponentRecaptures.find((move) => move.slice(2, 4) === lastMove.slice(2, 4) && legalMoves.includes(move));
      while (!recapture && scriptIndex < opponentScript.length && !legalMoves.includes(opponentScript[scriptIndex])) {
        scriptIndex += 1;
      }
      usi = recapture || opponentScript[scriptIndex++];
      if (!usi) {
        // 手順を使い切ったら玉を左右に動かして手を渡す。
        const shuffle = [["5a4a", "4a5a"], ["5a6a", "6a5a"]]
          .map((pair) => pair.map(convert))
          .find((pair) => legalMoves.includes(pair[kingShuffle % 2]));
        usi = shuffle?.[kingShuffle % 2];
        kingShuffle += 1;
      }
    }
    expect(appendUsiMove(record, usi), `${strategyId || castleId} ${color}: ${usi}`).toBe(true);
    moveHistory.push(usi);
  }
  return { complete: false, moveHistory };
}

const INTEGRATED_STRATEGIES = [
  "suzume-zashi", "yagura-37-silver", "morishita-system", "kakugawari-koshikake-gin",
  "gangi-right-shiken", "chikatetsu-bisha", "fujii-system", "right-shiken-elmo",
];

describe("integrated strategy and castle plans", () => {
  it("marks the requested strategies and castles as integrated", () => {
    for (const guide of [builtIn, production]) {
      for (const id of INTEGRATED_STRATEGIES) {
        expect(guide.isIntegratedOpening(id, "strategy"), id).toBe(true);
      }
      expect(guide.isIntegratedOpening("right-king", "castle")).toBe(true);
      expect(guide.isIntegratedOpening("yagura", "castle")).toBe(false);
      expect(guide.isIntegratedOpening("ibisha", "strategy")).toBe(false);
    }
    expect(production.isIntegratedOpening("migigyoku-habu", "castle")).toBe(true);
  });

  it("ignores the counterpart selection of an integrated opening", () => {
    const suzume = builtIn.resolveOpeningPlanDefinitions("suzume-zashi", "mino");
    expect(suzume.strategy.id).toBe("suzume-zashi");
    expect(suzume.castle.label).toBe("金矢倉");
    expect(builtIn.resolveOpeningPlanDefinitions("fujii-system", "mino").castle).toBeUndefined();
    const rightKing = builtIn.resolveOpeningPlanDefinitions("ibisha", "right-king");
    expect(rightKing.strategy).toBeUndefined();
    expect(rightKing.castle.id).toBe("right-king");
    expect(builtIn.openingPlanSteps("suzume-zashi", "mino").some(({ usi }) => usi === "2h6h")).toBe(false);
  });

  it.each(["black", "white"])("completes every integrated plan with only guided moves as %s", (color) => {
    for (const [name, guide] of [["built-in", builtIn], ["production", production]]) {
      for (const strategyId of INTEGRATED_STRATEGIES) {
        const result = playGuidedPlan(guide, { strategyId, color });
        expect(result.interruption?.message, `${name} ${strategyId}`).toBeUndefined();
        expect(result.complete, `${name} ${strategyId}: ${result.moveHistory.join(" ")}`).toBe(true);
      }
      const result = playGuidedPlan(guide, { castleId: "right-king", color });
      expect(result.complete, `${name} right-king: ${result.moveHistory.join(" ")}`).toBe(true);
    }
  });

  it.each(["black", "white"])("guides the yagura castle after Suzume-zashi as %s", (color) => {
    const { moveHistory } = playGuidedPlan(builtIn, { strategyId: "suzume-zashi", color });
    const convert = color === "white" ? builtIn.mirrorUsiMove : (move) => move;
    const own = moveHistory.filter((_, index) => index % 2 === (color === "black" ? 0 : 1));
    expect(own).toEqual(expect.arrayContaining(["5i6h", "6h7h", "7h8h"].map(convert)));
  });

  it.each(["black", "white"])("castles into Elmo before swinging the rook for Right Fourth File as %s", (color) => {
    const convert = color === "white" ? builtIn.mirrorUsiMove : (move) => move;
    const { moveHistory, complete } = playGuidedPlan(builtIn, { strategyId: "right-shiken-elmo", color });
    expect(complete).toBe(true);
    const own = moveHistory.filter((_, index) => index % 2 === (color === "black" ? 0 : 1));
    expect(own).toEqual([
      "7g7f", "5i6h", "6h7h", "7i6h", "6i7i", "4i5i",
      "3i4h", "4g4f", "4h4g", "4g5f", "2h4h",
    ].map(convert));
    expect(builtIn.openingDefinitionRookStyle("right-shiken-elmo", "strategy")).toBe("static");
  });

  it("does not report an integrated plan complete before its built-in castle", () => {
    const playedMoves = ["7g7f", "6g6f", "7i6h", "6h7g", "3g3f", "3i4h", "4h3g"];
    const record = createGameRecord();
    const replies = ["3c3d", "1c1d", "9c9d", "4a3b", "6a5b", "7a7b", "1d1e"];
    playedMoves.forEach((usi, index) => {
      expect(appendUsiMove(record, usi), usi).toBe(true);
      expect(appendUsiMove(record, replies[index]), replies[index]).toBe(true);
    });
    const options = { strategyId: "yagura-37-silver", playedMoves, currentSfen: record.position.sfen };
    expect(builtIn.isOpeningPlanComplete({ ...options, completedPhases: { castle: true } })).toBe(true);
    expect(builtIn.isOpeningPlanComplete(options)).toBe(false);
    expect(builtIn.nextOpeningPlanMove({
      ...options,
      legalMoves: enumerateLegalMoves(record.position).map(({ usi }) => usi),
    })).toMatchObject({ usi: "8h7i", phase: "castle" });
  });
});

describe("Kakugawari routine inside a castle", () => {
  it.each(["black", "white"])("starts Habu-style right king without a strategy as %s", (color) => {
    const convert = color === "white" ? production.mirrorUsiMove : (move) => move;
    const record = createGameRecord();
    if (color === "white") expect(appendUsiMove(record, "2g2f")).toBe(true);
    const options = {
      castleId: "migigyoku-habu", color,
      playedMoves: [], opponentMoves: color === "white" ? ["2g2f"] : [],
      legalMoves: enumerateLegalMoves(record.position).map(({ usi }) => usi),
      currentSfen: record.position.sfen,
    };
    expect(production.openingPlanCandidates(options)).toEqual([{ usi: convert("7g7f"), phase: "castle" }]);
    // 戦法欄に何か残っていても、一体型の囲いでは角換わり手順を案内する。
    expect(production.openingPlanCandidates({ ...options, strategyId: "ibisha", completedPhases: { strategy: true } }))
      .toEqual([{ usi: convert("7g7f"), phase: "castle" }]);
  });

  it.each(["black", "white"])("completes Habu-style right king through the Bishop Exchange as %s", (color) => {
    const result = playGuidedPlan(production, { castleId: "migigyoku-habu", color });
    expect(result.interruption?.message).toBeUndefined();
    const convert = color === "white" ? production.mirrorUsiMove : (move) => move;
    expect(result.moveHistory).toContain(convert("8h2b+"));
    expect(result.complete, result.moveHistory.join(" ")).toBe(true);
  });

  it("asks for another castle when the Habu routine cannot exchange bishops", () => {
    const record = createGameRecord();
    const line = ["7g7f", "4a3b", "2g2f", "6a5b", "2f2e", "5a4b", "6i7h", "7a7b"];
    for (const usi of line) expect(appendUsiMove(record, usi), usi).toBe(true);
    const interruption = production.openingPlanInterruption({
      castleId: "migigyoku-habu",
      playedMoves: line.filter((_, index) => index % 2 === 0),
      opponentMoves: line.filter((_, index) => index % 2 === 1),
      moveHistory: line,
      currentSfen: record.position.sfen,
    });
    expect(interruption).toMatchObject({ requiresReselection: true, clearCastle: true, clearStrategy: false });
    expect(interruption.message).toContain("別の囲い");
  });
});
