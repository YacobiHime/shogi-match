import { expect, test } from "vitest";
import { continuationPurpose } from "./continuation-purpose.mjs";
import { createNaturalnessEvaluator } from "./move-naturalness.mjs";
import { CPU_POSITION_SET, mirrorPositionSfen } from "./cpu-position-set.mjs";
import { mirrorUsiMove } from "./opening-guide.mjs";

test("読み筋で動かした駒自身の取り・成りへの準備を確かめ、先後を揃える", () => {
  const sfen = "4k4/9/6p2/9/9/9/9/7R1/4K4 b - 1";
  const candidate = { move: "2h3h", pv: ["2h3h", "5a4a", "3h3c+"] };
  for (const mirrored of [false, true]) {
    const position = mirrored ? mirrorPositionSfen(sfen) : sfen;
    const line = mirrored ? { move: mirrorUsiMove(candidate.move), pv: candidate.pv.map(mirrorUsiMove) } : candidate;
    expect(createNaturalnessEvaluator(position)(line.move).purposeful).toBe(false);
    expect(continuationPurpose(position, line)).toBe("attack-plan");
    expect(createNaturalnessEvaluator(position, { continuations: [line] })(line.move).tags).toContain("attack-plan");
  }
});

test("無関係な歩打ちを最善手の読み筋だけで正当化しない", () => {
  const fixture = CPU_POSITION_SET.find(({ id }) => id === "rook-attacked");
  const candidate = { move: "P*8d", pv: ["P*8d", "5e8b+", "8d8e"], score: { type: "cp", value: 1000 } };
  expect(continuationPurpose(fixture.sfen, candidate)).toBeNull();
  expect(createNaturalnessEvaluator(fixture.sfen, { continuations: [candidate] })(candidate.move).purposeful).toBe(false);
});

test("無関係な別の駒の攻めや不正・不完全な読み筋に理由を付けない", () => {
  const sfen = "4k4/9/6p2/9/9/9/9/7R1/4K4 b P 1";
  for (const pv of [[], ["P*8f", "5a4a", "2h3h"], ["P*8f", "5a4a", "2h3c+"], ["2h3h", "5a4a", "3h3c+"]]) {
    expect(continuationPurpose(sfen, { move: "P*8f", pv })).toBeNull();
  }
});
