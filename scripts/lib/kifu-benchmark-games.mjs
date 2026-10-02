// 棋譜解析ベンチマークで使う棋譜。図鑑の代表局(プロ・古典)と、悪手の出る低レベルの自動対局を合わせる。
// src/game-stateはTypeScriptなので、Nodeから直接使えるtsshogiで局面を作る。
import fs from "node:fs";
import path from "node:path";
import { Position, importKIF } from "tsshogi";
import * as referenceKifu from "../../src/data/reference-kifu.mjs";
import { STANDARD_SFEN, projectRoot } from "./node-engine.mjs";

function kifSteps(kif) {
  const record = importKIF(kif);
  if (record instanceof Error) throw record;
  const steps = [];
  record.goto(0);
  for (const node of record.moves) {
    if (node.ply > 0) record.goForward();
    if (node.ply > 0 && !node.move?.usi) break;
    steps.push({ sfen: record.position.sfen, lastMove: node.move?.usi ?? "" });
  }
  return steps;
}

function usiSteps(id, moves) {
  const position = Position.newBySFEN(STANDARD_SFEN);
  const steps = [{ sfen: position.sfen, lastMove: "" }];
  for (const usi of moves) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) throw new Error(`${id}: ${usi}を指せません`);
    steps.push({ sfen: position.sfen, lastMove: usi });
  }
  return steps;
}

/** 各棋譜を、図鑑と同じ形の局面の列({ sfen, lastMove })にする。 */
export function benchmarkGames() {
  const dex = Object.entries(referenceKifu)
    .filter(([, value]) => typeof value === "string")
    .map(([name, kif]) => ({ id: name.replace(/_KIFU$/, "").toLowerCase(), steps: kifSteps(kif) }));
  const file = path.join(projectRoot, "scripts/data/kifu-analysis-benchmark-games.json");
  const selfplay = JSON.parse(fs.readFileSync(file, "utf8")).games
    .map(({ id, moves }) => ({ id, steps: usiSteps(id, moves) }));
  return [...dex, ...selfplay];
}
