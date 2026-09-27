// 各レベルのCPU着手を、同じWASMエンジンと同じ局面で深く読み直し、1手当たりの評価損を測る開発用スクリプト。
// 勝率による校正はscripts/cpu-level-selfplay.mjsで行う。
// 使い方: node scripts/cpu-humanlike-report.mjs [--games 6] [--trials 6] [--levels 0,1,5,10,15] [--out report.json]
import fs from "node:fs";
import path from "node:path";
import { Position } from "tsshogi";
import { chooseCpuMove } from "../src/core/cpu-move-choice.mjs";
import { comparableScore } from "../src/core/move-selection.mjs";
import { createNaturalnessEvaluator, LOW_NATURALNESS_THRESHOLD } from "../src/core/move-naturalness.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from "../src/core/strength-settings.mjs";
import {
  STANDARD_SFEN, createNodeEngine, legalMoves, projectRoot, search, seededRandom,
} from "./lib/node-engine.mjs";

const REFERENCE_NODES = 30000;
const LOSS_CAP = 3000;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const trials = Number(option("trials", "6"));
const games = Number(option("games", "6"));
const levels = option("levels", "0,1,5,10,15,20,25,30").split(",").map(Number);
const outPath = option("out", "");
const seed = Number(option("seed", "20260926"));

/** 固定シードで中程度の強さの自己対局を行い、序盤〜中盤のサンプル局面を集める。 */
async function samplePositions(engine, random) {
  const samples = [];
  for (let game = 0; game < games; game += 1) {
    const position = Position.newBySFEN(STANDARD_SFEN);
    const history = [];
    for (let ply = 0; ply < 60; ply += 1) {
      if ([6, 14, 24, 36, 48, 58].includes(ply)) {
        samples.push({ sfen: position.sfen, history: [...history], label: `game${game + 1}-ply${ply}` });
      }
      const result = await search(engine, position.sfen, { nodes: 20000, multiPv: 3 });
      const candidates = result.candidates.filter(({ move }) => position.createMoveByUSI(move));
      const pick = candidates[Math.min(candidates.length - 1, Math.floor(random() * 3))]?.move ?? result.move;
      const move = position.createMoveByUSI(pick);
      if (!move || !position.doMove(move)) break;
      history.push(pick);
    }
  }
  return samples;
}

async function currentChoose(engine, preset, sample, moves, random) {
  const strength = getStrengthSearchSettings(preset);
  const result = strength.nodes === 0 ? undefined : await search(engine, sample.sfen, strength);
  return chooseCpuMove({
    strength,
    sfen: sample.sfen,
    legalMoves: moves,
    moveHistory: sample.history,
    search: result,
    verify: result
      ? (searchMoves, nodes) => search(engine, sample.sfen, { nodes, multiPv: searchMoves.length, searchMoves })
      : undefined,
    random,
  });
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function main() {
  const engine = await createNodeEngine();
  const random = seededRandom(seed);
  console.error("サンプル局面を生成中...");
  const samples = await samplePositions(engine, random);
  const referenceCache = new Map();
  const reference = async (sample, move) => {
    const key = `${sample.sfen}|${move}`;
    if (!referenceCache.has(key)) {
      const bestKey = `${sample.sfen}|*`;
      if (!referenceCache.has(bestKey)) {
        const best = await search(engine, sample.sfen, { nodes: REFERENCE_NODES, multiPv: 1 });
        referenceCache.set(bestKey, comparableScore(best.candidates.find(({ rank }) => rank === 1)?.score));
      }
      const result = await search(engine, sample.sfen, { nodes: REFERENCE_NODES, multiPv: 1, searchMoves: [move] });
      referenceCache.set(key, comparableScore(result.candidates.find(({ rank }) => rank === 1)?.score));
    }
    const best = referenceCache.get(`${sample.sfen}|*`);
    const value = referenceCache.get(key);
    if (best === undefined || value === undefined) return 0;
    return Math.min(LOSS_CAP, Math.max(0, best - value));
  };

  const report = { seed, trials, referenceNodes: REFERENCE_NODES, samples: samples.length, levels: [], examples: [] };
  for (const level of levels) {
    const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === level)?.value;
    if (!preset) continue;
    const row = { level, preset };
    {
      const losses = [];
      const times = [];
      let low = 0;
      let oversight = 0;
      let unread = 0;
      for (const sample of samples) {
        const position = Position.newBySFEN(sample.sfen);
        const moves = legalMoves(position);
        const naturalness = createNaturalnessEvaluator(sample.sfen, { moveHistory: sample.history });
        for (let trial = 0; trial < trials; trial += 1) {
          const started = performance.now();
          const choice = await currentChoose(engine, preset, sample, moves, random);
          times.push(performance.now() - started);
          const evaluation = naturalness(choice.move);
          if (evaluation.weight < LOW_NATURALNESS_THRESHOLD) low += 1;
          if (choice.kind === "oversight") oversight += 1;
          if (choice.kind === "natural") unread += 1;
          losses.push(await reference(sample, choice.move));
          if ([1, 5].includes(level) && trial === 0 && samples.indexOf(sample) % 6 === 2) {
            report.examples.push({
              level, sample: sample.label, sfen: sample.sfen, move: choice.move,
              kind: choice.kind, naturalness: Number(evaluation.weight.toFixed(2)), tags: evaluation.tags,
              loss: losses.at(-1),
            });
          }
        }
      }
      const sorted = [...losses].sort((a, b) => a - b);
      const sortedTimes = [...times].sort((a, b) => a - b);
      const mean = losses.reduce((sum, value) => sum + value, 0) / losses.length;
      const variance = losses.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, losses.length - 1);
      Object.assign(row, {
        meanLoss: Math.round(mean),
        meanLossSe: Math.round(Math.sqrt(variance / losses.length)),
        medianLoss: percentile(sorted, 0.5),
        p90Loss: percentile(sorted, 0.9),
        blunder300: Number((losses.filter((value) => value >= 300).length / losses.length).toFixed(3)),
        blunder1000: Number((losses.filter((value) => value >= 1000).length / losses.length).toFixed(3)),
        lowNaturalness: Number((low / losses.length).toFixed(3)),
        oversight: Number((oversight / losses.length).toFixed(3)),
        unread: Number((unread / losses.length).toFixed(3)),
        meanMs: Math.round(times.reduce((sum, value) => sum + value, 0) / times.length),
        p95Ms: Math.round(percentile(sortedTimes, 0.95)),
        maxMs: Math.round(sortedTimes.at(-1)),
      });
    }
    report.levels.push(row);
    console.error(`Lv${level} 完了`);
  }
  engine.quit();

  const lines = [
    `サンプル${samples.length}局面 × ${trials}回、基準探索${REFERENCE_NODES}nodes、seed=${seed}`,
    "",
    "| Lv | 平均損失(±標準誤差) | 中央値 | 90%点 | 300以上 | 1000以上 | 不自然 | 読まない手 | 見落とし | 平均ms | 95%ms | 最大ms |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  for (const row of report.levels) {
    const m = row;
    lines.push(`| ${row.level} | ${m.meanLoss} ±${m.meanLossSe} | ${m.medianLoss} | ${m.p90Loss} | ${pct(m.blunder300)} | ${pct(m.blunder1000)} | ${pct(m.lowNaturalness)} | ${pct(m.unread)} | ${pct(m.oversight)} | ${m.meanMs} | ${m.p95Ms} | ${m.maxMs} |`);
  }
  lines.push("", "代表例:");
  for (const example of report.examples) {
    lines.push(`- Lv${example.level} ${example.sample}: ${example.move} (${example.kind}, 自然さ${example.naturalness}, 損失${example.loss}, ${example.tags.join("/") || "-"})`);
  }
  console.log(lines.join("\n"));
  if (outPath) fs.writeFileSync(path.resolve(projectRoot, outPath), JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
