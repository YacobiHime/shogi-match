// node --import ./scripts/lib/ts-register.mjs scripts/cpu-position-set-report.mjs --logic --runs 200
import fs from "node:fs";
import { Position } from "tsshogi";
import { cpuPositionVariants } from "../src/core/cpu-position-set.mjs";
import "./lib/ts-register.mjs";
const { chooseLogicMove } = await import("../src/core/logic-ai.mjs");
const { chooseAwareMove } = await import("../src/core/aware-move-choice.mjs");
const { analyzePosition } = await import("../src/core/position-awareness.mjs");
import { chooseLegacyCpuMove as chooseCpuMove } from "./lib/legacy-cpu-move-choice.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings, searchSettingsForSkill } from "../src/core/strength-settings.mjs";
import { purposefulCalibration } from "./lib/purposeful-calibration.mjs";
import { createNaturalnessEvaluator } from "../src/core/move-naturalness.mjs";
import { mirrorUsiMove } from "../src/core/opening-guide.mjs";
import { applyUsiToBoard, attackersOf, guardsSquare, parseSfenState, parseUsiMove } from "../src/core/piece-movement.mjs";
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
  const { board, turn } = parseSfenState(fixture.sfen);
  const captureThreats = analyzePosition(fixture.sfen, { moveHistory: fixture.moveHistory, legalMoves: moves }).threats
    .filter(({ kind }) => kind === "capture");
  // 飛車取りへの直接の応答とは別に、同時に当たっている他の駒への受け・反撃も記録する。
  const answersCaptureThreat = (usi, natural) => {
    const parsed = parseUsiMove(usi);
    const after = applyUsiToBoard(board, usi, turn).board;
    return captureThreats.some(({ square, attackers }) => (parsed.from === square && natural.tags.some((tag) => ["escape", "guard"].includes(tag)))
      || guardsSquare(board, after, square, turn) || attackers.includes(parsed.to)
      || attackers.some((attacker) => attackersOf(after, attacker, turn).length > attackersOf(board, attacker, turn).length));
  };
  const fixtureMove = (usi) => fixture.mirrored ? mirrorUsiMove(usi) : usi;
  const responds = (usi, natural) => {
    if (fixture.id !== "rook-attacked") return natural.tags.some((tag) => ["escape", "guard", "threaten"].includes(tag));
    const rook = fixtureMove("8b");
    const bishop = fixtureMove("5e");
    const after = applyUsiToBoard(board, usi, turn).board;
    return (usi.startsWith(rook) && natural.tags.includes("escape")) || guardsSquare(board, after, rook, turn)
      || attackersOf(after, bishop, turn).length > attackersOf(board, bishop, turn).length;
  };
  for (const level of levels) {
    const modes = level === 0 || level === 40 ? ["legacy"] : level <= 10 ? ["logic"] : process.argv.includes("--compare") ? ["legacy", "hybrid"] : [process.argv.includes("--hybrid") ? "hybrid" : "legacy"];
    const contexts = modes.map((mode) => {
      const base = mode === "legacy" ? searchSettingsForSkill(CPU_STRENGTH_PRESETS[level].skill)
        : getStrengthSearchSettings(CPU_STRENGTH_PRESETS[level].value);
      let strength = { ...base, level, logicHybrid: mode === "hybrid" };
      if (mode === "hybrid" && process.argv.includes("--calibrated")) strength = purposefulCalibration(strength);
      const row = { id: fixture.id, mirrored: fixture.mirrored, level, mode, runs,
        settings: { nodes: strength.nodes, multiPv: strength.multiPv, candidateNodes: strength.candidateNodes,
          scoreTemperature: strength.scoreTemperature, engineBestVisibility: strength.engineBestVisibility,
          trustedEngineRate: strength.trustedEngineRate, shallowReadRate: strength.shallowReadRate,
          shallowTemperature: strength.shallowTemperature, shallowDepth: strength.shallowDepth },
        fallback: 0, aimless: 0, idlePawnDrop: 0, escape: 0, response: 0, captureThreatResponse: 0,
        take: 0, attack: 0, policies: 0, meanMs: 0, maxMs: 0, moves: {} };
      return { mode, strength, row };
    });
    for (let seed = 1; seed <= runs; seed += 1) {
      // 新旧を交互に読み、先に読む側も交代する。同じ負荷・対局初期化後の時間を比べる。
      for (const { mode, strength, row } of seed % 2 ? contexts : [...contexts].reverse()) {
      if (engine) { engine.newGame(); await engine.ready(); }
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
      const natural = evaluations.get(choice.move).purposeful || mode !== "hybrid" ? evaluations.get(choice.move)
        : createNaturalnessEvaluator(fixture.sfen, { moveHistory: fixture.moveHistory, continuations: normal?.candidates ?? [] })(choice.move);
      row.aimless += Number(!natural.purposeful);
      row.idlePawnDrop += Number(choice.move.startsWith("P*") && !natural.purposeful);
      row.escape += Number(natural.tags.includes("escape"));
      row.response += Number(responds(choice.move, natural));
      row.captureThreatResponse += Number(answersCaptureThreat(choice.move, natural));
      if (choice.policy) { row.policies += 1; row[choice.policy] += 1; }
      row.moves[choice.move] = (row.moves[choice.move] ?? 0) + 1;
      }
    }
    for (const { row } of contexts) {
    rows.push(row);
    console.error(`${row.id} ${row.mirrored ? "mirror" : "original"} Lv${level} ${row.mode}: aimless ${row.aimless}/${runs}, response ${row.response}/${runs}, ${row.meanMs.toFixed(1)}ms (max ${row.maxMs.toFixed(1)})`);
    const out = option("out", "");
    if (out) fs.writeFileSync(out, JSON.stringify({ date: "2026-10-19", runs, alternatingModes: true, rows }, null, 2) + "\n");
    }
  }
}
engine?.quit();
const output = JSON.stringify({ date: "2026-10-19", runs, alternatingModes: true, rows }, null, 2);
const out = option("out", "");
if (out) fs.writeFileSync(out, output + "\n");
else console.log(output);
