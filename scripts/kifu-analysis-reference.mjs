// 棋譜解析ベンチマークの基準データを、PCの強いエンジン(水匠5など)で作る開発用スクリプト。
// 使い方:
//   node scripts/kifu-analysis-reference.mjs --engine <USIエンジンのexe> [--nodes 8000000] [--workers 4] [--threads 4]
// 図鑑の代表局と、scripts/data/kifu-analysis-benchmark-games.jsonの自動対局の全局面を、MultiPV 2で読む。
// 結果はscripts/data/kifu-analysis-reference.jsonへ保存する。
import fs from "node:fs";
import path from "node:path";
import { createNativeEngine, projectRoot } from "./lib/node-engine.mjs";
import { benchmarkGames } from "./lib/kifu-benchmark-games.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const enginePath = option("engine", "");
if (!enginePath) throw new Error("--engineでUSIエンジンを指定してください");
const nodes = Number(option("nodes", "8000000"));
const workers = Number(option("workers", "4"));
const threads = Number(option("threads", "4"));
const outPath = path.join(projectRoot, "scripts/data/kifu-analysis-reference.json");

const games = benchmarkGames();
// 同じ探索量の途中結果があれば、その続きから読む。50局面ごとに保存するので、途中で止めても再開できる。
const previous = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : null;
const results = games.map((game) => {
  const saved = previous?.nodes === nodes ? previous.games.find(({ id }) => id === game.id)?.results : null;
  return Array.from({ length: game.steps.length }, (_, ply) => saved?.[ply] ?? null);
});
const jobs = games.flatMap((game, gameIndex) => game.steps
  .map((step, ply) => ({ gameIndex, ply, sfen: step.sfen }))
  .filter(({ ply }) => !results[gameIndex][ply]));
const save = () => fs.writeFileSync(outPath, `${JSON.stringify({
  engine: path.basename(path.dirname(enginePath)),
  nodes,
  multiPv: 2,
  createdAt: new Date().toISOString().slice(0, 10),
  complete: results.every((list) => list.every(Boolean)),
  games: games.map((game, index) => ({ id: game.id, results: results[index] })),
})}
`);
console.error(`残り${jobs.length}局面を読みます。`);
const engines = await Promise.all(Array.from({ length: workers }, () => createNativeEngine(enginePath, { threads })));
const started = Date.now();
let done = 0;
await Promise.all(engines.map(async (engine) => {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    engine.applyStrengthOptions({ multiPv: 2 });
    engine.setPosition(job.sfen);
    const search = await engine.go({ nodes, maxTimeMs: 60000 });
    results[job.gameIndex][job.ply] = search.candidates
      .map(({ rank, move, score, pv }) => ({ rank, move, score, pv: (pv ?? []).slice(0, 8) }));
    done += 1;
    if (done % 50 === 0) {
      save();
      console.error(`${done}局面 (${((Date.now() - started) / 1000).toFixed(0)}秒)`);
    }
  }
}));
engines.forEach((engine) => engine.quit());
save();
console.error(`${done}局面を${((Date.now() - started) / 1000).toFixed(0)}秒で解析し、${path.relative(projectRoot, outPath)}へ保存しました。`);
process.exit(0);
