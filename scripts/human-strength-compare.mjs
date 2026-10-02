// 人間の棋譜とCPUの指し手を、強いエンジン(水匠5など)の深い読みで採点して比べる開発用スクリプト。
// 「藤井聡太並み」(Lv40)が本当に藤井聡太の指し手の質に近いかを確かめるために使う。
// 使い方:
//   node scripts/human-strength-compare.mjs --engine <USIエンジンのexe> [--nodes 6000000] [--level 40]
//     [--cpu-nodes 720000] [--cache eval-cache.json] a.kif b.kif ...
// --cpu-nodesで、CPUの探索量だけを差し替えて試せる。--cacheを付けると基準エンジンの採点を保存し、次回は読み直さない。
// 棋譜の各局面で、指された手と、CPU(指定レベルの探索量・最善手)の手のそれぞれを、基準エンジンで採点する。
// 指し手の損は「指す前の局面の評価値」と「指した後の局面の評価値(相手番なので符号を反転)」の差。
// 評価値が±2000を超えた局面(勝負が決まった後)は集計から除く。
import fs from "node:fs";
import { RecordMetadataKey, importKIF } from "tsshogi";
import { createNativeEngine, createNodeEngine } from "./lib/node-engine.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from "../src/core/strength-settings.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const enginePath = option("engine", "");
if (!enginePath) throw new Error("--engineで基準のUSIエンジンを指定してください");
const nodes = Number(option("nodes", "6000000"));
const level = Number(option("level", "40"));
const cpuNodes = Number(option("cpu-nodes", "0"));
const cachePath = option("cache", "");
const cache = cachePath && fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};
const cacheKey = (sfen, moves = []) => `${nodes} ${sfen} ${moves.join(" ")}`;
const files = process.argv.slice(2).filter((arg, index, args) => arg.endsWith(".kif") && !args[index - 1]?.startsWith("--"));
const DECIDED = 2000;

const comparable = (score) => {
  if (score?.type === "cp") return score.value;
  if (score?.type === "mate") return score.value > 0 ? 100000 - score.value : -100000 - score.value;
  return undefined;
};
const winRate = (value) => 100 / (1 + Math.exp(-Math.max(-5000, Math.min(5000, value)) / 600));

const games = files.map((file) => {
  const record = importKIF(fs.readFileSync(file, "utf8"));
  if (record instanceof Error) throw record;
  const steps = [];
  record.goto(0);
  for (const node of record.moves) {
    if (node.ply > 0) record.goForward();
    if (node.ply > 0 && !node.move?.usi) break;
    steps.push({ sfen: record.position.sfen, move: "" });
    if (node.ply > 0) steps[node.ply - 1].move = node.move.usi;
  }
  const meta = (key) => record.metadata.getStandardMetadata(key) ?? "";
  return { file, black: meta(RecordMetadataKey.BLACK_NAME), white: meta(RecordMetadataKey.WHITE_NAME), steps };
});

// 1. CPUの手。対局と同じ探索量で、最善手(第1候補)を選ぶ。
const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === level);
const strength = { ...getStrengthSearchSettings(preset.value), ...(cpuNodes ? { nodes: cpuNodes } : {}) };
const cpuJobs = games.flatMap((game) => game.steps.filter(({ move }) => move));
const cpuEngines = await Promise.all(Array.from({ length: 8 }, () => createNodeEngine()));
let started = Date.now();
await Promise.all(cpuEngines.map(async (engine) => {
  for (let step = cpuJobs.shift(); step; step = cpuJobs.shift()) {
    engine.applyStrengthOptions({ multiPv: 1 });
    await engine.setSearchThreads(strength.searchThreads);
    engine.setPosition(step.sfen);
    step.cpuMove = (await engine.go({ nodes: strength.nodes, maxTimeMs: 60000 })).move;
  }
}));
cpuEngines.forEach((engine) => engine.quit());
console.error(`Lv${level}(${strength.nodes.toLocaleString()}nodes)の手を${((Date.now() - started) / 1000).toFixed(0)}秒で求めました。`);

// 2. 基準エンジンで、各局面と、CPUの手を指した後の局面を読む。
const evalJobs = [];
const queue = (job) => {
  const saved = cache[cacheKey(job.sfen, job.moves)];
  if (saved) job.set(saved);
  else evalJobs.push(job);
};
for (const game of games) {
  game.steps.forEach((step) => {
    queue({ sfen: step.sfen, set: (result) => { step.eval = result; } });
    if (step.move && step.cpuMove && step.cpuMove !== step.move) {
      queue({ sfen: step.sfen, moves: [step.cpuMove], set: (result) => { step.cpuAfter = result; } });
    }
  });
}
const refEngines = await Promise.all(Array.from({ length: Math.min(5, evalJobs.length) }, () => createNativeEngine(enginePath, { threads: 4 })));
started = Date.now();
await Promise.all(refEngines.map(async (engine) => {
  for (let job = evalJobs.shift(); job; job = evalJobs.shift()) {
    engine.applyStrengthOptions({ multiPv: 1 });
    engine.setPosition(job.moves ? `${job.sfen} moves ${job.moves.join(" ")}` : job.sfen);
    const result = await engine.go({ nodes, maxTimeMs: 60000 });
    const best = result.candidates.find(({ rank }) => rank === 1);
    const value = { move: result.move, score: comparable(best?.score) };
    cache[cacheKey(job.sfen, job.moves)] = value;
    job.set(value);
  }
}));
refEngines.forEach((engine) => engine.quit());
if (cachePath) fs.writeFileSync(cachePath, JSON.stringify(cache));
console.error(`基準エンジンで${((Date.now() - started) / 1000).toFixed(0)}秒かけて採点しました。`);

// 3. 指し手の損を集計する。
const tally = new Map();
const add = (name, loss, best) => {
  const entry = tally.get(name) ?? { moves: 0, cp: 0, win: 0, dubious: 0, mistake: 0, best: 0, losses: [] };
  entry.moves += 1;
  entry.cp += Math.min(loss.cp, DECIDED);
  entry.win += loss.win;
  entry.losses.push(loss.cp);
  if (loss.cp >= 300) entry.dubious += 1;
  if (loss.cp >= 800) entry.mistake += 1;
  if (best) entry.best += 1;
  tally.set(name, entry);
};
const lossOf = (before, after) => ({
  cp: Math.max(0, before + after),
  win: Math.max(0, winRate(before) - (100 - winRate(after))),
});
for (const game of games) {
  game.steps.forEach((step, ply) => {
    const next = game.steps[ply + 1];
    if (!step.move || !next || step.eval.score === undefined || Math.abs(step.eval.score) >= DECIDED) return;
    const mover = ply % 2 === 0 ? game.black : game.white;
    const played = lossOf(step.eval.score, next.eval.score);
    add(mover, played, step.move === step.eval.move);
    const cpuAfter = step.cpuMove === step.move ? next.eval.score : step.cpuAfter?.score;
    if (cpuAfter !== undefined) add(`Lv${level}(${mover}の局面)`, lossOf(step.eval.score, cpuAfter), step.cpuMove === step.eval.move);
  });
}
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
console.log(`CPU: Lv${level}、${strength.nodes.toLocaleString()}nodes`);
console.log(`基準: ${enginePath.split(/[\\/]/).at(-2)} ${nodes.toLocaleString()}nodes、${games.length}局。評価値±${DECIDED}以上の局面は除く。`);
console.log("| 指し手 | 手数 | 平均損失 | 中央値 | 平均勝率損失 | 疑問手以上(300) | 悪手以上(800) | 最善手一致 |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const [name, entry] of tally) {
  console.log(`| ${name} | ${entry.moves} | ${(entry.cp / entry.moves).toFixed(0)} | ${median(entry.losses)} | ${(entry.win / entry.moves).toFixed(2)} | ${entry.dubious} | ${entry.mistake} | ${((entry.best / entry.moves) * 100).toFixed(0)}% |`);
}
process.exit(0);
