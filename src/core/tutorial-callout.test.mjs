import { describe, expect, it } from "vitest";
import { TUTORIAL_LESSONS } from "./tutorial-curriculum.mjs";
import {
  CALLOUT_MAX_CHARS,
  coveredSquares,
  placeCallout,
  shortHeadline,
  speechSegments,
  splitLeadPhrase,
  stepCallout,
} from "./tutorial-callout.mjs";
import { tutorialStepMarks, tutorialStepSfen } from "./tutorial-runner.mjs";
import { parseSfenState } from "./piece-movement.mjs";

const MATE_TYPES = new Set(["mate", "attack-test"]);

/** 盤を見せるステップ(問題集の問題・観戦・対局は、ステップのデータに局面を持たないか、別の札を使う)。 */
function boardSteps() {
  return TUTORIAL_LESSONS.flatMap((lesson) => lesson.steps.flatMap((step, index) => {
    if (["problem", "replay", "play"].includes(step.type)) return [];
    const sfen = tutorialStepSfen(step);
    if (!sfen) return [];
    return [{ id: `${lesson.id}#${index}`, step, sfen, marks: tutorialStepMarks(step, sfen) }];
  }));
}

describe("盤の上のひとこと", () => {
  it("きまりの順に、見るマスと短い文を自動で作る", () => {
    // 駒取りゲームは、1手目まで動かす駒に「この駒だけで」、動かしたあとはねらう駒。
    const capture = { type: "capture", from: "5e", sfen: "9/2p6/9/9/4R4/9/9/9/9 b - 1" };
    expect(stepCallout(capture)).toEqual({ at: "5e", text: "この駒だけで" });
    expect(stepCallout(capture, { movesUsed: 1 })).toEqual({ at: "7b", text: "ねらう駒" });
    expect(stepCallout({ type: "move-piece", sfen: "9/9/9/9/4K4/9/9/9/9 b - 1", from: "5e", target: "5g" })).toEqual({ at: "5g", text: "ここまで" });
    // マスの名前だけで動かす課題では、目的のマスを教えない。
    expect(stepCallout({ type: "move-piece", sfen: "9/9/9/9/4K4/9/9/9/9 b - 1", from: "5e", target: "4d", hideTarget: true })).toBeNull();
    // 説明は「」の言葉を、緑の印に付ける。
    expect(stepCallout({ type: "explain", sfen: "9/9/9/9/4K4/9/9/9/9 b - 1", marks: [["4d", "key"]], speech: "ここが「4四」だよ。" })).toEqual({ at: "4d", text: "4四" });
    // 詰ませる課題は、相手の玉の逃げ道の数(5二は歩が利いている)。
    expect(stepCallout({ type: "mate", sfen: "4k4/9/4P4/9/9/9/9/9/8K b G 1" }, { mateTask: true })).toEqual({ at: "5a", text: "逃げ道 4" });
    // 例外の上書き。
    expect(stepCallout({ type: "explain", sfen: "9/9/9/9/4K4/9/9/9/9 b - 1", note: { at: "5e", text: "玉" } })).toEqual({ at: "5e", text: "玉" });
  });

  it("正解と取り返しの一言", () => {
    expect(splitLeadPhrase("両取り！ 金と飛車を同時にねらったね。")).toEqual({ lead: "両取り！", rest: "金と飛車を同時にねらったね。" });
    // 続きがない文や、最初の一句が長い文は切らない。
    expect(splitLeadPhrase("詰み！")).toEqual({ lead: "", rest: "詰み！" });
    expect(splitLeadPhrase("歩は1手で1マスずつ。2手で着いたね！")).toEqual({ lead: "", rest: "歩は1手で1マスずつ。2手で着いたね！" });
    expect(splitLeadPhrase("この一句はとても長いので盤の上には出せないよ！ 続き")).toEqual({ lead: "", rest: "この一句はとても長いので盤の上には出せないよ！ 続き" });
    const step = { type: "find-move", sfen: "4k4/9/9/9/9/9/9/9/8K b - 1" };
    expect(stepCallout(step, { phase: "solved", moved: "5e", lead: "両取り！" })).toEqual({ at: "5e", text: "両取り！" });
    expect(stepCallout(step, { phase: "refute", refuteSquare: "5e" })).toEqual({ at: "5e", text: "取られる！" });
    expect(stepCallout(step, { phase: "refute", refuteSquare: "3i", refuteKind: "drop" })).toEqual({ at: "3i", text: "打ち込まれる！" });
    expect(stepCallout(step, { phase: "proverb", moved: "5b" })).toEqual({ at: "5b", text: "この手！" });
    // その場の図鑑は、見出しを図鑑の矢印の行き先に付ける。
    expect(stepCallout({ type: "explain", sfen: "4k4/9/5S3/9/9/9/9/9/4K4 b G 1", headline: "頭金", arrows: ["G*5b"] })).toEqual({ at: "5b", text: "頭金" });
    expect(shortHeadline("飛車先の歩交換三つの得あり")).toBe("飛車先の歩交換三つの得あり");
    expect(shortHeadline("へぼ将棋、玉より飛車を可愛がり")).toBe("へぼ将棋");
  });

  it("札は盤の中に収まり、見るマスを隠さず、上端のマスでは下に出す", () => {
    const top = placeCallout("5a", "逃げ道 2");
    expect(top.side).toBe("below");
    const corner = placeCallout("9a", "ねらう駒×2");
    expect(corner.x).toBeGreaterThanOrEqual(0);
    expect(corner.y).toBeGreaterThanOrEqual(0);
    expect(coveredSquares(corner.x, corner.y, corner.width, corner.height)).not.toContain("9a");
    // 上に印があれば、下か横へずらす。
    const avoided = placeCallout("5e", "ここまで", { marks: [{ file: 5, rank: 4 }, { file: 4, rank: 4 }, { file: 6, rank: 4 }] });
    expect(coveredSquares(avoided.x, avoided.y, avoided.width, avoided.height).filter((square) => ["5d", "4d", "6d"].includes(square))).toEqual([]);
  });

  it("全ステップの札が14字まで、盤の中で、印のマスと見るマスに重ならない", () => {
    let made = 0;
    for (const { id, step, sfen, marks } of boardSteps()) {
      const callout = stepCallout(step, { sfen, marks, mateTask: MATE_TYPES.has(step.type) });
      if (!callout) continue;
      made += 1;
      expect([...callout.text].length, id).toBeLessThanOrEqual(CALLOUT_MAX_CHARS);
      const placement = placeCallout(callout.anchors ?? callout.at, callout.text, { marks, sfen });
      expect(placement, id).not.toBeNull();
      expect(placement.x, id).toBeGreaterThanOrEqual(0);
      expect(placement.y, id).toBeGreaterThanOrEqual(0);
      expect(placement.x + placement.width, id).toBeLessThanOrEqual(9 + 1e-9);
      expect(placement.y + placement.height, id).toBeLessThanOrEqual(9 + 1e-9);
      const covered = coveredSquares(placement.x, placement.y, placement.width, placement.height);
      const marked = new Set(marks.map(({ file, rank }) => `${file}${String.fromCharCode(96 + rank)}`));
      expect(covered.filter((square) => marked.has(square)), id).toEqual([]);
      expect(covered, id).not.toContain(placement.at);
      // 駒も隠さない。第1巻「盤」の筋の説明だけは、一段目が駒で埋まり1筋が全部緑なので、どこに置いても重なる。
      const { board } = parseSfenState(sfen);
      if (id !== "v1-board#1") expect(covered.filter((square) => board.has(square)), `${id} 駒を隠す`).toEqual([]);
      // 動けるマスを指す札は、見るマスが駒の動けるマスのどれか。
      if (callout.anchors) expect(callout.anchors, id).toContain(placement.at);
    }
    // ねらう駒・動けるマス・ここまで・逃げ道などで、盤のステップの3割ほどに札が付く。
    expect(made).toBeGreaterThan(80);
  });

  it("すぐそばが駒で埋まっていたら、離して置いて線でつなぐ(駒を隠さない)", () => {
    // 後手の玉のまわり(一段目・二段目・三段目)が駒で埋まった局面。
    const sfen = "lnsgkgsnl/1r2p2b1/pppp1pppp/9/4R4/9/9/9/4K4 b G 1";
    const placement = placeCallout("5a", "逃げ道 1", { sfen });
    const { board } = parseSfenState(sfen);
    expect(coveredSquares(placement.x, placement.y, placement.width, placement.height).filter((square) => board.has(square))).toEqual([]);
    expect(placement.reach).toBeGreaterThan(0);
    // すぐそばが空いていれば、離さない。
    expect(placeCallout("5e", "ここまで", { sfen: "4k4/9/9/9/9/9/9/9/4K4 b - 1" }).reach).toBe(0);
  });

  it("札は駒をなるべく避ける(避けられる位置があれば駒に重ねない)", () => {
    const sfen = "9/9/9/3ppp3/4k4/9/9/9/8K b - 1";
    const placement = placeCallout("5e", "逃げ道 3", { sfen });
    const { board } = parseSfenState(sfen);
    expect(coveredSquares(placement.x, placement.y, placement.width, placement.height).filter((square) => board.has(square))).toEqual([]);
  });
});

describe("吹き出しの色の札", () => {
  it("色の言葉の前で区切り、盤の印と同じ色の名前を付ける", () => {
    expect(speechSegments("歩を5五（緑のマス）まで動かそう！")).toEqual([
      { text: "歩を5五（", tone: "" },
      { text: "緑のマス", tone: "key" },
      { text: "）まで動かそう！", tone: "" },
    ]);
    expect(speechSegments("赤い数字と青い数字").map(({ tone }) => tone)).toEqual(["white", "", "black"]);
    expect(speechSegments("色の言葉はない")).toEqual([{ text: "色の言葉はない", tone: "" }]);
  });
});
