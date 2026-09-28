import { readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Windowsでも入力画像のハンドルを保持せず、変換後に同名ファイルへ置き換えられるようにする。
sharp.cache(false);

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

const coachPortraits = [
  "sakurano-momoka.webp",
  "sakurano-momoka-wry.webp",
  "sakurano-momoka-worried.webp",
];
for (const fileName of coachPortraits) {
  const source = path.join(root, "characters", fileName);
  const temporary = `${source}.optimized.webp`;
  const metadata = await sharp(source).metadata();
  if ((metadata.width ?? 0) <= 800) continue;
  await rm(temporary, { force: true });
  await sharp(source)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(temporary);
  await rm(source);
  await rename(temporary, source);
}
