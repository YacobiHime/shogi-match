import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../public/", import.meta.url));

async function pngFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await pngFiles(target));
    else if (entry.name.endsWith(".png")) files.push(target);
  }
  return files;
}

for (const folder of ["board", "piece", "stand"]) {
  const directory = path.join(root, folder);
  for (const source of await pngFiles(directory)) {
    const destination = source.replace(/\.png$/i, ".webp");
    await sharp(source).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(destination);
    await rm(source);
  }
}
