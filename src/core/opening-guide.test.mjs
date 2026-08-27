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
  openingCanonicalFollowupCandidates,
  openingDetourArrowCandidates,
  openingUrgentResponse,
  chooseSafeOpeningMove,
  openingFollowupCount,
  openingGuideScoreLossLimit,
  openingPlanBranchMessage,
  openingPlanCandidates,
  openingPlanInterruption,
  openingPlanSteps,
  rangingRookStrategyChoices,
  shouldAbandonOpeningGuide,
  shouldShowOpeningFollowup,
  OPENING_CASTLE_GROUPS,
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
  it("starts a fresh guidance window when a reachable plan is selected late", () => {
    expect(isOpeningGuideExpired(39, 30, 40)).toBe(false);
    expect(isOpeningGuideExpired(40, 30, 40)).toBe(false);
    expect(isOpeningGuideExpired(97, 90, 40)).toBe(false);
  });

  it("also retains the per-selection limit for nonstandard starting positions", () => {
    expect(isOpeningGuideExpired(39, 0, 40)).toBe(false);
    expect(isOpeningGuideExpired(50, 10, 40)).toBe(true);
    expect(isOpeningGuideExpired(97, 57, 40)).toBe(true);
  });

  it("abandons an opening plan after three followed detours", () => {
    expect(shouldAbandonOpeningGuide(2)).toBe(false);
    expect(shouldAbandonOpeningGuide(3)).toBe(false);
    expect(shouldAbandonOpeningGuide(5)).toBe(false);
    expect(shouldAbandonOpeningGuide(6)).toBe(true);
    expect(shouldAbandonOpeningGuide(7)).toBe(true);
  });

  it("shows completion followups only for a completed strategy without a castle", () => {
    expect(shouldShowOpeningFollowup({
      strategyId: "aigakari-bougin",
      planComplete: true,
    })).toBe(true);
    expect(shouldShowOpeningFollowup({
      castleId: "minogakoi",
      planComplete: true,
    })).toBe(false);
    expect(shouldShowOpeningFollowup({
      strategyId: "aigakari-bougin",
      castleId: "nakazumai",
      planComplete: true,
    })).toBe(false);
    expect(shouldShowOpeningFollowup({
      strategyId: "aigakari-bougin",
      planComplete: true,
      planExpired: true,
    })).toBe(false);
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
      "舟囲い", "箱入り娘", "早囲い", "金矢倉", "土居矢倉", "菊水矢倉", "エルモ囲い",
      "雁木", "左美濃", "天守閣美濃", "居飛車穴熊", "松尾流穴熊",
      "右玉", "大隅囲い", "中住まい", "中原囲い", "カニ囲い", "ボナンザ囲い",
    ]);
    expect(groups.ranging?.map(({ label }) => label)).toEqual([
      "片美濃", "本美濃", "高美濃", "ダイヤモンド美濃", "連盟美濃",
      "振り飛車銀冠", "振り飛車穴熊", "振り飛車エルモ",
      "金無双", "片金無双", "右矢倉",
    ]);
    expect(groups.both?.map(({ label }) => label)).toEqual(["ミレニアム"]);
  });

  it("classifies every castle by family, contexts, and a visible menu group", () => {
    const menuGroupIds = new Set(OPENING_CASTLE_GROUPS.map(({ id }) => id));
    expect(OPENING_CASTLES.every(({ family, contexts, menuGroup }) => (
      typeof family === "string"
      && Array.isArray(contexts)
      && contexts.length > 0
      && menuGroupIds.has(menuGroup)
    ))).toBe(true);
    expect(OPENING_CASTLES.find(({ id }) => id === "mino")).toMatchObject({
      label: "本美濃",
      family: "mino",
      contexts: ["anti-static-ranging", "double-ranging"],
      menuGroup: "ranging-mino",
    });
    expect(OPENING_CASTLES.find(({ id }) => id === "right-yagura")).toMatchObject({
      family: "yagura",
      contexts: ["double-ranging"],
      menuGroup: "double-ranging",
    });
  });

  it("offers basic rook destinations only for Ranging Rook castles", () => {
    expect(rangingRookStrategyChoices("half-mino").map(({ id }) => id)).toEqual([
      "shiken", "sangen", "nakabisha", "mukai",
    ]);
    expect(rangingRookStrategyChoices("mino", ["shiken", "sangen"]).map(({ id }) => id))
      .toEqual(["shiken", "sangen"]);
    expect(rangingRookStrategyChoices("right-yagura").map(({ id }) => id))
      .toEqual(["mukai"]);
    expect(rangingRookStrategyChoices("funagakoi")).toEqual([]);
  });

  it.each(["shiken", "sangen", "nakabisha", "mukai"])(
    "builds Half Mino after selecting the %s rook destination",
    (strategyId) => {
      expectPlanLegal(strategyId, "half-mino", "black");
      expectPlanLegal(strategyId, "half-mino", "white");
    },
  );

  it("does not move a Third-file Rook back to the fourth file while building Mino", () => {
    const moves = openingPlanSteps("sangen", "mino").map(({ usi }) => usi);
    expect(moves).toContain("2h7h");
    expect(moves).not.toContain("2h6h");
    expectPlanLegal("sangen", "mino", "black");
  });

  it("places every strategy in an opening family for the guide menu", () => {
    expect(OPENING_STRATEGIES.every(({ family }) =>
      ["ibisha", "aigakari", "yokofudori", "yagura", "kakugawari", "gangi", "anti-ranging", "shiken", "sangen", "nakabisha", "mukai", "special"].includes(family)
    )).toBe(true);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "shiken").map(({ label }) => label))
      .toEqual(["ノーマル四間飛車", "藤井システム"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "sangen").map(({ label }) => label))
      .toEqual(["ノーマル三間飛車", "早石田", "新鬼殺し", "7八飛戦法", "2手目3二飛戦法"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "nakabisha").map(({ label }) => label))
      .toEqual(["原始中飛車", "ゴキゲン中飛車", "端角中飛車"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "ibisha").map(({ label }) => label))
      .toEqual(["居飛車", "原始棒銀", "早繰り銀", "腰掛け銀"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "kakugawari").map(({ label }) => label))
      .toEqual(["角換わり", "角換わり棒銀", "角換わり早繰り銀", "角換わり腰掛け銀", "角換わり4五桂速攻"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "aigakari").map(({ label }) => label))
      .toEqual(["相掛かり", "ひねり飛車", "相掛かり棒銀", "相掛かり早繰り銀", "相掛かり腰掛け銀"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "yokofudori").map(({ label }) => label))
      .toEqual(["横歩取り", "横歩取り青野流"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "yagura").map(({ label }) => label))
      .toEqual(["矢倉戦法", "矢倉棒銀", "急戦矢倉早繰り銀", "矢倉腰掛け銀", "雀刺し", "矢倉3七銀", "森下システム"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "gangi").map(({ label }) => label))
      .toEqual(["雁木戦法", "雁木右四間"]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "special").map(({ label }) => label))
      .toEqual([
        "やばボーズ流", "鬼殺し", "筋違い角", "角頭歩戦法",
        "アヒル囲い", "パックマン", "嬉野流",
      ]);
    expect(OPENING_STRATEGIES.filter(({ family }) => family === "anti-ranging").map(({ label }) => label))
      .toEqual(["右四間飛車", "袖飛車", "鳥刺し"]);
    expect(OPENING_STRATEGIES.find(({ id }) => id === "ibisha")?.guideSelectable).toBe(false);
    expect(OPENING_STRATEGIES.filter(({ guideSelectable }) => guideSelectable === false).map(({ id }) => id))
      .toEqual([
        "ibisha", "aigakari", "yokofudori", "gangi-strategy", "kakugawari",
        "yagura-strategy", "hayaguri-gin", "koshikake-gin",
      ]);
  });

  it("does not complete a contextual silver strategy without its base opening", () => {
    expect(isOpeningPlanComplete({
      strategyId: "kakugawari-koshikake-gin",
      playedMoves: ["7g7f", "2g2f", "2f2e", "4g4f", "3i4h", "4h4g", "4g5f"],
    })).toBe(false);
    expect(isOpeningPlanComplete({
      strategyId: "kakugawari-koshikake-gin",
      playedMoves: [
        "7g7f", "2g2f", "2f2e", "8h2b+", "7i8h",
        "4g4f", "3i4h", "4h4g", "4g5f",
      ],
    })).toBe(true);
  });

  it("guides the left silver to 8h immediately after a Bishop Exchange", () => {
    expect(nextOpeningPlanMove({
      strategyId: "kakugawari-koshikake-gin",
      playedMoves: ["7g7f", "2g2f", "2f2e", "8h2b+"],
      legalMoves: ["7i8h", "4g4f", "3i4h"],
    })).toEqual({ usi: "7i8h", phase: "strategy" });
  });

  it("keeps an AI detour from moving the piece or occupying the square needed next", () => {
    expect(filterOpeningCompatibleCandidates({
      plannedMoves: [{ usi: "5i6h", phase: "castle" }],
      candidates: [
        { rank: 1, move: "5i4h" },
        { rank: 2, move: "4g4f" },
        { rank: 3, move: "7g6h" },
        { rank: 4, move: "5i6h" },
      ],
    }).map(({ move }) => move)).toEqual(["4g4f", "5i6h"]);
  });

  it("uses the researched Doi and Kikusui Fortress shapes", () => {
    expect(OPENING_CASTLES.find(({ id }) => id === "doi-yagura")?.completionSquares).toEqual([
      ["7h", "K"], ["7g", "S"], ["6g", "G"], ["5h", "G"],
    ]);
    expect(OPENING_CASTLES.find(({ id }) => id === "kikusui-yagura")?.completionSquares).toEqual([
      ["8i", "K"], ["8h", "S"], ["7h", "G"], ["7g", "N"], ["6g", "G"],
    ]);
  });

  it("uses the researched Ureshino, Bird Spear, and Bishop Exchange 4e Knight skeletons", () => {
    expect(openingPlanSteps("ureshino", "").map(({ usi }) => usi)).toEqual([
      "7i6h", "5g5f", "6h5g",
    ]);
    expect(openingPlanSteps("torizashi", "").map(({ usi }) => usi)).toEqual([
      "5g5f", "7i6h", "6h5g", "8h7i", "5g4f",
    ]);
    expect(openingPlanSteps("kakugawari-45-knight", "").map(({ usi }) => usi)).toContain("7i8h");
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

  it("offers reachable White-side castles from a partially built Ranging Rook position", () => {
    const definitions = OPENING_CASTLES.filter(({ id }) => (
      ["furibisha-elmo", "half-mino", "osumi"].includes(id)
    ));
    expect(availableOpeningDefinitions({
      definitions,
      kind: "castle",
      color: "white",
      rookStyle: "ranging",
      playedMoves: ["3c3d", "4c4d", "8b4b", "5a6b", "6b7b"],
      moveHistory: Array.from({ length: 44 }, (_, index) => `move-${index}`),
      legalMoves: ["7a6b", "7b8b", "6a6b"],
    }).map(({ id }) => id)).toEqual(["half-mino", "furibisha-elmo"]);
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

  it("continues Primitive Climbing Silver from 2g silver to the canonical 2f silver shape", () => {
    const setupMoves = ["2g2f", "2f2e", "3i3h", "3h2g"];
    const setupSfen = sfenAfterMoves(setupMoves);
    expect(isOpeningPlanComplete({
      strategyId: "bougin",
      playedMoves: setupMoves,
      detectedFormations: ["棒銀"],
      currentSfen: setupSfen,
    })).toBe(false);
    expect(nextOpeningPlanMove({
      strategyId: "bougin",
      playedMoves: setupMoves,
      detectedFormations: ["棒銀"],
      currentSfen: setupSfen,
      legalMoves: ["2g2f"],
    })).toEqual({ usi: "2g2f", phase: "strategy" });

    const completedMoves = [...setupMoves, "2g2f"];
    expect(isOpeningPlanComplete({
      strategyId: "bougin",
      playedMoves: completedMoves,
      currentSfen: sfenAfterMoves(completedMoves),
    })).toBe(true);

    const whiteSetupMoves = ["8c8d", "8d8e", "7a7b", "7b8c"];
    expect(nextOpeningPlanMove({
      strategyId: "bougin",
      color: "white",
      playedMoves: whiteSetupMoves,
      detectedFormations: ["棒銀"],
      currentSfen: sfenAfterMoves(whiteSetupMoves, "white"),
      legalMoves: ["8c8d"],
    })).toEqual({ usi: "8c8d", phase: "strategy" });
  });

  it("treats 2f silver as complete, then guides Primitive Climbing Silver through pawn exchange", () => {
    const completedMoves = ["2g2f", "2f2e", "3i3h", "3h2g", "2g2f"];
    expect(openingCanonicalFollowupCandidates({
      strategyId: "bougin",
      currentSfen: sfenAfterMoves(completedMoves),
      legalMoves: ["2f1e", "2f2e", "2f3e"],
    })).toEqual([
      { usi: "2f1e", kind: "silver-advance" },
      { usi: "2f3e", kind: "silver-advance" },
    ]);

    const advancedMoves = [...completedMoves, "2f1e"];
    expect(isOpeningPlanComplete({
      strategyId: "bougin",
      playedMoves: advancedMoves,
      currentSfen: sfenAfterMoves(advancedMoves),
    })).toBe(true);
    expect(openingCanonicalFollowupCandidates({
      strategyId: "bougin",
      currentSfen: sfenAfterMoves(advancedMoves),
      legalMoves: ["2e2d"],
    })).toEqual([{ usi: "2e2d", kind: "pawn-exchange" }]);

    let record = createGameRecord();
    for (const usi of [...advancedMoves, "2e2d"]) {
      record = createGameRecord(withTurn(record.position.sfen, "black"));
      expect(appendUsiMove(record, usi), `black: ${usi}`).toBe(true);
    }
    record = createGameRecord(withTurn(record.position.sfen, "white"));
    expect(appendUsiMove(record, "2c2d")).toBe(true);
    expect(openingCanonicalFollowupCandidates({
      strategyId: "bougin",
      currentSfen: record.position.sfen,
      legalMoves: ["2h2d"],
    })).toEqual([{ usi: "2h2d", kind: "pawn-exchange" }]);
  });

  it("mirrors Primitive Climbing Silver continuation for White", () => {
    const completedMoves = ["8c8d", "8d8e", "7a7b", "7b8c", "8c8d"];
    expect(openingCanonicalFollowupCandidates({
      strategyId: "bougin",
      color: "white",
      currentSfen: sfenAfterMoves(completedMoves, "white"),
      legalMoves: ["8d9e", "8d7e"],
    })).toEqual([
      { usi: "8d9e", kind: "silver-advance" },
      { usi: "8d7e", kind: "silver-advance" },
    ]);
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
    const exchangeDependent = id.startsWith("kakugawari") || id === "yababozu";
    const blackConditional = id === "sujichigai-kaku"
      ? ["8h2b+", "B*4e", "4e3d"]
      : id === "yokofudori"
        ? ["2h2d", "2d3d"]
        : id === "aono-ryu"
          ? ["2h2d", "2d3d"]
        : id === "hineribisha"
          ? ["2h2d", "2d2f", "2f3f"]
      : exchangeDependent ? ["8h2b+", "7i8h"] : [];
    const whiteConditional = id === "sujichigai-kaku"
      ? ["2b8h+", "B*6e", "6e7f"]
      : id === "yokofudori"
        ? ["8b8f", "8f7f"]
        : id === "aono-ryu"
          ? ["8b8f", "8f7f"]
        : id === "hineribisha"
          ? ["8b8f", "8f8d", "8d7d"]
      : exchangeDependent ? ["2b8h+", "3a2b"] : [];
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

  it.each([
    "kakugawari",
    "kakugawari-bougin",
    "kakugawari-hayaguri-gin",
    "kakugawari-koshikake-gin",
    "kakugawari-45-knight",
  ])("switches %s to Right Fourth-file Rook when White closes the bishop diagonal", (strategyId) => {
    expect(openingPlanInterruption({
      strategyId,
      color: "black",
      playedMoves: ["7g7f", "2g2f"],
      opponentMoves: ["3c3d", "4c4d"],
      moveHistory: ["7g7f", "3c3d", "2g2f", "4c4d"],
    })).toMatchObject({
      fallbackStrategyId: "right-shiken",
      message: expect.stringContaining("△4四歩"),
    });
  });

  it("switches a White-side Bishop Exchange plan when Black closes the bishop diagonal", () => {
    expect(openingPlanInterruption({
      strategyId: "kakugawari-koshikake-gin",
      color: "white",
      playedMoves: ["3c3d", "8c8d"],
      opponentMoves: ["7g7f", "6g6f"],
      moveHistory: ["7g7f", "3c3d", "6g6f"],
    })).toMatchObject({
      fallbackStrategyId: "right-shiken",
      message: expect.stringContaining("▲6六歩"),
    });
  });

  it("keeps a Bishop Exchange plan after the bishops have already been exchanged", () => {
    expect(openingPlanInterruption({
      strategyId: "kakugawari-bougin",
      color: "black",
      playedMoves: ["7g7f", "8h2b+"],
      opponentMoves: ["3c3d", "4c4d"],
      moveHistory: ["7g7f", "3c3d", "8h2b+", "3a2b", "4c4d"],
    })).toBeNull();
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
    const style = openingDefinitionRookStyle(id, "castle");
    const strategyId = style === "ranging" ? (id === "right-yagura" ? "mukai" : "shiken") : "";
    expectPlanLegal(strategyId, id, "black");
    expectPlanLegal(strategyId, id, "white");
  });

  it.each(["hakoiri-musume", "nakahara", "right-yagura"])(
    "reaches the registered completion position for %s",
    (castleId) => {
      const strategyId = castleId === "right-yagura" ? "mukai" : "";
      const moves = openingPlanSteps(strategyId, castleId).map(({ usi }) => usi);
      expect(isOpeningPlanComplete({
        castleId,
        playedMoves: moves,
        currentSfen: sfenAfterMoves(moves),
      })).toBe(true);
      expect(isOpeningPlanComplete({
        castleId,
        playedMoves: moves,
        currentSfen: createGameRecord().position.sfen,
      })).toBe(false);
    },
  );

  it.each(OPENING_CASTLES.filter(({ completionSquares, completionVariants }) => (
    completionSquares?.length || completionVariants?.length
  )))("reaches the exact registered shape for $label", ({ id: castleId }) => {
    const style = openingDefinitionRookStyle(castleId, "castle");
    const strategyId = style === "ranging"
      ? (castleId === "right-yagura" ? "mukai" : "shiken")
      : "";
    const moves = openingPlanSteps(strategyId, castleId).map(({ usi }) => usi);
    expect(isOpeningPlanComplete({
      castleId,
      playedMoves: moves,
      currentSfen: sfenAfterMoves(moves),
    })).toBe(true);
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

  it("does not overwrite the selected Ranging Rook while building Kinmusou", () => {
    const castleMoves = openingPlanSteps("", "kinmusou").map(({ usi }) => usi);
    expect(castleMoves).toEqual([
      "5i4h", "4h3h", "3i2h", "4i4h", "6i5h",
    ]);
    const moves = openingPlanSteps("shiken", "kinmusou").map(({ usi }) => usi);
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

  it("falls back to the best move when a lower-ranked plan has no comparable score", () => {
    expect(chooseSafeOpeningMove("2g2f", [
      { rank: 1, move: "7g7f" },
      { rank: 2, move: "2g2f" },
    ])).toEqual({ usi: "7g7f", source: "ai", scoreLoss: undefined });
    expect(chooseSafeOpeningMove("7g7f", [
      { rank: 1, move: "7g7f" },
    ])).toEqual({ usi: "7g7f", source: "plan", scoreLoss: 0 });
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

  it("shows one unsafe book move together with three AI detour candidates", () => {
    expect(openingDetourArrowCandidates("2g2f", [
      { rank: 1, move: "7g7f", score: { type: "cp", value: 120 } },
      { rank: 2, move: "2g2f", score: { type: "cp", value: -300 } },
      { rank: 3, move: "6i7h", score: { type: "cp", value: 80 } },
      { rank: 4, move: "4i5h", score: { type: "cp", value: 60 } },
      { rank: 5, move: "5i6h", score: { type: "cp", value: 40 } },
    ])).toEqual([
      { usi: "2g2f", source: "unsafe-plan" },
      { usi: "7g7f", source: "ai", score: { type: "cp", value: 120 } },
      { usi: "6i7h", source: "ai", score: { type: "cp", value: 80 } },
      { usi: "4i5h", source: "ai", score: { type: "cp", value: 60 } },
    ]);
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
    expect(openingGuideScoreLossLimit("yababozu", "castle")).toBe(500);

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
