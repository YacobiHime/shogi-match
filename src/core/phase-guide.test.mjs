import { describe, expect, it } from "vitest";
import {
  MIDDLE_MIN_PLY,
  attackFile,
  gaugeMoments,
  noteGauge,
  endgameGauge,
  guidePhase,
  kingSafety,
  loadPhaseIntroSeen,
  markPhaseIntroSeen,
  middleBoard,
} from "./phase-guide.mjs";

const STANDARD = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
// 先手玉2九・銀2八・金3九。後手玉5一だけ。
const GUARDED = "4k4/9/9/9/9/9/9/7S1/6GK1 b - 1";
// 先手の飛車5五が後手玉5一の筋に利く。後手の金4二が5二・5三を守る。
const FILE_FIVE = "4k4/5g3/9/9/4R4/9/9/9/4K4 b - 1";
// 後手の飛車5一が先手玉5九に王手。
const CHECKED = "4r4/9/9/9/9/9/9/9/4K4 b - 1";

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
}

describe("玉の堅さ(4章の2)", () => {
  it("守り駒を数え、0〜5の目盛りと言葉にする", () => {
    const mine = kingSafety(GUARDED, "black");
    expect(mine).toMatchObject({ guards: 2, pips: 3, word: "ふつう", anaguma: false });
    expect(kingSafety(GUARDED, "white")).toMatchObject({ guards: 0, pips: 1, word: "薄い" });
  });
  it("穴熊は1つ足す", () => {
    const anaguma = kingSafety("4k4/9/9/9/9/9/9/SG7/KN7 b - 1", "black");
    expect(anaguma.anaguma).toBe(true);
    expect(anaguma.pips).toBe(1 + 2 + 1);
    expect(anaguma.word).toBe("堅い");
  });
  it("玉がなければnull", () => {
    expect(kingSafety("9/9/9/9/9/9/9/9/9 b - 1", "black")).toBeNull();
  });
});

describe("攻める筋(4章の3)", () => {
  it("相手玉の前で、自分の利きが多い筋を返す", () => {
    expect(attackFile(FILE_FIVE, "black")).toBe(5);
  });
  it("自分の利きが足りなければnull", () => {
    expect(attackFile(STANDARD, "black")).toBeNull();
  });
});

describe("段階(3章)", () => {
  it("定跡の案内が出ているあいだは序盤", () => {
    expect(guidePhase({ sfen: STANDARD, ply: 40, openingShown: true })).toBe("opening");
  });
  it(`${MIDDLE_MIN_PLY}手目より前は出さない`, () => {
    expect(guidePhase({ sfen: STANDARD, ply: 10, openingShown: false })).toBe("opening");
    expect(guidePhase({ sfen: STANDARD, ply: 40, openingShown: false })).toBe("middle");
  });
  it("いちど終盤に入ったら、中盤へ戻らない", () => {
    expect(guidePhase({ sfen: STANDARD, ply: 40, openingShown: false, reachedEndgame: true })).toBe("endgame");
  });
  it("終盤の判定は助言のisEndgameにそろえる", () => {
    expect(guidePhase({ sfen: STANDARD, ply: 70, openingShown: false })).toBe("endgame");
  });
});

describe("作戦ボード(4章)", () => {
  const board = (score, materialDiff) => middleBoard({
    sfen: GUARDED, color: "black", materialDiff, reading: score === null ? null : { score: { type: "cp", value: score } },
  });
  it("形勢と駒の損得で方針を決める", () => {
    expect(board(500, 400).policy.key).toBe("ahead-up");
    expect(board(500, -400).policy.key).toBe("ahead-down");
    expect(board(-500, -400).policy.key).toBe("behind-down");
    expect(board(-500, 400).policy.key).toBe("behind-up");
  });
  it("読みがなければ駒の損得だけで言う", () => {
    expect(board(null, 400).policy.key).toBe("up");
    expect(board(null, -400).policy.key).toBe("down");
  });
  it("互角なら、攻める筋を方針にし、同じことを2回言わない", () => {
    const result = middleBoard({ sfen: FILE_FIVE, color: "black", materialDiff: 0, reading: { score: { type: "cp", value: 0 } } });
    expect(result.policy).toEqual({ key: "attack-file", text: "攻めるなら5筋に駒を集めよう" });
    expect(result.fileText).toBe("");
  });
  it("自玉が2段以上薄ければ、玉を固める", () => {
    const result = middleBoard({ sfen: GUARDED, color: "white", materialDiff: 0, reading: null });
    expect(result.policy.key).toBe("fortify");
  });
  it("2つの玉の堅さを並べる", () => {
    const result = board(0, 0);
    expect(result.kings.map((king) => [king.label, king.pips])).toEqual([["あなたの玉", 3], ["相手の玉", 1]]);
  });
  it("最善手が手筋の形のときだけ、手筋の気配を出す", () => {
    // 先手の桂打ち3三が、後手の金4一と飛車2一の両取り(桂の両取り)。
    const fork = "3k1g1r1/9/9/9/9/9/9/9/4K4 b N 1";
    expect(middleBoard({ sfen: fork, color: "black", reading: { bestMove: "N*3c" } }).tesuji).toBe(true);
    expect(middleBoard({ sfen: fork, color: "black", reading: { bestMove: "5i4i" } }).tesuji).toBe(false);
  });
});

describe("寄せの速度計(5章)", () => {
  it("王手されていれば、自玉は4で「王手をしのごう」", () => {
    const gauge = endgameGauge({ sfen: CHECKED, color: "black" });
    expect(gauge.risk).toMatchObject({ level: 4, text: "王手" });
    expect(gauge.action.key).toBe("check");
  });
  it("詰みがあれば、ほかより先に「詰ませにいこう」", () => {
    const gauge = endgameGauge({ sfen: CHECKED, color: "black", reading: { score: { type: "mate", value: 3 } } });
    expect(gauge.attack.level).toBe(4);
    expect(gauge.action.key).toBe("mate");
  });
  it("自玉が詰めろなら受ける。最善手が王手なら王手で迫りながら", () => {
    expect(endgameGauge({ sfen: GUARDED, color: "black", reading: { mateThreat: true } }).action.key).toBe("threat-defend");
    expect(endgameGauge({ sfen: GUARDED, color: "black", reading: { mateThreat: true, bestGivesCheck: true } }).action.key).toBe("threat-check");
  });
  it("最善手が詰めろなら攻め合い", () => {
    const gauge = endgameGauge({ sfen: GUARDED, color: "black", reading: { bestGivesMateThreat: true } });
    expect(gauge.attack).toMatchObject({ level: 3, text: "詰めろをかけられる" });
    expect(gauge.action.key).toBe("race");
  });
  it("読みがなければ、局面から数えられる段だけ", () => {
    const gauge = endgameGauge({ sfen: GUARDED, color: "black" });
    expect([gauge.attack.level, gauge.risk.level]).toEqual([1, 1]);
    expect(gauge.action.key).toBe("approach");
  });
});

describe("はじめての1行を見た印", () => {
  it("段階ごとに残す", () => {
    const storage = memoryStorage();
    expect(loadPhaseIntroSeen(storage)).toEqual({ middle: false, endgame: false });
    markPhaseIntroSeen("middle", storage);
    expect(loadPhaseIntroSeen(storage)).toEqual({ middle: true, endgame: false });
  });
});

describe("盤から数える1手詰め(10章)", () => {
  it("自分の手番で1手詰めがあれば、読みがなくても相手玉は4", () => {
    const gauge = endgameGauge({ sfen: GUARDED, color: "black", mateNow: true });
    expect(gauge.attack.level).toBe(4);
    expect(gauge.action.key).toBe("mate");
  });
  it("手番を渡すと相手に1手詰めがあれば、自玉は詰めろ", () => {
    expect(endgameGauge({ sfen: GUARDED, color: "black", threatNow: true }).risk).toMatchObject({ level: 3, text: "詰めろ" });
  });
  it("指したあとは、かけた詰めろと残った詰めろを言う", () => {
    const raced = endgameGauge({ sfen: GUARDED, color: "black", myTurn: false, mateNow: true });
    expect(raced.attack).toMatchObject({ level: 3, text: "詰めろをかけた" });
    expect(raced.action.key).toBe("raced");
    expect(endgameGauge({ sfen: GUARDED, color: "black", myTurn: false, threatNow: true }).action.key).toBe("left-threat");
    expect(endgameGauge({ sfen: GUARDED, color: "black", myTurn: false }).action.key).toBe("wait");
  });
  it("指したあとは、相手の手番の読みを使わない", () => {
    const gauge = endgameGauge({ sfen: GUARDED, color: "black", myTurn: false, reading: { score: { type: "mate", value: 1 } } });
    expect(gauge.attack.level).toBe(1);
  });
});

describe("寄せのふり返り(10章)", () => {
  const e = (ply, myTurn, attack, risk) => ({ ply, myTurn, attack, risk });
  it("詰めろを受けたか、受けなかったかを言う", () => {
    const held = gaugeMoments([e(60, true, 1, 3), e(61, false, 1, 1)]);
    expect(held).toEqual([expect.objectContaining({ key: "threat", move: 61, outcome: "受けた", good: true })]);
    const left = gaugeMoments([e(60, true, 1, 3), e(61, false, 1, 3)]);
    expect(left[0]).toMatchObject({ outcome: "受けなかった", good: false });
  });
  it("1手詰めが残っていなくても、すぐ詰まされたら受けなかった", () => {
    expect(gaugeMoments([e(60, true, 1, 3), e(61, false, 1, 1)], { lostByMateAt: 66 })[0].outcome).toBe("受けなかった");
  });
  it("詰みを詰ませたか、見逃したか", () => {
    expect(gaugeMoments([e(80, true, 4, 1)], { wonByMateAt: 81 })[0]).toMatchObject({ key: "mate", outcome: "詰ませた" });
    expect(gaugeMoments([e(80, true, 4, 1), e(81, false, 1, 1)])[0]).toMatchObject({ outcome: "見逃した", good: false });
  });
  it("詰めろをかけた手は、上がったときだけ", () => {
    const moments = gaugeMoments([e(71, false, 3, 1), e(72, true, 2, 1), e(73, false, 3, 1)]);
    expect(moments.map((m) => [m.key, m.move])).toEqual([["race", 71], ["race", 73]]);
  });
  it("多すぎるときは大事なものから3つ、手数の順に並べる", () => {
    const log = [e(41, false, 3, 1), e(50, true, 1, 3), e(51, false, 1, 1), e(61, false, 3, 1), e(70, true, 4, 1), e(71, false, 1, 1), e(75, false, 3, 1)];
    const moments = gaugeMoments(log);
    expect(moments.map((m) => [m.key, m.move])).toEqual([["race", 41], ["threat", 51], ["mate", 71]]);
    expect(moments[2].outcome).toBe("見逃した");
  });
  it("待ったで戻ったら、その手数から後ろの記録を消す", () => {
    expect(noteGauge([e(60, true, 1, 1), e(61, false, 1, 1), e(62, true, 2, 1)], e(61, false, 3, 1)))
      .toEqual([e(60, true, 1, 1), e(61, false, 3, 1)]);
  });
});
