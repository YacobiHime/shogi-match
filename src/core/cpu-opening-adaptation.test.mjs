import { describe, expect, it } from "vitest";
import { Square } from "tsshogi";
import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import {
  CPU_ADAPTIVE_CASTLES,
  CPU_OPENING_REPERTOIRES,
  adaptCpuOpeningPlan,
  cpuOpeningTier,
  createAdaptiveCpuPlan,
  opponentOpeningStance,
} from "./cpu-opening-repertoire.mjs";
import { isOpeningPlanComplete, nextOpeningPlanMove } from "./opening-guide.mjs";

function sfenAfter(moves) {
  const record = createGameRecord();
  for (const usi of moves) expect(appendUsiMove(record, usi), usi).toBe(true);
  return record.position.sfen;
}

function sides(moves, cpuColor) {
  const cpuParity = cpuColor === "black" ? 0 : 1;
  return {
    cpuMoves: moves.filter((_, index) => index % 2 === cpuParity),
    opponentMoves: moves.filter((_, index) => index % 2 !== cpuParity),
  };
}

function adapt(plan, moves, cpuColor, options = {}) {
  return adaptCpuOpeningPlan({
    plan, cpuColor, ...sides(moves, cpuColor), currentSfen: sfenAfter(moves), ...options,
  });
}

/** CPUの作戦を毎手組み替えながら指し、相手は決まった手順を指す。 */
function playAdaptivePlan({ strategyId, cpuColor, opponentScript, level = 12, random = () => 0 }) {
  const record = createGameRecord();
  const moves = [];
  let plan = createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES[strategyId]);
  let scriptIndex = 0;
  let lastCapture = "";
  for (let ply = 0; ply < 80; ply += 1) {
    const legalMoves = enumerateLegalMoves(record.position).map(({ usi }) => usi);
    const cpuTurn = (ply % 2 === 0) === (cpuColor === "black");
    // 実対局と同じく、駒を取られた直後は定跡ではなくエンジンが取り返す。
    let usi = cpuTurn && lastCapture
      ? legalMoves.find((move) => move.slice(2, 4) === lastCapture && !move.endsWith("+"))
      : undefined;
    if (!usi && cpuTurn) {
      const { cpuMoves, opponentMoves } = sides(moves, cpuColor);
      plan = adaptCpuOpeningPlan({
        plan, cpuColor, cpuMoves, opponentMoves, currentSfen: record.position.sfen, level, random,
      });
      const options = {
        strategyId: plan.strategyId, castleId: plan.castleId, color: cpuColor,
        playedMoves: cpuMoves, opponentMoves, moveHistory: moves, legalMoves,
        currentSfen: record.position.sfen,
      };
      if ((plan.castleStance || !plan.adaptCastle) && isOpeningPlanComplete(options)) return { plan, moves, complete: true };
      usi = nextOpeningPlanMove(options)?.usi;
      if (!usi) return { plan, moves, complete: false };
    } else if (!usi) {
      while (scriptIndex < opponentScript.length && !legalMoves.includes(opponentScript[scriptIndex])) {
        scriptIndex += 1;
      }
      // 手順を使い切ったら、玉を1升往復させて形を崩さずに手番を渡す。
      const shuffle = ["5i5h", "5h5i", "6h5h", "5h6h", "5a5b", "5b5a", "4b5b", "5b4b"].find((move) => legalMoves.includes(move));
      usi = opponentScript[scriptIndex++] ?? shuffle ?? legalMoves[0];
    }
    const destination = usi.replace("+", "").slice(-2);
    const captured = !usi.includes("*") && Boolean(record.position.board.at(Square.newByUSI(destination)));
    expect(appendUsiMove(record, usi), usi).toBe(true);
    lastCapture = captured && !cpuTurn ? destination : "";
    moves.push(usi);
  }
  return { plan, moves, complete: false };
}

describe("CPU opening adaptation", () => {
  it("maps the 50 levels to four strength tiers by amateur rank", () => {
    expect([0, 19, 20, 24, 25, 39, 40, 49].map(cpuOpeningTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(cpuOpeningTier(undefined)).toBe(1);
  });

  it("detects the opponent stance from rook-pawn moves, silvers and the rook file", () => {
    expect(opponentOpeningStance({ opponentColor: "black", opponentMoves: ["7g7f"], currentSfen: sfenAfter(["7g7f"]) }))
      .toBeUndefined();
    expect(opponentOpeningStance({ opponentColor: "black", opponentMoves: ["2g2f"], currentSfen: sfenAfter(["2g2f"]) }))
      .toBe("static");
    const ranging = ["7g7f", "3c3d", "6g6f", "8c8d", "2h6h"];
    expect(opponentOpeningStance({
      opponentColor: "black", opponentMoves: ranging.filter((_, index) => index % 2 === 0), currentSfen: sfenAfter(ranging),
    })).toBe("ranging");
    // 後手の6三銀（先手基準の4七銀）も居飛車の合図。
    const whiteSilver = ["7g7f", "6c6d", "5g5f", "7a6b", "6g6f", "6b6c"];
    expect(opponentOpeningStance({
      opponentColor: "white", opponentMoves: ["6c6d", "7a6b", "6b6c"], currentSfen: sfenAfter(whiteSilver),
    })).toBe("static");
  });

  it("waits for the opponent stance before choosing an adaptive castle", () => {
    const plan = createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES.shiken);
    expect(plan).toMatchObject({ strategyId: "shiken", castleId: "", adaptCastle: true });
    expect(createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES["fujii-system"])).toMatchObject({ adaptCastle: false });
    expect(adapt(plan, ["7g7f"], "white").castleId).toBe("");
  });

  it.each([
    ["shiken", "white", ["2g2f", "3c3d", "2f2e"], "static"],
    ["shiken", "white", ["7g7f", "3c3d", "6g6f", "4c4d", "2h6h"], "ranging"],
    ["ibisha", "black", ["2g2f", "3c3d", "2f2e", "4c4d", "7g7f", "8b4b"], "ranging"],
    ["ibisha", "black", ["2g2f", "8c8d", "2f2e", "8d8e"], "static"],
  ])("chooses a %s castle as %s from the opponent stance", (strategyId, cpuColor, moves, stance) => {
    const plan = adapt(createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES[strategyId]), moves, cpuColor);
    expect(plan.castleStance).toBe(stance);
    expect(CPU_ADAPTIVE_CASTLES[strategyId][stance]).toContain(plan.castleId);
  });

  it("prefers simple castles at low levels and deeper castles at high levels", () => {
    const moves = ["7g7f", "3c3d", "2g2f", "4c4d", "2f2e", "8b4b"];
    const plan = createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES.ibisha);
    const pick = (level, value) => adapt(plan, moves, "black", { level, random: () => value }).castleId;
    // 低級は左美濃と舟囲いが大半(左美濃が先頭。docs/opening-guide-ux-design.mdの15章)、プロ級はミレニアムなど手数のかかる囲いを選びやすい。
    expect(pick(3, 0.1)).toBe("left-mino");
    expect(pick(3, 0.5)).toBe("funagakoi");
    expect(pick(40, 0.5)).not.toBe("funagakoi");
    expect(pick(40, 0.99)).toBe("millennium");
  });

  it("keeps the castle once its pieces started moving", () => {
    const plan = {
      ...createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES.ibisha),
      castleId: "yagura",
      castleStance: "static",
    };
    // 先手CPUが矢倉の6八銀まで進めた後で、相手が振り飛車に変えても組み直さない。
    const moves = ["2g2f", "3c3d", "7g7f", "4c4d", "6g6f", "8b4b", "7i6h", "5a6b"];
    expect(adapt(plan, moves, "black")).toMatchObject({ castleId: "yagura", castleStance: "static" });
  });

  it("switches a static-rook CPU to a Bishop Exchange plan after the opponent exchanges", () => {
    const moves = ["7g7f", "3c3d", "8h2b+", "3a2b"];
    const plan = adapt(createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES.ibisha), moves, "white");
    expect(["kakugawari-koshikake-gin", "kakugawari-45-knight"]).toContain(plan.strategyId);
    expect(plan).toMatchObject({ switchedFrom: "ibisha", exchangeHandled: true });

    // 振り飛車や、戦法を詳しく指定した場合は切り替えない。
    expect(adapt(createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES.shiken), moves, "white").strategyId).toBe("shiken");
    expect(adapt(
      createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES.ibisha, { adaptStrategy: false }),
      moves,
      "white",
    ).strategyId).toBe("ibisha");
  });

  it.each([
    ["shiken", "white", ["2g2f", "2f2e", "7g7f", "6i7h", "3i4h", "4h3g", "5i6h", "6h7h"], "static"],
    ["shiken", "white", ["7g7f", "6g6f", "2h6h", "5i4h", "4h3h", "3h2h", "3i3h"], "ranging"],
    ["ibisha", "black", ["3c3d", "4c4d", "8b4b", "5a6b", "6b7b", "7b8b", "7a7b"], "ranging"],
    ["bougin", "black", ["8c8d", "8d8e", "3c3d", "4a3b", "7a6b", "5a4b"], "static"],
  ])("completes an adaptive %s plan as %s against the opponent stance", (strategyId, cpuColor, opponentScript, stance) => {
    const result = playAdaptivePlan({ strategyId, cpuColor, opponentScript });
    expect(result.plan.castleStance).toBe(stance);
    expect(result.complete, `${result.plan.label}: ${result.moves.join(" ")}`).toBe(true);
  });

  it("completes the Bishop Exchange plan after switching from a static-rook repertoire", () => {
    // 矢倉を目指して3四歩と角道を開けたところで、相手から角交換される。
    const result = playAdaptivePlan({
      strategyId: "yagura-strategy",
      cpuColor: "white",
      opponentScript: ["7g7f", "8h2b+", "2g2f", "4g4f", "3i4h", "5i6h", "6i7h", "1g1f", "9g9f"],
    });
    expect(result.plan.switchedFrom).toBe("yagura-strategy");
    expect(result.complete, `${result.plan.label}: ${result.moves.join(" ")}`).toBe(true);
  });
});

describe("左美濃の途中で角換わりになったら矢倉へ組み替える(docs/opening-guide-ux-design.mdの15章)", () => {
  // 先手CPUが左美濃を組みかけ(7八銀・7九玉)、角を交換した局面(両方の角が持ち駒)。
  const exchanged = "lnsgkgsnl/1r7/pppppp1pp/6p2/9/2P6/PP1PPPPPP/2S4R1/LNKG1GSNL b Bb 1";
  // 序盤の早いうちの角換わりは角換わりの作戦への切り替えが先に効くので、それを済ませた(exchangeHandled)作戦で確かめる。
  const plan = { ...createAdaptiveCpuPlan(CPU_OPENING_REPERTOIRES.ibisha), castleId: "left-mino", castleStance: "ranging", exchangeHandled: true };
  const cpuMoves = ["7g7f", "7i7h", "5i6h", "6h7i"];

  it("矢倉に替え、もう一度は替えない", () => {
    const next = adaptCpuOpeningPlan({ plan, cpuColor: "black", cpuMoves, opponentMoves: ["3c3d"], currentSfen: exchanged });
    expect(next).toMatchObject({ castleId: "yagura", castleSwitched: true });
    expect(adaptCpuOpeningPlan({ plan: next, cpuColor: "black", cpuMoves, opponentMoves: ["3c3d"], currentSfen: exchanged }).castleId).toBe("yagura");
  });

  it("角換わりでなければ左美濃のまま", () => {
    const sfen = "lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1BS4R1/LNKG1GSNL b - 1";
    expect(adaptCpuOpeningPlan({ plan, cpuColor: "black", cpuMoves, opponentMoves: ["3c3d"], currentSfen: sfen }).castleId).toBe("left-mino");
  });

  it("組み替えた矢倉を、その局面から完成まで指せる", () => {
    let record = createGameRecord(exchanged);
    const playedMoves = [...cpuMoves];
    for (let step = 0; step < 20; step += 1) {
      if (isOpeningPlanComplete({ strategyId: "", castleId: "yagura", color: "black", playedMoves, opponentMoves: [], currentSfen: record.position.sfen })) return;
      const fields = record.position.sfen.split(" "); fields[1] = "b";
      record = createGameRecord(fields.join(" "));
      const legalMoves = enumerateLegalMoves(record.position).map(({ usi }) => usi);
      const next = nextOpeningPlanMove({ strategyId: "", castleId: "yagura", color: "black", playedMoves, opponentMoves: [], moveHistory: playedMoves, currentSfen: record.position.sfen, legalMoves });
      expect(next, `step ${step}`).toBeTruthy();
      expect(appendUsiMove(record, next.usi), next.usi).toBeTruthy();
      playedMoves.push(next.usi);
    }
    throw new Error("矢倉が完成しなかった");
  });
});
