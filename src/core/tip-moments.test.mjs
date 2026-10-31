import { describe, expect, it } from "vitest";

import { appendUsiMove, createGameRecord } from "../game-state";
import { OPENING_CASTLES } from "./opening-guide.mjs";
import { TIP_MOMENTS, TIP_USES_KEY, loadTipUses, noteTipUse, startTipMoments, tipMoment, tipShapesHolding } from "./tip-moments.mjs";
import { TIPS_LESSONS } from "./tutorial-curriculum.mjs";
import { emptyTutorialProgress, learnedTips, recordLessonCleared, recordLessonSkipped, tipsTouched, withTutorialCourse } from "./tutorial-progress.mjs";

const STANDARD = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
const ALL = TIP_MOMENTS.map(({ id }) => id);
const castleMoves = (id) => OPENING_CASTLES.find((castle) => castle.id === id).blackMoves;

/** 手順を指し、最後の手の前後の局面と手を返す。 */
function lastMove(moves) {
  const record = createGameRecord(STANDARD);
  for (const usi of moves.slice(0, -1)) expect(appendUsiMove(record, usi), usi).toBe(true);
  const before = record.position.sfen;
  const usi = moves.at(-1);
  expect(appendUsiMove(record, usi), usi).toBe(true);
  return { before, usi, after: record.position.sfen };
}

/** 先手の手順のあいだに、後手の手を1手ずつはさむ。 */
function interleave(black, white) {
  return black.flatMap((usi, index) => (index < black.length - 1 ? [usi, white[index]] : [usi]));
}

describe("対局でコツの形ができた瞬間(21-14-2)", () => {
  it("札のコツは、どれもすぐ使えるコツのカードにある", () => {
    const tips = new Set(TIPS_LESSONS.map(({ id }) => id));
    for (const id of ALL) expect(tips.has(id)).toBe(true);
  });

  it("飛車先の歩の交換: 先手は▲2四歩△同歩▲同飛、後手は△8六歩▲同歩△同飛で出る", () => {
    const black = lastMove(["2g2f", "8c8d", "2f2e", "8d8e", "2e2d", "2c2d", "2h2d"]);
    expect(tipMoment({ ...black, color: "black", learned: ALL, fired: [] })?.id).toBe("tip-rook-pawn");
    const white = lastMove(["2g2f", "8c8d", "2f2e", "8d8e", "6i7h", "8e8f", "8g8f", "8b8f"]);
    expect(tipMoment({ ...white, color: "white", learned: ALL, fired: [] })?.id).toBe("tip-rook-pawn");
    // 飛車が歩を取らずに動いただけでは出ない。
    const move = lastMove(["2g2f", "8c8d", "2h2g"]);
    expect(tipMoment({ ...move, color: "black", learned: ALL, fired: [] })).toBeNull();
  });

  it("7七銀・7八金: 相手が居飛車で飛車先の歩を伸ばしてきたら出る。後手は3三銀・3二金", () => {
    const black = lastMove(["7g7f", "8c8d", "7i6h", "8d8e", "6h7g", "3c3d", "6i7h"]);
    const moment = tipMoment({ ...black, color: "black", learned: ALL, fired: [] });
    expect(moment).toMatchObject({ id: "tip-vs-ibisha", title: "7七銀・7八金の形！" });
    const white = lastMove(["2g2f", "3c3d", "2f2e", "3a4b", "7g7f", "4b3c", "6i7h", "4a3b"]);
    expect(tipMoment({ ...white, color: "white", learned: ALL, fired: [] })).toMatchObject({ id: "tip-vs-ibisha", title: "3三銀・3二金の形！" });
    // 相手の飛車先の歩が伸びていなければ、まだ出さない。
    const early = lastMove(["7g7f", "3c3d", "7i6h", "4a3b", "6h7g", "5a4b", "6i7h"]);
    expect(tipMoment({ ...early, color: "black", learned: ALL, fired: [] })).toBeNull();
  });

  it("エルモ囲い: 相手が振り飛車なら出て、居飛車なら出ない", () => {
    const elmo = castleMoves("elmo");
    const vsRanging = lastMove(interleave(elmo, ["3c3d", "8b4b", "9c9d", "1c1d"]));
    expect(tipMoment({ ...vsRanging, color: "black", learned: ALL, fired: [] })?.id).toBe("tip-vs-furibisha");
    const vsStatic = lastMove(interleave(elmo, ["3c3d", "8c8d", "9c9d", "1c1d"]));
    expect(tipShapesHolding(vsStatic.after, "black")).not.toContain("tip-vs-furibisha");
  });

  it("四間飛車と美濃囲い: 美濃囲いが完成した手で出る(1手前はまだ)", () => {
    // 美濃囲いの手順は、飛車を6八へ振る手から始まる。
    const black = ["7g7f", "6g6f", ...castleMoves("mino")];
    const white = ["3c3d", "8c8d", "8d8e", "9c9d", "1c1d", "9d9e", "1d1e", "5a4b", "4b3b", "6a5b", "7a6b"];
    const game = lastMove(interleave(black, white));
    expect(tipShapesHolding(game.before, "black")).not.toContain("tip-shiken");
    expect(tipMoment({ ...game, color: "black", learned: ALL, fired: [] })?.id).toBe("tip-shiken");
  });

  it("覚えていないコツ・この対局でもう出したコツ・始めからできている形は出さない", () => {
    const game = lastMove(["2g2f", "8c8d", "2f2e", "8d8e", "2e2d", "2c2d", "2h2d"]);
    expect(tipMoment({ ...game, color: "black", learned: [], fired: [] })).toBeNull();
    expect(tipMoment({ ...game, color: "black", learned: ALL, fired: ["tip-rook-pawn"] })).toBeNull();
    // 作戦カードの「完成形から」: 始めの局面で四間飛車と美濃囲いができている。
    // 美濃囲いの手順は、飛車を6八へ振る手から始まる。
    const black = ["7g7f", "6g6f", ...castleMoves("mino")];
    const white = ["3c3d", "8c8d", "8d8e", "9c9d", "1c1d", "9d9e", "1d1e", "5a4b", "4b3b", "6a5b", "7a6b"];
    const start = lastMove(interleave(black, white)).after;
    const fired = startTipMoments(start, "black");
    expect(fired).toContain("tip-shiken");
    const record = createGameRecord(start);
    appendUsiMove(record, "3a3b");
    const before = record.position.sfen;
    appendUsiMove(record, "9g9f");
    expect(tipMoment({ before, usi: "9g9f", after: record.position.sfen, color: "black", learned: ALL, fired })).toBeNull();
  });

  it("使った回数は保存され、読めない値と知らないコツは捨てる", () => {
    const data = {};
    const storage = { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); } };
    expect(loadTipUses(storage)).toEqual({});
    noteTipUse(storage, "tip-rook-pawn");
    expect(noteTipUse(storage, "tip-rook-pawn")).toEqual({ "tip-rook-pawn": 2 });
    expect(noteTipUse(storage, "tip-warp")).toEqual({ "tip-rook-pawn": 2 });
    data[TIP_USES_KEY] = JSON.stringify({ "tip-shiken": 3, "tip-rook-pawn": -1, "tip-vs-ibisha": "x", other: 5 });
    expect(loadTipUses(storage)).toEqual({ "tip-shiken": 3 });
    data[TIP_USES_KEY] = "{";
    expect(loadTipUses(storage)).toEqual({});
  });
});

describe("コツに触れたか・覚えたコツ(21-14-4)", () => {
  it("コツのタブを開いたか、コツのカードを遊んだら触れたことにする。覚えたのはクリアしたカードだけ", () => {
    expect(tipsTouched(emptyTutorialProgress())).toBe(false);
    expect(tipsTouched(recordLessonCleared(emptyTutorialProgress(), "v1-board", 3))).toBe(false);
    expect(tipsTouched(withTutorialCourse(emptyTutorialProgress(), "tips"))).toBe(true);
    const progress = recordLessonSkipped(recordLessonCleared(emptyTutorialProgress(), "tip-rook-pawn", 2), "tip-shiken");
    expect(tipsTouched(progress)).toBe(true);
    expect(learnedTips(progress)).toEqual(["tip-rook-pawn"]);
  });
});
