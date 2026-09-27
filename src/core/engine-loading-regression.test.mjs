import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../ShogiMatchGame.vue", import.meta.url), "utf8");

describe("engine loading timing", () => {
  it("does not initialize the engine while only the home screen is open", () => {
    expect(source).toMatch(
      /if \(restoredPersistedMatch \|\| !homeOpen\.value \|\| reviewMode\.value\) \{\s*void initializeEngine\(\);/,
    );
  });

  it("starts initialization when the home screen opens match preparation", () => {
    expect(source).toMatch(
      /function closeHome\(\)[\s\S]*?openPregame\(\);\s*homeOpen\.value = false;\s*void initializeEngine\(\);/,
    );
  });
});
