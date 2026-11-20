// 戦型の判定の監査(docs/formation-detect-design.mdの9章)。
// 棋譜を1手ずつ判定して、名前ごとの出た局の数・はじめて出た手数・同じ局での矛盾を出す。
// 使い方:
//   node scripts/formation-audit.mjs [--logic 20] [--seed 7] [--baseline <前の版のformation-tracker.mjs>]
//     棋譜は、図鑑の代表局と棋譜解析のベンチマークの自動対局(scripts/lib/kifu-benchmark-games.mjs)と、
//     ロジックAI(Lv6〜10)どうしの対局を--logic局。エンジンを使わないので速い。
//     --baselineを渡すと、前の版(git show <コミット>:src/core/formation-tracker.mjs で取り出し、importを絶対パスに直したもの)と
//     1局ずつ比べ、前の版だけ・今の版だけに出た名前を数える(前の版は、毎手の名前を1局ぶん合わせたもの)。
//     --trace <名前> で、前の版でその名前が出た局面と今の版の判定を並べる(--baselineなしなら、今の版でその名前がはじめて付いた局面)。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import "./lib/ts-register.mjs";
import { Position } from "tsshogi";
import { STANDARD_SFEN, legalMoves, projectRoot, seededRandom } from "./lib/node-engine.mjs";
import { benchmarkGames } from "./lib/kifu-benchmark-games.mjs";
import {
  createFormationState,
  detectFormationSnapshot,
  formationMove,
  formedNamesFromState,
  updateFormationState,
} from "../src/core/formation-tracker.mjs";
import { formationMeta } from "../src/core/formation-catalog.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const logicGames = Number(option("logic", "20"));
const random = seededRandom(Number(option("seed", "7")));
const baselinePath = option("baseline", "");
// --trace <名前>: 前の版でその名前が出た局面と、今の版の判定を並べる(--baselineと一緒に使う)。
const trace = option("trace", "");
const baseline = baselinePath ? await import(pathToFileURL(path.resolve(baselinePath)).href) : null;
const master = JSON.parse(fs.readFileSync(path.join(projectRoot, "src/data/hiragana_suisho_formations.json"), "utf8"));

/** ロジックAIどうしの対局(局面の列)。 */
async function logicCorpus(count) {
  if (!count) return [];
  const { chooseLogicMove } = await import("../src/core/logic-ai.mjs");
  const games = [];
  for (let game = 0; game < count; game += 1) {
    const levels = [6 + (game % 5), 10 - (game % 5)];
    const position = Position.newBySFEN(STANDARD_SFEN);
    const steps = [{ sfen: position.sfen, lastMove: "" }];
    const history = [];
    for (let ply = 0; ply < 160; ply += 1) {
      const moves = legalMoves(position);
      if (!moves.length) break;
      const level = levels[ply % 2];
      const choice = chooseLogicMove({ sfen: position.sfen, legalMoves: moves, level, moveHistory: history, random, maxTimeMs: 300 });
      position.doMove(position.createMoveByUSI(choice.move));
      history.push(choice.move);
      steps.push({ sfen: position.sfen, lastMove: choice.move });
    }
    games.push({ id: `logic-${game + 1}`, steps });
  }
  return games;
}

const corpus = [...benchmarkGames(), ...(await logicCorpus(logicGames))];
const byName = new Map();
const diffs = { onlyOld: new Map(), onlyNew: new Map() };
const conflicts = [];
const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

for (const game of corpus) {
  let state = createFormationState();
  let old = baseline ? baseline.createFormationState() : null;
  const oldNames = { black: new Set(), white: new Set() };
  const first = { black: new Map(), white: new Map() };
  game.steps.forEach(({ sfen }, ply) => {
    state = updateFormationState(state, detectFormationSnapshot(sfen, master), formationMove(sfen, ply));
    for (const color of ["black", "white"]) {
      for (const name of formedNamesFromState(state, color)) {
        if (first[color].has(name)) continue;
        first[color].set(name, ply);
        // --baselineなしの--trace: 今の版でその名前がはじめて付いた局面。
        if (trace && !baseline && name === trace) console.log(`[${trace}] ${game.id} ${ply}手 ${color} ${sfen}`);
      }
    }
    if (baseline) {
      const oldSnapshot = baseline.detectFormationSnapshot(sfen, master);
      if (trace) {
        for (const color of ["black", "white"]) {
          if (oldSnapshot[color].castle === trace || oldSnapshot[color].tactics.includes(trace)) {
            console.log(`[${trace}] ${game.id} ${ply}手 ${color} 今の版の囲い:${state[color].castle || "なし"} 戦法:${state[color].tactics.join("・") || "なし"} ${sfen}`);
          }
        }
      }
      old = baseline.updateFormationState(old, oldSnapshot);
      for (const color of ["black", "white"]) for (const name of baseline.formationNamesFromState(old, color)) oldNames[color].add(name);
    }
  });
  for (const color of ["black", "white"]) {
    for (const [name, ply] of first[color]) {
      const entry = byName.get(name) ?? { games: 0, plies: [] };
      entry.games += 1;
      entry.plies.push(ply);
      byName.set(name, entry);
    }
    const names = [...first[color].keys()];
    const ranging = names.some((name) => /振り飛車|四間|三間|中飛車|向かい飛車|石田/.test(name) && !/対|居飛車/.test(name));
    const staticCastle = names.some((name) => formationMeta(name)?.rook === "static" && formationMeta(name)?.kind === "castle");
    const rangingCastle = names.some((name) => formationMeta(name)?.rook === "ranging" && formationMeta(name)?.kind === "castle");
    if (staticCastle && rangingCastle && ranging) conflicts.push(`${game.id} ${color}: ${names.join("・")}`);
    if (baseline) {
      for (const name of oldNames[color]) if (!first[color].has(name)) bump(diffs.onlyOld, name);
      for (const name of first[color].keys()) if (!oldNames[color].has(name)) bump(diffs.onlyNew, name);
    }
  }
}

const sides = corpus.length * 2;
console.log(`棋譜 ${corpus.length}局(${sides}の側)`);
console.log("\n名前ごと(出た側の数・はじめて出た手数の中央と最大):");
const rows = [...byName].sort((a, b) => b[1].games - a[1].games);
for (const [name, { games, plies }] of rows) {
  const sorted = [...plies].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const flag = games > sides / 2 ? " ←出すぎ" : "";
  console.log(`  ${name}\t${games}\t中央${median}手\t最大${sorted.at(-1)}手${flag}`);
}
if (conflicts.length) console.log(`\n居飛車の囲いと振り飛車の囲い・戦法が同じ側に出た局(${conflicts.length}):\n  ${conflicts.join("\n  ")}`);
if (baseline) {
  const list = (map) => [...map].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name}(${count})`).join("、") || "なし";
  console.log(`\n前の版だけに出た名前: ${list(diffs.onlyOld)}`);
  console.log(`今の版だけに出た名前: ${list(diffs.onlyNew)}`);
}
