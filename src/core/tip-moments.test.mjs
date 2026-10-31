import { describe, expect, it } from "vitest";

import { appendUsiMove, createGameRecord } from "../game-state";
import { OPENING_CASTLES } from "./opening-guide.mjs";
import { TIP_CALLOUT_LIMIT, TIP_MOMENTS, TIP_USES_KEY, loadTipUses, mateTipMoments, noteTipUse, startTipMoments, tipCalloutDue, tipMoment, tipMoments, tipShapesHolding } from "./tip-moments.mjs";
import { problemById } from "./problem-set.mjs";
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

/** 局面から1手指し、前後の局面と手を返す。 */
function fromSfen(sfen, usi) {
  const record = createGameRecord(sfen);
  expect(appendUsiMove(record, usi), usi).toBe(true);
  return { before: sfen, usi, after: record.position.sfen };
}
const ids = (moments) => moments.map(({ id }) => id);

describe("コツの残り8枚の判定(22-2)", () => {
  it("12枚のコツが、教室のカードと同じ並びでそろっている", () => {
    expect(ALL).toEqual(TIPS_LESSONS.map(({ id }) => id));
    expect(TIP_MOMENTS.filter(({ mate }) => mate).map(({ id }) => id)).toEqual(["tip-head-gold", "tip-bottom", "tip-speed"]);
  });

  it("囲ってから戦う: 囲いが完成していて、大きな駒の取り合いの前に駒を取ると出る。囲っていなければ出ない", () => {
    const funa = castleMoves("funagakoi");
    const attack = ["2g2f", "2f2e", "2e2d", "2h2d"];
    const whiteMoves = ["8c8d", "9c9d", "1c1d", "4a3b", "6a5b", "9d9e", "2c2d"];
    const castled = lastMove(interleave([...funa, ...attack], whiteMoves.slice(-(funa.length + attack.length - 1))));
    expect(ids(tipMoments({ ...castled, color: "black", learned: ALL, fired: [] }))).toEqual(["tip-rook-pawn", "tip-castle-first"]);
    const bare = lastMove(interleave(attack, ["8c8d", "9c9d", "2c2d"]));
    expect(ids(tipMoments({ ...bare, color: "black", learned: ALL, fired: [] }))).not.toContain("tip-castle-first");
  });

  it("味方の利きの上へ: 角に当たるマスへ銀を進めても、金が守っていて取り合いで損をしないなら出る", () => {
    const supported = fromSfen("4k4/9/7b1/9/9/4GS3/9/9/4K4 b - 1", "4f4e");
    expect(ids(tipMoments({ ...supported, color: "black", learned: ALL, fired: [] }))).toEqual(["tip-supported"]);
    // 守りの金がいなければ、角にタダで取られるので出ない。
    const loose = fromSfen("4k4/9/7b1/9/9/5S3/9/9/4K4 b - 1", "4f4e");
    expect(tipMoments({ ...loose, color: "black", learned: ALL, fired: [] })).toEqual([]);
  });

  it("タダの駒を取る: だれも守っていない駒を取ると出る。守られた駒・歩では出ない", () => {
    const free = fromSfen("4k4/5g3/9/7s1/9/9/9/7R1/4K4 b - 1", "2h2d");
    expect(ids(tipMoments({ ...free, color: "black", learned: ALL, fired: [] }))).toContain("tip-free-piece");
    const guarded = fromSfen("4k4/9/6g2/7s1/9/9/9/7R1/4K4 b - 1", "2h2d");
    expect(ids(tipMoments({ ...guarded, color: "black", learned: ALL, fired: [] }))).not.toContain("tip-free-piece");
    const pawn = fromSfen("4k4/9/9/7p1/9/9/9/7R1/4K4 b - 1", "2h2d");
    expect(ids(tipMoments({ ...pawn, color: "black", learned: ALL, fired: [] }))).not.toContain("tip-free-piece");
  });

  it("両取り: 桂・金の両取りで出る。後手の桂の両取りでも出る。ねらいが1つなら出ない", () => {
    const knight = fromSfen("4k4/9/3r1g3/9/9/9/9/9/4K4 b N 1", "N*5e");
    expect(ids(tipMoments({ ...knight, color: "black", learned: ALL, fired: [] }))).toEqual(["tip-fork"]);
    const gold = fromSfen("8k/9/5r3/3b5/9/9/9/9/4K4 b G 1", "G*5d");
    expect(ids(tipMoments({ ...gold, color: "black", learned: ALL, fired: [] }))).toEqual(["tip-fork"]);
    const white = fromSfen("4k4/9/9/9/9/9/3G1R3/9/4K4 w n 1", "N*5e");
    expect(tipMoment({ ...white, color: "white", learned: ALL, fired: [] })?.id).toBe("tip-fork");
    const single = fromSfen("4k4/9/3r5/9/9/9/9/9/4K4 b N 1", "N*5e");
    expect(tipMoments({ ...single, color: "black", learned: ALL, fired: [] })).toEqual([]);
  });

  it("垂れ歩でと金: 打った歩が進んでと金になると出る。はじめから盤にあった歩では出ない", () => {
    const record = createGameRecord("9/1k7/ppp6/9/9/9/9/9/4K4 b P 1");
    for (const usi of ["P*2d", "8b7b"]) appendUsiMove(record, usi);
    const dropped = fromSfen(record.position.sfen, "2d2c+");
    expect(ids(tipMoments({ ...dropped, history: ["P*2d", "8b7b"], color: "black", learned: ALL, fired: [] }))).toContain("tip-pawn-hand");
    const native = fromSfen("9/2k6/ppp6/7P1/9/9/9/9/4K4 b - 1", "2d2c+");
    expect(ids(tipMoments({ ...native, history: [], color: "black", learned: ALL, fired: [] }))).not.toContain("tip-pawn-hand");
  });

  it("詰ませた手のコツ: 頭金・下段に落とす・駒を捨てて詰ますを見分ける", () => {
    const headGold = mateTipMoments({ moves: ["G*3b"], initialSfen: "6k2/9/6P2/9/9/9/9/9/4K4 b G 1", color: "black", learned: ALL, fired: [] });
    expect(ids(headGold)).toEqual(["tip-head-gold"]);
    // ▲2四金△2二玉▲2三金: 2三の玉が奥の2段目へ下がって、頭金で詰む。
    const bottom = mateTipMoments({ moves: ["G*2d", "2c2b", "G*2c"], initialSfen: "6gsl/6p2/7k1/9/7P1/9/9/9/4K4 b 2G 1", color: "black", learned: ALL, fired: [] });
    expect(ids(bottom)).toEqual(["tip-head-gold", "tip-bottom"]);
    // 金を捨てて角を打つ3手詰め(問題集の問題)。
    const problem = problemById("gts-1b9a04eaca2e");
    const line = typeof problem.line === "string" ? problem.line.split(/\s+/) : problem.line;
    expect(ids(mateTipMoments({ moves: line, initialSfen: problem.sfen, color: "black", learned: ALL, fired: [] }))).toContain("tip-speed");
    // 詰んでいない、詰ませたのが相手、覚えていない、もう出した、のときは出ない。
    expect(mateTipMoments({ moves: ["G*2d", "2c2b"], initialSfen: "6gsl/6p2/7k1/9/7P1/9/9/9/4K4 b 2G 1", color: "black", learned: ALL, fired: [] })).toEqual([]);
    expect(mateTipMoments({ moves: ["G*3b"], initialSfen: "6k2/9/6P2/9/9/9/9/9/4K4 b G 1", color: "white", learned: ALL, fired: [] })).toEqual([]);
    expect(mateTipMoments({ moves: ["G*3b"], initialSfen: "6k2/9/6P2/9/9/9/9/9/4K4 b G 1", color: "black", learned: [], fired: [] })).toEqual([]);
    expect(mateTipMoments({ moves: ["G*3b"], initialSfen: "6k2/9/6P2/9/9/9/9/9/4K4 b G 1", color: "black", learned: ALL, fired: ["tip-head-gold"] })).toEqual([]);
  });

  it("盤の札は、そのコツを使った3回目までだけ出す", () => {
    expect(TIP_CALLOUT_LIMIT).toBe(3);
    expect([0, 1, 2, 3, 10].map(tipCalloutDue)).toEqual([true, true, true, false, false]);
  });
});
