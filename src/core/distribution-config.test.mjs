import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));

it("publishes the built entry without duplicate root engine assets", () => {
  const manifest = readJson("package.json");
  expect(manifest.main).toBe("./dist/shogi-match.js");
  expect(manifest.exports["."]).toBe("./dist/shogi-match.js");
  expect(manifest.scripts.prepack).toBe("npm run build");
  expect(manifest.files).not.toContain("yaneuraou.wasm");
  expect(manifest.files).not.toContain("yaneuraou.data");
  expect(manifest.dependencies ?? {}).not.toHaveProperty("vue");
  expect(manifest.dependencies ?? {}).not.toHaveProperty("tsshogi");
  expect(manifest.devDependencies).toHaveProperty("vue");
  expect(manifest.devDependencies).toHaveProperty("tsshogi");
});

it("sets root HTML cache and basic response security headers", () => {
  const headers = readJson("firebase.json").hosting.headers;
  expect(headers.some(({ source, headers: rules }) => source === "/"
    && rules.some(({ key }) => key === "Cache-Control"))).toBe(true);
  const global = headers.find(({ source }) => source === "**")?.headers ?? [];
  expect(global.map(({ key }) => key)).toEqual(expect.arrayContaining([
    "X-Content-Type-Options", "Referrer-Policy",
  ]));
});

it("long-caches versioned assets and serves engine data as binary", () => {
  const headers = readJson("firebase.json").hosting.headers;
  const jsAndCss = headers.find(({ source }) => source === "**/*.@(js|css)")?.headers ?? [];
  expect(jsAndCss).toContainEqual({
    key: "Cache-Control",
    value: "public, max-age=31536000, immutable",
  });
  const staticAssets = headers.find(({ source }) => source.includes("mp3"))?.headers ?? [];
  expect(staticAssets.some(({ key }) => key === "Cache-Control")).toBe(true);
  const engineData = headers.find(({ source }) => source === "**/*.data")?.headers ?? [];
  expect(engineData).toContainEqual({ key: "Content-Type", value: "application/octet-stream" });

  const buildScript = readFileSync(new URL("scripts/build-hosting.mjs", root), "utf8");
  expect(buildScript).toMatch(/const assetVersions = new Map\(\)/);
  expect(buildScript).toMatch(/for \(const asset of \["shogi-match\.css", "shogi-match\.js"\]\)/);
});
