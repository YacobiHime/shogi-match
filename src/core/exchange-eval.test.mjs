import { describe, expect, it } from "vitest";
import { captureSwing, exchangeGain, moveExchange } from "./exchange-eval.mjs";
import { parseSfenState } from "./piece-movement.mjs";

const boardOf = (sfen) => parseSfenState(sfen).board;

describe("取り合いの計算", () => {
  // 先手の銀(5五)に後手の歩(5四)が利き、先手の金(5六)が守る。1対1で数は足りるが、歩で取られると損。
  const pawnOnSilver = "4k4/9/9/4p4/4S4/4G4/9/9/4K4 b - 1";

  it("見え方ごとに、取られる損の見え方が変わる", () => {
    const board = boardOf(pawnOnSilver);
    expect(exchangeGain(board, "5e", "white", { mode: "presence" }).gain).toBe(captureSwing("S"));
    // 数だけ比べると、1対1なので取られないと見る。
    expect(exchangeGain(board, "5e", "white", { mode: "count" }).gain).toBe(0);
    // 安い駒から取り合うと、銀と歩の交換で相手が得をする。
    const see = exchangeGain(board, "5e", "white", { mode: "see" });
    expect(see.gain).toBe(captureSwing("S") - captureSwing("P"));
    expect(see.line).toEqual(["5d5e", "5f5e"]);
    expect(exchangeGain(board, "5e", "white", { mode: "full" }).gain).toBe(see.gain);
    expect(see).toMatchObject({ attackers: 1, defenders: 1 });
  });

  it("後手から見ても同じ(先後を反転した局面)", () => {
    const board = boardOf("4k4/9/9/4g4/4s4/4P4/9/9/4K4 w - 1");
    expect(exchangeGain(board, "5e", "black", { mode: "see" }).gain).toBe(captureSwing("S") - captureSwing("P"));
    expect(exchangeGain(board, "5e", "black", { mode: "count" }).gain).toBe(0);
  });

  it("守りのない駒は、数で見ても取られる。利きがなければ取られない", () => {
    const board = boardOf("4k4/9/9/4p4/4S4/9/9/9/4K4 b - 1");
    expect(exchangeGain(board, "5e", "white", { mode: "count" }).gain).toBe(captureSwing("S"));
    expect(exchangeGain(board, "5f", "white", { mode: "see" }).gain).toBe(0);
    expect(exchangeGain(boardOf(pawnOnSilver), "5f", "white", { mode: "full" }).gain).toBe(0);
  });

  it("高い駒でしか取れないなら、取ると損なので取らない", () => {
    // 先手の歩(5五)を後手の飛車(5一)が狙うが、金(5六)が守っている。
    const board = boardOf("4r4/9/9/9/4P4/4G4/9/9/K8 b - 1");
    expect(exchangeGain(board, "5e", "white", { mode: "see" }).gain).toBe(0);
    expect(exchangeGain(board, "5e", "white", { mode: "count" }).gain).toBe(0);
  });

  it("裏の利き(手前の駒が出ると通る飛車)は、fullだけが数える", () => {
    // 先手の銀(5五)を、後手の歩(5四)と角(2二)が狙う。先手は金(5六)の後ろに飛車(5九)。
    const board = boardOf("4k4/7b1/9/4p4/4S4/4G4/9/9/K3R4 b - 1");
    const see = exchangeGain(board, "5e", "white", { mode: "see" });
    const full = exchangeGain(board, "5e", "white", { mode: "full" });
    // 裏の利きが見えないと、金を取り返されたあと守りがないと思い、損を大きく見積もる。
    expect(see.gain).toBeGreaterThan(full.gain);
    expect(full.gain).toBe(captureSwing("S") - captureSwing("P"));
  });

  it("ピンされた駒と、取り返される場所の玉は、守りに使えない(full)", () => {
    // 先手の金(5七)は、後手の飛車(5一)の利きで玉(5九)にピンされていて、銀(4六)を守れない。
    const pinned = boardOf("4r4/9/9/9/9/5S3/4G4/9/4K3k b - 1");
    // 後手の歩(4五)が銀を狙う。
    pinned.set("4e", { color: "white", kind: "P" });
    expect(exchangeGain(pinned, "4f", "white", { mode: "see" }).gain).toBe(captureSwing("S") - captureSwing("P"));
    expect(exchangeGain(pinned, "4f", "white", { mode: "full" }).gain).toBe(captureSwing("S"));
    // 玉(5八)だけが守る銀(4七)を、歩(4六)と桂(5五)の2枚で狙う。玉は取り返されるマスへは出られない。
    const king = boardOf("8k/9/9/9/4n4/5p3/5S3/4K4/9 b - 1");
    // 歩は4七で成るので、成りの得(と金と歩の差)も付く。
    const promoted = captureSwing("S") + 400;
    expect(exchangeGain(king, "4g", "white", { mode: "see" }).gain).toBe(promoted);
    expect(exchangeGain(king, "4g", "white", { mode: "full" })).toMatchObject({ gain: promoted, line: ["4f4g+"] });
  });

  it("成りの得も、取り合いに入れる", () => {
    // 後手の歩(5七)が敵陣で先手の金(5八)を取ると、と金になる。守りの玉(5九)は、と金を取り返せる。
    const board = boardOf("8k/9/9/9/9/9/4p4/4G4/4K4 b - 1");
    const gain = exchangeGain(board, "5h", "white", { mode: "full" }).gain;
    expect(gain).toBe(captureSwing("G") + 400 - captureSwing("+P"));
  });
});

describe("1手の駒の損得", () => {
  it("動かしたことで守りが外れた駒は、範囲がmovedだと見えず、defendedから見える", () => {
    // 先手の金(5六)が銀(5五)を守っている。金を4六へ動かすと、銀が歩にただで取られる。
    const state = parseSfenState("4k4/9/9/4p4/4S4/4G4/9/9/4K4 b - 1");
    const moved = moveExchange(state, "5f6g", { mode: "see", scope: "moved" });
    const defended = moveExchange(state, "5f6g", { mode: "see", scope: "defended" });
    expect(moved.risk).toBe(0);
    expect(defended).toMatchObject({ risk: captureSwing("S"), riskSquare: "5e" });
    expect(moveExchange(state, "5f6g", { mode: "see", scope: "all" }).risk).toBe(captureSwing("S"));
  });

  it("気づいている当たりは、範囲に入れる", () => {
    const state = parseSfenState("4k4/9/9/4p4/4S4/9/9/9/4K3G b - 1");
    expect(moveExchange(state, "1i2h", { mode: "see", scope: "moved" }).risk).toBe(0);
    expect(moveExchange(state, "1i2h", { mode: "see", scope: "moved", watched: ["5e"] }).risk).toBe(captureSwing("S"));
  });

  it("王手は、玉を取れることを狙いに数えない(駒をただで渡す王手は、損だけが残る)", () => {
    // 先手の銀を5二へ打つ王手は、後手の玉(5一)にただで取られる。
    const state = parseSfenState("4k4/9/9/9/9/9/9/9/4K4 b S 1");
    const check = moveExchange(state, "S*5b", { mode: "full", scope: "all" });
    expect(check.threat).toBe(0);
    expect(check).toMatchObject({ risk: captureSwing("S"), riskSquare: "5b" });
  });

  it("王手で相手が動けないあいだは、ほかの駒を取る手を数えない(full)", () => {
    // 先手の飛車(5五)の王手。後手の歩(1三)は先手の香(1五)を取れそうだが、王手を放っておけない。
    const state = parseSfenState("4k4/9/8p/9/8L/9/9/9/K3R4 b - 1");
    const check = moveExchange(state, "5i5e", { mode: "full", scope: "all" });
    expect(check.riskSquare).not.toBe("1e");
  });
});
