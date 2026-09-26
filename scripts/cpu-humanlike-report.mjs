// CPU着手選択の改修前後を、同じWASMエンジンと同じ局面で比較する開発用スクリプト。
// 使い方: node scripts/cpu-humanlike-report.mjs [--games 6] [--trials 6] [--levels 0,1,2,5,10,14] [--out report.json]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Position, Square, handPieceTypes } from "tsshogi";
import { ShogiEngine } from "../src/core/engine.js";
import { chooseCpuMove } from "../src/core/cpu-move-choice.mjs";
import { comparableScore, selectMoveByRank } from "../src/core/move-selection.mjs";
import { createNaturalnessEvaluator, LOW_NATURALNESS_THRESHOLD } from "../src/core/move-naturalness.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from "../src/core/strength-settings.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STANDARD_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
const REFERENCE_NODES = 30000;
const LOSS_CAP = 3000;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const trials = Number(option("trials", "6"));
const games = Number(option("games", "6"));
const levels = option("levels", "0,1,2,3,4,5,7,10,14,17,20").split(",").map(Number);
const outPath = option("out", "");
const seed = Number(option("seed", "20260926"));

function seededRandom(initial) {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 改修前(2026-09-26時点のmain)の設定と選択処理を比較用に複製する。
const LEGACY_SETTINGS = new Map([
  [1000, { nodes: 0, multiPv: 1, moveRank: { min: 1, max: 1 }, maxScoreLoss: 0, bestMoveRate: 0, randomLegalRate: 1, randomFallback: true }],
  [2000, { nodes: 100, multiPv: 24, moveRank: { min: 12, max: 24 }, maxScoreLoss: 8000, scoreTemperature: 5000, bestMoveRate: 0.01, randomLegalRate: 0.90, randomFallback: true }],
  [3000, { nodes: 180, multiPv: 22, moveRank: { min: 10, max: 22 }, maxScoreLoss: 7000, scoreTemperature: 4500, bestMoveRate: 0.01, randomLegalRate: 0.75, randomFallback: true }],
  [4000, { nodes: 280, multiPv: 20, moveRank: { min: 9, max: 20 }, maxScoreLoss: 6000, scoreTemperature: 4000, bestMoveRate: 0.02, randomLegalRate: 0.55, randomFallback: true }],
  [4500, { nodes: 400, multiPv: 18, moveRank: { min: 8, max: 18 }, maxScoreLoss: 5000, scoreTemperature: 3200, bestMoveRate: 0.02, randomLegalRate: 0.30, randomFallback: true }],
  [5000, { nodes: 500, multiPv: 16, moveRank: { min: 8, max: 16 }, maxScoreLoss: 3600, scoreTemperature: 2600, bestMoveRate: 0.03, randomFallback: true }],
  [6000, { nodes: 650, multiPv: 16, moveRank: { min: 7, max: 16 }, maxScoreLoss: 3300, scoreTemperature: 2400, bestMoveRate: 0.05 }],
  [7000, { nodes: 850, multiPv: 16, moveRank: { min: 6, max: 16 }, maxScoreLoss: 3000, scoreTemperature: 2200, bestMoveRate: 0.08 }],
  [8000, { nodes: 1100, multiPv: 15, moveRank: { min: 6, max: 15 }, maxScoreLoss: 2700, scoreTemperature: 1900, bestMoveRate: 0.12 }],
  [10000, { nodes: 1500, multiPv: 14, moveRank: { min: 5, max: 14 }, maxScoreLoss: 2400, scoreTemperature: 1600, bestMoveRate: 0.16 }],
  [12000, { nodes: 2000, multiPv: 14, moveRank: { min: 5, max: 14 }, maxScoreLoss: 2100, scoreTemperature: 1400, bestMoveRate: 0.20 }],
  [15000, { nodes: 2800, multiPv: 13, moveRank: { min: 4, max: 13 }, maxScoreLoss: 1800, scoreTemperature: 1200, bestMoveRate: 0.25 }],
  [20000, { nodes: 4000, multiPv: 12, moveRank: { min: 3, max: 12 }, maxScoreLoss: 1500, scoreTemperature: 950, bestMoveRate: 0.30 }],
  [25000, { nodes: 5500, multiPv: 11, moveRank: { min: 3, max: 11 }, maxScoreLoss: 1250, scoreTemperature: 800, bestMoveRate: 0.35 }],
  [30000, { nodes: 8000, multiPv: 9, moveRank: { min: 2, max: 9 }, maxScoreLoss: 900, scoreTemperature: 650, bestMoveRate: 0.42 }],
  [60000, { nodes: 11000, multiPv: 8, moveRank: { min: 2, max: 8 }, maxScoreLoss: 800, scoreTemperature: 520, bestMoveRate: 0.50 }],
  [70000, { nodes: 15000, multiPv: 8, moveRank: { min: 2, max: 8 }, maxScoreLoss: 700, scoreTemperature: 440, bestMoveRate: 0.58 }],
  [80000, { nodes: 22000, multiPv: 7, moveRank: { min: 2, max: 7 }, maxScoreLoss: 600, scoreTemperature: 360, bestMoveRate: 0.66 }],
  [100000, { nodes: 32000, multiPv: 6, moveRank: { min: 2, max: 6 }, maxScoreLoss: 500, scoreTemperature: 280, bestMoveRate: 0.74 }],
  [150000, { nodes: 45000, multiPv: 5, moveRank: { min: 2, max: 5 }, maxScoreLoss: 420, scoreTemperature: 220, bestMoveRate: 0.82 }],
  [200000, { nodes: 65000, multiPv: 5, moveRank: { min: 2, max: 5 }, maxScoreLoss: 350, scoreTemperature: 170, bestMoveRate: 0.88 }],
]);

function legalMoves(position) {
  const moves = new Set();
  const add = (move) => {
    if (move && position.isValidMove(move)) moves.add(move.usi);
  };
  for (const from of position.board.listNonEmptySquares()) {
    if (position.board.at(from)?.color !== position.color) continue;
    for (const to of Square.all) {
      const move = position.createMove(from, to);
      add(move);
      add(move?.withPromote() ?? null);
    }
  }
  for (const pieceType of handPieceTypes) {
    if (position.hand(position.color).count(pieceType) < 1) continue;
    for (const to of Square.all) add(position.createMove(pieceType, to));
  }
  return [...moves];
}

/** Emscriptenのブラウザ向け資産読込をNodeで動かすため、一時ディレクトリへ補正版を置く。 */
async function createNodeEngine() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shogi-match-engine-"));
  for (const file of ["yaneuraou.wasm", "yaneuraou.data", "yaneuraou.worker.js"]) {
    fs.copyFileSync(path.join(projectRoot, "vendor", file), path.join(dir, file));
  }
  const source = fs.readFileSync(path.join(projectRoot, "vendor", "yaneuraou.js"), "utf8");
  const hook = "u=A.getPreloadedPackage?A.getPreloadedPackage(f,g):null";
  if (!source.includes(hook)) throw new Error("エンジンローダーの形式が想定と異なります");
  const dataPath = JSON.stringify(path.join(dir, "yaneuraou.data"));
  const prefix = "globalThis.location=globalThis.location||{pathname:\"/engine/\",href:\"file:///engine/\"};"
    + `globalThis.__shogiMatchPreload=function(){var b=require("fs").readFileSync(${dataPath});`
    + "return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};\n";
  fs.writeFileSync(path.join(dir, "yaneuraou.js"), prefix + source.replace(
    hook,
    "u=(A.getPreloadedPackage||globalThis.__shogiMatchPreload)?(A.getPreloadedPackage||globalThis.__shogiMatchPreload)(f,g):null",
  ));
  const require = createRequire(pathToFileURL(path.join(dir, "package.json")));
  const YaneuraOu = require(path.join(dir, "yaneuraou.js"));
  const wasmBinary = fs.readFileSync(path.join(dir, "yaneuraou.wasm"));
  const engine = new ShogiEngine({
    factory: (options = {}) => YaneuraOu({
      ...options,
      wasmBinary,
      locateFile: (file) => path.join(dir, file),
    }),
  });
  await engine.init();
  await engine.ready();
  engine.newGame();
  return engine;
}

async function search(engine, sfen, { nodes, multiPv, searchMoves }) {
  engine.applyStrengthOptions({ multiPv });
  engine.setPosition(sfen);
  return engine.go({ nodes, maxTimeMs: 20000, ...(searchMoves ? { searchMoves } : {}) });
}

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

function uniformMove(moves, random) {
  return moves[Math.floor(random() * moves.length)];
}

async function legacyChoose(engine, preset, sample, moves, random) {
  const settings = LEGACY_SETTINGS.get(preset);
  if (preset === 1000 || random() < (settings.randomLegalRate ?? 0)) {
    return { move: uniformMove(moves, random), kind: "uniform" };
  }
  const result = await search(engine, sample.sfen, settings);
  const selection = selectMoveByRank(result, settings.moveRank, random, {
    maxScoreLoss: settings.maxScoreLoss,
    scoreTemperature: settings.scoreTemperature,
    bestMoveRate: settings.bestMoveRate,
    fallbackMove: settings.randomFallback ? uniformMove(moves, random) : undefined,
  });
  return { move: selection.move, kind: selection.rank === 0 ? "uniform" : "rank" };
}

async function currentChoose(engine, preset, sample, moves, random) {
  const strength = getStrengthSearchSettings(preset);
  const result = preset === 1000 ? undefined : await search(engine, sample.sfen, strength);
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
    if (!preset || !LEGACY_SETTINGS.has(preset)) continue;
    const row = { level, preset };
    for (const variant of ["before", "after"]) {
      const losses = [];
      const times = [];
      let low = 0;
      let oversight = 0;
      for (const sample of samples) {
        const position = Position.newBySFEN(sample.sfen);
        const moves = legalMoves(position);
        const naturalness = createNaturalnessEvaluator(sample.sfen, { moveHistory: sample.history });
        for (let trial = 0; trial < trials; trial += 1) {
          const started = performance.now();
          const choice = variant === "before"
            ? await legacyChoose(engine, preset, sample, moves, random)
            : await currentChoose(engine, preset, sample, moves, random);
          times.push(performance.now() - started);
          const evaluation = naturalness(choice.move);
          if (evaluation.weight < LOW_NATURALNESS_THRESHOLD) low += 1;
          if (choice.kind === "oversight") oversight += 1;
          losses.push(await reference(sample, choice.move));
          if ([1, 5].includes(level) && trial === 0 && samples.indexOf(sample) % 6 === 2) {
            report.examples.push({
              level, variant, sample: sample.label, sfen: sample.sfen, move: choice.move,
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
      row[variant] = {
        meanLoss: Math.round(mean),
        meanLossSe: Math.round(Math.sqrt(variance / losses.length)),
        medianLoss: percentile(sorted, 0.5),
        p90Loss: percentile(sorted, 0.9),
        blunder300: Number((losses.filter((value) => value >= 300).length / losses.length).toFixed(3)),
        blunder1000: Number((losses.filter((value) => value >= 1000).length / losses.length).toFixed(3)),
        lowNaturalness: Number((low / losses.length).toFixed(3)),
        oversight: Number((oversight / losses.length).toFixed(3)),
        meanMs: Math.round(times.reduce((sum, value) => sum + value, 0) / times.length),
        p95Ms: Math.round(percentile(sortedTimes, 0.95)),
        maxMs: Math.round(sortedTimes.at(-1)),
      };
    }
    report.levels.push(row);
    console.error(`Lv${level} 完了`);
  }
  engine.quit();

  const lines = [
    `サンプル${samples.length}局面 × ${trials}回、基準探索${REFERENCE_NODES}nodes、seed=${seed}`,
    "",
    "| Lv | 版 | 平均損失(±標準誤差) | 中央値 | 90%点 | 300以上 | 1000以上 | 不自然 | 見落とし | 平均ms | 95%ms | 最大ms |",
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  for (const row of report.levels) {
    for (const variant of ["before", "after"]) {
      const m = row[variant];
      lines.push(`| ${row.level} | ${variant === "before" ? "改修前" : "改修後"} | ${m.meanLoss} ±${m.meanLossSe} | ${m.medianLoss} | ${m.p90Loss} | ${pct(m.blunder300)} | ${pct(m.blunder1000)} | ${pct(m.lowNaturalness)} | ${pct(m.oversight)} | ${m.meanMs} | ${m.p95Ms} | ${m.maxMs} |`);
    }
  }
  lines.push("", "代表例:");
  for (const example of report.examples) {
    lines.push(`- Lv${example.level} ${example.variant === "before" ? "改修前" : "改修後"} ${example.sample}: ${example.move} (${example.kind}, 自然さ${example.naturalness}, 損失${example.loss}, ${example.tags.join("/") || "-"})`);
  }
  console.log(lines.join("\n"));
  if (outPath) fs.writeFileSync(path.resolve(projectRoot, outPath), JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
