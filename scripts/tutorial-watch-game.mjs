// 将棋教室の観戦レッスン用に、実力者（先手）と初心者（後手）の対局をCPU同士で作る開発用スクリプト。
// 使い方:
//   node scripts/tutorial-watch-game.mjs --prefix 7g7f,3c3d,... --weak-level 12 --seed 14 [--out game.json]
//   prefixの手を指したあと、先手はエンジンの最善手、後手はweak-levelの強さ設定で指し継ぐ。
//   各手の評価値（先手から見た値）と最善手を表示するので、解説を付ける場面選びに使う。
import fs from "node:fs";
import { Position } from "tsshogi";
import { chooseCpuMove } from "../src/core/cpu-move-choice.mjs";
import { comparableScore } from "../src/core/move-selection.mjs";
import { formatHintMove } from "../src/core/match-assists.mjs";
import { CPU_STRENGTH_PRESETS, searchSettingsForSkill } from "../src/core/strength-settings.mjs";
import { STANDARD_SFEN, createNodeEngine, legalMoves, search, seededRandom } from "./lib/node-engine.mjs";

const MAX_PLY = 200;
const STRONG_NODES = 150000;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const prefix = option("prefix", "").split(",").filter(Boolean);
const preset = CPU_STRENGTH_PRESETS.find(({ level }) => level === Number(option("weak-level", "12")));
if (!preset) throw new Error("存在しないレベルです");
const weak = searchSettingsForSkill(preset.skill);
const out = option("out", "");
const random = seededRandom(Number(option("seed", "1")));
const strongEngine = await createNodeEngine();
const weakEngine = await createNodeEngine();
const position = Position.newBySFEN(STANDARD_SFEN);
const record = [];

for (let ply = 0; ply < MAX_PLY; ply += 1) {
  const sfen = position.sfen;
  const moves = legalMoves(position);
  if (!moves.length) break;
  const black = position.color === "black";
  const analysis = await search(strongEngine, sfen, { nodes: STRONG_NODES, multiPv: 1 });
  const best = analysis.candidates.find(({ rank }) => rank === 1);
  let move = prefix[ply];
  if (!move && black) move = best.move;
  if (!move) {
    const result = weak.nodes > 0 ? await search(weakEngine, sfen, weak) : undefined;
    const choice = await chooseCpuMove({
      strength: weak,
      sfen,
      legalMoves: moves,
      moveHistory: record.map(({ usi }) => usi),
      search: result,
      verify: result
        ? (searchMoves, nodes) => search(weakEngine, sfen, { nodes, multiPv: searchMoves.length, searchMoves })
        : undefined,
      random,
    });
    move = choice.move;
  }
  record.push({
    ply: ply + 1,
    usi: move,
    label: `${black ? "▲" : "△"}${formatHintMove(move, sfen)}`,
    // 評価値は手番側から見た値なので、先手から見た値へそろえる。
    evaluation: (black ? 1 : -1) * (comparableScore(best.score) ?? 0),
    best: best.move === move ? "" : formatHintMove(best.move, sfen),
  });
  const next = position.createMoveByUSI(move);
  if (!next || !position.doMove(next)) throw new Error(`不正な着手です: ${move}`);
}

for (const { ply, label, evaluation, best } of record) {
  console.log(`${ply} ${label} ${evaluation}${best ? ` (最善 ${best})` : ""}`);
}
console.log(record.map(({ usi }) => usi).join(" "));
if (out) fs.writeFileSync(out, JSON.stringify(record, null, 1));
strongEngine.quit();
weakEngine.quit();
process.exit(0);
