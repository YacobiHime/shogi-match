// 棋力テストの問題を作る開発用スクリプト(docs/skill-assessment-design.mdの4章)。
// 1. いろいろなLvのCPUどうしで対局させ、局面を集める(人がよくする間違いが出る局面にするため、CPUの選び方で指す)。
// 2. 審判のエンジンで局面を読み、問題になる局面を見つける。
//    - take(見る・取る): タダか得になる駒取りが、ただ1つの良い手
//    - save(見る・守る): 何もしないと駒を取られる。助ける手が良い手
//    - tactic(読む・手筋): すぐの駒取りではないが、数手で駒得になる、ただ1つの良い手
//    - defend(受ける): 何もしないと詰まされる(詰めろ)。詰まない受けの手が良い手
//    - judge(判断・3択): 駒の取り合いのない局面で、最善手と、自然だが劣る2手から選ぶ
// 3. CPUの各Lvに解かせ、半分が解けるLv(cpuB)を問題の難しさの元にする。詰将棋(問題集のデータ)も同じように解かせる。
// 出力は src/data/skill-test-items.mjs(生成物。手で書き換えない)。
// 使い方: node scripts/build-skill-test-items.mjs [--games 36] [--seed 20261027] [--cache /tmp/skill-items.json] [--phase all|positions|calibrate|judge] [--judge-file judge.json]
//   判断の3択が足りないときは、別のseedで --phase judge --judge-file を走らせてから、--phase calibrate --judge-file で足す。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "./lib/ts-register.mjs";
import { Position } from "tsshogi";
import { comparableScore } from "../src/core/move-selection.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings, logicLevelOf } from "../src/core/strength-settings.mjs";
import { material, playLight, replyLoss, stateFromSfen } from "../src/core/logic-position.mjs";
import { STANDARD_SFEN, createNodeEngine, legalMoves, projectRoot, search, seededRandom } from "./lib/node-engine.mjs";
const { chooseAwareMove } = await import("../src/core/aware-move-choice.mjs");
const { chooseLogicMove } = await import("../src/core/logic-ai.mjs");
const { TSUME_PROBLEMS } = await import("../src/data/tsume-problems.mjs");
const { JISSEN_TSUME_PROBLEMS } = await import("../src/data/jissen-tsume-problems.mjs");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const GAMES = Number(option("games", "160"));
const SEED = Number(option("seed", "20261027"));
const CACHE = option("cache", path.join(os.tmpdir(), "skill-test-items-cache.json"));
const PHASE = option("phase", "all");
/** 判断の3択だけを探す追加の読み(--phase judge)の書き出し先と、calibrateで足すときの読み込み元。 */
const JUDGE_FILE = option("judge-file", "");
const OUT = path.join(projectRoot, "src/data/skill-test-items.mjs");
const REF_NODES = 60000;
const NULL_NODES = 30000;
const MAX_PLIES = 150;
/** 解かせるCPUのLv。 */
const LADDER = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
const TRIALS = 2;
/** 1種類あたりの問題の数の上限。 */
const PER_TYPE = 90;

const random = seededRandom(SEED);
const isMate = (score) => score?.type === "mate";
const positionOf = (sfen) => Position.newBySFEN(sfen);
const nullMoveSfen = (sfen) => {
  const parts = sfen.split(" ");
  parts[1] = parts[1] === "b" ? "w" : "b";
  return parts.join(" ");
};
/** 手を指したあと、相手の取りの読み(depth手)を受けた、自分の駒の損得。 */
function netAfter(state, usi, depth) {
  const child = playLight(state, usi);
  return child ? material(child, state.turn) - replyLoss(child, depth) : -Infinity;
}
/** 読み筋をplies手まで指した局面での、手番側(最初の手番)の駒の損得。 */
function materialAlongPv(sfen, pv, plies) {
  let state = stateFromSfen(sfen);
  const side = state.turn;
  for (const usi of pv.slice(0, plies)) {
    const next = playLight(state, usi);
    if (!next) break;
    state = next;
  }
  return material(state, side) - replyLoss(state, 2) * (state.turn === side ? 0 : 1);
}
const isCapture = (sfen, usi) => {
  if (!usi || usi.includes("*")) return false;
  const position = positionOf(sfen);
  const move = position.createMoveByUSI(usi);
  return Boolean(move && position.board.at(move.to));
};

function presetSettings(level) {
  const preset = CPU_STRENGTH_PRESETS.find((entry) => entry.level === level);
  return { preset, strength: { ...getStrengthSearchSettings(preset.value), level }, logicLevel: logicLevelOf(preset.value) };
}

/** そのLvのCPUが選ぶ手。対局画面と同じ選び方(24級〜16級はロジックAI)。onlyを渡すと、その手の中から選ぶ。 */
async function cpuChoice(engine, level, sfen, history, only = null) {
  const { strength, logicLevel } = presetSettings(level);
  const moves = only ?? legalMoves(positionOf(sfen));
  const logic = () => chooseLogicMove({ sfen, legalMoves: moves, moveHistory: history, level: logicLevel ?? 10, random });
  if (logicLevel !== null) return logic()?.move ?? null;
  engine.newGame();
  await engine.ready();
  const result = await search(engine, sfen, { ...strength, ...(only ? { searchMoves: only, multiPv: Math.min(only.length, strength.multiPv ?? only.length) } : {}) });
  const choice = await chooseAwareMove({
    strength, sfen, legalMoves: moves, moveHistory: history, search: result,
    verify: (searchMoves, nodes) => search(engine, sfen, { nodes, multiPv: searchMoves.length, searchMoves }),
    probe: (line, { nodes, multiPv }) => search(engine, `${sfen} moves ${line.join(" ")}`, { nodes, multiPv }),
    random,
  }) ?? logic();
  return choice?.move ?? null;
}

/** いろいろなLvのCPUどうしの対局から、局面を集める。 */
async function collectPositions(engine) {
  const positions = [];
  for (let game = 0; game < GAMES; game += 1) {
    // 弱すぎると数十手で大差が付いて使える局面が減るので、Lv10〜34から選ぶ。
    const levels = { b: 10 + Math.floor(random() * 25), w: 10 + Math.floor(random() * 25) };
    const position = positionOf(STANDARD_SFEN);
    const history = [];
    for (let ply = 0; ply < MAX_PLIES; ply += 1) {
      const sfen = position.sfen;
      if (!legalMoves(position).length) break;
      if (ply >= 12) positions.push({ sfen, history: [...history], game, ply });
      const level = levels[sfen.split(" ")[1]];
      const usi = await cpuChoice(engine, level, sfen, history);
      const move = usi && position.createMoveByUSI(usi);
      if (!move || !position.doMove(move)) break;
      history.push(usi);
    }
    console.error(`対局 ${game + 1}/${GAMES}（Lv${levels.b}対Lv${levels.w}、${history.length}手）`);
  }
  return positions;
}

/** 局面を読んで、問題になる形を見つける。 */
async function detectItem(refEngine, entry) {
  const { sfen } = entry;
  const result = await search(refEngine, sfen, { nodes: REF_NODES, multiPv: 8 });
  const cands = (result.candidates ?? []).filter(({ move }) => move).map((candidate) => ({ ...candidate, value: comparableScore(candidate.score) }));
  if (cands.length < 2 || cands.some(({ value }) => value === undefined)) return null;
  const best = cands[0];
  // 問題は「その手を見つけられるか」なので、形勢に差が付いていてもよい(判断の3択だけは互角に近い局面)。
  if (isMate(best.score) || Math.abs(best.value) >= 3000) return null;
  const second = cands[1];
  const gap = best.value - second.value;
  const state = stateFromSfen(sfen);
  const now = material(state, state.turn);
  const position = positionOf(sfen);
  const accepted = (margin) => cands.filter(({ value, score }) => !(isMate(score) && score.value < 0) && value >= best.value - margin).map(({ move }) => move);
  // 何もしないとどうなるか(手番を渡した局面を相手側から読む)。王手されているときは調べない。
  let threat = null;
  if (!position.checked) {
    const nullResult = await search(refEngine, nullMoveSfen(sfen), { nodes: NULL_NODES, multiPv: 1 });
    const top = nullResult.candidates?.find(({ rank }) => rank === 1);
    if (top) threat = { move: top.move, score: top.score, value: comparableScore(top.score) };
  }
  const base = { sfen, history: entry.history, game: entry.game, ply: entry.ply, best: best.move, pv: best.pv ?? [] };
  // 受ける: 何もしないと詰まされる(詰めろ)のに、受ける手がある。
  if (threat && isMate(threat.score) && threat.score.value > 0 && threat.score.value <= 9) {
    const ok = accepted(300);
    if (ok.length && ok.length <= 5) return { ...base, type: "defend", accepted: ok, threatMate: threat.score.value };
    return null;
  }
  const net2 = (usi) => netAfter(state, usi, 2);
  // 見る・取る: 駒を取る手が、ただ1つの良い手で、取り合いの2手の読みで駒得になる。
  if (gap >= 300 && isCapture(sfen, best.move) && net2(best.move) - now >= 300) {
    return { ...base, type: "take", accepted: accepted(150), gain: net2(best.move) - now };
  }
  // 見る・守る: 何もしないと駒を取られて400以上損をする。助ける手が良い手。
  const passLoss = threat?.value === undefined ? 0 : best.value + threat.value;
  const nullState = { ...state, turn: state.turn === "black" ? "white" : "black" };
  if (threat && !isMate(threat.score) && passLoss >= 400 && replyLoss(nullState, 2) >= 300 && gap >= 150) {
    const ok = accepted(200);
    if (ok.length <= 5) return { ...base, type: "save", accepted: ok, passLoss };
  }
  // 読む・手筋: すぐの駒取りではないが、読み筋の5手先で300以上の駒得。ただ1つの良い手。
  if (gap >= 400 && !(isCapture(sfen, best.move) && net2(best.move) - now >= 300) && materialAlongPv(sfen, best.pv ?? [best.move], 5) - now >= 300) {
    return { ...base, type: "tactic", accepted: accepted(150) };
  }
  // 判断(3択): 取り合いの起きていない落ち着いた局面で、最善手と、自然だが劣る2手。
  if (Math.abs(best.value) <= 600 && (!threat || passLoss < 200)) {
    const natural = cands.slice(1).filter(({ move, value }) => best.value - value >= 200 && best.value - value <= 1000 && net2(move) >= now - 100);
    if (natural.length >= 2 && best.value - second.value >= 120) {
      const pick = natural.slice(0, 4).sort(() => random() - 0.5).slice(0, 2).map(({ move }) => move);
      return { ...base, type: "judge", accepted: [best.move], choices: [best.move, ...pick].sort(() => random() - 0.5) };
    }
  }
  return null;
}

/** 正解しやすさの曲線(判断の3択は、当て推量で1/3)。aは1Lvあたりのロジット。 */
const responseProbability = (level, b, guess) => guess + (1 - guess - 0.02) / (1 + Math.exp(-0.5 * (level - b)));
/** CPUの正誤から、半分が解けるLv(最尤)。 */
function fitDifficulty(results, guess) {
  let bestB = 0;
  let bestLog = -Infinity;
  for (let b = -10; b <= 55; b += 0.25) {
    let log = 0;
    for (const { level, correct } of results) {
      const p = Math.min(0.999, Math.max(0.001, responseProbability(level, b, guess)));
      log += correct ? Math.log(p) : Math.log(1 - p);
    }
    if (log > bestLog) {
      bestLog = log;
      bestB = b;
    }
  }
  return bestB;
}

async function calibrate(engine, item) {
  const results = [];
  for (const level of LADDER) {
    for (let trial = 0; trial < TRIALS; trial += 1) {
      const move = await cpuChoice(engine, level, item.sfen, item.history ?? [], item.choices ?? null);
      results.push({ level, correct: Boolean(move && item.accepted.includes(move)) });
    }
  }
  return { cpuB: fitDifficulty(results, item.choices ? 1 / 3 : 0), solved: results.filter(({ correct }) => correct).length };
}

/**
 * 判断の3択だけを探す(追加の読み)。最初の読みの条件(MultiPV 8で、最善と2番目の差が120以上)では、落ち着いた局面の問題が
 * ほとんど見つからなかったので、読む手を12に増やし、2番目の手との差は問わない(選択肢に入れるのは、最善より150〜1200劣る手だけ)。
 * 手番を渡したときの読みの代わりに、取り合いの2手の読みで、取られそうな駒がないことを確かめる(速さのため)。
 */
async function detectJudge(refEngine, entry) {
  const { sfen } = entry;
  const position = positionOf(sfen);
  if (position.checked) return null;
  const state = stateFromSfen(sfen);
  const nullState = { ...state, turn: state.turn === "black" ? "white" : "black" };
  if (replyLoss(nullState, 2) >= 200) return null;
  const result = await search(refEngine, sfen, { nodes: REF_NODES, multiPv: 12 });
  const cands = (result.candidates ?? []).filter(({ move }) => move).map((candidate) => ({ ...candidate, value: comparableScore(candidate.score) }));
  if (cands.length < 3 || cands.some(({ value, score }) => value === undefined || isMate(score))) return null;
  const best = cands[0];
  if (Math.abs(best.value) > 800) return null;
  const now = material(state, state.turn);
  // 最善手が駒得になる駒取りなら、判断ではなく「取れる駒」の問題なので除く。
  if (isCapture(sfen, best.move) && netAfter(state, best.move, 2) - now >= 100) return null;
  const natural = cands.slice(1).filter(({ move, value }) => best.value - value >= 150 && best.value - value <= 1200 && netAfter(state, move, 2) >= now - 100);
  if (natural.length < 2) return null;
  const pick = natural.slice(0, 5).sort(() => random() - 0.5).slice(0, 2).map(({ move }) => move);
  return {
    sfen, history: entry.history, game: entry.game, ply: entry.ply, best: best.move, pv: best.pv ?? [],
    type: "judge", accepted: [best.move], choices: [best.move, ...pick].sort(() => random() - 0.5),
  };
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    return {};
  }
}
const writeCache = (cache) => fs.writeFileSync(CACHE, JSON.stringify(cache));

async function main() {
  const engine = await createNodeEngine();
  const refEngine = await createNodeEngine();
  const cache = readCache();
  if (PHASE === "judge") {
    // 判断の3択だけを、別の対局から探してJUDGE_FILEへ書く(calibrateで--judge-fileを付けると足す)。
    const positions = await collectPositions(engine);
    const found = [];
    const lastPly = new Map();
    for (const [index, entry] of positions.entries()) {
      if (found.length >= PER_TYPE) break;
      if (lastPly.has(entry.game) && entry.ply - lastPly.get(entry.game) < 6) continue;
      const item = await detectJudge(refEngine, entry);
      if (item) {
        found.push(item);
        lastPly.set(entry.game, entry.ply);
      }
      if (index % 200 === 0) console.error(`判断の読み ${index}/${positions.length}（問題 ${found.length}）`);
    }
    fs.writeFileSync(JUDGE_FILE, JSON.stringify(found));
    console.error(`判断の問題 ${found.length}`);
    engine.quit();
    refEngine.quit();
    process.exit(0);
  }
  if (PHASE === "all" || PHASE === "positions" || !cache.items) {
    const positions = await collectPositions(engine);
    console.error(`局面 ${positions.length}`);
    const found = [];
    for (const [index, entry] of positions.entries()) {
      const item = await detectItem(refEngine, entry);
      if (item) found.push(item);
      if (index % 200 === 0) console.error(`読み ${index}/${positions.length}（問題の候補 ${found.length}）`);
    }
    // 同じ対局の近い局面は、似た問題になるので間を空ける。種類ごとに上限まで。
    const items = [];
    const lastPly = new Map();
    for (const item of found) {
      const key = `${item.type}:${item.game}`;
      if (lastPly.has(key) && item.ply - lastPly.get(key) < 6) continue;
      if (items.filter(({ type }) => type === item.type).length >= PER_TYPE) continue;
      lastPly.set(key, item.ply);
      items.push(item);
    }
    cache.items = items;
    cache.calibrated = {};
    writeCache(cache);
    console.error(`問題 ${items.length}（${["take", "save", "tactic", "defend", "judge"].map((type) => `${type} ${items.filter((item) => item.type === type).length}`).join("・")}）`);
  }
  if (PHASE === "all" || PHASE === "calibrate") {
    cache.calibrated ??= {};
    if (JUDGE_FILE && !cache.judgeAdded) {
      // 追加の読みの判断の問題を、後ろに足す(前の問題のidは変わらない)。
      const extra = JSON.parse(fs.readFileSync(JUDGE_FILE, "utf8"));
      const room = Math.max(0, PER_TYPE - cache.items.filter(({ type }) => type === "judge").length);
      cache.items.push(...extra.slice(0, room));
      cache.judgeAdded = true;
      writeCache(cache);
    }
    const tsume = [...TSUME_PROBLEMS.map((entry) => ({ ...entry, source: "tsume" })), ...JISSEN_TSUME_PROBLEMS.map((entry) => ({ ...entry, source: "jissen" }))]
      .map((entry) => ({ id: entry.id, type: "mate", source: entry.source, sfen: entry.sfen, accepted: [entry.line.split(" ")[0]], plies: entry.line.split(" ").length }));
    const all = [...cache.items.map((item, index) => ({ ...item, id: `st-${item.type}-${index}` })), ...tsume];
    for (const [index, item] of all.entries()) {
      if (cache.calibrated[item.id]) continue;
      cache.calibrated[item.id] = await calibrate(engine, item);
      if (index % 20 === 0) {
        writeCache(cache);
        console.error(`解かせる ${index}/${all.length}`);
      }
    }
    writeCache(cache);
    const generated = all.filter(({ type }) => type !== "mate").map((item) => ({
      id: item.id, type: item.type, sfen: item.sfen, accepted: item.accepted, ...(item.choices ? { choices: item.choices } : {}),
      best: item.best, pv: (item.pv ?? []).slice(0, 7), cpuB: cache.calibrated[item.id].cpuB,
    }));
    const mates = all.filter(({ type }) => type === "mate").map((item) => ({ id: item.id, cpuB: cache.calibrated[item.id].cpuB }));
    const lines = [
      "// 棋力テストの問題。scripts/build-skill-test-items.mjs で生成したもので、手で書き換えない(docs/skill-assessment-design.mdの4章)。",
      "// いろいろなLvのCPUどうしの対局の局面から、審判のエンジンで問題になる局面を選んだ。",
      "// acceptedは正解の手(USI)、choicesは3択の選択肢、bestは最善手、pvは答えのあとの読み筋。",
      "// cpuBは、CPUの各Lvに解かせて半分が解けたLv(難しさの元。人に合わせた補正はskill-test.mjsのTYPE_OFFSETS)。",
      `// 生成: seed ${SEED}、対局 ${GAMES}、審判 ${REF_NODES}nodes、解かせたLv ${LADDER.join(",")}×${TRIALS}回。`,
      "",
      `export const SKILL_TEST_ITEMS = Object.freeze(${JSON.stringify(generated, null, 1)});`,
      "",
      "/** 問題集の詰将棋(初手)を、CPUの各Lvに解かせて半分が解けたLv。 */",
      `export const SKILL_TEST_MATE_CPU_B = Object.freeze(${JSON.stringify(Object.fromEntries(mates.map(({ id, cpuB }) => [id, cpuB])), null, 1)});`,
      "",
    ];
    fs.writeFileSync(OUT, lines.join("\n"));
    console.error(`書き出し ${path.relative(projectRoot, OUT)}（問題 ${generated.length}、詰将棋 ${mates.length}）`);
  }
  engine.quit();
  refEngine.quit();
  process.exit(0);
}

await main();
