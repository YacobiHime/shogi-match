// 棋力テストの問題を作る開発用スクリプト(docs/skill-assessment-design.mdの4章と10章。v2)。
// 問いは約束で、約束を守る手を全部正解にする。人のものさし(問いの約束)とエンジンのものさしが一致する局面だけを問題にする。
//   - take(見る・取る): 得する駒取り(取り合いの2手の読みで300以上)のすべてが正解。どれも最善から300以内で、ほかの手は300以上悪い
//   - save(見る・守る): 取られないようにする手(取り合いの2手の読みで損100以下)のすべてが正解。どれも最善から400以内で、ほかの手は300以上悪い
//   - tactic(読む・手筋): 名前の付いた手筋の形(move-tesuji.mjsのdetectTesujiShape)で、駒得や寄せがその形から生まれる
//   - defend(受ける): 詰めろを受ける手。詰まない手のすべてが正解(最善手は王手でない受けの手)
//   - judge(判断・3択): 落ち着いた局面で、最善手と、200以上劣る自然な2手
// 1. games: いろいろなLv(10〜34)のCPUどうしで対局させ、棋譜を集める(--seedを変えて分けて走らせる)。
// 2. detect: 局面を審判のエンジンで読み、問題を見つける(--shard i/nで分けて走らせる)。
//    detect-yose: 寄せの手筋だけを、寄せの形の手がある局面から探す(寄せの手筋はdetectではほとんど見つからない)。
// 3. select: 見つけた問題から、種類ごとに選ぶ(同じ対局の近い局面は1つ、手筋は1つの名前が3分の1まで)。
// 4. verify: 受けの正解と判断の答えを読み直す(詰みが見つかった手は正解から外し、答えが揺れる判断の問題は外す)。
// 5. calibrate: CPUの各Lvに解かせ、半分が解けるLv(cpuB)を求める(--shard i/n)。
// 6. write: src/data/skill-test-items.mjs(生成物。手で書き換えない)へ書き出す。詰将棋のcpuBは前の版の値を引き継ぐ。
// 使い方の例(作業用の一時フォルダーを WORK に):
//   node scripts/build-skill-test-items.mjs --phase games --seed 1 --games 120 --out $WORK/games-1.json
//   node scripts/build-skill-test-items.mjs --phase detect --in $WORK/games-1.json,$WORK/games-2.json --shard 0/4 --out $WORK/found-0.json
//   node scripts/build-skill-test-items.mjs --phase detect-yose --in $WORK/games-1.json,... --out $WORK/found-yose.json
//   node scripts/build-skill-test-items.mjs --phase select --in $WORK/found-0.json,...,$WORK/found-yose.json --out $WORK/selected.json
//   node scripts/build-skill-test-items.mjs --phase verify --in $WORK/selected.json --out $WORK/verified.json
//   node scripts/build-skill-test-items.mjs --phase calibrate --in $WORK/verified.json --shard 0/4 --out $WORK/cal-0.json
//   node scripts/build-skill-test-items.mjs --phase write --in $WORK/verified.json --cal $WORK/cal-0.json,...
import fs from "node:fs";
import path from "node:path";
import "./lib/ts-register.mjs";
import { Position } from "tsshogi";
import { comparableScore } from "../src/core/move-selection.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings, logicLevelOf } from "../src/core/strength-settings.mjs";
import { material, playLight, replyLoss, stateFromSfen } from "../src/core/logic-position.mjs";
import { SAVE_LOSS_MAX, TAKE_GAIN_MIN, THREAT_LOSS_MIN, isCaptureMove, materialSwing, passLoss, profitableCaptures, savingMoves } from "../src/core/skill-test-promise.mjs";
import { detectTesujiShape, tesujiShape } from "../src/core/tesuji-shape.mjs";
import { STANDARD_SFEN, createNodeEngine, legalMoves, projectRoot, search, seededRandom } from "./lib/node-engine.mjs";
const { chooseAwareMove } = await import("../src/core/aware-move-choice.mjs");
const { chooseLogicMove } = await import("../src/core/logic-ai.mjs");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const PHASE = option("phase", "");
const SEED = Number(option("seed", "20261030"));
const GAMES = Number(option("games", "120"));
const INPUTS = String(option("in", "")).split(",").filter(Boolean);
const OUT_FILE = option("out", "");
const [SHARD, SHARDS] = String(option("shard", "0/1")).split("/").map(Number);
const OUT = path.join(projectRoot, "src/data/skill-test-items.mjs");
const MAX_PLIES = 150;
/** 局面を集め始める手数(序盤の定跡の局面は問題にしない)。 */
const FIRST_PLY = 12;
/** 審判の読み: 最初の読み・手を渡したときの読み・二度目の深い読み・受けの手を1つずつ確かめる読み。 */
const FIRST_NODES = 60000;
const NULL_NODES = 30000;
const DEEP_NODES = 400000;
const SAFE_NODES = 100000;
/** 一度に読ませる手の数(全部の合法手を一度に読ませると、WASMのエンジンが止まった)。 */
const CHUNK = 24;
/** 約束を守らない手は、最善よりこれだけ悪い(人のものさしとエンジンのものさしが一致する)。 */
const OTHER_GAP = 300;
/** 約束を守る手が、最善からこれ以内(取る・守る)。 */
const TAKE_SPREAD = 300;
const SAVE_SPREAD = 400;
/** 手筋の正解は、同じ名前の形で最善から200以内。 */
const TESUJI_SPREAD = 200;
/**
 * 寄せの手筋では、形でない手が最善よりこれだけ悪い。寄せの局面は良い攻めの手が並びやすく、300では1問も見つからなかった
 * (約3万3千局面。2026-10-30)ので、200にする(docs/skill-assessment-design.mdの10-11)。
 */
const YOSE_GAP = 200;
/** 判断の3択: 2つの選択肢は、深い読みで最善より200〜1200劣る。 */
const JUDGE_GAP = 200;
const JUDGE_MAX = 1200;
/** 受け: 詰まない手が合法手のこれ以下の割合。最善手の評価がこれより上(もう負けている局面では受けを問わない)。 */
const DEFEND_SAFE_SHARE = 0.25;
const DEFEND_FLOOR = -2000;
/** 解かせるCPUのLv。 */
const LADDER = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
const TRIALS = 2;
/** 種類ごとの問題の数の上限。手筋は駒得と寄せに分け、1つの名前は手筋の問題の3分の1まで。 */
const QUOTA = { take: 80, save: 80, gain: 60, yose: 30, defend: 80, judge: 80 };
const SAME_GAME_PLIES = 6;

const random = seededRandom(SEED);
const positionOf = (sfen) => Position.newBySFEN(sfen);

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

/** いろいろなLvのCPUどうしの対局の棋譜を集める(人がよくする間違いが出る局面にするため、CPUの選び方で指す)。 */
async function collectGames(engine) {
  const games = [];
  for (let game = 0; game < GAMES; game += 1) {
    // 弱すぎると数十手で大差が付いて使える局面が減るので、Lv10〜34から選ぶ。
    const levels = { b: 10 + Math.floor(random() * 25), w: 10 + Math.floor(random() * 25) };
    const position = positionOf(STANDARD_SFEN);
    const moves = [];
    for (let ply = 0; ply < MAX_PLIES; ply += 1) {
      const sfen = position.sfen;
      if (!legalMoves(position).length) break;
      const usi = await cpuChoice(engine, levels[sfen.split(" ")[1]], sfen, moves);
      const move = usi && position.createMoveByUSI(usi);
      if (!move || !position.doMove(move)) break;
      moves.push(usi);
    }
    games.push({ id: `${SEED}-${game}`, levels, moves });
    console.error(`対局 ${game + 1}/${GAMES}（Lv${levels.b}対Lv${levels.w}、${moves.length}手）`);
    if (game % 5 === 4) fs.writeFileSync(OUT_FILE, JSON.stringify(games));
  }
  return games;
}

const isMate = (score) => score?.type === "mate";
const nullMoveSfen = (sfen) => {
  const parts = sfen.split(" ");
  parts[1] = parts[1] === "b" ? "w" : "b";
  return parts.join(" ");
};
function afterMove(sfen, usi) {
  const position = positionOf(sfen);
  const move = position.createMoveByUSI(usi);
  return move && position.doMove(move) ? position : null;
}
const givesCheck = (sfen, usi) => Boolean(afterMove(sfen, usi)?.checked);
/** 読みの候補を、値の高い順に。 */
const ranked = (result) => (result.candidates ?? [])
  .filter(({ move }) => move)
  .map((candidate) => ({ move: candidate.move, score: candidate.score, pv: candidate.pv ?? [candidate.move], value: comparableScore(candidate.score) }))
  .filter(({ value }) => value !== undefined)
  .sort((a, b) => b.value - a.value);
/** 指定の手を全部読む(CHUNK手ずつ)。 */
async function readMoves(engine, sfen, moves, nodes) {
  const list = [];
  for (let index = 0; index < moves.length; index += CHUNK) {
    const chunk = moves.slice(index, index + CHUNK);
    list.push(...ranked(await search(engine, sfen, { nodes, multiPv: chunk.length, searchMoves: chunk })));
  }
  return list.sort((a, b) => b.value - a.value);
}
/** 相手側の手番の局面で、手番側に詰みがあるか(何手で)。 */
async function mateFor(engine, sfen, nodes = NULL_NODES) {
  const top = ranked(await search(engine, sfen, { nodes, multiPv: 1 }))[0];
  return top && isMate(top.score) && top.score.value > 0 ? { plies: top.score.value, move: top.move } : null;
}
/** 読み筋をplies手まで指した局面での、最初の手番側の駒の損得の変わり方(相手の番なら、取りの読みを引く)。 */
function gainAlong(sfen, pv, plies) {
  let state = stateFromSfen(sfen);
  const side = state.turn;
  const base = material(state, side);
  for (const usi of pv.slice(0, plies)) {
    const next = playLight(state, usi);
    if (!next) return -Infinity;
    state = next;
  }
  return material(state, side) - base - (state.turn === side ? 0 : replyLoss(state, 2));
}
const squareDistance = (a, b) => Math.max(Math.abs(Number(a[0]) - Number(b[0])), Math.abs(a.charCodeAt(1) - b.charCodeAt(1)));

/** 棋譜から、問題にする局面を並べる。 */
function positionsOf(games) {
  const list = [];
  for (const game of games) {
    const position = positionOf(STANDARD_SFEN);
    for (const [ply, usi] of game.moves.entries()) {
      if (ply >= FIRST_PLY) list.push({ sfen: position.sfen, history: game.moves.slice(0, ply), game: game.id, ply });
      const move = position.createMoveByUSI(usi);
      if (!move || !position.doMove(move)) break;
    }
  }
  return list;
}

/** 受ける: 何もしないと詰まされる。詰まない手のすべてが正解で、最善手は王手でない受けの手。 */
async function detectDefend(engine, entry, legal, best, threat) {
  const { sfen } = entry;
  if (best.value <= DEFEND_FLOOR || givesCheck(sfen, best.move)) return null;
  const all = await readMoves(engine, sfen, legal, FIRST_NODES);
  const safe = [];
  for (const { move, score } of all) {
    if (isMate(score) && score.value < 0) continue;
    // 指したあとの局面を、相手の側から読み直して、詰みがないことを確かめる。
    const after = afterMove(sfen, move);
    if (!after || await mateFor(engine, after.sfen, SAFE_NODES)) continue;
    safe.push(move);
    if (safe.length > legal.length * DEFEND_SAFE_SHARE) return null;
  }
  if (!safe.includes(best.move)) return null;
  // 最善手が自分の詰めろにもなる手(攻防)は、受けの問題にしない。
  const afterBest = afterMove(sfen, best.move);
  if (!afterBest || await mateFor(engine, nullMoveSfen(afterBest.sfen))) return null;
  return { type: "defend", accepted: safe, threat: threat.move, threatMate: threat.plies };
}

/** 見る・取る: 得する駒取りのすべてが正解。どれも最善から300以内で、ほかの手は300以上悪い。 */
async function detectTake(engine, entry, legal, first) {
  const { sfen } = entry;
  const takes = profitableCaptures(sfen, legal);
  const best = first[0];
  if (!takes.length || takes.length >= 12 || !takes.includes(best.move)) return null;
  const other = first.find(({ move }) => !takes.includes(move));
  if (other && best.value - other.value < OTHER_GAP) return null;
  const deep = ranked(await search(engine, sfen, { nodes: DEEP_NODES, multiPv: takes.length + 1 }));
  return agreeing(deep, takes, TAKE_SPREAD) ? { type: "take", accepted: takes, deep } : null;
}

/** 深い読みで、約束を守る手が上に全部並び、どれも最善からspread以内で、ほかの手はOTHER_GAP以上悪いか。 */
function agreeing(deep, promised, spread) {
  if (!deep.length || !promised.includes(deep[0].move)) return false;
  const top = deep[0].value;
  const head = deep.slice(0, promised.length);
  if (head.some(({ move }) => !promised.includes(move)) || head.length < promised.length) return false;
  if (head.some(({ value, score }) => value < top - spread || (isMate(score) && score.value < 0))) return false;
  const other = deep[promised.length];
  return !other || top - other.value >= OTHER_GAP;
}

/** 見る・守る: 取られないようにする手のすべてが正解。最善手もその1つで、反撃や攻め合いが良い局面は使わない。 */
async function detectSave(engine, entry, legal, first, threat) {
  const { sfen } = entry;
  if (passLoss(sfen) < THREAT_LOSS_MIN || !threat || isMate(threat.score)) return null;
  // 手を渡したときの相手の最善手が、こちらの駒を取る手であること(「△の角で銀を取られる」と言える)。
  const nullSfen = nullMoveSfen(sfen);
  if (!isCaptureMove(nullSfen, threat.move) || materialSwing(nullSfen, threat.move) < THREAT_LOSS_MIN) return null;
  if (first[0].value + threat.value < 400) return null;
  const keep = savingMoves(sfen, legal);
  if (!keep.length || keep.length > legal.length / 3 || keep.length >= 12 || !keep.includes(first[0].move)) return null;
  const other = first.find(({ move }) => !keep.includes(move));
  if (other && first[0].value - other.value < OTHER_GAP) return null;
  const deep = ranked(await search(engine, sfen, { nodes: DEEP_NODES, multiPv: keep.length + 1 }));
  if (!agreeing(deep, keep, SAVE_SPREAD)) return null;
  return { type: "save", accepted: keep, deep, threat: threat.move, target: threat.move.slice(2, 4) };
}

/** 手筋の効き目: 駒得や寄せが、その形から生まれるか(読み筋で確かめる)。 */
async function shapeWorks(engine, sfen, line, shape, info, gapToOther) {
  if (info.family === "yose") {
    // 寄せの手筋: 指したあと手番を渡すと詰む(詰めろ)か、形でない手より500以上良い。
    const after = afterMove(sfen, line[0]);
    return Boolean(after && (await mateFor(engine, nullMoveSfen(after.sfen)))) || gapToOther >= 500;
  }
  const captureAt = (index) => {
    const usi = line[index];
    return usi && isCaptureMove(sfenOfState(sfen, line.slice(0, index)), usi) ? usi.slice(2, 4) : null;
  };
  if (["focal-pawn", "tapping-pawn"].includes(shape.id)) {
    // 歩の手筋: 5手目までの自分の駒取りが、歩を打ったマスのまわりか、歩で動かされた駒で生まれる。
    const near = [line[0].slice(2, 4), ...(shape.targets ?? []), line[1]?.slice(2, 4)].filter(Boolean);
    const hit = [2, 4].some((index) => {
      const to = captureAt(index);
      return to && near.some((square) => squareDistance(square, to) <= 1);
    });
    return hit && Math.max(gainAlong(sfen, line, 3), gainAlong(sfen, line, 5)) >= TAKE_GAIN_MIN;
  }
  // 両取り・田楽刺し: 3手目(相手が1枚逃げたあと)に、ねらった駒を取って駒得。
  const to = captureAt(2);
  return Boolean(to && shape.targets.includes(to)) && gainAlong(sfen, line, 3) >= TAKE_GAIN_MIN;
}
/** 手順を指した局面のSFEN。 */
function sfenOfState(sfen, moves) {
  const position = positionOf(sfen);
  for (const usi of moves) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) break;
  }
  return position.sfen;
}

/** 読む・手筋: 最善手が名前の付いた手筋の形で、効き目が読み筋で確かめられる。正解は同じ名前の形で最善から200以内。 */
async function detectTactic(engine, entry, legal, first) {
  const { sfen } = entry;
  const best = first[0];
  const shape = detectTesujiShape({ sfenBefore: sfen, usi: best.move });
  if (!shape) return null;
  const info = /** @type {any} */ (tesujiShape(shape.id));
  const same = legal.filter((usi) => detectTesujiShape({ sfenBefore: sfen, usi })?.id === shape.id);
  const minGap = info.family === "yose" ? YOSE_GAP : OTHER_GAP;
  const other = first.find(({ move }) => !same.includes(move));
  const gapToOther = other ? best.value - other.value : Infinity;
  if (gapToOther < minGap) return null;
  if (!(await shapeWorks(engine, sfen, best.pv, shape, info, gapToOther))) return null;
  // 二度読み: 深い読みでも、最善手が同じ形で、形でない手は300以上悪い。
  const deep = ranked(await search(engine, sfen, { nodes: DEEP_NODES, multiPv: Math.min(same.length + 1, 8) }));
  if (!deep.length || !same.includes(deep[0].move) || detectTesujiShape({ sfenBefore: sfen, usi: deep[0].move })?.id !== shape.id) return null;
  const top = deep[0].value;
  const firstOther = deep.find(({ move }) => !same.includes(move));
  if (firstOther && top - firstOther.value < minGap) return null;
  const accepted = deep.filter(({ move, value }) => same.includes(move) && value >= top - TESUJI_SPREAD).map(({ move }) => move);
  const answer = detectTesujiShape({ sfenBefore: sfen, usi: deep[0].move });
  return { type: "tactic", family: info.family, tesuji: shape.id, targets: answer?.targets ?? shape.targets, accepted, deep };
}

/** 判断(3択): 落ち着いた局面で、最善手と、深い読みでも200〜1200劣る自然な2手。 */
async function detectJudge(engine, entry, first, threat) {
  const { sfen } = entry;
  if (passLoss(sfen) >= 200 || (threat && (isMate(threat.score) || first[0].value + threat.value >= 200))) return null;
  if (first.length < 3 || first.some(({ score }) => isMate(score))) return null;
  const best = first[0];
  if (Math.abs(best.value) > 800) return null;
  // 最善手が駒得になる駒取りなら、判断ではなく「取れる駒」の問題。
  if (isCaptureMove(sfen, best.move) && materialSwing(sfen, best.move) >= 100) return null;
  const natural = first.slice(1).filter(({ move, value }) => best.value - value >= 150 && best.value - value <= JUDGE_MAX && materialSwing(sfen, move) >= -SAVE_LOSS_MAX);
  if (natural.length < 2) return null;
  const pool = [best.move, ...natural.slice(0, 5).map(({ move }) => move)];
  const deep = ranked(await search(engine, sfen, { nodes: DEEP_NODES, multiPv: pool.length, searchMoves: pool }));
  if (!deep.length || deep[0].move !== best.move) return null;
  const top = deep[0].value;
  const fits = deep.slice(1).filter(({ value }) => top - value >= JUDGE_GAP && top - value <= JUDGE_MAX);
  if (fits.length < 2) return null;
  const pick = [...fits].sort(() => random() - 0.5).slice(0, 2);
  return {
    type: "judge", accepted: [best.move], deep,
    choices: [best.move, ...pick.map(({ move }) => move)].sort(() => random() - 0.5),
    gap: top - Math.max(...pick.map(({ value }) => value)),
  };
}

/** 局面を読んで、問題になる形を見つける。王手されている局面は使わない。 */
async function detectItem(engine, entry) {
  const { sfen } = entry;
  const position = positionOf(sfen);
  if (position.checked) return null;
  const legal = legalMoves(position);
  if (legal.length < 3) return null;
  const first = ranked(await search(engine, sfen, { nodes: FIRST_NODES, multiPv: 12 }));
  if (first.length < 3 || isMate(first[0].score) || Math.abs(first[0].value) >= 3000) return null;
  const threatTop = ranked(await search(engine, nullMoveSfen(sfen), { nodes: NULL_NODES, multiPv: 1 }))[0] ?? null;
  const base = { sfen, history: entry.history, game: entry.game, ply: entry.ply };
  const finish = (found) => {
    if (!found) return null;
    const { deep, ...rest } = found;
    const top = deep?.[0] ?? first[0];
    return { ...base, ...rest, best: top.move, pv: top.pv.slice(0, 7), line: top.pv.slice(0, 3) };
  };
  // 詰めろの局面は、受けの問題だけにする。
  if (threatTop && isMate(threatTop.score) && threatTop.score.value > 0) {
    if (threatTop.score.value > 9) return null;
    return finish(await detectDefend(engine, entry, legal, first[0], { move: threatTop.move, plies: threatTop.score.value }));
  }
  return finish(await detectTake(engine, entry, legal, first))
    ?? finish(await detectSave(engine, entry, legal, first, threatTop))
    ?? finish(await detectTactic(engine, entry, legal, first))
    ?? finish(await detectJudge(engine, entry, first, threatTop));
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const groupOf = (item) => (item.type === "tactic" ? item.family : item.type);

/** 見つけた問題から、種類ごとに選ぶ(同じ局面は1つ、同じ対局の近い局面は1つ。手筋は1つの名前が3分の1まで)。 */
function selectItems(found) {
  const shuffled = [...found].sort((a, b) => (a.game === b.game ? a.ply - b.ply : a.game < b.game ? -1 : 1)).map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key).map(({ item }) => item);
  const pick = (tesujiCap) => {
    const picked = [];
    for (const item of shuffled) {
      const group = groupOf(item);
      if (picked.filter((entry) => groupOf(entry) === group).length >= QUOTA[group]) continue;
      if (item.type === "tactic" && picked.filter((entry) => entry.tesuji === item.tesuji).length >= tesujiCap) continue;
      if (picked.some((entry) => entry.sfen === item.sfen || (entry.type === item.type && entry.game === item.game && Math.abs(entry.ply - item.ply) < SAME_GAME_PLIES))) continue;
      picked.push(item);
    }
    return picked;
  };
  // 1つの名前の上限は、選んだ手筋の問題の数の3分の1。見つかる数が名前ごとに偏るので、上限を下げながら合わせる。
  let picked = pick(Infinity);
  for (let cap = QUOTA.gain + QUOTA.yose; cap > 1; cap -= 1) {
    picked = pick(cap);
    const tactics = picked.filter(({ type }) => type === "tactic");
    const most = Math.max(0, ...Object.values(tactics.reduce((counts, { tesuji }) => ({ ...counts, [tesuji]: (counts[tesuji] ?? 0) + 1 }), {})));
    if (most <= Math.ceil(tactics.length / 3)) break;
  }
  const order = ["take", "save", "tactic", "defend", "judge"];
  return order.flatMap((type) => picked.filter((item) => item.type === type).map((item, index) => ({ ...item, id: `st2-${type}-${index}` })));
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

/** 書き出す問題の項目(対局の情報と手順は書かない)。 */
function outputItem(item, cpuB) {
  const keep = ["id", "type", "sfen", "accepted", "choices", "best", "pv", "threat", "threatMate", "target", "tesuji", "targets", "gap"];
  // 答えのあとに盤で動かす読み筋は、手筋と判断だけ(ほかは矢印と印で見せる)。
  if (item.type === "tactic" || item.type === "judge") keep.push("line");
  return { ...Object.fromEntries(keep.filter((key) => item[key] !== undefined).map((key) => [key, item[key]])), cpuB };
}

async function main() {
  if (PHASE === "detect") {
    const engine = await createNodeEngine();
    const positions = positionsOf(INPUTS.flatMap(readJson)).filter((_, index) => index % SHARDS === SHARD);
    // エンジンが止まったときは、--skip Nで、書き出し済みの問題を残してN局面目から続ける。
    const skip = Number(option("skip", "0"));
    const found = skip && fs.existsSync(OUT_FILE) ? readJson(OUT_FILE) : [];
    const started = Date.now();
    for (const [index, entry] of positions.entries()) {
      if (index < skip) continue;
      const item = await detectItem(engine, entry);
      if (item) found.push(item);
      if (index % 100 === 99 || index === positions.length - 1) {
        fs.writeFileSync(OUT_FILE, JSON.stringify(found));
        const count = (group) => found.filter((entry) => groupOf(entry) === group).length;
        console.error(`読み ${index + 1}/${positions.length}（${Math.round((Date.now() - started) / 1000)}秒）`
          + ` 取る${count("take")}・守る${count("save")}・手筋${count("gain")}+${count("yose")}・受け${count("defend")}・判断${count("judge")}`);
      }
    }
    engine.quit();
    process.exit(0);
  }
  if (PHASE === "detect-yose") {
    // 寄せの手筋だけを探す追加の読み。寄せの形に当たる合法手がある局面だけを読む。
    const engine = await createNodeEngine();
    const positions = positionsOf(INPUTS.flatMap(readJson)).filter((_, index) => index % SHARDS === SHARD);
    const skip = Number(option("skip", "0"));
    const found = skip && fs.existsSync(OUT_FILE) ? readJson(OUT_FILE) : [];
    for (const [index, entry] of positions.entries()) {
      if (index < skip) continue;
      const position = positionOf(entry.sfen);
      if (!position.checked) {
        const legal = legalMoves(position);
        if (legal.some((usi) => tesujiShape(detectTesujiShape({ sfenBefore: entry.sfen, usi })?.id ?? "")?.family === "yose")) {
          const first = ranked(await search(engine, entry.sfen, { nodes: FIRST_NODES, multiPv: 12 }));
          const shape = first[0] && detectTesujiShape({ sfenBefore: entry.sfen, usi: first[0].move });
          if (first.length >= 3 && !isMate(first[0].score) && Math.abs(first[0].value) < 3000 && tesujiShape(shape?.id ?? "")?.family === "yose") {
            const item = await detectTactic(engine, entry, legal, first);
            if (item) {
              const { deep, ...rest } = item;
              found.push({ sfen: entry.sfen, history: entry.history, game: entry.game, ply: entry.ply, ...rest, best: deep[0].move, pv: deep[0].pv.slice(0, 7), line: deep[0].pv.slice(0, 3) });
            }
          }
        }
      }
      if (index % 500 === 499 || index === positions.length - 1) {
        fs.writeFileSync(OUT_FILE, JSON.stringify(found));
        console.error(`寄せの読み ${index + 1}/${positions.length} 手筋${found.length}`);
      }
    }
    engine.quit();
    process.exit(0);
  }
  if (PHASE === "select") {
    const selected = selectItems(INPUTS.flatMap(readJson));
    fs.writeFileSync(OUT_FILE, JSON.stringify(selected));
    console.error(["take", "save", "tactic", "defend", "judge"].map((type) => `${type} ${selected.filter((item) => item.type === type).length}`).join("・"));
    const names = {};
    for (const item of selected.filter(({ type }) => type === "tactic")) names[item.tesuji] = (names[item.tesuji] ?? 0) + 1;
    console.error(JSON.stringify(names));
    process.exit(0);
  }
  if (PHASE === "verify") {
    // 選んだ問題を読み直す(docs/skill-assessment-design.mdの10-11)。
    // 受け: 全部の合法手の読みと、正解の手ごとの深い読み(相手の側から)のどれかで詰みが見つかった手は、正解から外す。最善手が外れたら問題ごと外す。
    // 判断: 3つの選択肢だけをもう一度深く読み、答えが同じで2番目より150以上良いものだけ残す(読みのぶれで答えが揺れる問題を外す)。
    const engine = await createNodeEngine();
    const kept = [];
    for (const item of INPUTS.flatMap(readJson)) {
      if (item.type === "defend") {
        const legal = legalMoves(positionOf(item.sfen));
        const mated = new Set((await readMoves(engine, item.sfen, legal, FIRST_NODES)).filter(({ score }) => isMate(score) && score.value < 0).map(({ move }) => move));
        const accepted = [];
        for (const usi of item.accepted) {
          const after = afterMove(item.sfen, usi);
          if (!mated.has(usi) && after && !(await mateFor(engine, after.sfen, DEEP_NODES))) accepted.push(usi);
        }
        if (!accepted.includes(item.best)) {
          console.error(`外す ${item.id}（最善手に詰みが見つかった）`);
          continue;
        }
        if (accepted.length < item.accepted.length) console.error(`${item.id} 正解 ${item.accepted.length}→${accepted.length}`);
        kept.push({ ...item, accepted });
        continue;
      }
      if (item.type === "judge") {
        const list = ranked(await search(engine, item.sfen, { nodes: DEEP_NODES, multiPv: 3, searchMoves: item.choices }));
        if (list[0]?.move !== item.best || list[0].value - list[1].value < 150) {
          console.error(`外す ${item.id}（読み直すと答えか差が変わる）`);
          continue;
        }
      }
      kept.push(item);
    }
    fs.writeFileSync(OUT_FILE, JSON.stringify(kept));
    console.error(["take", "save", "tactic", "defend", "judge"].map((type) => `${type} ${kept.filter((item) => item.type === type).length}`).join("・"));
    engine.quit();
    process.exit(0);
  }
  if (PHASE === "calibrate") {
    const engine = await createNodeEngine();
    const items = INPUTS.flatMap(readJson).filter((_, index) => index % SHARDS === SHARD);
    const out = {};
    for (const [index, item] of items.entries()) {
      out[item.id] = await calibrate(engine, item);
      if (index % 10 === 9 || index === items.length - 1) {
        fs.writeFileSync(OUT_FILE, JSON.stringify(out));
        console.error(`解かせる ${index + 1}/${items.length}`);
      }
    }
    engine.quit();
    process.exit(0);
  }
  if (PHASE === "write") {
    const { SKILL_TEST_MATE_CPU_B } = await import("../src/data/skill-test-items.mjs");
    const calibrated = Object.assign({}, ...String(option("cal", "")).split(",").filter(Boolean).map(readJson));
    const items = INPUTS.flatMap(readJson).filter((item) => calibrated[item.id]).map((item) => outputItem(item, calibrated[item.id].cpuB));
    const lines = [
      "// 棋力テストの問題。scripts/build-skill-test-items.mjs で生成したもので、手で書き換えない(docs/skill-assessment-design.mdの4章と10章)。",
      "// いろいろなLvのCPUどうしの対局の局面から、問いの約束と審判のエンジンが一致する局面を選んだ(v2)。",
      "// acceptedは正解の手(USI。約束を守る手のすべて)、choicesは3択の選択肢、bestは最善手、pvは答えからの読み筋、lineは答えのあとに盤で見せる3手。",
      "// threatは何もしないときの相手の手(守る: 駒を取る手、受け: 詰み筋の1手目)、targetは取られそうな駒のマス、tesujiは手筋の形のid、targetsはその形でねらう駒のマス。",
      "// cpuBは、CPUの各Lvに解かせて半分が解けたLv(難しさの元。人に合わせた補正はskill-test-bank.mjsのTYPE_OFFSETS)。",
      `// 生成: ${option("note", "CPUどうしの対局")}、審判 ${FIRST_NODES}nodes(二度目 ${DEEP_NODES}nodes)、解かせたLv ${LADDER.join(",")}×${TRIALS}回。`,
      "",
      `export const SKILL_TEST_ITEMS = Object.freeze(${JSON.stringify(items, null, 1)});`,
      "",
      "/** 問題集の詰将棋(初手)を、CPUの各Lvに解かせて半分が解けたLv(前の版の値を引き継ぐ)。 */",
      `export const SKILL_TEST_MATE_CPU_B = Object.freeze(${JSON.stringify(SKILL_TEST_MATE_CPU_B, null, 1)});`,
      "",
    ];
    fs.writeFileSync(OUT, lines.join("\n"));
    console.error(`書き出し ${path.relative(projectRoot, OUT)}（問題 ${items.length}）`);
    process.exit(0);
  }
  if (PHASE === "games") {
    const engine = await createNodeEngine();
    const games = await collectGames(engine);
    fs.writeFileSync(OUT_FILE, JSON.stringify(games));
    engine.quit();
    process.exit(0);
  }
  throw new Error(`--phase を games・detect・select・calibrate・write から選んでください（${PHASE}）`);
}

await main();
