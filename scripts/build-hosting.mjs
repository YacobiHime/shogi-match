import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const output = new URL("../firebase-public/", import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const path of [
  "game.html",
  "auth.html",
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

// エンジンの版(?v=)は、vite.config.jsのengineVersionPluginがビルドの時点で埋め込む。
// 遅延チャンク(dist/chunks/)は名前に内容のハッシュを持つので、ここでは書き換えない。

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

// ログインのページ(docs/cloud-sync-design.mdの5章)の中身にも内容の版を付ける(JSは長くキャッシュするため)。
const loginVersion = createHash("sha256").update(await readFile(new URL("dist/auth/login.js", output))).digest("hex").slice(0, 12);
const authHtml = await readFile(new URL("auth.html", output), "utf8");
await writeFile(new URL("auth.html", output), authHtml.replace(/(\.\/dist\/auth\/login\.js)(?:\?v=[^"']+)?/g, `$1?v=${loginVersion}`));
