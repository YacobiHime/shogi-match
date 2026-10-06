import { describe, expect, it } from "vitest";
import { capGodMoves, judgeGodMove, moveContext, winRate } from "./god-move.mjs";

const cp = (value) => ({ type: "cp", value });
const mate = (value) => ({ type: "mate", value });
const deep = (bestScore, secondScore) => [
  { rank: 1, move: "5c5d", score: bestScore },
  { rank: 2, move: "7g7f", score: secondScore },
];
// 浅い読みでは別の手が最善に見えている。
const shallowMiss = [
  { rank: 1, move: "7g7f", score: cp(100) },
  { rank: 2, move: "2g2f", score: cp(80) },
];
const shallowFound = [{ rank: 1, move: "5c5d", score: cp(300) }];

describe("god move", () => {
  it("converts scores to win rates", () => {
    expect(winRate(cp(0))).toBe(50);
    expect(winRate(cp(600))).toBeCloseTo(73.1, 1);
    expect(winRate(mate(5))).toBe(100);
    expect(winRate(mate(-5))).toBe(0);
    expect(winRate(undefined)).toBeUndefined();
  });

  it("calls a hidden, game-deciding best move a god move", () => {
    // +600(勝率73)と0(勝率50)。この手だけが勝ちにつながる。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(600), cp(0)), shallowCandidates: shallowMiss }))
      .toMatchObject({ hidden: true, sacrifice: false });
    // 浅い読みでも見えている手は、見つけにくい手ではない。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(600), cp(0)), shallowCandidates: shallowFound })).toBeNull();
    // 浅い読みで少し(300未満)低く見えるだけの手も、見つけにくい手ではない。
    expect(judgeGodMove({
      move: "5c5d",
      deepCandidates: deep(cp(600), cp(0)),
      shallowCandidates: [{ rank: 1, move: "7g7f", score: cp(100) }, { rank: 2, move: "5c5d", score: cp(-100) }],
    })).toBeNull();
    // 最善手でなければ神の一手ではない。
    expect(judgeGodMove({ move: "7g7f", deepCandidates: deep(cp(600), cp(0)), shallowCandidates: shallowMiss })).toBeNull();
    // ほかの手では負ける局面で、負けを消す手も勝敗を分ける。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(0), cp(-600)), shallowCandidates: shallowMiss })).not.toBeNull();
  });

  it("needs the move to decide the game, not just to be a little better", () => {
    // +300と0は勝率で約12ポイントの差しかない。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(300), cp(0)), shallowCandidates: shallowMiss })).toBeNull();
    // 互角の序盤で、+250と-250(勝率差約21ポイント)でも、どちらも形勢は「不明」のままなので選ばない。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(250), cp(-250)), shallowCandidates: shallowMiss })).toBeNull();
    // もう勝っている局面で、さらに良くするだけの手も選ばない(+2000と+500はどちらも勝ち)。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(2000), cp(500)), shallowCandidates: shallowMiss })).toBeNull();
    // 詰ませる手と、詰まない手。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(mate(9), cp(0)), shallowCandidates: shallowMiss })).not.toBeNull();
  });

  it("counts a hidden mating move as decisive even when the side is already winning", () => {
    // ▲5二銀のような決め手。次善手でも+2000で勝っているが、詰ませられるのはこの手だけ。
    const finisher = judgeGodMove({
      move: "5c5d", deepCandidates: deep(mate(11), cp(2000)), shallowCandidates: shallowMiss, sacrifice: true,
    });
    expect(finisher).not.toBeNull();
    // 詰みの手順がほかにもあるなら、決め手とは言えない。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(mate(11), mate(13)), shallowCandidates: shallowMiss })).toBeNull();
    // 浅い読みで詰みが見えている当たり前の詰ませ方は除く。
    expect(judgeGodMove({
      move: "5c5d",
      deepCandidates: deep(mate(3), cp(2000)),
      shallowCandidates: [{ rank: 1, move: "5c5d", score: mate(3) }],
    })).toBeNull();
  });

  it("counts a sacrifice as hard to find and gives it a bonus", () => {
    // +450(勝率68)と0は勝率で約18ポイントの差。捨て駒なら神の一手、そうでなければ届かない。
    const candidates = deep(cp(450), cp(0));
    expect(judgeGodMove({ move: "5c5d", deepCandidates: candidates, shallowCandidates: shallowFound })).toBeNull();
    const sacrifice = judgeGodMove({ move: "5c5d", deepCandidates: candidates, shallowCandidates: shallowFound, sacrifice: true });
    expect(sacrifice).toMatchObject({ hidden: false, sacrifice: true });
    // 浅い読みで見えず、捨て駒でもある手は、どちらの加点も受けて強くなる。
    const both = judgeGodMove({ move: "5c5d", deepCandidates: candidates, shallowCandidates: shallowMiss, sacrifice: true });
    expect(both.strength).toBeCloseTo(sacrifice.strength + 10, 5);
    // 浅い読みでもう詰みが見えている局面の捨て駒は、読まなくても分かる。
    expect(judgeGodMove({
      move: "5c5d",
      deepCandidates: deep(mate(5), cp(0)),
      shallowCandidates: [{ rank: 1, move: "5c5d", score: mate(5) }],
      sacrifice: true,
    })).toBeNull();
  });

  it("skips trivial and obvious moves such as recaptures, escapes and plain attacks", () => {
    const options = { move: "5c5d", deepCandidates: deep(cp(600), cp(0)), shallowCandidates: shallowMiss };
    expect(judgeGodMove({ ...options, trivial: true })).toBeNull();
    expect(judgeGodMove({ ...options, obvious: true })).toBeNull();
  });

  it("finds recaptures, obvious moves and sacrifices from the position", () => {
    // 7六の歩を取り返す手は、誰でも指す手。
    expect(moveContext("4k4/9/9/9/9/2p6/2P6/9/4K4 b - 1", "7g7f", "7e7f"))
      .toEqual({ trivial: true, obvious: true, sacrifice: false });
    // 歩で当たっている飛車を逃げる手は、当たり前の手。
    expect(moveContext("4k4/9/9/9/9/7p1/7R1/9/4K4 b - 1", "2g3g").obvious).toBe(true);
    // 紐の付いた銀を出て飛車に当てる手も、当たり前の手。
    expect(moveContext("4k4/5r3/9/4SP3/9/9/9/9/4K4 b - 1", "5d4c")).toMatchObject({ obvious: true, sacrifice: false });
    // 序盤の静かな手は、当たり前の手ではない(神の一手かどうかは読みで決める)。
    expect(moveContext("lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1", "7g7f").obvious).toBe(false);
    // 玉の隣へ銀を打つと、ひもが付いていなければ玉にただで取られる。
    expect(moveContext("4k4/9/9/9/9/9/9/9/4K4 b S 1", "S*5b").sacrifice).toBe(true);
    // 金のひもが付いていれば、玉は銀を取れない。
    expect(moveContext("4k4/9/4G4/9/9/9/9/9/4K4 b S 1", "S*5b").sacrifice).toBe(false);
    // 銀を、相手の歩で取られる升へ動かす（歩と銀の交換で損）。
    expect(moveContext("4k4/9/4p4/9/4S4/9/9/9/4K4 b - 1", "5e5d").sacrifice).toBe(true);
  });

  it("keeps only the three strongest god moves in a game, even while analysis is in progress", () => {
    const point = (ply, strength) => ({ ply, annotation: { kind: "brilliant", label: "神の一手", strength } });
    let points = capGodMoves([point(1, 20), point(2, 30), point(3, 15), point(4, 25)]);
    const gods = (list) => list.filter(({ annotation }) => annotation?.kind === "brilliant").map(({ ply }) => ply);
    expect(gods(points)).toEqual([1, 2, 4]);
    expect(points[2].annotation).toMatchObject({ kind: "good", label: "好手", godCandidate: true });
    // 後から強い手が見つかれば、入れ替わる。外れた手も、より強ければ戻れる。
    points = capGodMoves([...points, point(5, 40)]);
    expect(gods(points)).toEqual([2, 4, 5]);
    expect(gods(capGodMoves([{ ply: 0, annotation: null }, ...points]))).toEqual([2, 4, 5]);
  });
});
