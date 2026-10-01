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

  it("calls a hidden best move clearly ahead of the second move a god move", () => {
    // +300と0は勝率で約12ポイントの差。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(300), cp(0)), shallowCandidates: shallowMiss }))
      .toMatchObject({ hidden: true, sacrifice: false });
    // 浅い読みでも見えている手は、見つけにくい手ではない。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(300), cp(0)), shallowCandidates: shallowFound })).toBeNull();
    // 最善手でなければ神の一手ではない。
    expect(judgeGodMove({ move: "7g7f", deepCandidates: deep(cp(300), cp(0)), shallowCandidates: shallowMiss })).toBeNull();
  });

  it("needs the move to be clearly better than the second move in win rate", () => {
    // +300と+150は勝率で約6ポイントの差しかない。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(300), cp(150)), shallowCandidates: shallowMiss })).toBeNull();
    // 勝負が決まった局面の差は、評価値が大きくても勝率ではほとんど差がない。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(3000), cp(2000)), shallowCandidates: shallowMiss })).toBeNull();
    // 逆転の一手でなくてもよい。不利な側の見つけにくい最善手も対象にする。
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(-300), cp(-700)), shallowCandidates: shallowMiss })).not.toBeNull();
  });

  it("counts a sacrifice as hard to find and gives it a bonus", () => {
    // +300と+110は勝率で約7.6ポイントの差。捨て駒なら神の一手、そうでなければ届かない。
    const candidates = deep(cp(300), cp(110));
    expect(judgeGodMove({ move: "5c5d", deepCandidates: candidates, shallowCandidates: shallowFound })).toBeNull();
    const sacrifice = judgeGodMove({ move: "5c5d", deepCandidates: candidates, shallowCandidates: shallowFound, sacrifice: true });
    expect(sacrifice).toMatchObject({ hidden: false, sacrifice: true });
    // 浅い読みで見えず、捨て駒でもある手は、どちらの加点も受けて強くなる。
    const both = judgeGodMove({ move: "5c5d", deepCandidates: candidates, shallowCandidates: shallowMiss, sacrifice: true });
    expect(both.strength).toBeCloseTo(sacrifice.strength + 10, 5);
    // 浅い読みでもう詰みが見えている局面の捨て駒は、読まなくても分かる。
    expect(judgeGodMove({
      move: "5c5d",
      deepCandidates: deep(mate(5), cp(300)),
      shallowCandidates: [{ rank: 1, move: "5c5d", score: mate(5) }],
      sacrifice: true,
    })).toBeNull();
  });

  it("skips trivial moves such as recaptures", () => {
    expect(judgeGodMove({ move: "5c5d", deepCandidates: deep(cp(300), cp(0)), shallowCandidates: shallowMiss, trivial: true }))
      .toBeNull();
  });

  it("finds recaptures and sacrifices from the position", () => {
    // 7六の歩を取り返す手は、誰でも指す手。
    expect(moveContext("4k4/9/9/9/9/2p6/2P6/9/4K4 b - 1", "7g7f", "7e7f")).toEqual({ trivial: true, sacrifice: false });
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
