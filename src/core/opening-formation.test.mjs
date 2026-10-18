import { describe, expect, it } from "vitest";
import {
  openingFormation,
  openingFormationGhosts,
  openingFormationProgress,
  openingFormationSteps,
  openingStepLabel,
} from "./opening-formation.mjs";
import { ALL_OPENING_PLANS } from "./opening-catalog.mjs";

const START = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
const moved = (strategyId, castleId) => openingFormation(strategyId, castleId).pieces
  .filter((piece) => piece.moved).map(({ square, kind }) => `${square}${kind}`).sort();

describe("作戦カードの完成形", () => {
  it("四間飛車＋本美濃は、飛車が6八、玉が2八、銀が3八、金が5八", () => {
    expect(moved("shiken", "mino")).toEqual(["2hK", "3hS", "5hG", "6fP", "6hR", "7fP"].sort());
  });

  it("角換わりの手順では、角が盤から消える", () => {
    const pieces = openingFormation("kakugawari", "nakazumai").pieces;
    expect(pieces.some(({ kind }) => kind === "B")).toBe(false);
    expect(pieces.find(({ square }) => square === "7f")?.kind).toBe("P");
  });

  it("自分の駒がいるマスへ動く手は、駒を交換したとして、いた駒を外す", () => {
    // 横歩取り: 2五の歩を2四へ突き、飛車で取り返す(歩交換)。駒の数は1枚減る。
    const pieces = openingFormation("yokofudori", "").pieces;
    expect(pieces.length).toBe(19);
  });

  it("すべてのカードで、駒が重ならず、動かす駒があり、待たせずに作れる", () => {
    const started = performance.now();
    for (const plan of ALL_OPENING_PLANS) {
      const { pieces, moved: squares } = openingFormation(plan.strategyId, plan.castles[0] ?? "");
      expect(new Set(pieces.map(({ square }) => square)).size, plan.id).toBe(pieces.length);
      expect(squares.length, plan.id).toBeGreaterThan(0);
    }
    // 作戦カードのシートを開いたとき、全部のカードの盤を作っても待たせない。
    expect(performance.now() - started).toBeLessThan(ALL_OPENING_PLANS.length * 5);
  });

  it("薄い駒は空きマスにだけ出し、後手では盤を反転したマスに出す", () => {
    const black = openingFormationGhosts({ strategyId: "shiken", castleId: "mino", color: "black", sfen: START });
    // 2八は飛車がいるので、玉の薄い駒は出さない。
    expect(black.map(({ file, rank, kind }) => `${file}${rank}${kind}`).sort()).toEqual(["38S", "58G", "66P", "68R", "76P"].sort());
    expect(black.every(({ color }) => color === "black")).toBe(true);
    const white = openingFormationGhosts({ strategyId: "shiken", castleId: "mino", color: "white", sfen: START });
    expect(white.map(({ file, rank, kind }) => `${file}${rank}${kind}`).sort()).toEqual(["34P", "42R", "44P", "52G", "72S"].sort());
    expect(openingFormationGhosts({ sfen: START })).toEqual([]);
  });

  it("進み具合は、着いた駒のマスを先手から見た座標で返す", () => {
    const afterRook = "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B1R5/LNSGKGSNL b - 1";
    const progress = openingFormationProgress({ strategyId: "shiken", castleId: "mino", sfen: afterRook });
    expect(progress).toMatchObject({ filled: 2, total: 6 });
    expect([...progress.filledSquares].sort()).toEqual(["6h", "7f"]);
    expect(openingFormationProgress({ sfen: START })).toEqual({ filled: 0, total: 0, filledSquares: [] });
  });

  it("1手ずつの形を残し、最後の形が完成形になる", () => {
    const { steps, frames } = openingFormationSteps("shiken", "mino");
    expect(frames).toHaveLength(steps.length + 1);
    expect(frames[0].every(({ moved }) => !moved)).toBe(true);
    expect(frames.at(-1)).toEqual(openingFormation("shiken", "mino").pieces);
    expect(steps.map(({ phase }) => phase)).toEqual([...Array(3).fill("strategy"), ...Array(5).fill("castle")]);
    // 1手目のあとは、7六の歩だけが動いている。
    expect(frames[1].filter(({ moved }) => moved).map(({ square }) => square)).toEqual(["7f"]);
  });

  it("手の名前は、先手は▲、後手は盤を反転したマスで△と書く", () => {
    const { steps } = openingFormationSteps("shiken", "mino");
    expect(steps.map((step) => openingStepLabel(step)).slice(0, 3)).toEqual(["▲７六歩", "▲６六歩", "▲６八飛"]);
    expect(steps.map((step) => openingStepLabel(step, "white")).slice(0, 3)).toEqual(["△３四歩", "△４四歩", "△４二飛"]);
    const kakugawari = openingFormationSteps("kakugawari", "nakazumai").steps.map((step) => openingStepLabel(step));
    expect(kakugawari.slice(0, 2)).toEqual(["▲７六歩", "角を交換する"]);
    const promoted = { usi: "8h2b+", phase: "strategy", kind: "B", from: "8h", to: "2b", promote: true, drop: false, exchange: false };
    expect(openingStepLabel(promoted)).toBe("▲２二角成");
    const drop = { usi: "B*5e", phase: "strategy", kind: "B", from: "", to: "5e", promote: false, drop: true, exchange: false };
    expect(openingStepLabel(drop)).toBe("▲５五角打");
  });

  it("すべてのカードで、手順の再生に動かない手がない", () => {
    for (const plan of ALL_OPENING_PLANS) {
      const { steps, frames } = openingFormationSteps(plan.strategyId, plan.castles[0] ?? "");
      expect(steps.length, plan.id).toBeGreaterThan(0);
      for (let index = 1; index < frames.length; index += 1) {
        expect(frames[index], `${plan.id} ${index}`).not.toEqual(frames[index - 1]);
      }
    }
  });
});
