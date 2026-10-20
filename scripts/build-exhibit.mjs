// 展示用パッケージ(Windows・Chrome・インターネット不要)を作る。docs/exhibit-design.md
// npm run build:exhibit で、build:hosting のあとに呼ぶ。
// 出力: exhibit/shogi-match-exhibit/(app/ に公開版と同じ中身、起動のbatとPowerShellのサーバー、説明書)と、そのzip。
import { execFileSync } from "node:child_process";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const hosting = new URL("firebase-public/", root);
const outRoot = new URL("exhibit/", root);
const out = new URL("shogi-match-exhibit/", outRoot);

try {
  await stat(new URL("game.html", hosting));
} catch {
  console.error("firebase-public/ がありません。先に npm run build:hosting を実行してください。");
  process.exit(1);
}

await rm(outRoot, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(hosting, new URL("app/", out), { recursive: true });
for (const file of ["server.ps1", "start.bat", "start-window.bat", "README.txt"]) {
  await cp(new URL(`scripts/exhibit/${file}`, root), new URL(file, out));
}

// zip にまとめる(zipコマンドがない環境では、フォルダーだけ作る)。
const zipPath = fileURLToPath(new URL("shogi-match-exhibit.zip", outRoot));
try {
  execFileSync("zip", ["-qr", zipPath, "shogi-match-exhibit"], { cwd: fileURLToPath(outRoot), stdio: "inherit" });
  const { size } = await stat(zipPath);
  console.log(`展示用パッケージ: exhibit/shogi-match-exhibit.zip (${(size / 1024 / 1024).toFixed(1)}MB)`);
} catch {
  console.log("zip コマンドが見つからないため、フォルダーだけ作りました: exhibit/shogi-match-exhibit/");
}
