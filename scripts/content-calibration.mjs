// 対局の場面採点(src/core/play-content.mjs)の、場面ごとの難しさと傾きを、強さの分かっているCPUの対局から合わせる開発用スクリプト
// (docs/skill-measure-design.mdの14章)。
// 1. --analyze: scripts/cpu-level-selfplay.mjsの--outのJSON(複数可。カンマ区切り)を、アプリと同じ段階解析(PCの設定)で読み、
//    L<n>の側の場面(contentEvents)を、そのLvと一緒に--eventsのJSONへ書く(指導役Gの側は数えない)。
// 2. --fit: --eventsのJSONから、場面の種類(取れる駒・守る駒・駒損なし・詰みの手数)ごとに、難しさbと傾きaを最尤で決め、
//    1局ごとの見立ての外れ(今の値と合わせた値)を比べる。合わせた値は奇数局で決めて偶数局で確かめる。
// 使い方:
//   node --experimental-strip-types --no-warnings --import ./scripts/lib/ts-register.mjs \
//     scripts/content-calibration.mjs --analyze --games a.json,b.json --events events.json [--lanes 4]
//   node --experimental-strip-types --no-warnings --import ./scripts/lib/ts-register.mjs \
//     scripts/content-calibration.mjs --fit --events events.json
import fs from "node:fs";
import { Position } from "tsshogi";
import "./lib/ts-register.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const levelOf = (spec) => {
  const match = /^L(\d+)$/.exec(String(spec));
  return match ? Number(match[1]) : null;
};

async function analyze() {
  const { STANDARD_SFEN, createNodeEngine } = await import("./lib/node-engine.mjs");
  const { STAGED_ANALYSIS_PLANS, analysisPointsFromResults, analyzeKifuStaged } = await import("../src/core/kifu-analysis-pipeline.mjs");
  const { CONTENT_DIFFICULTY, contentEvents } = await import("../src/core/play-content.mjs");
  // 詰みの手数は難しさbから戻すので、解析したときの値で鍵にして残す(あとで値を変えても読み直せるように)。
  const mateByB = new Map(Object.entries(CONTENT_DIFFICULTY.mate).map(([plies, b]) => [b, plies]));
  const stepsOf = (moves) => {
    const position = Position.newBySFEN(STANDARD_SFEN);
    const steps = [{ sfen: position.sfen, lastMove: "" }];
    for (const usi of moves) {
      const move = position.createMoveByUSI(usi);
      if (!move || !position.doMove(move)) break;
      steps.push({ sfen: position.sfen, lastMove: usi });
    }
    return steps;
  };
  const games = option("games", "").split(",").filter(Boolean)
    .flatMap((file) => JSON.parse(fs.readFileSync(file, "utf8")).games)
    .filter((game) => game.moves?.length >= 20);
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
  const samples = [];
  const started = Date.now();
  for (const [index, game] of games.entries()) {
    const sides = ["black", "white"].filter((color) => levelOf(game[color]) !== null);
    if (!sides.length) continue;
    const steps = stepsOf(game.moves);
    engines.forEach((engine) => engine.newGame());
    const results = await analyzeKifuStaged({ steps, lanes, plan: STAGED_ANALYSIS_PLANS.desktop });
    const points = analysisPointsFromResults(steps, results);
    const sfens = steps.map(({ sfen }) => sfen);
    const moves = steps.slice(1).map(({ lastMove }) => lastMove);
    const guided = game.black === "G" || game.white === "G";
    for (const color of sides) {
      const events = contentEvents({ points, sfens, moves, color });
      samples.push({ game: index, level: levelOf(game[color]), guided, events: events.map((event) => ({ kind: event.kind, key: kindKey(event, mateByB), b: event.b, correct: event.correct })) });
    }
    console.error(`${index + 1}/${games.length}局 (${Math.round((Date.now() - started) / 1000)}秒)`);
  }
  fs.writeFileSync(option("events", "events.json"), JSON.stringify(samples));
  for (const engine of engines) engine.quit?.();
}

/** 場面の種類の鍵(詰みは手数で分ける。難しさbから手数へ戻す)。 */
function kindKey(event, mateByB) {
  if (event.key) return event.key;
  return event.kind === "mate" ? `mate${mateByB.get(event.b) ?? "?"}` : event.kind;
}

async function fit() {
  const { CONTENT_DIFFICULTY } = await import("../src/core/play-content.mjs");
  const { ITEM_SLIP, posteriorLevel } = await import("../src/core/skill-test.mjs");
  const mateByB = new Map(Object.entries(CONTENT_DIFFICULTY.mate).map(([plies, b]) => [b, plies]));
  const samples = JSON.parse(fs.readFileSync(option("events", "events.json"), "utf8"));
  const p = (level, b, a) => (1 - ITEM_SLIP) / (1 + Math.exp(-a * (level - b)));
  /** 種類ごとに、(b, a)を格子で探して対数尤度を最大にする。 */
  const fitKinds = (list) => {
    const byKind = new Map();
    for (const sample of list) {
      for (const event of sample.events) {
        const key = kindKey(event, mateByB);
        byKind.set(key, [...(byKind.get(key) ?? []), { level: sample.level, correct: event.correct }]);
      }
    }
    const table = {};
    for (const [key, rows] of byKind) {
      let best = null;
      for (let b = -20; b <= 60; b += 0.5) {
        for (const a of [0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) {
          let log = 0;
          for (const { level, correct } of rows) {
            const q = Math.min(1 - 1e-9, Math.max(1e-9, p(level, b, a)));
            log += correct ? Math.log(q) : Math.log(1 - q);
          }
          if (!best || log > best.log) best = { b, a, log };
        }
      }
      const hit = rows.filter(({ correct }) => correct).length;
      table[key] = { b: best.b, a: best.a, n: rows.length, rate: Math.round((100 * hit) / rows.length) };
    }
    return table;
  };
  /** 1局の見立て(今の式・合わせた式)。 */
  const estimate = (sample, table) => {
    const answers = sample.events.map((event) => {
      if (!table) return { b: event.b, guess: 0, correct: event.correct };
      const row = table[kindKey(event, mateByB)];
      return row ? { b: row.b, a: row.a, guess: 0, correct: event.correct } : { b: event.b, guess: 0, correct: event.correct };
    });
    return answers.length >= 8 ? posteriorLevel(answers, null).level : null;
  };
  const train = samples.filter((sample) => sample.game % 2 === 1);
  const test = samples.filter((sample) => sample.game % 2 === 0);
  const table = fitKinds(train);
  const full = fitKinds(samples);
  console.log("| 場面 | 数 | できた割合 | 難しさb | 傾きa |");
  console.log("| --- | ---: | ---: | ---: | ---: |");
  for (const [key, row] of Object.entries(full).sort()) console.log(`| ${key} | ${row.n} | ${row.rate}% | ${row.b} | ${row.a} |`);
  const report = (label, list, use) => {
    const rows = list.map((sample) => ({ level: sample.level, guided: sample.guided, est: estimate(sample, use) })).filter((row) => row.est !== null);
    const groups = new Map();
    for (const row of rows) {
      const key = `${row.guided ? "指導" : "ふつう"} L${row.level}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const mae = rows.reduce((sum, row) => sum + Math.abs(row.est - row.level), 0) / Math.max(1, rows.length);
    const corr = (() => {
      const n = rows.length;
      const mx = rows.reduce((s, r) => s + r.level, 0) / n;
      const my = rows.reduce((s, r) => s + r.est, 0) / n;
      const sxy = rows.reduce((s, r) => s + (r.level - mx) * (r.est - my), 0);
      const sxx = rows.reduce((s, r) => s + (r.level - mx) ** 2, 0);
      const syy = rows.reduce((s, r) => s + (r.est - my) ** 2, 0);
      return sxy / Math.sqrt(sxx * syy);
    })();
    console.log(`\n${label}: 平均の外れ ${mae.toFixed(1)}Lv・相関 ${corr.toFixed(2)}（${rows.length}標本）`);
    for (const [key, list2] of [...groups].sort()) {
      const mean = list2.reduce((s, r) => s + r.est, 0) / list2.length;
      console.log(`  ${key}: 見立て ${mean.toFixed(1)}（${list2.length}）`);
    }
  };
  report("今の値（偶数局）", test, null);
  report("奇数局で合わせた値（偶数局で確かめ）", test, table);
  console.log(`\n全局で合わせた値(JSON): ${JSON.stringify(Object.fromEntries(Object.entries(full).map(([key, row]) => [key, { b: row.b, a: row.a }])))}`);
}

if (process.argv.includes("--analyze")) await analyze();
else if (process.argv.includes("--fit")) await fit();
else console.error("--analyze か --fit を付けてください");
process.exit(0);
