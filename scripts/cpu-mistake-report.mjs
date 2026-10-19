// CPUの着手を深い読みで採点し、大きな損の手を「見える深さ」で分ける開発用スクリプト。
// 設計はdocs/cpu-human-model-design.mdの2章と5章。
// - A級: 取りの読み2手(取って取り返す)で、最善手より300以上駒を損する(駒を取られる)か、取れる駒を逃す。1手詰めを許す・逃す。
// - B級: 取りの読み4手で見える駒損、3手詰めを許す・逃す。
// - C級: それ以外(深い筋・形の判断)。
// 審判の評価は、最善手と選んだ手を同じ探索で比べ、別々の探索の揺れを避ける。互角に近い局面(最善の評価値の絶対値が1500未満)だけを数える。
// 使い方: node scripts/cpu-mistake-report.mjs [--levels 11,20,30] [--legacy] [--low-nodes 200,1000] [--games 8] [--trials 3] [--ref 80000] [--out x.json]
import fs from "node:fs";
import path from "node:path";
import "./lib/ts-register.mjs";
import { Position } from "tsshogi";
import { chooseLegacyCpuMove } from "./lib/legacy-cpu-move-choice.mjs";
import { comparableScore } from "../src/core/move-selection.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings, searchSettingsForSkill } from "../src/core/strength-settings.mjs";
import { material, playLight, replyLoss, stateFromSfen } from "../src/core/logic-position.mjs";
import { STANDARD_SFEN, createNodeEngine, legalMoves, projectRoot, search, seededRandom } from "./lib/node-engine.mjs";
const { chooseAwareMove } = await import("../src/core/aware-move-choice.mjs");
const { chooseLogicMove, usesLogicAi } = await import("../src/core/logic-ai.mjs");
const { findMateLine } = await import("../src/core/problem-solver.ts");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const games = Number(option("games", "8"));
const trials = Number(option("trials", "3"));
const levels = option("levels", "11,15,20,25,30").split(",").filter(Boolean).map(Number);
const lowNodes = option("low-nodes", "").split(",").filter(Boolean).map(Number);
const referenceNodes = Number(option("ref", "80000"));
const outPath = option("out", "");
const seed = Number(option("seed", "20261019"));
const legacy = process.argv.includes("--legacy");
const BLUNDER = 300;
const RUIN = 800;
const BALANCED = 1500;

/** 中程度の強さの自己対局から、序盤〜終盤の局面を集める。 */
async function samplePositions(engine, random) {
  const samples = [];
  for (let game = 0; game < games; game += 1) {
    const position = Position.newBySFEN(STANDARD_SFEN);
    const history = [];
    for (let ply = 0; ply < 80; ply += 1) {
      if (ply >= 10 && (ply - 10) % 8 === 0) samples.push({ sfen: position.sfen, history: [...history], label: `g${game + 1}-p${ply}` });
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

function childSfen(sfen, usi) {
  const position = Position.newBySFEN(sfen);
  const move = position.createMoveByUSI(usi);
  if (!move || !position.doMove(move)) return null;
  return position.sfen;
}

/** 手を指したあと、相手の取りの読み(depth手)を受けた、自分の駒の損得。 */
function netAfter(state, usi, depth) {
  const child = playLight(state, usi);
  return child ? material(child, state.turn) - replyLoss(child, depth) : -Infinity;
}

const mate = (sfen, plies) => (sfen ? findMateLine(sfen, plies, { nodeLimit: plies > 1 ? 20000 : 4000, maxTimeMs: plies > 1 ? 400 : 200 }) : null);

/** 大きな損の手の種類。 */
function classify(sfen, move, best) {
  const state = stateFromSfen(sfen);
  const tags = [];
  const own1 = mate(sfen, 1);
  const own3 = own1 ? null : mate(sfen, 3);
  if (own1 && own1[0] !== move) tags.push("A:逃した1手詰め");
  if (own3 && own3[0] !== move) tags.push("B:逃した3手詰め");
  const child = childSfen(sfen, move);
  const bestChild = childSfen(sfen, best);
  if (mate(child, 1) && !mate(bestChild, 1)) tags.push("A:1手詰めを許す");
  else if (mate(child, 3) && !mate(bestChild, 3)) tags.push("B:3手詰めを許す");
  const now = material(state, state.turn);
  const after2 = netAfter(state, move, 2);
  const best2 = netAfter(state, best, 2);
  if (best2 - after2 >= BLUNDER) tags.push(now - after2 >= BLUNDER ? "A:駒を取られる" : "A:取れる駒を逃す");
  else if (netAfter(state, best, 4) - netAfter(state, move, 4) >= BLUNDER) tags.push("B:取り合いの損");
  const kind = tags.some((tag) => tag.startsWith("A:")) ? "A" : tags.some((tag) => tag.startsWith("B:")) ? "B" : "C";
  return { kind, tags };
}

function summarize(allRows) {
  const rows = allRows.filter(({ bestValue }) => bestValue !== undefined && Math.abs(bestValue) < BALANCED);
  const n = rows.length;
  const pct = (count) => Math.round(1000 * count / Math.max(1, n)) / 10;
  const count = (test) => rows.filter(test).length;
  const has = (row, tag) => row.tags.includes(tag);
  return {
    n,
    meanLossCap1000: Math.round(rows.reduce((sum, { loss }) => sum + Math.min(1000, loss), 0) / Math.max(1, n)),
    small: pct(count(({ loss }) => loss >= 100 && loss < BLUNDER)),
    blunder: pct(count(({ loss }) => loss >= BLUNDER)),
    ruin: pct(count(({ loss }) => loss >= RUIN)),
    hang: pct(count((row) => row.loss >= BLUNDER && has(row, "A:駒を取られる"))),
    hangRuin: pct(count((row) => row.loss >= RUIN && has(row, "A:駒を取られる"))),
    missedGain: pct(count((row) => row.loss >= BLUNDER && has(row, "A:取れる駒を逃す"))),
    mateA: pct(count((row) => row.loss >= BLUNDER && row.tags.some((tag) => tag.startsWith("A:") && tag.includes("詰め")))),
    classB: pct(count((row) => row.loss >= BLUNDER && row.kind === "B")),
    ruinC: pct(count((row) => row.loss >= RUIN && row.kind === "C")),
  };
}

async function main() {
  const engine = await createNodeEngine();
  const referenceEngine = await createNodeEngine();
  const random = seededRandom(seed);
  console.error("サンプル局面を生成中...");
  const samples = await samplePositions(referenceEngine, random);
  const cache = new Map();
  const reference = async (sample, move) => {
    if (!cache.has(sample.sfen)) {
      const best = await search(referenceEngine, sample.sfen, { nodes: referenceNodes, multiPv: 1 });
      cache.set(sample.sfen, { best: best.move, value: comparableScore(best.candidates.find(({ rank }) => rank === 1)?.score), losses: new Map() });
    }
    const entry = cache.get(sample.sfen);
    if (move === entry.best) return { best: entry.best, bestValue: entry.value, loss: 0 };
    if (!entry.losses.has(move)) {
      const result = await search(referenceEngine, sample.sfen, { nodes: referenceNodes, multiPv: 2, searchMoves: [entry.best, move] });
      const of = (usi) => comparableScore(result.candidates.find((candidate) => candidate.move === usi)?.score);
      const best = of(entry.best);
      const value = of(move);
      entry.losses.set(move, best === undefined || value === undefined ? 0 : Math.min(3000, Math.max(0, best - value)));
    }
    return { best: entry.best, bestValue: entry.value, loss: entry.losses.get(move) };
  };
  const scored = async (sample, move) => {
    const ref = await reference(sample, move);
    const kind = ref.loss >= BLUNDER ? classify(sample.sfen, move, ref.best) : { kind: null, tags: [] };
    return { sample: sample.label, move, best: ref.best, bestValue: ref.bestValue, loss: ref.loss, ...kind };
  };
  const report = { legacy, seed, games, trials, referenceNodes, samples: samples.length, lowNodes: [], levels: [] };
  for (const nodes of lowNodes) {
    const rows = [];
    for (const sample of samples) {
      engine.newGame();
      await engine.ready();
      rows.push(await scored(sample, (await search(engine, sample.sfen, { nodes, multiPv: 1 })).move));
    }
    report.lowNodes.push({ nodes, ...summarize(rows), rows });
    console.error(`探索量${nodes}の最善手 完了`);
  }
  for (const level of levels) {
    const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === level);
    if (!preset) continue;
    const strength = legacy ? { ...searchSettingsForSkill(preset.skill), level } : { ...getStrengthSearchSettings(preset.value), level };
    const rows = [];
    for (const sample of samples) {
      const moves = legalMoves(Position.newBySFEN(sample.sfen));
      for (let trial = 0; trial < trials; trial += 1) {
        engine.newGame();
        await engine.ready();
        const logic = () => chooseLogicMove({ sfen: sample.sfen, legalMoves: moves, moveHistory: sample.history, level: usesLogicAi(level) ? level : 10, random });
        let choice;
        if (usesLogicAi(level)) choice = logic();
        else {
          const result = await search(engine, sample.sfen, strength);
          choice = await (legacy ? chooseLegacyCpuMove : chooseAwareMove)({
            strength, sfen: sample.sfen, legalMoves: moves, moveHistory: sample.history, search: result,
            verify: (searchMoves, nodes) => search(engine, sample.sfen, { nodes, multiPv: searchMoves.length, searchMoves }),
            probe: (line, { nodes, multiPv }) => search(engine, `${sample.sfen} moves ${line.join(" ")}`, { nodes, multiPv }),
            random,
          }) ?? logic();
        }
        rows.push({ ...(await scored(sample, choice.move)), chooser: choice.kind, reason: choice.reason });
      }
    }
    report.levels.push({ level, ...summarize(rows), rows });
    console.error(`Lv${level} 完了`);
  }
  engine.quit();
  referenceEngine.quit();
  const lines = [
    `${legacy ? "旧CPU" : "現在のCPU"}、サンプル${samples.length}局面 × ${trials}回、審判${referenceNodes}nodes、seed=${seed}。互角に近い局面だけを数える。`,
    "",
    "| 対象 | 選択数 | 平均損失 | 100〜300 | 300以上 | 800以上 | 駒を取られる(300以上) | 同(800以上) | 取れる駒を逃す | 詰みのA級 | B級 | C級(800以上) |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const line = (label, row) => `| ${label} | ${row.n} | ${row.meanLossCap1000} | ${row.small}% | ${row.blunder}% | ${row.ruin}% | ${row.hang}% | ${row.hangRuin}% | ${row.missedGain}% | ${row.mateA}% | ${row.classB}% | ${row.ruinC}% |`;
  for (const row of report.lowNodes) lines.push(line(`探索量${row.nodes}の最善手`, row));
  for (const row of report.levels) lines.push(line(`Lv${row.level}`, row));
  console.log(lines.join("\n"));
  if (outPath) fs.writeFileSync(path.resolve(projectRoot, outPath), JSON.stringify(report, null, 2));
  process.exit(0);
}

await main();
