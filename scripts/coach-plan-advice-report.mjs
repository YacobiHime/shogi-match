// やこび姫の作戦の助言(飛車を振る提案)が、1局に何回出るかを数える開発用スクリプト。
// 図鑑の代表局と低いレベルの自動対局(棋譜解析ベンチマークと同じ棋譜)の平手の局面を、両方の側から見て、
// 対局画面と同じ読み(上位5手・6万局面)と確かめの読み(2手・20万局面)で判定する。設計は docs/coach-plan-advice-design.md。
// 使い方: node scripts/coach-plan-advice-report.mjs [--nodes 60000] [--confirm 200000] [--games 0]
import { benchmarkGames } from "./lib/kifu-benchmark-games.mjs";
import { STANDARD_SFEN, createNodeEngine, search } from "./lib/node-engine.mjs";
import {
  PLAN_SWING_MAX_PLY,
  confirmPlanAdvice,
  planAdvice,
} from "../src/core/coach-plan-advice.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const nodes = Number(option("nodes", "60000"));
const confirmNodes = Number(option("confirm", "200000"));
const limit = Number(option("games", "0"));

const games = benchmarkGames().filter(({ steps }) => steps[0]?.sfen === STANDARD_SFEN);
const engine = await createNodeEngine();
const rows = [];
let proposedTotal = 0;
let confirmedTotal = 0;
for (const game of limit ? games.slice(0, limit) : games) {
  const topics = { black: new Set(), white: new Set() };
  const found = [];
  let proposed = 0;
  for (let ply = 1; ply <= Math.min(PLAN_SWING_MAX_PLY, game.steps.length); ply += 1) {
    const sfen = game.steps[ply - 1].sfen;
    const color = sfen.split(" ")[1] === "w" ? "white" : "black";
    const result = await search(engine, sfen, { nodes, multiPv: 5 });
    const proposal = planAdvice({
      candidates: result.candidates,
      sfen,
      color,
      moveCount: ply - 1,
      advisedTopics: topics[color],
    });
    if (!proposal) continue;
    proposed += 1;
    const deeper = await search(engine, sfen, { nodes: confirmNodes, multiPv: 2, searchMoves: [proposal.swingMove, proposal.otherMove] });
    const advice = confirmPlanAdvice(proposal, deeper.candidates);
    if (!advice) continue;
    topics[color].add(advice.topic);
    found.push(`${ply - 1}手目 ${color === "black" ? "先手" : "後手"} ${advice.swing.label} ${advice.swingMove}(${advice.swingScore.value}) / ${advice.otherMove}(${advice.otherScore?.value})`);
  }
  proposedTotal += proposed;
  confirmedTotal += found.length;
  rows.push({ id: game.id, proposed, confirmed: found.length });
  console.log(`${game.id}: 浅い読みで${proposed}回、確かめて${found.length}回${found.length ? `\n  ${found.join("\n  ")}` : ""}`);
}
const sides = rows.length * 2;
console.log(`\n${rows.length}局(${sides}人分): 浅い読みで${proposedTotal}回、確かめて${confirmedTotal}回。1人1局あたり${(confirmedTotal / Math.max(1, sides)).toFixed(2)}回`);
process.exit(0);
