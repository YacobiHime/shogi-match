// ロジックAI(Lv1〜10)どうしを対局させる開発用スクリプト。エンジンを使わないので速い。
// 使い方:
//   node scripts/logic-ai-duel.mjs --levels 10,8 [--games 100] [--seed 11]
//     いまの版のLv10とLv8を、先後を入れ替えながら対局させ、最初のレベルの得点率を出す。
//   node scripts/logic-ai-duel.mjs --levels 10,10 --baseline old-logic-ai.mjs
//     2番目の選手を、別のファイルのロジックAI(例: git show <コミット>:src/core/logic-ai.mjs で取り出した版)にする。
//     取り出した版の import は、このリポジトリの src/core への絶対パスに書き換えておく。
// 終局は詰み(合法手なし)。240手で終わらなければ、駒の損得(歩100)が1,500以上離れていれば勝ち、それ以外は引き分け。
import path from "node:path";
import { pathToFileURL } from "node:url";
import "./lib/ts-register.mjs";
import { Position } from "tsshogi";
import { material, stateFromSfen } from "../src/core/logic-position.mjs";
import { STANDARD_SFEN, legalMoves, seededRandom } from "./lib/node-engine.mjs";
const current = await import("../src/core/logic-ai.mjs");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const [levelA, levelB] = option("levels", "10,8").split(",").map(Number);
const games = Number(option("games", "100"));
const random = seededRandom(Number(option("seed", "11")));
const baselinePath = option("baseline", "");
const baseline = baselinePath ? await import(pathToFileURL(path.resolve(baselinePath)).href) : current;
const MAX_PLY = 240;
const DECISIVE = 1500;

let score = 0;
const tally = { win: 0, draw: 0, loss: 0 };
for (let game = 0; game < games; game += 1) {
  const aIsBlack = game % 2 === 0;
  const position = Position.newBySFEN(STANDARD_SFEN);
  const history = [];
  let result = null;
  for (let ply = 0; ply < MAX_PLY; ply += 1) {
    const moves = legalMoves(position);
    const aToMove = (position.sfen.split(" ")[1] === "b") === aIsBlack;
    if (!moves.length) {
      result = aToMove ? 0 : 1;
      break;
    }
    const choice = (aToMove ? current : baseline).chooseLogicMove({
      sfen: position.sfen, legalMoves: moves, level: aToMove ? levelA : levelB, moveHistory: history, random, maxTimeMs: 600,
    });
    position.doMove(position.createMoveByUSI(choice.move));
    history.push(choice.move);
  }
  if (result === null) {
    const balance = material(stateFromSfen(position.sfen), aIsBlack ? "black" : "white");
    result = balance >= DECISIVE ? 1 : balance <= -DECISIVE ? 0 : 0.5;
  }
  score += result;
  tally[result === 1 ? "win" : result === 0 ? "loss" : "draw"] += 1;
}
const label = baselinePath ? `Lv${levelA} 対 ${path.basename(baselinePath)}のLv${levelB}` : `Lv${levelA} 対 Lv${levelB}`;
console.log(`${label}: ${tally.win}勝${tally.draw}分${tally.loss}敗 得点率${(100 * score / games).toFixed(1)}%`);
