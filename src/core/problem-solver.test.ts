import { describe, expect, it } from "vitest";
import { judgeMateStep } from "./problem-solver";

// 3手詰め（7四金 8四玉の形）。作意は 7d8d 9d9e 9g9f。
const MATE_IN_3 = "9/9/9/k1G6/1L7/9/PP7/9/L8 b 2r2b3g4s4n2l16p 1";

describe("judgeMateStep", () => {
  it("詰みが続く手には、受け方の応手と残りの手数を返す", () => {
    const verdict = judgeMateStep(MATE_IN_3, "7d8d", 3);
    expect(verdict).toEqual({ status: "continue", reply: "9d9e", plies: 2 });
  });

  it("最後の手で詰んだら詰みと判定する", () => {
    const afterReply = "9/9/9/1G7/kL7/9/PP7/9/L8 b 2r2b3g4s4n2l16p 3";
    expect(judgeMateStep(afterReply, "9g9f", 1)).toEqual({ status: "mated" });
  });

  it("王手でない手と指せない手を区別する", () => {
    expect(judgeMateStep(MATE_IN_3, "9g9f", 3).status).toBe("not-check");
    expect(judgeMateStep(MATE_IN_3, "1a1b", 3).status).toBe("illegal");
  });
});
