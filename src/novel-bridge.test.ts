import { describe, expect, it } from "vitest";
import {
  buildGameUrl,
  MATCH_PROTOCOL_VERSION,
  MATCH_RESULT_TYPE,
  normalizeFrameOptions,
  parseMatchResultMessage,
} from "./novel-bridge";

describe("visual novel bridge", () => {
  it("builds a standalone game URL from safe parameters", () => {
    const url = buildGameUrl({
      matchId: "chapter1:boss",
      gameUrl: "./game.html",
      mode: "cpu",
      playerColor: "white",
    }, "https://example.test/novel/index.html");
    expect(url.href).toBe(
      "https://example.test/novel/game.html?match_id=chapter1%3Aboss&mode=cpu&player_color=white",
    );
  });

  it("rejects unsafe match identifiers", () => {
    expect(() => normalizeFrameOptions({ matchId: "../bad" })).toThrow(/matchId/);
  });

  it("accepts only the expected versioned result", () => {
    const message = {
      type: MATCH_RESULT_TYPE,
      version: MATCH_PROTOCOL_VERSION,
      matchId: "chapter1:boss",
      result: {
        outcome: "black-win",
        winner: "black",
        reason: "checkmate",
        moveCount: 3,
        moves: ["7g7f", "3c3d", "2g2f"],
        finalSfen: "sfen",
      },
    };
    expect(parseMatchResultMessage(message, "chapter1:boss")).toEqual(message);
    expect(parseMatchResultMessage(message, "other")).toBeNull();
  });
});
