import { describe, expect, it } from "vitest";
import { appendUsiMove, createGameRecord } from "../game-state";
import {
  availableOpeningDefinitions,
  chooseAdaptiveOpeningMove,
  filterOpeningCompatibleCandidates,
  inferOpeningRookStyle,
  isOpeningGuideExpired,
  isOpeningPlanComplete,
  mirrorUsiMove,
  nextOpeningPlanMove,
  openingDefinitionRookStyle,
  openingUrgentResponse,
  chooseSafeOpeningMove,
  openingFollowupCount,
  openingGuideScoreLossLimit,
  openingPlanBranchMessage,
  openingPlanCandidates,
  openingPlanInterruption,
  openingPlanSteps,
  shouldAbandonOpeningGuide,
  OPENING_CASTLES,
  OPENING_STRATEGIES,
} from "./opening-guide.mjs";
import { OPENING_EXPLANATIONS, openingExplanation } from "./opening-explanations.mjs";

function withTurn(sfen, color) {
  const fields = sfen.split(" ");
  fields[1] = color === "black" ? "b" : "w";
  return fields.join(" ");
}

function expectPlanLegal(strategyId, castleId, color, opponentDependent = []) {
  let record = createGameRecord();
  for (const { usi } of openingPlanSteps(strategyId, castleId, color)) {
    record = createGameRecord(withTurn(record.position.sfen, color));
    const applied = appendUsiMove(record, usi);
    if (!applied && opponentDependent.includes(usi)) continue;
    expect(applied, `${color}: ${usi}`).toBe(true);
  }
}

function sfenAfterMoves(moves, color = "black") {
  let record = createGameRecord();
  for (const usi of moves) {
    record = createGameRecord(withTurn(record.position.sfen, color));
    expect(appendUsiMove(record, usi), `${color}: ${usi}`).toBe(true);
  }
  return record.position.sfen;
}

describe("opening guide", () => {
  it("expires at the overall opening limit even when the guide was selected late", () => {
    expect(isOpeningGuideExpired(39, 30, 40)).toBe(false);
    expect(isOpeningGuideExpired(40, 30, 40)).toBe(true);
    expect(isOpeningGuideExpired(97, 57, 40)).toBe(true);
  });

  it("also retains the per-selection limit for nonstandard starting positions", () => {
    expect(isOpeningGuideExpired(39, 0, 40)).toBe(false);
    expect(isOpeningGuideExpired(50, 10, 40)).toBe(true);
  });

  it("abandons an opening plan after three followed detours", () => {
    expect(shouldAbandonOpeningGuide(2)).toBe(false);
    expect(shouldAbandonOpeningGuide(3)).toBe(true);
    expect(shouldAbandonOpeningGuide(4)).toBe(true);
    expect(shouldAbandonOpeningGuide(5)).toBe(true);
  });

  it("has an explanation for every selectable strategy", () => {
    expect(Object.keys(OPENING_EXPLANATIONS).sort())
      .toEqual(OPENING_STRATEGIES.map(({ id }) => id).sort());
    for (const { id } of OPENING_STRATEGIES) {
      expect(openingExplanation(id)).toMatchObject({
        overview: expect.any(String),
        aim: expect.any(String),
        castles: expect.any(String),
        followup: expect.any(String),
        caution: expect.any(String),
      });
    }
  });

  it("classifies every castle as static-rook, ranging-rook, or dual-use", () => {
    const groups = Object.groupBy(OPENING_CASTLES, ({ id }) => (
      openingDefinitionRookStyle(id, "castle") ?? "both"
    ));
    expect(groups.static?.map(({ label }) => label)).toEqual([
      "舟囲い", "早囲い", "矢倉", "土居矢倉", "菊水矢倉", "エルモ囲い",
      "雁木", "左美濃", "天守閣美濃", "居飛車穴熊", "松尾流穴熊",
      "右玉", "中住まい", "カニ囲い", "ボナンザ囲い",
    ]);
    expect(groups.ranging?.map(({ label }) => label)).toEqual([
      "片美濃", "美濃囲い", "高美濃囲い", "ダイヤモンド美濃", "連盟美濃",
      "銀冠", "振り飛車穴熊", "振り飛車エルモ", "右エルモ", "金無双", "片金無双",
    ]);
    expect(groups.both?.map(({ label }) => label)).toEqual(["ミレニアム", "大隅囲い"]);
  });

  it("places every strategy in an opening family for the guide menu", () => {
    expect(OPENING_STRATEGIES.every(({ family }) =>
      ["ibisha", "aigakari", "yokofudori", "yagura", "kakugawari", "gangi", "shiken", "sangen", "nakabisha", "mukai", "special"].includes(family)
    )).toBe(true);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "shiken").map(({ label }) => label))
      .toEqual(["四間飛車", "藤井システム"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "sangen").map(({ label }) => label))
      .toEqual(["三間飛車", "石田流"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "nakabisha").map(({ label }) => label))
      .toEqual(["中飛車", "ゴキゲン中飛車"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "ibisha").map(({ label }) => label))
      .toEqual(["居飛車", "棒銀", "右四間飛車", "早繰り銀", "腰掛け銀", "袖飛車"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "kakugawari").map(({ label }) => label))
      .toEqual(["角換わり", "角換わり4五桂速攻"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "aigakari").map(({ label }) => label))
      .toEqual(["相掛かり", "ひねり飛車"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "yokofudori").map(({ label }) => label))
      .toEqual(["横歩取り", "横歩取り青野流"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "yagura").map(({ label }) => label))
      .toEqual(["矢倉戦法", "雀刺し", "矢倉3七銀", "森下システム"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "gangi").map(({ label }) => label))
      .toEqual(["雁木戦法", "雁木右四間"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "special").map(({ label }) => label))
      .toEqual([
        "やばボーズ流", "鬼殺し", "筋違い角", "角頭歩戦法", "端角中飛車", "新鬼殺し",
        "7八飛戦法", "2手目3二飛戦法", "鳥刺し", "アヒル囲い", "パックマン", "嬉野流",
      ]);
    expect(OPENING_STRATEGIES.find(({ id }) => id === "ibisha")?.guideSelectable).toBe(false);
  });

  it("offers Yababozu only to White after Black opens the bishop diagonal", () => {
    const yababozu = OPENING_STRATEGIES.find(({ id }) => id === "yababozu");
    expect(availableOpeningDefinitions({
      definitions: [yababozu],
      kind: "strategy",
      color: "white",
      moveHistory: ["7g7f"],
      legalMoves: ["3c3d"],
    }).map(({ id }) => id)).toEqual(["yababozu"]);
    expect(availableOpeningDefinitions({
      definitions: [yababozu],
      kind: "strategy",
      color: "white",
      moveHistory: ["2g2f"],
      legalMoves: ["3c3d"],
    })).toEqual([]);
    expect(availableOpeningDefinitions({
      definitions: [yababozu],
      kind: "strategy",
      color: "black",
      moveHistory: ["7g7f"],
      legalMoves: ["7g7f"],
    })).toEqual([]);
  });

  it("requires Black to recapture the exchanged bishop before continuing Yababozu", () => {
    const yababozu = OPENING_STRATEGIES.find(({ id }) => id === "yababozu");
    const common = {
      definitions: [yababozu],
      kind: "strategy",
      color: "white",
      playedMoves: ["3c3d", "2b8h+"],
      legalMoves: ["4a3b"],
    };
    expect(availableOpeningDefinitions({
      ...common,
      moveHistory: ["7g7f", "3c3d", "2g2f", "2b8h+", "2f2e"],
    })).toEqual([]);
    expect(availableOpeningDefinitions({
      ...common,
      moveHistory: ["7g7f", "3c3d", "2g2f", "2b8h+", "7i8h"],
    }).map(({ id }) => id)).toEqual(["yababozu"]);
  });

  it("recognizes Static Rook commitment from the rook pawn, 4h silver, or bishop exchange", () => {
    expect(inferOpeningRookStyle({ playedMoves: ["2g2f"] })).toBe("static");
    expect(inferOpeningRookStyle({ playedMoves: ["7g7f", "3i4h"] })).toBe("static");
    expect(inferOpeningRookStyle({ playedMoves: ["7g7f", "8h2b+"] })).toBe("static");
    expect(inferOpeningRookStyle({ color: "white", playedMoves: ["8c8d"] })).toBe("static");
  });

  it("recognizes Ranging Rook commitment after moving the rook off its home file", () => {
    expect(inferOpeningRookStyle({ playedMoves: ["7g7f", "2h6h"] })).toBe("ranging");
    expect(inferOpeningRookStyle({ color: "white", playedMoves: ["3c3d", "8b4b"] }))
      .toBe("ranging");
  });

  it("keeps Right Fourth-file Rook in the Static Rook family", () => {
    expect(inferOpeningRookStyle({ playedMoves: ["4g4f", "2h4h"] })).toBe("static");
    expect(inferOpeningRookStyle({ color: "white", playedMoves: ["6c6d", "8b6b"] }))
      .toBe("static");
  });

  it("hides Ranging Rook castles and strategies after Static Rook commitment", () => {
    expect(availableOpeningDefinitions({
      definitions: OPENING_CASTLES.filter(({ id }) => ["mino", "yagura"].includes(id)),
      kind: "castle",
      rookStyle: "static",
      legalMoves: ["2h6h", "7g7f"],
    }).map(({ id }) => id)).toEqual(["yagura"]);
    expect(availableOpeningDefinitions({
      definitions: OPENING_STRATEGIES.filter(({ id }) => ["shiken", "bougin"].includes(id)),
      kind: "strategy",
      rookStyle: "static",
      legalMoves: ["2h6h", "2g2f"],
    }).map(({ id }) => id)).toEqual(["bougin"]);
  });

  it("hides Static Rook castles and strategies after Ranging Rook commitment", () => {
    expect(availableOpeningDefinitions({
      definitions: OPENING_CASTLES.filter(({ id }) => ["mino", "yagura"].includes(id)),
      kind: "castle",
      rookStyle: "ranging",
      legalMoves: ["2h6h", "7g7f"],
    }).map(({ id }) => id)).toEqual(["mino"]);
    expect(availableOpeningDefinitions({
      definitions: OPENING_STRATEGIES.filter(({ id }) => ["shiken", "bougin"].includes(id)),
      kind: "strategy",
      rookStyle: "ranging",
      legalMoves: ["2h6h", "2g2f"],
    }).map(({ id }) => id)).toEqual(["shiken"]);
  });

  it("shows Pacman only to White after Black opens the bishop diagonal", () => {
    const pacman = OPENING_STRATEGIES.find(({ id }) => id === "pacman");
    expect(availableOpeningDefinitions({
      definitions: [pacman],
      kind: "strategy",
      color: "white",
      moveHistory: ["7g7f"],
      legalMoves: ["4c4d"],
    }).map(({ id }) => id)).toEqual(["pacman"]);
    expect(availableOpeningDefinitions({
      definitions: [pacman],
      kind: "strategy",
      color: "white",
      moveHistory: ["2g2f"],
      legalMoves: ["4c4d"],
    })).toEqual([]);
    expect(availableOpeningDefinitions({
      definitions: [pacman],
      kind: "strategy",
      color: "black",
      legalMoves: ["6g6f"],
    })).toEqual([]);
  });

  it("offers first-move and reply-dependent surprise openings only in their exact window", () => {
    const sujichigai = OPENING_STRATEGIES.find(({ id }) => id === "sujichigai-kaku");
    const first78 = OPENING_STRATEGIES.find(({ id }) => id === "first-78-rook");
    const second32 = OPENING_STRATEGIES.find(({ id }) => id === "second-32-rook");
    expect(availableOpeningDefinitions({
      definitions: [sujichigai], kind: "strategy", color: "black",
      playedMoves: ["7g7f"], moveHistory: ["7g7f", "3c3d"], legalMoves: ["8h2b+"],
    }).map(({ id }) => id)).toEqual(["sujichigai-kaku"]);
    expect(availableOpeningDefinitions({
      definitions: [sujichigai], kind: "strategy", color: "black",
      playedMoves: ["7g7f"], moveHistory: ["7g7f", "8c8d"], legalMoves: ["8h2b+"],
    })).toEqual([]);
    expect(availableOpeningDefinitions({
      definitions: [first78], kind: "strategy", color: "black",
      moveHistory: [], legalMoves: ["2h7h"],
    }).map(({ id }) => id)).toEqual(["first-78-rook"]);
    expect(availableOpeningDefinitions({
      definitions: [first78], kind: "strategy", color: "black",
      moveHistory: ["7g7f", "3c3d"], legalMoves: ["2h7h"],
    })).toEqual([]);
    expect(availableOpeningDefinitions({
      definitions: [second32], kind: "strategy", color: "white",
      moveHistory: ["7g7f"], legalMoves: ["8b3b"],
    }).map(({ id }) => id)).toEqual(["second-32-rook"]);
  });

  it("hides an opening whose remaining planned moves cannot be played", () => {
    const shiken = OPENING_STRATEGIES.find(({ id }) => id === "shiken");
    expect(availableOpeningDefinitions({
      definitions: [shiken],
      kind: "strategy",
      color: "black",
      legalMoves: ["2g2f", "5g5f"],
    })).toEqual([]);
  });

  it("stops Pacman guidance when the offered pawn is not captured", () => {
    const pacman = OPENING_STRATEGIES.find(({ id }) => id === "pacman");
    expect(availableOpeningDefinitions({
      definitions: [pacman],
      kind: "strategy",
      color: "white",
      playedMoves: ["4c4d"],
      moveHistory: ["7g7f", "4c4d", "2g2f"],
      legalMoves: ["8b4b"],
    })).toEqual([]);
    expect(availableOpeningDefinitions({
      definitions: [pacman],
      kind: "strategy",
      color: "white",
      playedMoves: ["4c4d"],
      moveHistory: ["7g7f", "4c4d", "8h4d"],
      legalMoves: ["8b4b"],
    }).map(({ id }) => id)).toEqual(["pacman"]);
  });

  it("distinguishes a completed plan from a temporarily unavailable next move", () => {
    expect(isOpeningPlanComplete({
      strategyId: "shiken",
      playedMoves: ["7g7f", "6g6f"],
    })).toBe(false);
    expect(isOpeningPlanComplete({
      strategyId: "shiken",
      playedMoves: ["7g7f", "6g6f", "2h6h"],
    })).toBe(true);
    expect(isOpeningPlanComplete({
      strategyId: "shiken",
      detectedFormations: ["四間飛車"],
    })).toBe(true);
  });

  it("shows three to five AI follow-up arrows", () => {
    expect([0, 0.34, 0.99].map((value) => openingFollowupCount(() => value)))
      .toEqual([3, 4, 5]);
  });

  it("mirrors black guidance for a white player", () => {
    expect(mirrorUsiMove("7g7f")).toBe("3c3d");
    expect(mirrorUsiMove("2h6h")).toBe("8b4b");
  });

  it("builds the normal Yababozu shape through the rook retreat", () => {
    const moves = openingPlanSteps("yababozu", "", "white").map(({ usi }) => usi);
    expect(moves).toEqual([
      "3c3d", "2b8h+", "4a3b", "3a4b", "4c4d", "4b4c", "8b4b", "5a6b", "6b7b",
      "2a3c", "4b4a",
    ]);
    expect(moves.indexOf("4c4d")).toBeGreaterThan(moves.indexOf("4a3b"));
    expect(moves.indexOf("4c4d")).toBeGreaterThan(moves.indexOf("3a4b"));
  });

  it("keeps the rook at home and counters with 5f silver against sixth-file Koshikake pressure", () => {
    const context = {
      playedMoves: ["3c3d", "2b8h+", "4a3b", "3a4b", "4c4d", "4b4c"],
      opponentMoves: ["6g6f", "3i4h", "4h4g", "4g5f"],
      opponentFormations: ["腰掛け銀"],
    };
    expect(openingPlanSteps("yababozu", "", "white", context).map(({ usi }) => usi))
      .toEqual([
        "3c3d", "2b8h+", "4a3b", "3a4b", "4c4d", "4b4c",
        "4c5d", "5a6b", "6b7b", "2a3c",
      ]);
    expect(openingPlanCandidates({
      strategyId: "yababozu",
      color: "white",
      ...context,
      legalMoves: ["8b4b", "4c5d", "5a6b"],
    }).map(({ usi }) => usi)).toEqual(["4c5d"]);
  });

  it("builds the standard White Gokigen Central Rook with 5c silver and 7b king", () => {
    expect(openingPlanSteps("gokigen", "", "white").map(({ usi }) => usi)).toEqual([
      "3c3d", "5c5d", "8b5b", "5d5e", "3a4b", "4b5c", "5a6b", "6b7b",
    ]);
  });

  it("switches Gokigen to the silver opposition against Super-Speed Silver", () => {
    const context = { opponentMoves: ["3g3f", "3i3h", "3h3g", "3g4f"] };
    expect(openingPlanSteps("gokigen", "", "white", context).map(({ usi }) => usi)).toEqual([
      "3c3d", "5c5d", "8b5b", "5d5e", "3a4b", "4b5c", "5c4d", "5a6b", "6b7b",
    ]);
    expect(openingPlanBranchMessage({
      strategyId: "gokigen", color: "white", ...context,
    })).toContain("4二銀から5三銀、4四銀");
  });

  it("switches Gokigen through recapture and Opposing Rook against Maruyama Vaccine", () => {
    const context = { opponentMoves: ["8h2b+"] };
    expect(openingPlanSteps("gokigen", "", "white", context).map(({ usi }) => usi)).toEqual([
      "3c3d", "5c5d", "8b5b", "3a2b", "2b3c", "5b2b", "5a6b", "6b7b",
    ]);
    expect(openingPlanBranchMessage({
      strategyId: "gokigen", color: "white", ...context,
    })).toContain("丸山ワクチン");
  });

  it("avoids the ultra-rapid line when the opponent shows right gold on 5h", () => {
    const context = { opponentMoves: ["4i5h"] };
    expect(openingPlanSteps("gokigen", "", "white", context).map(({ usi }) => usi)).toEqual([
      "3c3d", "5c5d", "8b5b", "5a6b", "6b7b", "7b8b", "7a7b",
    ]);
    expect(openingPlanBranchMessage({
      strategyId: "gokigen", color: "white", ...context,
    })).toContain("5八金右は超急戦の合図");
  });

  it("does not abandon the normal Yababozu branch after the rook has moved", () => {
    expect(openingPlanSteps("yababozu", "", "white", {
      playedMoves: ["8b4b"],
      opponentMoves: ["6g6f", "6f6e"],
      opponentFormations: ["腰掛け銀"],
    }).map(({ usi }) => usi)).toContain("4b4a");
    expect(openingPlanSteps("yababozu", "", "white", {
      playedMoves: ["8b4b"],
      opponentMoves: ["6g6f", "6f6e"],
      opponentFormations: ["腰掛け銀"],
    }).map(({ usi }) => usi)).not.toContain("4c5d");
  });

  it("exposes only Yababozu moves whose prerequisites are complete", () => {
    expect(openingPlanCandidates({
      strategyId: "yababozu",
      color: "white",
      playedMoves: ["3c3d", "2b8h+"],
      moveHistory: ["7g7f", "3c3d", "2g2f", "2b8h+", "7i8h"],
      legalMoves: ["4a3b", "3a4b", "4c4d"],
    }).map(({ usi }) => usi)).toEqual(["4a3b"]);
    expect(openingPlanCandidates({
      strategyId: "yababozu",
      color: "white",
      playedMoves: ["3c3d", "2b8h+", "4a3b"],
      moveHistory: ["7g7f", "3c3d", "2g2f", "2b8h+", "7i8h", "4a3b"],
      legalMoves: ["3a4b", "4c4d"],
    }).map(({ usi }) => usi)).toEqual(["3a4b"]);
    expect(openingPlanCandidates({
      strategyId: "yababozu",
      color: "white",
      playedMoves: ["3c3d", "2b8h+", "4a3b", "3a4b"],
      moveHistory: ["7g7f", "3c3d", "2g2f", "2b8h+", "7i8h", "4a3b", "2f2e", "3a4b"],
      legalMoves: ["4c4d", "8b4b"],
    }).map(({ usi }) => usi)).toEqual(["4c4d"]);
  });

  it.each(OPENING_STRATEGIES)("uses a legal strategy sequence for $label", ({ id }) => {
    const exchangeDependent = ["kakugawari", "kakugawari-45-knight", "yababozu"].includes(id);
    const blackConditional = id === "sujichigai-kaku"
      ? ["8h2b+", "B*4e", "4e3d"]
      : id === "yokofudori"
        ? ["2h2d", "2d3d"]
        : id === "aono-ryu"
          ? ["2h2d", "2d3d"]
        : id === "hineribisha"
          ? ["2h2d", "2d2f", "2f3f"]
      : exchangeDependent ? ["8h2b+"] : [];
    const whiteConditional = id === "sujichigai-kaku"
      ? ["2b8h+", "B*6e", "6e7f"]
      : id === "yokofudori"
        ? ["8b8f", "8f7f"]
        : id === "aono-ryu"
          ? ["8b8f", "8f7f"]
        : id === "hineribisha"
          ? ["8b8f", "8f8d", "8d7d"]
      : exchangeDependent ? ["2b8h+"] : [];
    expectPlanLegal(id, "", "black", blackConditional);
    expectPlanLegal(id, "", "white", whiteConditional);
  });

  it("builds the complete Ahiru castle in the requested order", () => {
    expect(openingPlanSteps("ahiru", "", "black").map(({ usi }) => usi)).toEqual([
      "2g2f", "2f2e", "3i4h", "9g9f", "2h2f", "7i6h",
      "6i7i", "8h9g", "4i3i", "5i5h", "1g1f",
    ]);
  });

  it("switches Ahiru to the third-file rook attack against 3d pawn and 3c bishop", () => {
    expect(openingPlanSteps("ahiru", "", "black", {
      playedMoves: ["2g2f", "2f2e", "3i4h"],
      opponentMoves: ["3c3d", "2b3c"],
    }).map(({ usi }) => usi)).toEqual(["2g2f", "2f2e", "3i4h", "2h2f", "2f3f"]);
  });

  it("plays the Yokofudori guide through a legal alternating main line", () => {
    const record = createGameRecord();
    const line = [
      "7g7f", "3c3d", "2g2f", "8c8d", "2f2e", "8d8e", "6i7h", "4a3b",
      "2e2d", "2c2d", "2h2d", "8e8f", "8g8f", "8b8f", "2d3d",
    ];
    for (const usi of line) expect(appendUsiMove(record, usi), usi).toBe(true);
  });

  it("plays the Twisting Rook guide after the mutual rook-pawn exchange", () => {
    const record = createGameRecord();
    const line = [
      "2g2f", "8c8d", "2f2e", "8d8e", "6i7h", "4a3b", "2e2d", "2c2d",
      "2h2d", "8e8f", "8g8f", "8b8f", "2d2f", "4c4d", "2f3f", "6c6d",
      "7g7f", "5c5d", "8i7g",
    ];
    for (const usi of line) expect(appendUsiMove(record, usi), usi).toBe(true);
  });

  it("abandons Yababozu with an explanation when the opponent closes the bishop diagonal", () => {
    expect(openingPlanInterruption({
      strategyId: "yababozu",
      color: "white",
      playedMoves: ["3c3d"],
      opponentMoves: ["7g7f", "6g6f"],
      moveHistory: ["7g7f", "3c3d", "6g6f"],
    })).toMatchObject({
      fallbackStrategyId: "shiken",
      message: expect.stringContaining("角道を閉じちゃった"),
    });
  });

  it("abandons Pacman after the offered pawn is ignored", () => {
    expect(openingPlanInterruption({
      strategyId: "pacman",
      color: "white",
      playedMoves: ["4c4d"],
      opponentMoves: ["7g7f", "2g2f"],
      moveHistory: ["7g7f", "4c4d", "2g2f"],
    })).toMatchObject({ fallbackStrategyId: "shiken" });
    expect(openingPlanInterruption({
      strategyId: "pacman",
      color: "white",
      playedMoves: ["4c4d"],
      opponentMoves: ["7g7f", "8h4d"],
      moveHistory: ["7g7f", "4c4d", "8h4d"],
    })).toBeNull();
  });

  it.each(OPENING_CASTLES)("uses a legal castle sequence for $label", ({ id }) => {
    expectPlanLegal("", id, "black");
    expectPlanLegal("", id, "white");
  });

  it("skips played and currently illegal steps", () => {
    const next = nextOpeningPlanMove({
      strategyId: "shiken",
      castleId: "mino",
      playedMoves: ["7g7f"],
      legalMoves: ["2h6h", "5i4h"],
    });
    expect(next).toEqual({ usi: "2h6h", phase: "strategy" });
  });

  it("skips a phase already recognized by formation detection", () => {
    const next = nextOpeningPlanMove({
      strategyId: "shiken",
      castleId: "mino",
      legalMoves: ["7g7f", "5i4h"],
      detectedFormations: ["四間飛車"],
    });
    expect(next).toEqual({ usi: "5i4h", phase: "castle" });
  });

  it("finishes Fujii System guidance once the formation is recognized", () => {
    const next = nextOpeningPlanMove({
      strategyId: "fujii-system",
      castleId: "",
      legalMoves: ["7g7f", "6g6f", "2h6h"],
      detectedFormations: ["藤井システム"],
    });
    expect(next).toBeNull();
  });

  it("does not finish Right King guidance after only moving the king to 4h", () => {
    const next = nextOpeningPlanMove({
      strategyId: "",
      castleId: "right-king",
      playedMoves: ["5i4h"],
      legalMoves: ["7g7f", "6g6f"],
      detectedFormations: ["右玉"],
    });
    expect(next).toEqual({ usi: "7g7f", phase: "castle" });
  });

  it("guides Right King through the twin-silver shape and rook retreat", () => {
    expect(openingPlanSteps("", "right-king").map(({ usi }) => usi)).toEqual([
      "7g7f", "6g6f", "7i6h", "6h6g", "3i4h", "4g4f",
      "4h4g", "3g3f", "6i7h", "5i4h", "2i3g", "2h2i",
    ]);
  });

  it("requires the complete Right King position instead of move history alone", () => {
    const moves = openingPlanSteps("", "right-king").map(({ usi }) => usi);
    expect(isOpeningPlanComplete({
      castleId: "right-king",
      playedMoves: moves,
      currentSfen: createGameRecord().position.sfen,
    })).toBe(false);
    expect(isOpeningPlanComplete({
      castleId: "right-king",
      playedMoves: moves,
      currentSfen: sfenAfterMoves(moves),
    })).toBe(true);
  });

  it("keeps Yababozu complete after its pieces move on to the middlegame", () => {
    const moves = openingPlanSteps("yababozu", "", "white").map(({ usi }) => usi);
    const game = createGameRecord();
    const actualLine = [
      "7g7f", "3c3d", "2g2f", "2b8h+", "7i8h", "4a3b",
      "2f2e", "3a4b", "6g6f", "4c4d", "6f6e", "4b4c",
      "5g5f", "8b4b", "9g9f", "5a6b", "9f9e", "6b7b",
      "1g1f", "2a3c", "1f1e", "4b4a",
    ];
    for (const usi of actualLine) expect(appendUsiMove(game, usi), usi).toBe(true);
    const completedSfen = game.position.sfen;
    expect(isOpeningPlanComplete({
      strategyId: "yababozu",
      color: "white",
      currentSfen: completedSfen,
    })).toBe(true);
    expect(isOpeningPlanComplete({
      strategyId: "yababozu",
      color: "white",
      playedMoves: moves.slice(0, -1),
      currentSfen: createGameRecord().position.sfen,
    })).toBe(false);
    expect(isOpeningPlanComplete({
      strategyId: "yababozu",
      color: "white",
      playedMoves: moves,
      // 完成後に駒が動いた局面を想定し、現在形ではなく履歴で完成を維持する。
      currentSfen: createGameRecord().position.sfen,
    })).toBe(true);
  });

  it("prepares a fourth-file rook before building Kinmusou", () => {
    const moves = openingPlanSteps("", "kinmusou").map(({ usi }) => usi);
    expect(moves).toEqual([
      "7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3i2h", "4i4h", "6i5h",
    ]);
    expect(isOpeningPlanComplete({
      castleId: "kinmusou",
      detectedFormations: ["金無双"],
      currentSfen: createGameRecord().position.sfen,
    })).toBe(false);
    expect(isOpeningPlanComplete({
      castleId: "kinmusou",
      playedMoves: moves,
      currentSfen: sfenAfterMoves(moves),
    })).toBe(true);
  });

  it("does not skip a blocked prerequisite in the Static Rook Anaguma sequence", () => {
    expect(nextOpeningPlanMove({
      castleId: "ibisha-anaguma",
      playedMoves: ["9i9h", "7g7f"],
      legalMoves: ["8i7g", "7i8h", "6i7h"],
    })).toBeNull();
  });

  it("does not accept a premature Static Rook Anaguma detection", () => {
    const moves = openingPlanSteps("", "ibisha-anaguma").map(({ usi }) => usi);
    expect(isOpeningPlanComplete({
      castleId: "ibisha-anaguma",
      detectedFormations: ["居飛車穴熊"],
      currentSfen: createGameRecord().position.sfen,
    })).toBe(false);
    expect(isOpeningPlanComplete({
      castleId: "ibisha-anaguma",
      playedMoves: moves,
      currentSfen: sfenAfterMoves(moves),
    })).toBe(true);
  });

  it("prioritizes 7h gold against the fourth-file rook-pawn push in Aigakari", () => {
    expect(openingUrgentResponse({
      strategyId: "aigakari",
      color: "black",
      moveHistory: ["2g2f", "8c8d", "2f2e", "8d8e"],
      legalMoves: ["6i7h", "7g7f"],
    })).toEqual({
      usi: "6i7h",
      reason: "相手が8五歩まで伸ばしたから、先に7八金で角頭を守ろう！",
    });
  });

  it("mirrors the Aigakari gold defense for a white player", () => {
    expect(openingUrgentResponse({
      strategyId: "aigakari",
      color: "white",
      moveHistory: ["2g2f", "8c8d", "2f2e"],
      legalMoves: ["4a3b", "3c3d"],
    })?.usi).toBe("4a3b");
  });

  it("replaces a plan move that falls outside the safe top candidates", () => {
    expect(chooseSafeOpeningMove("2g2f", [
      { rank: 1, move: "6i7h", score: { type: "cp", value: 80 } },
      { rank: 2, move: "7g7f", score: { type: "cp", value: 20 } },
    ])).toEqual({ usi: "6i7h", source: "ai", scoreLoss: undefined });
  });

  it("keeps a plan move when its evaluation loss is small", () => {
    expect(chooseSafeOpeningMove("2g2f", [
      { rank: 1, move: "7g7f", score: { type: "cp", value: 90 } },
      { rank: 2, move: "2g2f", score: { type: "cp", value: -40 } },
    ])).toEqual({ usi: "2g2f", source: "plan", scoreLoss: 130 });
  });

  it("reorders ready plan moves by evaluation without leaving the plan", () => {
    expect(chooseAdaptiveOpeningMove(
      [{ usi: "7g7f" }, { usi: "2g2f" }],
      [
        { rank: 1, move: "2g2f", score: { type: "cp", value: 90 } },
        { rank: 2, move: "7g7f", score: { type: "cp", value: 20 } },
      ],
    )).toEqual({ usi: "2g2f", source: "plan", scoreLoss: 0 });
  });

  it("rejects Yababozu detours that block the rook before it reaches the fourth file", () => {
    const candidates = [
      { rank: 1, move: "6a5b", score: { type: "cp", value: 120 } },
      { rank: 2, move: "4a5b", score: { type: "cp", value: 100 } },
      { rank: 3, move: "8b9b", score: { type: "cp", value: 90 } },
      { rank: 4, move: "9c9d", score: { type: "cp", value: 80 } },
      { rank: 5, move: "8b4b", score: { type: "cp", value: 60 } },
    ];
    expect(filterOpeningCompatibleCandidates({
      strategyId: "yababozu",
      color: "white",
      playedMoves: ["3c3d", "2b8h+", "4a3b", "3a4b", "4c4d", "4b4c"],
      plannedMoves: [{ usi: "8b4b" }],
      candidates,
    }).map(({ rank, move }) => ({ rank, move }))).toEqual([
      { rank: 1, move: "9c9d" },
      { rank: 2, move: "8b4b" },
    ]);
    expect(filterOpeningCompatibleCandidates({
      strategyId: "yababozu",
      color: "white",
      playedMoves: ["8b4b"],
      candidates,
    })).toEqual(candidates);
  });

  it("keeps the 6b and 7b king route open until Yababozu reaches the 7b king shape", () => {
    expect(filterOpeningCompatibleCandidates({
      strategyId: "yababozu",
      color: "white",
      playedMoves: ["8b4b"],
      plannedMoves: [{ usi: "5a6b" }],
      candidates: [
        { rank: 1, move: "6a6b", score: { type: "cp", value: 100 } },
        { rank: 2, move: "5a6b", score: { type: "cp", value: 80 } },
        { rank: 3, move: "9c9d", score: { type: "cp", value: 60 } },
      ],
    }).map(({ rank, move }) => ({ rank, move }))).toEqual([
      { rank: 1, move: "5a6b" },
      { rank: 2, move: "9c9d" },
    ]);
  });

  it("rejects a plan move with a large evaluation drop", () => {
    expect(chooseSafeOpeningMove("2g2f", [
      { rank: 1, move: "6i7h", score: { type: "cp", value: 120 } },
      { rank: 4, move: "2g2f", score: { type: "cp", value: -500 } },
    ])).toEqual({ usi: "6i7h", source: "ai", scoreLoss: 620 });
  });

  it("prioritizes the Yababozu book line within a wider safety margin", () => {
    expect(openingGuideScoreLossLimit("yababozu", "strategy")).toBe(600);
    expect(openingGuideScoreLossLimit("shiken", "strategy")).toBe(250);
    expect(openingGuideScoreLossLimit("yababozu", "castle")).toBe(250);

    const candidates = [
      { rank: 1, move: "8b8d", score: { type: "cp", value: 180 } },
      { rank: 4, move: "8b4b", score: { type: "cp", value: -320 } },
    ];
    expect(chooseSafeOpeningMove(
      "8b4b",
      candidates,
      openingGuideScoreLossLimit("yababozu", "strategy"),
    )).toEqual({ usi: "8b4b", source: "plan", scoreLoss: 500 });
    expect(chooseSafeOpeningMove(
      "8b4b",
      candidates,
      openingGuideScoreLossLimit("shiken", "strategy"),
    )).toEqual({ usi: "8b8d", source: "ai", scoreLoss: 500 });
  });
});
