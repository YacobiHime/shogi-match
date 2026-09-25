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
