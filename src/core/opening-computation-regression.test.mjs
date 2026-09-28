import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../ShogiMatchGame.vue", import.meta.url), "utf8");

describe("opening availability computation", () => {
  it("shares a bounded formation snapshot cache by SFEN", () => {
    expect(source).toMatch(/const FORMATION_SNAPSHOT_CACHE_LIMIT = 4;/);
    expect(source).toMatch(/function formationSnapshotForSfen\(sfen: string\)/);
    expect(source.match(/detectFormationSnapshot\(sfen, hiraganaFormationMaster\)/g)).toHaveLength(1);
    expect(source).toMatch(/while \(formationSnapshotCache\.size > FORMATION_SNAPSHOT_CACHE_LIMIT\)/);
  });

  it("computes legal moves and rook style once for both option groups", () => {
    expect(source).toMatch(/const openingAvailabilityContext = computed\(\(\) => \{/);
    expect(source).toMatch(/legalMoves: openingGuideLegalMoves\(\)/);
    expect(source).toMatch(/committedRookStyle: inferOpeningRookStyle\(\{/);
    expect(source).toMatch(/\} = openingAvailabilityContext\.value;/);
  });
});
