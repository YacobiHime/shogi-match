import { describe, expect, it } from "vitest";
import { InitialPositionSFEN } from "tsshogi";
import { formationChoices, mirrorSquare, placeFormation } from "./edit-formation.mjs";
import { pieceAt, pieceTotals, validateEditedPosition, handsOf } from "./position-editor.mjs";
import { openingFormation } from "./opening-formation.mjs";

const STANDARD = InitialPositionSFEN.STANDARD;

describe("局面編集で作戦の形を置く", () => {
  it("目録は作戦カードの群の順で、囲いだけの群もある", () => {
    const groups = formationChoices();
    expect(groups.map(({ id }) => id)).toEqual(["static", "ranging", "surprise", "castle"]);
    const shiken = groups[1].items.find(({ id }) => id === "shiken");
    expect(shiken.label).toContain("四間飛車");
    expect(shiken.castles[0].id).toBe("mino");
    expect(groups[3].items.every(({ castles }) => castles.length === 1)).toBe(true);
  });

  it("後手のマスは盤を180度回す", () => {
    expect(mirrorSquare("2h")).toBe("8b");
    expect(mirrorSquare("5i")).toBe("5a");
  });

  it("先手に四間飛車と美濃囲いを置く。相手の駒はそのまま、駒は40枚のまま", () => {
    const { sfen, skipped } = placeFormation(STANDARD, { strategyId: "shiken", castleId: "mino", side: "black" });
    expect(skipped).toEqual([]);
    for (const { square, kind } of openingFormation("shiken", "mino").pieces) {
      expect(pieceAt(sfen, square)).toMatchObject({ side: "black" });
      if (kind === "R") expect(square).toBe("6h");
    }
    expect(pieceAt(sfen, "5a")).toMatchObject({ type: "king", side: "white" });
    expect(pieceTotals(sfen)).toEqual({ box: 0, placed: 40 });
    expect(validateEditedPosition(sfen).problems).toEqual([]);
  });

  it("後手にも置ける(先手の形を回したマス)", () => {
    const { sfen, skipped } = placeFormation(STANDARD, { strategyId: "shiken", castleId: "mino", side: "white" });
    expect(skipped).toEqual([]);
    expect(pieceAt(sfen, "4b")).toMatchObject({ type: "rook", side: "white" });
    expect(validateEditedPosition(sfen).problems).toEqual([]);
  });

  it("角換わりは、交換した角を持ち駒にする", () => {
    const { sfen, hand } = placeFormation(STANDARD, { strategyId: "kakugawari", castleId: "nakazumai", side: "black" });
    expect(hand).toContain("bishop");
    expect(handsOf(sfen).black.bishop).toBe(1);
    expect(pieceTotals(sfen).placed).toBe(40);
  });

  it("相手の駒がいるマスには置かず、置けなかったマスとして返す", () => {
    // 6八(飛車の振り先)に後手の金を置いた局面
    const blocked = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B1g3R1/LNS1KGSNL b - 1";
    const { sfen, skipped } = placeFormation(blocked, { strategyId: "shiken", castleId: "mino", side: "black" });
    expect(skipped).toContain("6h");
    expect(pieceAt(sfen, "6h")).toMatchObject({ type: "gold", side: "white" });
    expect(pieceTotals(sfen).placed + pieceTotals(sfen).box).toBe(40);
  });

  it("すべての作戦の形を、平手の両方の側に置ける(二歩・行き所のない駒・玉の数の反則がない)", () => {
    for (const group of formationChoices()) {
      for (const item of group.items) {
        for (const castle of item.castles.length ? item.castles : [{ id: "" }]) {
          let sfen = placeFormation(STANDARD, { strategyId: item.strategyId, castleId: castle.id, side: "black" }).sfen;
          sfen = placeFormation(sfen, { strategyId: item.strategyId, castleId: castle.id, side: "white" }).sfen;
          // 王手は、同じ作戦を両方に置いたとき角の筋が通ることがある(筋違い角)。形の置き方の誤りではないので数えない。
          const codes = validateEditedPosition(sfen).problems.map(({ code }) => code).filter((code) => code !== "check");
          expect({ id: item.id, castle: castle.id, codes }).toEqual({ id: item.id, castle: castle.id, codes: [] });
        }
      }
    }
  });
});
