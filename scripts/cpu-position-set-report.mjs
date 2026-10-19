// node --import ./scripts/lib/ts-register.mjs scripts/cpu-position-set-report.mjs --logic --runs 200
import fs from "node:fs";
import { Position } from "tsshogi";
import { cpuPositionVariants } from "../src/core/cpu-position-set.mjs";
import "./lib/ts-register.mjs";
const { chooseLogicMove } = await import("../src/core/logic-ai.mjs");
import { createNaturalnessEvaluator } from "../src/core/move-naturalness.mjs";
import { mirrorUsiMove } from "../src/core/opening-guide.mjs";
import { legalMoves, seededRandom } from "./lib/node-engine.mjs";

const option = (key, fallback) => {
  const index = process.argv.indexOf(`--${key}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const runs = Number(option("runs", "200"));
const levels = option("levels", "1,2,3,5,8,10").split(",").map(Number);
const rows = [];
for (const fixture of cpuPositionVariants()) {
  const moves = legalMoves(Position.newBySFEN(fixture.sfen));
  const evaluate = createNaturalnessEvaluator(fixture.sfen, { moveHistory: fixture.moveHistory });
  const evaluations = new Map(moves.map((usi) => [usi, evaluate(usi)]));
  for (const level of levels) {
    const row = { id: fixture.id, mirrored: fixture.mirrored, level, runs, aimless: 0, idlePawnDrop: 0, escape: 0, response: 0, take: 0, attack: 0, policies: 0, meanMs: 0, maxMs: 0, moves: {} };
    for (let seed = 1; seed <= runs; seed += 1) {
      const started = performance.now();
      const choice = chooseLogicMove({ sfen: fixture.sfen, legalMoves: moves, moveHistory: fixture.moveHistory, level, random: seededRandom(seed) });
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
    console.error(`${row.id} ${row.mirrored ? "mirror" : "original"} Lv${level}: aimless ${row.aimless}/${runs}, response ${row.response}/${runs}, ${row.meanMs.toFixed(1)}ms (max ${row.maxMs.toFixed(1)})`);
  }
}
const output = JSON.stringify({ date: "2026-10-19", runs, rows }, null, 2);
const out = option("out", "");
if (out) fs.writeFileSync(out, output + "\n");
else console.log(output);
