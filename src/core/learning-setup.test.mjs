import { describe, expect, it } from "vitest";
import { createGameRecord } from "../game-state";
import {
  LEARNING_HANDICAPS,
  STANDARD_START_SFEN,
  UNLIMITED_ASSIST,
  assistAllowance,
  attackMap,
  buildFormationStart,
  formatAssistCount,
  learningStartPosition,
  normalizeAssistLimit,
} from "./learning-setup.mjs";
import { isOpeningPlanComplete } from "./opening-guide.mjs";
import { parseSfenBoard } from "./sfen-board.mjs";

describe("learning match setup", () => {
  it("starts handicap games with the handicap giver as White moving first", () => {
    for (const handicap of LEARNING_HANDICAPS) {
      expect(() => createGameRecord(handicap.sfen), handicap.id).not.toThrow();
      expect(handicap.sfen.split(" ")[1], handicap.id).toBe("w");
    }
    expect(learningStartPosition({ startType: "handicap", handicapId: "rook", handicapGiver: "cpu" }))
      .toMatchObject({ playerColor: "black", label: "飛車落ち" });
    expect(learningStartPosition({ startType: "handicap", handicapId: "rook", handicapGiver: "player" }))
      .toMatchObject({ playerColor: "white" });
    const rookHandicap = parseSfenBoard(learningStartPosition({ startType: "handicap", handicapId: "rook" }).sfen);
    expect(rookHandicap.get("8b")).toBeUndefined();
    expect(rookHandicap.get("2h")).toMatchObject({ color: "black", kind: "R" });
  });

  it("keeps the configured position for a standard start", () => {
    expect(learningStartPosition({ playerColor: "white" })).toMatchObject({
      sfen: STANDARD_START_SFEN, playerColor: "white",
    });
    expect(learningStartPosition({ standardSfen: "4k4/9/9/9/9/9/9/9/4K4 b - 1" }).sfen)
      .toBe("4k4/9/9/9/9/9/9/9/4K4 b - 1");
  });

  it("supports finite and unlimited assist counts", () => {
    expect(assistAllowance(3)).toBe(3);
    expect(assistAllowance(0)).toBe(0);
    expect(assistAllowance(UNLIMITED_ASSIST)).toBe(Number.POSITIVE_INFINITY);
    expect(formatAssistCount(Number.POSITIVE_INFINITY)).toBe("∞");
    expect(formatAssistCount(2)).toBe("2");
    expect(normalizeAssistLimit(-1)).toBe(-1);
    expect(normalizeAssistLimit(7)).toBe(3);
  });

  it.each([
    [{ strategyId: "suzume-zashi" }, null],
    [null, { strategyId: "shiken", castleId: "mino" }],
    [{ strategyId: "shiken", castleId: "mino" }, { strategyId: "ibisha", castleId: "funagakoi" }],
    [{ strategyId: "kakugawari-koshikake-gin" }, { strategyId: "kakugawari-koshikake-gin" }],
    [{ castleId: "yagura" }, { castleId: "yagura" }],
  ])("builds a legal position where both chosen plans are complete (%j vs %j)", (black, white) => {
    const result = buildFormationStart({ black, white });
    expect(result.ok, result.message).toBe(true);
    expect(() => createGameRecord(result.sfen)).not.toThrow();
    for (const [color, plan] of [["black", black], ["white", white]]) {
      if (!plan) continue;
      const parity = color === "black" ? 0 : 1;
      expect(isOpeningPlanComplete({
        ...plan,
        color,
        playedMoves: result.moves.filter((_, index) => index % 2 === parity),
        opponentMoves: result.moves.filter((_, index) => index % 2 !== parity),
        currentSfen: result.sfen,
      }), `${color} ${JSON.stringify(plan)}`).toBe(true);
    }
  });

  it("keeps the side without a plan in its own camp", () => {
    const result = buildFormationStart({ black: { strategyId: "suzume-zashi" } });
    const whiteMoves = result.moves.filter((_, index) => index % 2 === 1);
    expect(whiteMoves[0]).toBe("3c3d");
    // 作戦のない側は玉の1升往復だけで手番を渡す。
    expect(new Set(whiteMoves.slice(1))).toEqual(new Set(["5a5b", "5b5a"]));
  });

  it("reports combinations that cannot be completed", () => {
    expect(buildFormationStart({})).toMatchObject({ ok: false });
    // 横歩取りは相手の応手が決まっていないと完成しない。
    const result = buildFormationStart({ black: { strategyId: "yokofudori" } });
    expect(result.ok).toBe(false);
    expect(result.message).toEqual(expect.any(String));
  });

  it("counts attackers of both colors on each square", () => {
    const marks = attackMap(STANDARD_START_SFEN);
    const at = (file, rank) => marks.find((mark) => mark.file === file && mark.rank === rank);
    // 初期局面の7六には先手の7七歩だけが利く。
    expect(at(7, 6)).toEqual({ file: 7, rank: 6, black: 1, white: 0 });
    // 2八の飛車は、6八・5八・4八・3八へ横に利く。
    expect(at(5, 8)?.black).toBeGreaterThanOrEqual(1);
    // 5五のような中央の空き升には、初期局面では誰も利いていない。
    expect(at(5, 5)).toBeUndefined();
    // 後手の利きも数える。
    expect(at(3, 4)).toEqual({ file: 3, rank: 4, black: 0, white: 1 });
    expect(attackMap("invalid")).toEqual([]);
  });
});
