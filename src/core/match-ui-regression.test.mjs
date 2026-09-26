import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../ShogiMatchGame.vue", import.meta.url), "utf8");

describe("match screen regressions", () => {
  it("keeps the flip control readable and reachable on every layout", () => {
    expect(source).toMatch(/class="shogi-game__command shogi-game__command--flip"[\s\S]*?aria-label="盤面を上下反転（ひふみんアイ）"/);
    expect(source).toMatch(/\.shogi-game__command\s*\{[^}]*white-space:\s*nowrap/s);
    // PC以外では見出しにボタンを並べず、メニューの中に反転を置く。
    expect(source).toMatch(/const menuCollapsed = computed\(\(\) => uiLayout\.value !== "wide"\)/);
    expect(source).toMatch(/role="menuitemcheckbox"[\s\S]*?ひふみんアイ（盤を反転）/);
  });

  it("asks before resigning from the toolbar and the menu", () => {
    expect(source.match(/reviewMode \? completeReview\(\) : requestResign\(\)/g)).toHaveLength(2);
    expect(source).not.toMatch(/reviewMode \? completeReview\(\) : resign\(\)/);
    expect(source).toMatch(/function confirmResign\(\) \{\s*resignConfirmOpen\.value = false;\s*resign\(\);/);
  });

  it("does not hide opening-guide choices behind a fixed height in portrait", () => {
    const stack = source.split(".shogi-game--stack {")[1]?.split("}")[0] ?? "";
    expect(stack).toMatch(/grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto auto auto;/);
    expect(stack).toMatch(/"board" "coach" "guide" "actions"/);
    expect(source.match(/class="shogi-game__opening-guide"/g)).toHaveLength(1);
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
