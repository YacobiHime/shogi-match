import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../ShogiMatchGame.vue", import.meta.url), "utf8");

describe("match screen regressions", () => {
  it("keeps the flip control readable and two rows tall on narrow screens", () => {
    expect(source).toMatch(/class="shogi-game__command shogi-game__command--flip"[\s\S]*?aria-label="盤面を上下反転（ひふみんアイ）"/);
    expect(source).toMatch(/\.shogi-game__toolbar \.shogi-game__command\s*\{[^}]*white-space:\s*nowrap/s);
    const narrow = source.split("@media (max-width: 360px) {")[1]
      ?.split("@media (min-width: 541px) and (max-width: 899px) and (max-height: 500px)")[0] ?? "";
    expect(narrow).not.toMatch(/\.shogi-game__turn\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
    expect(narrow).toMatch(/\.shogi-game__turn\s*\{[^}]*grid-column:\s*2/s);
  });

  it("shows the opponent separately from the handicap", () => {
    expect(source).toMatch(/<dt>手合割<\/dt>/);
    expect(source).toMatch(/<dt>対戦相手<\/dt>/);
    expect(source).toMatch(/cpuPlayerName/);
    expect(source).not.toMatch(/手合割・対戦相手/);
  });

  it("draws detour arrows from opening-compatible candidates", () => {
    expect(source).toMatch(/openingDetourArrowCandidates\(\s*planned\.usi,\s*compatibleCandidates,/);
  });
});
