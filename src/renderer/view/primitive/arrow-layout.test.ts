import { describe, expect, it } from "vitest";
import { parallelArrowLaneOffsets } from "./arrow-layout";

describe("parallelArrowLaneOffsets", () => {
  it("separates arrows that overlap in the same direction", () => {
    expect(parallelArrowLaneOffsets([
      { start: { x: 100, y: 50 }, end: { x: 10, y: 50 } },
      { start: { x: 100, y: 50 }, end: { x: 40, y: 50 } },
      { start: { x: 100, y: 50 }, end: { x: 70, y: 50 } },
    ], 16)).toEqual([0, -16, 16]);
  });

  it("does not move arrows on different lines or in different directions", () => {
    expect(parallelArrowLaneOffsets([
      { start: { x: 100, y: 50 }, end: { x: 10, y: 50 } },
      { start: { x: 100, y: 80 }, end: { x: 10, y: 80 } },
      { start: { x: 100, y: 50 }, end: { x: 100, y: 10 } },
    ], 16)).toEqual([0, 0, 0]);
  });

  it("separates collinear diagonal arrows with different starting points", () => {
    expect(parallelArrowLaneOffsets([
      { start: { x: 90, y: 90 }, end: { x: 20, y: 20 } },
      { start: { x: 70, y: 70 }, end: { x: 40, y: 40 } },
    ], 12)).toEqual([0, -12]);
  });
});
