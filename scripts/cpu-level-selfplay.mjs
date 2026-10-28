// CPU同士を自動対局させ、強さ設定ごとのレーティング差を推定する開発用スクリプト。
// 使い方:
//   node scripts/cpu-level-selfplay.mjs --players L1,L5,L10 [--games 40] [--gap 2] [--workers 8] [--out result.json]
//   選手はL<レベル>、s<技量>(例: s0.3)、e<もとの校正のLv>(小数可、例: e12.5)、old<旧識別値>(2026-09-26版の設定、例: old6000)で指定する。
//   末尾にn<nodes>を付けると探索量だけを差し替える(例: L40n2000000)。
//   末尾にnoriskを付けると、危険への態度(無難な手・勝負手の選び直し)を外す(例: L25norisk)。
//   末尾にclassicを付けると、人間らしいCPUの選び方を外して今までの選び方で指す(例: L15classic)。
//   末尾にsig<倍率>を付けると、人間らしいCPUの判断のぶれの倍率を差し替える(例: L15sig1.6)。
//   --deadline-sec 280 で、指定秒数を過ぎたら対局中の局を打ち切り、終わった局だけで集計する。
//   --opening-plies 12 で、序盤の指定手数まで両者とも評価差の小さい候補からばらして選ぶ。
//   最上位レベル同士は着手にばらつきがなく、同じ棋譜を繰り返すのを避けるために使う。
//   並べた順に、隣からgap個先までの組み合わせで先後を入れ替えながら対局する。
//   --anchors old6000 --anchor-games 20 で、基準選手を全選手と対局させる。
//   --include prev.json で、以前の結果の対局もレーティング推定に含める。
import fs from "node:fs";
import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { purposefulCalibration } from "./lib/purposeful-calibration.mjs";
import { Position } from "tsshogi";
import { canBlunder, isBlunderChoice } from "../src/core/cpu-move-choice.mjs";
import { chooseLegacyCpuMove as chooseCpuMove } from "./lib/legacy-cpu-move-choice.mjs";
import "./lib/ts-register.mjs";
const { chooseLogicMove } = await import("../src/core/logic-ai.mjs");
const { chooseAwareMove } = await import("../src/core/aware-move-choice.mjs");
import { comparableScore } from "../src/core/move-selection.mjs";
import { createNaturalnessEvaluator } from "../src/core/move-naturalness.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings, logicLevelOf, searchSettingsForSkill, sourceLevelSettings } from "../src/core/strength-settings.mjs";
import { STANDARD_SFEN, createNodeEngine, legalMoves, projectRoot, search, seededRandom } from "./lib/node-engine.mjs";

const MAX_PLY = 256;
const ADJUDICATE_FROM_PLY = 120;
const ADJUDICATE_EVERY = 8;
const ADJUDICATE_NODES = 3000;
const ADJUDICATE_SCORE = 4000;
const FINAL_ADJUDICATE_NODES = 10000;
const FINAL_ADJUDICATE_SCORE = 800;

// 2026-09-26版の設定。ユーザー報告(ぴよ将棋Lv15程度の人が旧Lv6に勝てない)の基準点として比較する。
const OLD_SETTINGS = new Map([
  [2000, { nodes: 100, multiPv: 4, maxScoreLoss: 1200, scoreTemperature: 1800, bestMoveRate: 0.01, alpha: 1, oversightRate: 0.80, oversightShallowLoss: 600, oversightNodes: 3000, oversightMaxLoss: 3000 }],
  [6000, { nodes: 650, multiPv: 6, maxScoreLoss: 1000, scoreTemperature: 950, bestMoveRate: 0.05, alpha: 0.8, oversightRate: 0.35, oversightShallowLoss: 400, oversightNodes: 5000, oversightMaxLoss: 2000 }],
  [12000, { nodes: 2000, multiPv: 8, maxScoreLoss: 940, scoreTemperature: 760, bestMoveRate: 0.20, alpha: 0.6, oversightRate: 0.18, oversightShallowLoss: 280, oversightNodes: 10000, oversightMaxLoss: 1400 }],
  [30000, { nodes: 8000, multiPv: 9, maxScoreLoss: 900, scoreTemperature: 650, bestMoveRate: 0.42, alpha: 0.6, oversightRate: 0.04, oversightShallowLoss: 200, oversightNodes: 24000, oversightMaxLoss: 1000 }],
]);

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

/** 選手指定から、着手選択に渡す強さ設定を作る。 */
export function strengthForPlayer(spec) {
  const hybrid = spec.match(/^(.+?)(hybrid|legacy|tuned)$/);
  if (hybrid) {
    const base = strengthForPlayer(hybrid[1]);
    if (!(base.logicLevel === undefined && base.level >= 10 && base.level <= 48)) throw new Error("hybrid/legacyの比較対象は、エンジンで指すLv(15級〜タイトル保持者)です");
    if (hybrid[2] === "tuned") return purposefulCalibration(base);
    if (hybrid[2] === "legacy") {
      const preset = CPU_STRENGTH_PRESETS.find(({ level }) => level === base.level);
      const settings = searchSettingsForSkill(preset.skill);
      const override = hybrid[1].match(/n(\d+)$/);
      return { ...settings, ...(override ? { nodes: Number(override[1]) } : {}), level: base.level, logicHybrid: false };
    }
    return { ...base, logicHybrid: hybrid[2] === "hybrid" };
  }
  // classic: 人間らしいCPU(human-model.mjs)を外し、温度の抽選とわざと選ぶ見落としの、今までの選び方で指す。
  const classic = spec.match(/^(.+)classic$/);
  if (classic) {
    const { human: _human, ...rest } = strengthForPlayer(classic[1]);
    return rest;
  }
  // s<倍率>: 人間らしいCPUの判断のぶれの倍率だけを差し替える(例: L15s1.6)。校正用。
  const sigma = spec.match(/^(.+?)sig([\d.]+)$/);
  if (sigma) {
    const base = strengthForPlayer(sigma[1]);
    return { ...base, human: base.human ? { ...base.human, sigma: Number(sigma[2]) } : base.human };
  }
  const noRisk = spec.match(/^(.+)norisk$/);
  if (noRisk) return { ...strengthForPlayer(noRisk[1]), riskAttitude: 0 };
  const nodesOverride = spec.match(/^(.+?)n(\d+)$/);
  if (nodesOverride) return { ...strengthForPlayer(nodesOverride[1]), nodes: Number(nodesOverride[2]) };
  if (/^L\d+$/.test(spec)) {
    const preset = CPU_STRENGTH_PRESETS.find(({ level }) => level === Number(spec.slice(1)));
    if (!preset) throw new Error(`存在しないレベルです: ${spec}`);
    const settings = getStrengthSearchSettings(preset.value);
    // 24級〜16級(sourceが10以下)はロジックAIで指す。Lvの番号ではなくsourceで決める。
    const logic = logicLevelOf(preset.value);
    return { ...settings, level: preset.level, ...(logic !== null ? { logicLevel: logic } : {}) };
  }
  if (/^s[\d.]+$/.test(spec)) return searchSettingsForSkill(Number(spec.slice(1)));
  // e<もとの校正のLv(小数)>: 低級帯の付け替えを決めるための、もとの校正のLvの設定(例: e12.5)。
  // 10以下は、ロジックAIの小数のLv(0より大きい。表示の24級〜16級)。
  if (/^e[\d.]+$/.test(spec)) {
    const source = Number(spec.slice(1));
    return { ...sourceLevelSettings(source), level: Math.round(source), ...(source > 0 && source <= 10 ? { logicLevel: source } : {}) };
  }
  if (/^old\d+$/.test(spec)) {
    const old = OLD_SETTINGS.get(Number(spec.slice(3)));
    if (!old) throw new Error(`比較用の旧設定がありません: ${spec}`);
    return {
      ...old,
      moveRank: { min: 1, max: old.multiPv },
      naturalnessAlpha: old.alpha,
      naturalMoveRate: 0,
    };
  }
  throw new Error(`選手の指定が不正です: ${spec}`);
}

function positionKey(sfen) {
  return sfen.split(" ").slice(0, 3).join(" ");
}

async function adjudicate(engine, sfen, nodes, threshold, color) {
  const result = await search(engine, sfen, { nodes, multiPv: 1 });
  const value = comparableScore(result.candidates.find(({ rank }) => rank === 1)?.score);
  if (value === undefined || Math.abs(value) < threshold) return null;
  // 評価値は手番側から見た値。
  return (value > 0) === (color === "black") ? "black" : "white";
}

/** 序盤をばらすための着手設定。最善手から評価差80以内の候補を、差が小さいほど選びやすくする。 */
const OPENING_VARIETY = {
  ...searchSettingsForSkill(0.9),
  nodes: 20000,
  multiPv: 4,
  moveRank: { min: 1, max: 4 },
  maxScoreLoss: 80,
  scoreTemperature: 40,
  bestMoveRate: 0,
  naturalnessAlpha: 0,
  openingPlanScoreScale: 1,
};

/** 1局を指し、勝者("black" | "white" | "draw")を返す。選手ごとに別のエンジンを使い、置換表を共有しない。 */
async function playGame(engines, players, seed, openingPlies = 0) {
  const random = seededRandom(seed);
  const position = Position.newBySFEN(STANDARD_SFEN);
  const history = [];
  const seen = new Map();
  const decisions = [];
  // 対局画面と同じく、大きな悪手の回数と間隔を選手ごとに数える。
  const blunderPlies = { black: [], white: [] };
  for (let ply = 0; ply < MAX_PLY; ply += 1) {
    const color = position.color === "black" ? "black" : "white";
    const moves = legalMoves(position);
    if (!moves.length) return { winner: color === "black" ? "white" : "black", plies: ply, moves: history, reason: "mate", ...(decisions.length ? { decisions } : {}) };
    if (ply >= ADJUDICATE_FROM_PLY && ply % ADJUDICATE_EVERY === 0) {
      const winner = await adjudicate(engines.judge, position.sfen, ADJUDICATE_NODES, ADJUDICATE_SCORE, color);
      if (winner) return { winner, plies: ply, moves: history, reason: "adjudicated", ...(decisions.length ? { decisions } : {}) };
    }
    const engine = engines[color];
    const strength = ply < openingPlies ? OPENING_VARIETY : players[color];
    const sfen = position.sfen;
    const logicLevel = strength.logicLevel ?? null;
    const result = !logicLevel && strength.nodes > 0 ? await search(engine, sfen, strength) : undefined;
    let choice = logicLevel ? chooseLogicMove({ sfen, legalMoves: moves, moveHistory: history, level: logicLevel, random }) : await (strength.logicHybrid ? chooseAwareMove : chooseCpuMove)({
      strength,
      sfen,
      legalMoves: moves,
      moveHistory: history,
      search: result,
      verify: result
        ? (searchMoves, nodes) => search(engine, sfen, { nodes, multiPv: searchMoves.length, searchMoves })
        : undefined,
      probe: result
        ? (moves, { nodes, multiPv }) => search(engine, `${sfen} moves ${moves.join(" ")}`, { nodes, multiPv })
        : undefined,
      random,
      blunderAllowed: canBlunder(strength, blunderPlies[color], ply),
    });
    if (process.argv.includes("--diagnostics") && strength.logicHybrid) {
      const root = createNaturalnessEvaluator(sfen, { moveHistory: history, continuations: result.candidates })(result.move);
      decisions.push({ ply, color, sfen, root: result.move, actual: choice?.move ?? null, purposeful: root.purposeful, tags: root.tags,
        fallback: !choice, considered: choice?.consideredMoves });
    }
    choice ??= strength.logicHybrid ? chooseLogicMove({ sfen, legalMoves: moves, moveHistory: history, level: 10, random }) : null;
    if (isBlunderChoice(choice)) blunderPlies[color].push(ply);
    const move = choice && position.createMoveByUSI(choice.move);
    if (!move || !position.doMove(move)) throw new Error(`不正な着手です: ${choice?.move}`);
    history.push(choice.move);
    const key = positionKey(position.sfen);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (seen.get(key) >= 4) return { winner: "draw", plies: ply + 1, moves: history, reason: "repetition", ...(decisions.length ? { decisions } : {}) };
  }
  const color = position.color === "black" ? "black" : "white";
  const winner = await adjudicate(engines.judge, position.sfen, FINAL_ADJUDICATE_NODES, FINAL_ADJUDICATE_SCORE, color);
  return { winner: winner ?? "draw", plies: MAX_PLY, moves: history, reason: winner ? "max-ply-adjudicated" : "max-ply", ...(decisions.length ? { decisions } : {}) };
}

async function runWorker() {
  const black = await createNodeEngine();
  const white = await createNodeEngine();
  const engines = { black, white, judge: black };
  process.on("message", async (job) => {
    if (job.type === "quit") {
      black.quit();
      white.quit();
      process.exit(0);
    }
    black.newGame();
    white.newGame();
    const players = { black: strengthForPlayer(job.black), white: strengthForPlayer(job.white) };
    const started = Date.now();
    try {
      const result = await playGame(engines, players, job.seed, job.openingPlies);
      process.send({ ...job, ...result, ms: Date.now() - started });
    } catch (error) {
      process.send({ ...job, error: String(error?.stack ?? error) });
    }
  });
  process.send({ type: "ready" });
}

/** 引き分けを0.5勝としたBradley-Terryモデルで、先頭の選手を0とするレーティングと標準誤差を推定する。 */
export function fitRatings(players, games) {
  const index = new Map(players.map((player, i) => [player, i]));
  const n = players.length;
  const ratings = new Array(n).fill(0);
  const scale = Math.log(10) / 400;
  let hessian = [];
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const gradient = new Array(n).fill(0);
    hessian = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const game of games) {
      const a = index.get(game.black);
      const b = index.get(game.white);
      const score = game.winner === "black" ? 1 : game.winner === "white" ? 0 : 0.5;
      const expected = 1 / (1 + Math.exp(-scale * (ratings[a] - ratings[b])));
      gradient[a] += scale * (score - expected);
      gradient[b] -= scale * (score - expected);
      const curvature = scale * scale * expected * (1 - expected);
      hessian[a][a] += curvature;
      hessian[b][b] += curvature;
      hessian[a][b] -= curvature;
      hessian[b][a] -= curvature;
    }
    // 先頭を基準に固定し、残りをニュートン法で更新する。全勝・全敗での発散を防ぐため弱い事前分布を置く。
    const size = n - 1;
    const matrix = Array.from({ length: size }, (_, i) => (
      Array.from({ length: size }, (_, j) => hessian[i + 1][j + 1] + (i === j ? 1e-6 : 0))
    ));
    const vector = gradient.slice(1).map((value, i) => value - 1e-6 * ratings[i + 1]);
    const step = solve(matrix, vector);
    let change = 0;
    for (let i = 0; i < size; i += 1) {
      const delta = Math.max(-400, Math.min(400, step[i]));
      ratings[i + 1] += delta;
      change = Math.max(change, Math.abs(delta));
    }
    if (change < 0.01) break;
  }
  const size = n - 1;
  const covariance = invert(Array.from({ length: size }, (_, i) => (
    Array.from({ length: size }, (_, j) => hessian[i + 1][j + 1] + (i === j ? 1e-6 : 0))
  )));
  return players.map((player, i) => ({
    player,
    rating: Math.round(ratings[i]),
    se: i === 0 ? 0 : Math.round(Math.sqrt(Math.max(0, covariance[i - 1][i - 1]))),
  }));
}

function solve(matrix, vector) {
  const size = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < size; row += 1) {
      if (row === col || a[col][col] === 0) continue;
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= size; k += 1) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row, i) => (row[i] === 0 ? 0 : row[size] / row[i]));
}

function invert(matrix) {
  const size = matrix.length;
  return Array.from({ length: size }, (_, j) => solve(matrix, Array.from({ length: size }, (_, i) => (i === j ? 1 : 0))))
    .reduce((columns, column, j) => {
      column.forEach((value, i) => { columns[i][j] = value; });
      return columns;
    }, Array.from({ length: size }, () => new Array(size).fill(0)));
}

async function runMain() {
  const players = option("players", "L1,L5,L10,L15").split(",");
  players.forEach(strengthForPlayer);
  const gamesPerPair = Number(option("games", "40"));
  const gap = Number(option("gap", "2"));
  const workers = Number(option("workers", "8"));
  const seed = Number(option("seed", "20260927"));
  const outPath = option("out", "");
  const anchors = option("anchors", "").split(",").filter(Boolean);
  anchors.forEach(strengthForPlayer);
  const anchorGames = Number(option("anchor-games", "20"));
  const openingPlies = Number(option("opening-plies", "0"));
  const deadlineSec = Number(option("deadline-sec", "0"));
  const included = option("include", "").split(",").filter(Boolean)
    .flatMap((file) => JSON.parse(fs.readFileSync(path.resolve(projectRoot, file), "utf8")).games);

  const jobs = [];
  const explicitPairs = option("pairs", "").split(",").filter(Boolean).map((pair) => pair.split(":"));
  for (const pair of explicitPairs) if (pair.length !== 2 || pair.some((player) => !players.includes(player))) throw new Error(`対戦カードが不正です: ${pair.join(":")}`);
  const pairs = explicitPairs.length ? explicitPairs : players.flatMap((player, i) => players.slice(i + 1, i + gap + 1).map((other) => [player, other]));
  for (const pair of pairs) {
      for (let game = 0; game < gamesPerPair; game += 1) {
        const [black, white] = game % 2 === 0 ? pair : [...pair].reverse();
        jobs.push({ black, white, seed: seed + jobs.length * 7919, openingPlies });
      }
  }
  for (const anchor of anchors) {
    for (const player of players) {
      for (let game = 0; game < anchorGames; game += 1) {
        const [black, white] = game % 2 === 0 ? [anchor, player] : [player, anchor];
        jobs.push({ black, white, seed: seed + jobs.length * 7919, openingPlies });
      }
    }
  }
  const results = [];
  const total = jobs.length;
  const conditions = { seed, openingPlies, plannedGames: total, includedGames: included.length,
    settings: Object.fromEntries([...new Set([...players, ...anchors])].map((player) => [player, strengthForPlayer(player)])) };
  console.error(`${players.length}選手、${total}局を${workers}並列で対局します。`);

  const started = Date.now();
  await new Promise((resolve, reject) => {
    let running = 0;
    const scriptPath = fileURLToPath(import.meta.url);
    const children = [];
    if (deadlineSec > 0) {
      setTimeout(() => {
        console.error(`${deadlineSec}秒を過ぎたため、${results.length}/${total}局で打ち切ります。`);
        for (const child of children) child.kill();
        resolve();
      }, deadlineSec * 1000).unref();
    }
    for (let w = 0; w < Math.min(workers, jobs.length); w += 1) {
      const child = fork(scriptPath, ["--worker", ...["--hybrid", "--diagnostics"].filter((flag) => process.argv.includes(flag))], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
      children.push(child);
      running += 1;
      const next = () => {
        const job = jobs.shift();
        if (job) child.send(job);
        else child.send({ type: "quit" });
      };
      child.on("message", (message) => {
        if (message.type !== "ready") {
          if (message.error) {
            reject(new Error(message.error));
            return;
          }
          results.push(message);
          if (outPath) fs.writeFileSync(path.resolve(projectRoot, outPath), JSON.stringify({ players, complete: false, conditions, games: [...included, ...results] }, null, 2));
          if (results.length % 20 === 0) {
            const elapsed = (Date.now() - started) / 1000;
            console.error(`${results.length}/${total}局 (${elapsed.toFixed(0)}秒)`);
          }
        }
        next();
      });
      child.on("exit", () => {
        running -= 1;
        if (running === 0) resolve();
      });
    }
  });

  // 以前の結果を含める場合も、その先頭選手をレーティング0の基準に保つ。
  const allPlayers = [...new Set([...included.flatMap(({ black, white }) => [black, white]), ...players, ...anchors])];
  const allGames = [...included, ...results];
  const ratings = fitRatings(allPlayers, allGames);
  const lines = ["| 選手 | レーティング(±標準誤差) | 局数 | 勝率 | 平均手数 |", "| --- | ---: | ---: | ---: | ---: |"];
  for (const { player, rating, se } of ratings) {
    const own = allGames.filter(({ black, white }) => black === player || white === player);
    const score = own.reduce((sum, game) => (
      sum + (game.winner === "draw" ? 0.5 : (game.winner === "black") === (game.black === player) ? 1 : 0)
    ), 0);
    const plies = own.reduce((sum, game) => sum + game.plies, 0) / Math.max(1, own.length);
    lines.push(`| ${player} | ${rating} ±${se} | ${own.length} | ${(score / Math.max(1, own.length) * 100).toFixed(0)}% | ${plies.toFixed(0)} |`);
  }
  const reasons = allGames.reduce((map, { reason }) => map.set(reason, (map.get(reason) ?? 0) + 1), new Map());
  lines.push("", `終局理由: ${[...reasons].map(([reason, count]) => `${reason} ${count}`).join("、")}`);
  lines.push(`所要時間: ${((Date.now() - started) / 1000).toFixed(0)}秒`);
  console.log(lines.join("\n"));
  if (outPath) {
    fs.writeFileSync(path.resolve(projectRoot, outPath), JSON.stringify({ players: allPlayers, complete: results.length === total, conditions, ratings, games: allGames }, null, 2));
  }
}

if (process.argv.includes("--worker")) {
  runWorker().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMain().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
