import { cp, mkdir, rm } from "node:fs/promises";

const output = new URL("../firebase-public/", import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const path of [
  "game.html",
  "dist",
  "yaneuraou.data",
  "yaneuraou.wasm",
  "yaneuraou.worker.js",
]) {
  await cp(new URL(`../${path}`, import.meta.url), new URL(path, output), {
    recursive: true,
  });
}

await cp(
  new URL("game.html", output),
  new URL("index.html", output),
);
