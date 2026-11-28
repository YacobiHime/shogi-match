// 棋力測定の指導対局(docs/skill-measure-design.mdの13章)の物差しの確かめ。開発用。
// scripts/cpu-level-selfplay.mjsの--outのJSON(選手G=指導役と、強さの分かっているCPUのL<n>)を、アプリと同じ段階解析(PCの設定)で読み、
// CPU(L<n>)の側について、(1) 形勢がどのくらい帯(L側から見て少しリード)に収まったか、(2) 場面採点(play-content.mjs)の見立てのLvを出す。
// 同じファイルにL<n>どうしの対局があれば、比べのために、ふつうの対局の場面採点も出す。
// 使い方:
//   node --experimental-strip-types --no-warnings --import ./scripts/lib/ts-register.mjs \
//     scripts/guided-measure-report.mjs --games games.json [--lanes 4]
import fs from "node:fs";
import { Position } from "tsshogi";
import "./lib/ts-register.mjs";
import { STANDARD_SFEN, createNodeEngine } from "./lib/node-engine.mjs";
const { STAGED_ANALYSIS_PLANS, analysisPointsFromResults, analyzeKifuStaged } = await import("../src/core/kifu-analysis-pipeline.mjs");
const { contentEstimate, contentEvents } = await import("../src/core/play-content.mjs");
const { GUIDE_BAND } = await import("../src/core/guided-play.mjs");
const { comparableScore } = await import("../src/core/move-selection.mjs");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const levelOf = (spec) => {
  const match = /^L(\d+)$/.exec(String(spec));
  return match ? Number(match[1]) : null;
};
function stepsOf(moves) {
  const position = Position.newBySFEN(STANDARD_SFEN);
  const steps = [{ sfen: position.sfen, lastMove: "" }];
  for (const usi of moves) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) break;
    steps.push({ sfen: position.sfen, lastMove: usi });
  }
  return steps;
}

const input = JSON.parse(fs.readFileSync(option("games", ""), "utf8"));
const lanesCount = Number(option("lanes", "4"));
const engines = [];
for (let index = 0; index < lanesCount; index += 1) engines.push(await createNodeEngine());
const lanes = engines.map((engine) => async (sfen, { nodes, multiPv, maxTimeMs, fresh }) => {
  if (fresh) {
    engine.newGame();
    await engine.ready();
  }
  engine.applyStrengthOptions({ multiPv });
  engine.setPosition(sfen);
  return engine.go({ nodes, maxTimeMs });
});

/** 標本: { level, guided, plies, inBand, measurable, events, est } */
const samples = [];
const games = input.games.filter((game) => game.moves?.length >= 20);
const started = Date.now();
for (const [index, game] of games.entries()) {
  const sides = ["black", "white"].filter((color) => levelOf(game[color]) !== null);
  if (!sides.length) continue;
  const guided = game.black === "G" || game.white === "G";
  const steps = stepsOf(game.moves);
  engines.forEach((engine) => engine.newGame());
  const results = await analyzeKifuStaged({ steps, lanes, plan: STAGED_ANALYSIS_PLANS.desktop });
  const points = analysisPointsFromResults(steps, results);
  const sfens = steps.map(({ sfen }) => sfen);
  const moves = steps.slice(1).map(({ lastMove }) => lastMove);
  for (const color of sides) {
    // 形勢(先手から見た点)を、CPUの側から見た点に直し、31〜120手目で帯(相手から見て GUIDE_BAND)に入った割合。
    const sign = color === "black" ? 1 : -1;
    const values = points.filter((point) => point.ply > 30 && point.ply <= 120)
      .map((point) => comparableScore(point.score)).filter(Number.isFinite).map((value) => sign * value);
    const inBand = values.filter((value) => value >= -GUIDE_BAND.high && value <= -GUIDE_BAND.low).length;
    const measurable = values.filter((value) => Math.abs(value) < 1500).length;
    const events = contentEvents({ points, sfens, moves, color });
    const est = contentEstimate(events);
    samples.push({ level: levelOf(game[color]), guided, plies: steps.length - 1, values: values.length, inBand, measurable, events: events.length, est });
  }
  console.error(`${index + 1}/${games.length}局 (${Math.round((Date.now() - started) / 1000)}秒)`);
}

const groups = new Map();
for (const sample of samples) {
  const key = `${sample.guided ? "指導" : "ふつう"} L${sample.level}`;
  groups.set(key, [...(groups.get(key) ?? []), sample]);
}
const mean = (list) => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : NaN);
const sd = (list) => { const m = mean(list); return Math.sqrt(mean(list.map((value) => (value - m) ** 2))); };
console.log("| 組 | 局 | 手数 | 帯に入った割合 | 大差でない割合 | 場面の数 | 場面採点のLv(平均) | 外れ(平均) | ばらつき |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const [key, list] of [...groups].sort()) {
  const level = list[0].level;
  const est = list.filter((sample) => sample.est).map((sample) => sample.est.level);
  const pct = (part, whole) => `${Math.round((100 * part) / Math.max(1, whole))}%`;
  console.log(`| ${key} | ${list.length} | ${Math.round(mean(list.map((s) => s.plies)))} | ${pct(list.reduce((a, s) => a + s.inBand, 0), list.reduce((a, s) => a + s.values, 0))} | ${pct(list.reduce((a, s) => a + s.measurable, 0), list.reduce((a, s) => a + s.values, 0))} | ${mean(list.map((s) => s.events)).toFixed(1)} | ${est.length ? mean(est).toFixed(1) : "—"}（${est.length}局） | ${est.length ? (mean(est) - level).toFixed(1) : "—"} | ${est.length ? sd(est).toFixed(1) : "—"} |`);
}
for (const engine of engines) engine.quit?.();
process.exit(0);
