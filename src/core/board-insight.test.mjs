import { describe, expect, it } from "vitest";
import { PIECE_POINTS, PROMOTED_PIECE_POINTS, captureOf, capturePoints, materialLabel, materialSwing } from "./piece-points.mjs";
import {
  cheapestRecapture,
  controlCount,
  hasCheckingMove,
  kingEscapeMap,
  refutationOf,
  unsafeDestinations,
} from "./board-insight.mjs";
import { referenceDexEntries } from "./reference-dex.mjs";

describe("駒の値段", () => {
  it("駒図鑑のtier表と同じ値を使う", () => {
    const table = referenceDexEntries("piece").find(({ id }) => id === "piece-values").table;
    const points = Object.fromEntries(table.flatMap(({ pieces }) => pieces.map(({ label, points: value }) => [label, value])));
    expect(points["歩兵"]).toBe(PIECE_POINTS.P);
    expect(points["金将"]).toBe(PIECE_POINTS.G);
    expect(points["飛車"]).toBe(PIECE_POINTS.R);
    expect(points["竜王"]).toBe(PROMOTED_PIECE_POINTS["+R"]);
    expect(points["と金"]).toBe(PROMOTED_PIECE_POINTS["+P"]);
  });

  it("成った駒を取ったときは、持ち駒になる元の駒の値段にする", () => {
    expect(capturePoints("+P")).toBe(1);
    expect(capturePoints("+R")).toBe(10);
    expect(capturePoints("K")).toBe(0);
  });

  it("取った駒と、取った側を返す", () => {
    expect(captureOf("4k4/9/9/9/4g4/9/9/4R4/4K4 b - 1", "5h5e")).toEqual({ square: "5e", kind: "G", color: "black", points: 6 });
    expect(captureOf("4k4/9/9/9/4g4/9/9/4R4/4K4 b - 1", "5h5f")).toBeNull();
    expect(captureOf("4k4/9/9/9/4+p4/9/9/4R4/4K4 b - 1", "5h5e").points).toBe(1);
  });

  it("手順の駒の損得を、指定した側から見た合計で数える", () => {
    // ▲2四飛(銀を取る＋5)△同歩(飛車を取られる−10)
    const sfen = "k8/9/7p1/7s1/9/9/9/7R1/8K b - 1";
    expect(materialSwing(sfen, ["2h2d"])).toBe(5);
    expect(materialSwing(sfen, ["2h2d", "2c2d"])).toBe(-5);
    expect(materialSwing(sfen, ["2h2d", "2c2d"], "white")).toBe(5);
  });

  it("合計を札の言葉と色にする", () => {
    expect(materialLabel(6)).toEqual({ text: "駒得 ＋6", tone: "good" });
    expect(materialLabel(-4)).toEqual({ text: "駒損 −4", tone: "bad" });
    expect(materialLabel(0)).toEqual({ text: "とりかえ ±0", tone: "even" });
  });
});

describe("利きメガネ", () => {
  it("動かすと取られて損をする行き先を返す", () => {
    // 5五の銀。4四・5四・6四は後手の歩(4三・5三・6三)が利いていて、自分の利きがない。
    const sfen = "4k4/9/3ppp3/9/4S4/9/9/9/4K4 b - 1";
    expect(unsafeDestinations(sfen, "5e").sort()).toEqual(["4d", "5d", "6d"]);
  });

  it("自分の駒が利いている行き先は、安い駒に取られる場合だけ取られるマスにする", () => {
    // 5六の金が5五を守っている。銀を5四へ出すと歩に取られるが、5五へ戻るのは安全。
    const guarded = "4k4/9/4p4/9/9/4S4/9/9/4K4 b - 1";
    expect(unsafeDestinations(guarded, "5f")).toEqual([]);
    const rook = "4k4/4p4/9/9/4R4/9/9/9/4K4 b - 1";
    // 飛車を5三へ出すと歩(1点)に取られる。5三は5五の飛車の後ろからの利きもない。
    expect(unsafeDestinations(rook, "5e")).toContain("5c");
  });

  it("持ち駒を打つ行き先も調べる", () => {
    const sfen = "4k4/9/9/9/9/9/9/9/4K4 b G 1";
    // 玉のとなり(4一・6一・4二・5二・6二)へ打つと、玉に取られる。
    expect(unsafeDestinations(sfen, "G*").sort()).toEqual(["4a", "4b", "5b", "6a", "6b"]);
  });

  it("いちばん安い駒で取り返す手を返す", () => {
    // 2四の飛車は、2三の歩でも2一の竜でも取れる。歩で取る。
    const sfen = "k6+r1/9/7p1/7R1/9/9/9/9/8K w - 1";
    expect(cheapestRecapture(sfen, "2d")).toBe("2c2d");
  });

  it("取られる場所へ動かした手に、相手の取り返しを返す", () => {
    const sfen = "k8/9/7p1/7s1/9/9/9/7R1/8K b - 1";
    expect(refutationOf(sfen, "2h2d")).toEqual({ reply: "2c2d", square: "2d" });
    // 2六は歩も銀も利いていない。
    expect(refutationOf(sfen, "2h2f")).toBeNull();
  });

  it("詰んだ玉のまわりには、逃げられるマスがない", () => {
    // 頭金: 5一玉、5二金、5三歩。
    const sfen = "4k4/4G4/4P4/9/9/9/9/9/4K4 w - 1";
    const map = kingEscapeMap(sfen, "white");
    expect(map.king).toBe("5a");
    expect(map.squares.filter(({ state }) => state === "open")).toEqual([]);
  });

  it("味方の駒がふさいでいるマスと、逃げられるマスを分ける", () => {
    const sfen = "3gkg3/9/9/9/9/9/9/9/4K4 w - 1";
    const map = kingEscapeMap(sfen, "white");
    const byState = (state) => map.squares.filter((entry) => entry.state === state).map(({ square }) => square).sort();
    expect(byState("blocked")).toEqual(["4a", "6a"]);
    expect(byState("open")).toEqual(["4b", "5b", "6b"]);
  });

  it("玉の後ろのマスにも、飛車の利きが通る", () => {
    // 5九の飛車が5一玉に王手。玉の真上(5二)へは逃げられない。
    const sfen = "4k4/9/9/9/9/9/9/9/4R3K w - 1";
    const map = kingEscapeMap(sfen, "white");
    expect(map.squares.find(({ square }) => square === "5b").state).toBe("covered");
  });

  it("利いているマスの数を数える", () => {
    const counts = controlCount("lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1");
    expect(counts.black).toBe(counts.white);
    expect(counts.black).toBeGreaterThan(20);
  });

  it("王手をかけられる手があるかを調べる", () => {
    expect(hasCheckingMove("4k4/9/9/9/9/9/9/9/4K4 b G 1")).toBe(true);
    expect(hasCheckingMove("k8/9/9/9/9/9/9/9/8K b - 1")).toBe(false);
  });
});

describe("利きメガネの所持", async () => {
  const { KIKI_GLASSES_KEY, emptyTutorialProgress, hasKikiGlasses, loadKikiGlassesOn, recordLessonCleared, recordLessonSkipped, saveKikiGlassesOn } = await import("./tutorial-progress.mjs");
  it("利きを見ようをクリアかスキップすると持っている", () => {
    expect(hasKikiGlasses(emptyTutorialProgress())).toBe(false);
    expect(hasKikiGlasses(recordLessonCleared(emptyTutorialProgress(), "v2-kiki", 2))).toBe(true);
    expect(hasKikiGlasses(recordLessonSkipped(emptyTutorialProgress(), "v2-kiki"))).toBe(true);
  });
  it("付け外しを保存し、読めなくても外した状態で遊べる", () => {
    const store = new Map();
    const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    expect(loadKikiGlassesOn(storage)).toBe(false);
    saveKikiGlassesOn(storage, true);
    expect(store.get(KIKI_GLASSES_KEY)).toBe("on");
    expect(loadKikiGlassesOn(storage)).toBe(true);
    expect(loadKikiGlassesOn({ getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });
});

describe("駒得の数字", async () => {
  const { AI_PIECE_POINTS, aiMaterialTotals, capturePop, materialTotals } = await import("./piece-points.mjs");
  it("プレイヤーが取ったら緑の＋、取られたら赤の−を、取ったマスに浮かべる", () => {
    const sfen = "k8/9/7p1/7s1/9/9/9/7R1/8K b - 1";
    expect(capturePop(sfen, "2h2d", "black", 1)).toEqual({ id: 1, file: 2, rank: 4, text: "＋5", tone: "good", big: false, points: 5 });
    const after = "k8/9/7p1/7R1/9/9/9/9/8K w S 1";
    expect(capturePop(after, "2c2d", "black", 2)).toMatchObject({ text: "−10", tone: "bad", big: true, points: -10 });
    expect(capturePop(sfen, "2h2e", "black", 3)).toBeNull();
  });
  it("盤の上と持ち駒の点数を合わせる", () => {
    expect(materialTotals("4k4/9/9/9/9/9/9/4+P4/4K4 b G2p 1")).toEqual({ black: 13, white: 2 });
  });
  it("対局はAIの値で成り駒と持ち駒を合計し、玉は数えない", () => {
    expect(aiMaterialTotals("4k4/9/9/9/9/9/9/4+P4/4K4 b G2p 1")).toEqual({ black: 1080, white: 180 });
    expect(aiMaterialTotals("4k4/9/9/9/9/9/9/+R+B7/4K4 b - 1")).toEqual({ black: 2340, white: 0 });
    expect(aiMaterialTotals("4k4/9/9/9/9/9/9/9/4K4 b R2bl 1")).toEqual({ black: 990, white: 2025 });
    expect(aiMaterialTotals("4k4/9/9/9/9/9/9/9/4K4 b - 1")).toEqual({ black: 0, white: 0 });
    expect(aiMaterialTotals("lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1")).toEqual({ black: 6165, white: 6165 });
  });
  it("対局の取得表示もAIの値を使い、成り駒は元の駒で数える", () => {
    const pop = (sfen, move) => capturePop(sfen, move, "black", 1, AI_PIECE_POINTS, AI_PIECE_POINTS.B);
    expect(pop("k8/9/7p1/7s1/9/9/9/7R1/8K b - 1", "2h2d")).toMatchObject({ text: "＋495", points: 495, big: false });
    expect(pop("k8/9/7p1/7R1/9/9/9/9/8K w S 1", "2c2d")).toMatchObject({ text: "−990", points: -990, big: true });
    expect(pop("k8/9/9/7+p1/9/9/9/7R1/8K b - 1", "2h2d")).toMatchObject({ text: "＋90", points: 90, big: false });
  });

  // 成りの分(docs/material-guide-design.mdの「成りの分」)。
  const { materialBalance, materialPops, moveMaterial, promotionBonus } = await import("./piece-points.mjs");
  const ai = (sfen, move, side = "black") => materialPops(sfen, move, side, 1, AI_PIECE_POINTS, AI_PIECE_POINTS.B).map(({ text, sub, offset, points }) => ({ text, sub, offset, points }));
  it("成った分は、成った駒と元の駒の値段の差", () => {
    expect(promotionBonus("+B", AI_PIECE_POINTS)).toBe(90);
    expect(promotionBonus("+P", AI_PIECE_POINTS)).toBe(450);
    expect(promotionBonus("+B")).toBe(2);
    expect(promotionBonus("B", AI_PIECE_POINTS)).toBe(0);
  });
  it("成ったら「成り＋」、成駒を取られたら元の駒の値段と「成り−」を分けて浮かべる", () => {
    // 角が成る(取らない)。
    expect(ai("k8/9/9/9/9/9/9/7B1/8K b - 1", "2h4f")).toEqual([]);
    expect(ai("k8/9/9/9/9/9/9/9/1B6K b - 1", "8i3d+")).toEqual([{ text: "成り＋90", sub: true, offset: false, points: 90 }]);
    // 先手の馬を、後手の銀が取る: 先手から見て −855 と 成り−90。
    expect(ai("k8/9/2s6/3+B5/9/9/9/9/8K w - 1", "7c6d")).toEqual([
      { text: "−855", sub: false, offset: false, points: -855 },
      { text: "成り−90", sub: true, offset: true, points: -90 },
    ]);
    // 飛車で角を取りながら成る: ＋855 と 成り＋405。
    expect(ai("k8/9/7b1/9/9/9/9/7R1/8K b - 1", "2h2c+")).toEqual([
      { text: "＋855", sub: false, offset: false, points: 855 },
      { text: "成り＋405", sub: true, offset: true, points: 405 },
    ]);
    // 教室の値: と金を取られると −1 と 成り−6。
    expect(materialPops("k8/9/9/9/9/2s6/2+P6/9/8K w - 1", "7f7g", "black", 1).map(({ text }) => text)).toEqual(["−1", "成り−6"]);
    expect(moveMaterial("k8/9/9/9/9/9/9/7R1/8K b - 1", "2h2e", "black")).toBeNull();
  });
  it("駒の損得の札は、浮かべた数字の合計と同じ(歩を取ると＋90、角馬交換は馬の側が−90)", () => {
    const start = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
    const diff = (sfen, from = start) => { const t = materialBalance(sfen, from); return t.black - t.white; };
    expect(diff(start)).toBe(0);
    expect(diff("lnsgkgsnl/1r5b1/pppppppp1/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b P 1")).toBe(90);
    // 先手の角が馬になった局面と、その馬と後手の角が交換になった局面。
    const horse = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1+B5R1/LNSGKGSNL b - 1";
    expect(diff(horse)).toBe(90);
    expect(diff("lnsgkgsnl/1r7/ppppppppp/9/9/9/PPPPPPPPP/7R1/LNSGKGSNL b Bb 1") - diff(horse)).toBe(-90);
    // 手順で数えた合計(materialSwing、教室の値)とも同じ考え方: 角を取りながら成ると ＋8＋2。
    expect(materialSwing("k8/9/7b1/9/9/9/9/7R1/8K b - 1", ["2h2c+"])).toBe(10);
    // 駒落ちは、開始局面の駒がまるごとない差をそのまま数える(香落ちの下手は＋315から)。
    const kyo = "lnsgkgsn1/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1";
    expect(diff(kyo, kyo)).toBe(315);
    expect(diff("lnsgkgsn1/1r5b1/pppppppp1/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b P 1", kyo)).toBe(405);
  });

});
