// node --import ./scripts/lib/ts-register.mjs scripts/cpu-position-set-report.mjs --logic --runs 200
import fs from "node:fs";
import { Position } from "tsshogi";
import { cpuPositionVariants } from "../src/core/cpu-position-set.mjs";
import "./lib/ts-register.mjs";
const { chooseLogicMove } = await import("../src/core/logic-ai.mjs");
const { chooseAwareMove } = await import("../src/core/aware-move-choice.mjs");
import { chooseCpuMove } from "../src/core/cpu-move-choice.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from "../src/core/strength-settings.mjs";
import { purposefulCalibration } from "./lib/purposeful-calibration.mjs";
import { createNaturalnessEvaluator } from "../src/core/move-naturalness.mjs";
import { mirrorUsiMove } from "../src/core/opening-guide.mjs";
import { createNodeEngine, search, legalMoves, seededRandom } from "./lib/node-engine.mjs";

const option = (key, fallback) => {
  const index = process.argv.indexOf(`--${key}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const runs = Number(option("runs", "200"));
const levels = option("levels", process.argv.includes("--logic") ? "1,2,3,5,8,10" : "11,20,30,39").split(",").map(Number);
const engine = levels.some((level) => level > 10) ? await createNodeEngine() : null;
const rows = [];
for (const fixture of cpuPositionVariants().filter((fixture) => (!option("position", "") || fixture.id === option("position", ""))
  && (option("side", "both") === "both" || fixture.mirrored === (option("side", "both") === "mirror")))) {
  const moves = legalMoves(Position.newBySFEN(fixture.sfen));
  const evaluate = createNaturalnessEvaluator(fixture.sfen, { moveHistory: fixture.moveHistory });
  const evaluations = new Map(moves.map((usi) => [usi, evaluate(usi)]));
  for (const level of levels) {
    const modes = level === 0 || level === 40 ? ["legacy"] : level <= 10 ? ["logic"] : process.argv.includes("--compare") ? ["legacy", "hybrid"] : [process.argv.includes("--hybrid") ? "hybrid" : "legacy"];
    for (const mode of modes) {
    const base = getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value);
    let strength = { ...base, level, logicHybrid: mode === "hybrid" };
    if (mode === "hybrid" && process.argv.includes("--calibrated")) strength = purposefulCalibration(strength);
    const row = { id: fixture.id, mirrored: fixture.mirrored, level, mode, runs, fallback: 0, aimless: 0, idlePawnDrop: 0, escape: 0, response: 0, take: 0, attack: 0, policies: 0, meanMs: 0, maxMs: 0, moves: {} };
    for (let seed = 1; seed <= runs; seed += 1) {
      if (engine) engine.newGame();
      const started = performance.now();
      const normal = engine ? await search(engine, fixture.sfen, strength) : undefined;
      const random = seededRandom(seed);
      let choice = mode === "logic" ? chooseLogicMove({ sfen: fixture.sfen, legalMoves: moves, moveHistory: fixture.moveHistory, level, random })
        : await (mode === "hybrid" ? chooseAwareMove : chooseCpuMove)({ sfen: fixture.sfen, legalMoves: moves, moveHistory: fixture.moveHistory, strength, search: normal,
          verify: (searchMoves, nodes) => search(engine, fixture.sfen, { nodes, multiPv: searchMoves.length, searchMoves }),
          probe: (line, options) => search(engine, `${fixture.sfen} moves ${line.join(" ")}`, options), random });
      if (!choice && mode === "hybrid") {
        row.fallback += 1;
        choice = chooseLogicMove({ sfen: fixture.sfen, legalMoves: moves, moveHistory: fixture.moveHistory, level: 10, random });
      }
      if (!choice) throw new Error(`${fixture.id} Lv${level} ${mode}: 手を選べませんでした`);
      const ms = performance.now() - started;
      row.meanMs += ms / runs;
      row.maxMs = Math.max(row.maxMs, ms);
      const natural = evaluations.get(choice.move);
      row.aimless += Number(!natural.purposeful);
      row.idlePawnDrop += Number(choice.move.startsWith("P*") && !natural.purposeful);
      row.escape += Number(natural.tags.includes("escape"));
      const counter = ["3c3d", "6c6d"].map((move) => fixture.mirrored ? mirrorUsiMove(move) : move);
      row.response += Number(natural.tags.includes("escape") || natural.tags.includes("guard") || natural.tags.includes("threaten") || (fixture.id === "rook-attacked" && counter.includes(choice.move)));
      if (choice.policy) { row.policies += 1; row[choice.policy] += 1; }
      row.moves[choice.move] = (row.moves[choice.move] ?? 0) + 1;
    }
    rows.push(row);
    console.error(`${row.id} ${row.mirrored ? "mirror" : "original"} Lv${level} ${mode}: aimless ${row.aimless}/${runs}, response ${row.response}/${runs}, ${row.meanMs.toFixed(1)}ms (max ${row.maxMs.toFixed(1)})`);
    const out = option("out", "");
    if (out) fs.writeFileSync(out, JSON.stringify({ date: "2026-10-19", runs, rows }, null, 2) + "\n");
    }
  }
}
engine?.quit();
const output = JSON.stringify({ date: "2026-10-19", runs, rows }, null, 2);
const out = option("out", "");
if (out) fs.writeFileSync(out, output + "\n");
else console.log(output);
