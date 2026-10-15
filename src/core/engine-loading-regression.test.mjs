import { describe, expect, it } from "vitest";
import { matchScreenSource } from "./match-screen-source.mjs";

const source = matchScreenSource();

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
