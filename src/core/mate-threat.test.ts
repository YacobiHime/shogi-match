import { describe, expect, test } from "vitest";
import { detectStrictMateThreat, findForcedMate, findMateInOne } from "./mate-threat";

describe("1手詰め判定", () => {
  test("現在の手番側に金打ちの1手詰めがあれば指し手を返す", () => {
    expect(findMateInOne(
      "4k4/9/9/9/9/6b2/9/3P1P3/3PKP3 w g 1",
    )).toBe("G*5h");
  });

  test("1手では詰まない局面ではnullを返す", () => {
    expect(findMateInOne(
      "4k4/9/9/9/9/9/9/3P1P3/3PKP3 b - 1",
    )).toBeNull();
  });
});

describe("厳密な詰めろ判定", () => {
  test("手番を渡すと金打ちの一手詰めになる局面を検出する", () => {
    const result = detectStrictMateThreat(
      "4k4/9/9/9/9/6b2/9/3P1P3/3PKP3 b g 1",
      5,
      10000,
    );
    expect(result).toMatchObject({ isThreat: true, matePly: 1, exhausted: false });
  });

  test("現在王手されている局面を詰めろとは判定しない", () => {
    const result = detectStrictMateThreat(
      "4k4/9/9/9/9/9/4r4/3P1P3/3PKP3 b - 1",
      5,
      10000,
    );
    expect(result.isThreat).toBe(false);
  });
});

describe("手番側の強制詰み判定", () => {
  test("連続王手で詰む局面を検出する", () => {
    expect(findForcedMate("4k4/9/9/9/9/6b2/9/3P1P3/3PKP3 w g 1", 5, 10000))
      .toMatchObject({ isMate: true, matePly: 1, exhausted: false });
  });

  test("詰めろを受けた後のように詰みが無ければ偽を返す", () => {
    expect(findForcedMate("4k4/9/9/9/9/9/9/3P1P3/3PKP3 w g 1", 5, 10000))
      .toMatchObject({ isMate: false, exhausted: false });
  });
});
