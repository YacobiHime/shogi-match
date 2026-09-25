import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const output = new URL("../firebase-public/", import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const path of [
  "game.html",
  "dist",
  "vendor",
]) {
  await cp(new URL(`../${path}`, import.meta.url), new URL(path, output), {
    recursive: true,
  });
}

await cp(
  new URL("game.html", output),
  new URL("index.html", output),
);

// ローダーと付随するwasm/data/workerを同じ版として配信する。
const profiles = ["yaneuraou", "yaneuraou.halfkp.noeval"];
const bundledJsUrl = new URL("dist/shogi-match.js", output);
let bundledJs = await readFile(bundledJsUrl, "utf8");
for (const profile of profiles) {
  const hash = createHash("sha256");
  let assetCount = 0;
  for (const suffix of ["js", "wasm", "data", "worker.js"]) {
    const name = `${profile}.${suffix}`;
    try {
      hash.update(await readFile(new URL(`vendor/${name}`, output)));
      assetCount += 1;
    }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (assetCount === 0) continue;
  const version = hash.digest("hex").slice(0, 12);
  bundledJs = bundledJs.replaceAll(`${profile}.js?v=20260727-2`, `${profile}.js?v=${version}`);
}
await writeFile(bundledJsUrl, bundledJs);

const assetVersions = new Map();
for (const asset of ["shogi-match.css", "shogi-match.js"]) {
  const bytes = await readFile(new URL(`dist/${asset}`, output));
  assetVersions.set(asset, createHash("sha256").update(bytes).digest("hex").slice(0, 12));
}

const sourceHtml = await readFile(new URL("game.html", output), "utf8");
const versionedHtml = [...assetVersions].reduce(
  (html, [asset, version]) => html.replace(
    new RegExp(`(\\./dist/${asset.replace(".", "\\.")})(?:\\?v=[^\"']+)?`, "g"),
    `$1?v=${version}`,
  ),
  sourceHtml,
);
await writeFile(new URL("game.html", output), versionedHtml);
await writeFile(new URL("index.html", output), versionedHtml);
