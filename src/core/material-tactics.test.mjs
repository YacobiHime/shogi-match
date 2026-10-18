import { describe, expect, it } from "vitest";
import { bestGainMove, defendingReply, dropThreat, moveGain, sfenAfterMove } from "./material-tactics.mjs";

describe("駒の損得の軽い読み", () => {
  it("取った駒の値段から、取られて損をする駒の値段を引く", () => {
    // 守られていない金を桂で取る(成る)＝＋6。
    expect(moveGain("k3sg3/9/4N4/9/9/9/9/8L/7GK b - 1", "5c4a+")).toBe(6);
    // 飛車に守られた金を桂で取る＝＋6−4。
    expect(moveGain("k3rg3/9/4N4/9/9/9/9/8L/7GK b - 1", "5c4a+")).toBe(2);
    // 歩に守られた金を飛車で取る＝＋6−10。
    expect(moveGain("k8/9/4p4/4g4/9/9/9/4R4/8K b - 1", "5h5d")).toBe(-4);
    expect(moveGain("k8/9/9/9/9/9/9/4R4/8K b - 1", "5h5d")).toBe(0);
  });

  it("いちばん得な手と、守る側のいちばん良い応手(両取りなら高いほうを逃がす)", () => {
    expect(bestGainMove("k8/9/9/3s1b3/4G4/9/9/8L/7GK b - 1")).toEqual({ usi: "5e4d", gain: 8 });
    const afterFork = sfenAfterMove("k2rsg3/9/9/9/5N3/9/9/8L/7GK b - 1", "4e5c");
    const reply = defendingReply(afterFork);
    expect(reply.usi.slice(0, 2)).toBe("6a");
    expect(reply.score).toBe(6);
  });

  // 合法手ごとに相手の受けまで読むので重い。並列で動かすと5秒を超えることがある。
  it("持ち駒を打ち込まれて両取りになる隙を見つける", () => {
    const gap = "ln1gk2nl/1r1s1gs2/p1pppp1pp/1p4p2/9/2P3PP1/PPSPPPN1P/2K2GSR1/LN1G4L w Bb 1";
    expect(dropThreat(gap, "B")?.usi).toBe("B*3i");
    const closed = sfenAfterMove(gap.replace(" w ", " b "), "2h2i");
    expect(dropThreat(closed, "B")).toBeNull();
  }, 30_000);
});
