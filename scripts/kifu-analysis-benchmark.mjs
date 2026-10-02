// 棋譜解析の速さと精度を、強いエンジン(水匠5など)の深い解析にどれだけ近いかで比べる開発用スクリプト。
// 先にscripts/kifu-analysis-reference.mjsで基準データを作る。
// 使い方:
//   node --experimental-strip-types --no-warnings --import ./scripts/lib/ts-register.mjs \
//     scripts/kifu-analysis-benchmark.mjs [--methods legacy,staged-desktop-4] [--games amano_soho,selfplay-1]
// 方法の指定:
//   legacy[-<nodes>]           旧方式。全局面を浅い読み+MultiPV 2で1局面ずつ読む(既定12,000nodes)。
//                              浅い読みの前に置換表を消し、神の一手を段階解析と同じ条件で判定する。
//   app[-<nodes>]              旧方式を、アプリと同じく置換表を消さずに読む(時間の比較用)。
//   staged-<plan>-<lanes>      段階解析。planはdesktopかmobile、lanesは同時に動かすエンジンの数。
// 指標(基準の解析と比べる):
//   勝率誤差   局面ごとの先手勝率(評価値600で約73%)の平均絶対誤差(ポイント)
//   最善手一致 基準の最善手と同じ手を最善とした局面の割合
//   悪手       基準で疑問手以上(損300以上)の手を、疑問手以上と判定できた割合(再現率)と、判定の正しさ(適合率)
//   大悪手     基準で悪手以上(損800以上)の手を、悪手以上と判定できた割合
//   神の一手   基準の神の一手のうち、神の一手と判定できた数
import fs from "node:fs";
import path from "node:path";
import { createNodeEngine, projectRoot } from "./lib/node-engine.mjs";
import { benchmarkGames } from "./lib/kifu-benchmark-games.mjs";
import { STAGED_ANALYSIS_PLANS, analysisPointsFromResults, analyzeKifuStaged } from "../src/core/kifu-analysis-pipeline.mjs";
import { winRate } from "../src/core/god-move.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const reference = JSON.parse(fs.readFileSync(path.join(projectRoot, "scripts/data/kifu-analysis-reference.json"), "utf8"));
const gameFilter = option("games", "").split(",").filter(Boolean);
const games = benchmarkGames().filter(({ id }) => !gameFilter.length || gameFilter.includes(id));
const methods = option("methods", "legacy,staged-desktop-1,staged-desktop-4").split(",");
const maxLanes = Math.max(1, ...methods
  .filter((method) => method.startsWith("staged"))
  .map((method) => Number(method.split("-")[2] ?? 1)));

const engines = [];
for (let index = 0; index < maxLanes; index += 1) engines.push(await createNodeEngine());
const laneFor = (engine) => async (sfen, { nodes, multiPv, maxTimeMs, fresh }) => {
  if (fresh) {
    engine.newGame();
    await engine.ready();
  }
  engine.applyStrengthOptions({ multiPv });
  engine.setPosition(sfen);
  return engine.go({ nodes, maxTimeMs });
};

/** 基準の解析にも、褒め言葉と同じ浅い読みを付けて、神の一手を同じ基準で判定する。 */
async function referenceResults(game) {
  const deep = reference.games.find(({ id }) => id === game.id)?.results;
  if (!deep) throw new Error(`${game.id}の基準データがありません`);
  const results = deep.map((candidates) => ({ deep: candidates, shallow: null, nodes: reference.nodes, multiPv: 2 }));
  const lane = laneFor(engines[0]);
  for (let ply = 0; ply + 1 < game.steps.length; ply += 1) {
    const best = results[ply].deep.find(({ rank }) => rank === 1);
    if (best?.move !== game.steps[ply + 1].lastMove) continue;
    results[ply].shallow = (await lane(game.steps[ply].sfen, STAGED_ANALYSIS_PLANS.desktop.shallow)).candidates;
  }
  return results;
}

async function legacyResults(game, nodes, fresh = true) {
  const lane = laneFor(engines[0]);
  const results = [];
  for (const step of game.steps) {
    const shallow = (await lane(step.sfen, { ...STAGED_ANALYSIS_PLANS.desktop.shallow, fresh })).candidates;
    const deep = (await lane(step.sfen, { nodes, multiPv: 2, maxTimeMs: 1200 })).candidates;
    results.push({ deep, shallow, nodes, multiPv: 2 });
  }
  return results;
}

const BAD = new Set(["dubious", "mistake", "blunder"]);
const SEVERE = new Set(["mistake", "blunder"]);

function compare(points, refPoints) {
  const byPly = new Map(points.map((point) => [point.ply, point]));
  let error = 0;
  let compared = 0;
  let sameBest = 0;
  const counts = { badHit: 0, badRef: 0, badFound: 0, severeHit: 0, severeRef: 0, godHit: 0, godRef: 0, godFound: 0 };
  for (const ref of refPoints) {
    const point = byPly.get(ref.ply);
    const kind = point?.annotation?.kind;
    const refKind = ref.annotation?.kind;
    if (point) {
      error += Math.abs(winRate(point.score) - winRate(ref.score));
      compared += 1;
      if (point.bestMove === ref.bestMove) sameBest += 1;
    }
    if (BAD.has(refKind)) {
      counts.badRef += 1;
      if (BAD.has(kind)) counts.badHit += 1;
    }
    if (SEVERE.has(refKind)) {
      counts.severeRef += 1;
      if (SEVERE.has(kind)) counts.severeHit += 1;
    }
    if (refKind === "brilliant") {
      counts.godRef += 1;
      if (kind === "brilliant") counts.godHit += 1;
    }
  }
  for (const point of points) {
    if (BAD.has(point.annotation?.kind)) counts.badFound += 1;
    if (point.annotation?.kind === "brilliant") counts.godFound += 1;
  }
  return { error, compared, sameBest, ...counts };
}

// --plan '{"scan":{"nodes":30000}}' で、段階解析の設定の一部を差し替えて試す。
const planOverride = JSON.parse(option("plan", "{}"));
const planWith = (base) => Object.fromEntries(Object.entries(base).map(([stage, budget]) => [stage, { ...budget, ...planOverride[stage] }]));

const refByGame = new Map();
for (const game of games) refByGame.set(game.id, analysisPointsFromResults(game.steps, await referenceResults(game)));

const percent = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(0)}%` : "-");
const rows = [];
for (const method of methods) {
  const stageCounts = {};
  const stageMs = {};
  let currentStage = "";
  let stageStarted = 0;
  const total = { error: 0, compared: 0, sameBest: 0, badHit: 0, badRef: 0, badFound: 0, severeHit: 0, severeRef: 0, godHit: 0, godRef: 0, godFound: 0, ms: 0, positions: 0 };
  for (const game of games) {
    engines.forEach((engine) => engine.newGame());
    const started = Date.now();
    let results;
    if (method.startsWith("legacy") || method.startsWith("app")) {
      results = await legacyResults(game, Number(method.split("-")[1] ?? 12000), method.startsWith("legacy"));
    } else {
      const [, planName, laneCount] = method.split("-");
      results = await analyzeKifuStaged({
        steps: game.steps,
        lanes: engines.slice(0, Number(laneCount)).map(laneFor),
        plan: planWith(STAGED_ANALYSIS_PLANS[planName]),
        onProgress: ({ stage, total: count, done }) => {
          if (done !== 0) return;
          const now = Date.now();
          if (currentStage) stageMs[currentStage] = (stageMs[currentStage] ?? 0) + now - stageStarted;
          currentStage = stage;
          stageStarted = now;
          stageCounts[stage] = (stageCounts[stage] ?? 0) + count;
        },
      });
    }
    if (currentStage) stageMs[`${currentStage}+shallow`] = (stageMs[`${currentStage}+shallow`] ?? 0) + Date.now() - stageStarted;
    currentStage = "";
    total.ms += Date.now() - started;
    total.positions += game.steps.length;
    const counts = compare(analysisPointsFromResults(game.steps, results), refByGame.get(game.id));
    for (const key of Object.keys(counts)) total[key] += counts[key];
  }
  rows.push(`| ${method} | ${(total.ms / 1000).toFixed(1)}秒 | ${(total.error / total.compared).toFixed(1)} | ${percent(total.sameBest, total.compared)}`
    + ` | ${percent(total.badHit, total.badRef)} / ${percent(total.badHit, total.badFound)} | ${percent(total.severeHit, total.severeRef)}`
    + ` | ${total.godHit}/${total.godRef}(判定${total.godFound}) |`);
  console.error(`${method}: ${(total.ms / 1000).toFixed(1)}秒 ${JSON.stringify(stageCounts)} ${JSON.stringify(stageMs)}`);
  console.error(rows.at(-1));
}
console.log([
  `基準: ${reference.engine} ${reference.nodes.toLocaleString()}nodes、${games.length}局${games.reduce((sum, { steps }) => sum + steps.length, 0)}局面`,
  "| 方法 | 時間 | 勝率誤差 | 最善手一致 | 悪手 再現率/適合率 | 大悪手 再現率 | 神の一手 |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...rows,
].join("\n"));
engines.forEach((engine) => engine.quit());
process.exit(0);
