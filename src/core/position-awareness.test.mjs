import { describe, expect, test } from "vitest";
import { analyzePosition, perceptionForPosition } from "./position-awareness.mjs";
import { cpuPositionVariants } from "./cpu-position-set.mjs";
import { mirrorUsiMove } from "./opening-guide.mjs";
import { logicPerception, rollPerception } from "./logic-ai.mjs";
import { createRng } from "./ryuo-random.mjs";
import { replyLoss, playLight, stateFromSfen } from "./logic-position.mjs";

describe("局面の気づき", () => {
  test.each(cpuPositionVariants())("当たりだけの照会も同じ脅威と目立ち方を返す: $id $mirrored", (fixture) => {
    const options = { moveHistory: fixture.moveHistory };
    const full = analyzePosition(fixture.sfen, options);
    const captures = analyzePosition(fixture.sfen, { ...options, captureThreatsOnly: true });
    expect(captures.threats).toEqual(full.threats.filter(({ kind }) => kind === "capture"));
    expect(captures.chances).toEqual([]);
    expect(perceptionForPosition(logicPerception(10), captures)).toEqual(perceptionForPosition(logicPerception(10), full));
  });
  test.each(cpuPositionVariants().filter(({ id }) => id === "rook-attacked"))("直前の角による飛車取りを目立つ脅威とする: $mirrored", (fixture) => {
    const awareness = analyzePosition(fixture.sfen, { moveHistory: fixture.moveHistory });
    const square = fixture.mirrored ? mirrorUsiMove("8b") : "8b";
    expect(awareness.threats).toContainEqual(expect.objectContaining({ kind: "capture", square, salience: "last-move-major" }));
    const perception = perceptionForPosition(logicPerception(1), awareness);
    let noticed = 0;
    for (let seed = 1; seed <= 1000; seed += 1) noticed += Number(rollPerception(perception, createRng(seed).next).hanging);
    expect(noticed / 1000).toBeGreaterThan(0.65);
    expect(noticed / 1000).toBeLessThan(0.75);
    expect(analyzePosition(fixture.sfen).threats.find((threat) => threat.square === square).salience).toBe("other");
  });

  test.each(cpuPositionVariants().filter(({ id }) => id === "bougin-silver"))("成り込みも読み、侵入を放置する手に損を付ける: $mirrored", (fixture) => {
    const state = stateFromSfen(fixture.sfen);
    const reply = (usi) => {
      const child = playLight(state, fixture.mirrored ? mirrorUsiMove(usi) : usi);
      return -replyLoss(child, 4);
    };
    expect(reply("9a9b")).toBeLessThan(reply("P*2c"));
  });

  test("取り返しで損をしない取りをcaptureの脅威としない", () => {
    const sfen = "4k4/9/9/4p4/4P4/4G4/9/9/4K4 b - 1";
    expect(analyzePosition(sfen).threats.some(({ kind, square }) => kind === "capture" && square === "5e")).toBe(false);
  });

  test("詰めろと、王手・詰みの機会を時間上限付きで調べる", () => {
    const own = analyzePosition("4k4/9/4P4/9/9/9/9/9/4K4 b G 1");
    expect(own.chances).toContainEqual(expect.objectContaining({ kind: "mate", moves: ["G*5b"] }));
    const threat = analyzePosition("4k4/9/9/9/9/9/4p4/9/4K4 b g 1");
    expect(threat.threats).toContainEqual(expect.objectContaining({ kind: "mate-threat", square: "5i" }));
  });
});
