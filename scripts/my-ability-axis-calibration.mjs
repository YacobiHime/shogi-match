// 「あなたの能力」(src/core/my-abilities.mjs)の、集計の軸ごとの「Lvと値の対応」(AXIS_MODELS)を作る開発用スクリプト。
// 強さの分かっているCPUどうしの対局(scripts/cpu-level-selfplay.mjsの--outのJSON)を、アプリと同じ段階解析(PCの設定)で読み、
// 1局ずつ・側ごとに、対局の要約(play-insight.mjsのsummarizePlayInsight)の軸の値を出して、Lvに直線で当てはめる。
// - 損の軸: log(1手の損の平均 + 10) = a + b × Lv
// - 割合の軸: ロジット(割合) = a + b × Lv
// めったに起きないことを数える軸(視野・発想・詰み。POOLED_AXES)は、1局ずつでは割合が0か1に張りつくので、
// Lvごとに数を合わせた割合((当たり+0.5)/(数+1))を、数で重みをつけて当てはめる(あなたの能力も最近の対局を合わせて数える)。
// 使い方:
//   node --experimental-strip-types --no-warnings --import ./scripts/lib/ts-register.mjs \
//     scripts/my-ability-axis-calibration.mjs --games games.json [--lanes 4] [--out samples.json] [--limit 0]
// 選手の指定はL<レベル>(表示のLv)だけを数える(classicなどの付いた選手は数えない)。設計は docs/player-abilities-design.md の13-7。
import fs from "node:fs";
import { Position } from "tsshogi";
import "./lib/ts-register.mjs";
import { STANDARD_SFEN, createNodeEngine } from "./lib/node-engine.mjs";
const { STAGED_ANALYSIS_PLANS, analysisPointsFromResults, analyzeKifuStaged } = await import("../src/core/kifu-analysis-pipeline.mjs");
const { LOSS_AXES, RATE_AXES, summarizePlayInsight } = await import("../src/core/play-insight.mjs");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

/** 軸ごとの、1局の標本として数える最小の数(手、詰み・発想は機会)。 */
const MIN_N = Object.freeze({ mate: 1, idea: 1 });
const minN = (key) => MIN_N[key] ?? 10;

/** Lvごとに合わせて当てはめる軸。 */
const POOLED_AXES = new Set(['vision', 'idea', 'mate']);

/** Lvごとに合わせた割合を、数の重みで直線に当てはめる。 */
function fitPooled(key, rows) {
  const byLevel = new Map();
  for (const { level, axes } of rows) {
    const axis = axes?.[key];
    if (!axis?.n) continue;
    const entry = byLevel.get(level) ?? { n: 0, hit: 0 };
    entry.n += axis.n;
    entry.hit += axis.hit;
    byLevel.set(level, entry);
  }
  const points = [...byLevel].map(([x, { n, hit }]) => {
    const rate = (hit + 0.5) / (n + 1);
    return { x, y: Math.log(rate / (1 - rate)), w: n, rate, n };
  });
  if (points.length < 4) return null;
  const sw = points.reduce((sum, { w }) => sum + w, 0);
  const mx = points.reduce((sum, { x, w }) => sum + w * x, 0) / sw;
  const my = points.reduce((sum, { y, w }) => sum + w * y, 0) / sw;
  const b = points.reduce((sum, { x, y, w }) => sum + w * (x - mx) * (y - my), 0) / points.reduce((sum, { x, w }) => sum + w * (x - mx) ** 2, 0);
  const a = my - b * mx;
  return {
    a: Math.round(a * 10000) / 10000, b: Math.round(b * 100000) / 100000, n: points.reduce((sum, { n }) => sum + n, 0), levelError: null,
    byLevel: points.sort((p, q) => p.x - q.x).map(({ x, rate, n }) => `L${x}:${(rate * 100).toFixed(1)}%(${n})`).join(' '),
  };
}

/** 1局の手から、0手目からの局面。 */
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

const levelOf = (spec) => {
  const match = /^L(\d+)$/.exec(String(spec));
  return match ? Number(match[1]) : null;
};

/** 軸の値をyにする(損は対数、割合はロジット)。 */
function yOf(key, axis) {
  if (LOSS_AXES.includes(key)) return Math.log(Math.max(0, axis.sum / axis.n) + 10);
  const rate = Math.min(0.98, Math.max(0.02, axis.hit / axis.n));
  return Math.log(rate / (1 - rate));
}

/** 最小二乗の直線 y = a + b × x。 */
function fitLine(points) {
  const n = points.length;
  const mx = points.reduce((sum, { x }) => sum + x, 0) / n;
  const my = points.reduce((sum, { y }) => sum + y, 0) / n;
  const sxx = points.reduce((sum, { x }) => sum + (x - mx) ** 2, 0);
  const sxy = points.reduce((sum, { x, y }) => sum + (x - mx) * (y - my), 0);
  const b = sxy / sxx;
  const a = my - b * mx;
  const residual = Math.sqrt(points.reduce((sum, { x, y }) => sum + (y - a - b * x) ** 2, 0) / Math.max(1, n - 2));
  // 1標本の誤差を、Lvの幅で言う(|残差 / 傾き|)。
  return { a: Math.round(a * 10000) / 10000, b: Math.round(b * 100000) / 100000, n, levelError: Math.round((residual / Math.abs(b)) * 10) / 10 };
}

const input = JSON.parse(fs.readFileSync(option("games", ""), "utf8"));
const lanesCount = Number(option("lanes", "4"));
const limit = Number(option("limit", "0"));
const outPath = option("out", "");
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

const games = input.games.filter((game) => levelOf(game.black) !== null && levelOf(game.white) !== null && game.moves?.length >= 20);
const samples = [];
const started = Date.now();
for (const [index, game] of (limit ? games.slice(0, limit) : games).entries()) {
  const steps = stepsOf(game.moves);
  engines.forEach((engine) => engine.newGame());
  const results = await analyzeKifuStaged({ steps, lanes, plan: STAGED_ANALYSIS_PLANS.desktop });
  const points = analysisPointsFromResults(steps, results);
  const sfens = steps.map(({ sfen }) => sfen);
  const moves = steps.slice(1).map(({ lastMove }) => lastMove);
  for (const color of ["black", "white"]) {
    const summary = summarizePlayInsight({ points, sfens, moves, color, initialSfen: STANDARD_SFEN });
    samples.push({ level: levelOf(game[color]), axes: summary.axes });
  }
  console.error(`${index + 1}/${limit || games.length}局 (${Math.round((Date.now() - started) / 1000)}秒)`);
}

const table = {};
for (const key of [...LOSS_AXES, ...RATE_AXES]) {
  if (POOLED_AXES.has(key)) {
    const row = fitPooled(key, samples);
    if (row) table[key] = row;
    continue;
  }
  const points = samples.filter(({ axes }) => axes?.[key]?.n >= minN(key)).map(({ level, axes }) => ({ x: level, y: yOf(key, axes[key]) }));
  if (points.length >= 8) table[key] = fitLine(points);
}
console.log("| 軸 | 種類 | a | b | 標本 | 1標本の誤差(Lv) |");
console.log("| --- | --- | ---: | ---: | ---: | ---: |");
for (const [key, row] of Object.entries(table)) {
  console.log(`| ${key} | ${LOSS_AXES.includes(key) ? "loss" : POOLED_AXES.has(key) ? "rate(合わせる)" : "rate"} | ${row.a} | ${row.b} | ${row.n} | ${row.levelError ?? "—"} |`);
  if (row.byLevel) console.log(`|  | ${row.byLevel} | | | | |`);
}
if (outPath) fs.writeFileSync(outPath, JSON.stringify({ table, samples }, null, 1));
for (const engine of engines) engine.quit?.();
process.exit(0);
