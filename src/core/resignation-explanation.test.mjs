import { describe, expect, it } from "vitest";
import { explainResignation, resignationSearchSettings } from "./resignation-explanation.mjs";

// 先手番の平手初期局面と、後手番にした局面。評価値は手番側から見た値。
const blackToMove = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
const whiteToMove = "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 2";

describe("resignation explanation", () => {
  it("explains a forced mate against the side that resigned and lays out the sequence", () => {
    const explanation = explainResignation({
      sfen: whiteToMove,
      candidates: [{ rank: 1, move: "3c3d", pv: ["3c3d", "2g2f"], score: { type: "mate", value: -9 } }],
      loser: "white",
      names: { black: "羽生善治", white: "加藤一二三" },
    });
    expect(explanation).toMatchObject({ kind: "mate", pv: ["3c3d", "2g2f"], value: -9 });
    expect(explanation.text).toBe("AIが読むと、加藤一二三はどう受けても9手で詰まされてしまうんだ。だから投了したんだね。");
    expect(explanation.pvLabel).toBe("△3四歩 → ▲2六歩");
  });

  it("reads the score from the loser's side even when the winner is to move", () => {
    // 先手番で先手から見て+2000なら、投了した後手から見て-2000。
    const explanation = explainResignation({
      sfen: blackToMove,
      candidates: [{ rank: 1, move: "7g7f", score: { type: "cp", value: 2000 } }],
      loser: "white",
    });
    expect(explanation).toMatchObject({ kind: "hopeless", value: -2000 });
    expect(explanation.text).toContain("後手から見て-2000");
  });

  it("tells clear disadvantage, an early resignation, and a missed win apart", () => {
    const explain = (score) => explainResignation({ sfen: blackToMove, candidates: [{ rank: 1, move: "7g7f", score }], loser: "black" });
    expect(explain({ type: "cp", value: -800 }).kind).toBe("clear");
    expect(explain({ type: "cp", value: -200 }).kind).toBe("early");
    // 投了した側が有利なら、投了が早かったと話す。
    expect(explain({ type: "cp", value: 68 }).text).toContain("むしろ先手のほうが指しやすい（先手から見て+68）");
    expect(explain({ type: "mate", value: 5 })).toMatchObject({ kind: "missed" });
    expect(explain(undefined)).toBeNull();
  });

  it("reads deeper than the usual analysis to find long mates", () => {
    expect(resignationSearchSettings().nodes).toBeGreaterThan(resignationSearchSettings(true).nodes);
    expect(resignationSearchSettings(true).nodes).toBeGreaterThanOrEqual(400000);
  });
});
