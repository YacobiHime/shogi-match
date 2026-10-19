// 独立した局面ごとに別のエンジンを使う。各エンジン内の読みは直列。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CPU_POSITION_SET } from "../src/core/cpu-position-set.mjs";

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shogi-cpu-positions-"));
const jobs = CPU_POSITION_SET.flatMap(({ id }) => ["original", "mirror"].map((side) => ({ id, side })));
const rows = [];
const runs = Number(option("runs", "100"));
const forwarded = ["--levels", option("levels", "11,20,30,39"), "--runs", String(runs),
  ...["--hybrid", "--compare", "--calibrated"].filter((flag) => process.argv.includes(flag))];
const script = fileURLToPath(new URL("./cpu-position-set-report.mjs", import.meta.url));
const out = option("out", "cpu-position-results.json");
const children = new Set();
try {
  await Promise.all(Array.from({ length: Number(option("workers", "4")) }, async () => {
    while (jobs.length) {
      const job = jobs.shift();
      const file = path.join(directory, `${job.id}-${job.side}.json`);
      await new Promise((resolve, reject) => {
        const child = fork(script, [...forwarded, "--position", job.id, "--side", job.side, "--out", file], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
        children.add(child);
        child.once("error", reject);
        child.once("exit", (code) => {
          children.delete(child);
          code === 0 ? resolve() : reject(new Error(`${job.id} ${job.side}: exit ${code}`));
        });
      });
      rows.push(...JSON.parse(fs.readFileSync(file, "utf8")).rows);
      fs.writeFileSync(out, JSON.stringify({ date: "2026-10-19", runs, alternatingModes: true, workers: Number(option("workers", "4")), rows }, null, 2) + "\n");
    }
  }));
} finally {
  // 自分でmkdtempした専用ディレクトリだけを消す。
  for (const child of children) child.kill();
  const absolute = path.resolve(directory);
  if (path.dirname(absolute) !== path.resolve(os.tmpdir()) || !path.basename(absolute).startsWith("shogi-cpu-positions-")) throw new Error("一時ディレクトリの境界が不正です");
  fs.rmSync(absolute, { recursive: true, force: true });
}
