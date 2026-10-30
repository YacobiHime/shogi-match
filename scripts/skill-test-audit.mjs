// 棋力テストの問題の束を、盤の形と審判のエンジンで調べ直す開発用スクリプト(docs/skill-assessment-design.mdの10-1と10-9)。
// 問いの約束と正解の一覧の食い違い(約束を守るのに不正解になる手・約束にない正解)と、読みを深くしたときの答えの揺れを数える。
// 使い方: node scripts/skill-test-audit.mjs [--engine]   (--engineを付けると、受けの全部の手の読みと判断の読み直しもする。数分かかる)
import "./lib/ts-register.mjs";
import { Position } from "tsshogi";
import { comparableScore } from "../src/core/move-selection.mjs";
import { createNodeEngine, legalMoves, search } from "./lib/node-engine.mjs";
import { profitableCaptures, savingMoves } from "../src/core/skill-test-promise.mjs";
import { detectTesujiShape } from "../src/core/tesuji-shape.mjs";
const { SKILL_TEST_BANK } = await import("../src/core/skill-test-bank.mjs");

const WITH_ENGINE = process.argv.includes("--engine");
const items = SKILL_TEST_BANK.filter(({ type }) => type !== "mate");
const ofType = (type) => items.filter((item) => item.type === type);
const legalOf = (sfen) => legalMoves(Position.newBySFEN(sfen));
const sameSet = (a, b) => a.length === b.length && a.every((usi) => b.includes(usi));
const givesCheck = (sfen, usi) => {
  const position = Position.newBySFEN(sfen);
  const move = position.createMoveByUSI(usi);
  return Boolean(move && position.doMove(move) && position.checked);
};
const isMate = (score) => score?.type === "mate";
const rows = [];

const take = ofType("take");
rows.push(["take", take.length, `正解の一覧が得する駒取りのすべてと違う ${take.filter((item) => !sameSet(item.accepted, profitableCaptures(item.sfen, legalOf(item.sfen)))).length}`]);
const save = ofType("save");
rows.push(["save", save.length, `最善手が駒を助けない ${save.filter((item) => !savingMoves(item.sfen, [item.best]).length).length}・正解の一覧が駒を助ける手のすべてと違う ${save.filter((item) => !sameSet(item.accepted, savingMoves(item.sfen, legalOf(item.sfen)))).length}`]);
const tactic = ofType("tactic");
const names = {};
for (const item of tactic) names[item.tesuji] = (names[item.tesuji] ?? 0) + 1;
rows.push(["tactic", tactic.length, `形に当たらない正解 ${tactic.filter((item) => item.accepted.some((usi) => detectTesujiShape({ sfenBefore: item.sfen, usi })?.id !== item.tesuji)).length}・名前 ${JSON.stringify(names)}`]);
const defend = ofType("defend");
rows.push(["defend", defend.length, `最善手が王手 ${defend.filter((item) => givesCheck(item.sfen, item.best)).length}`]);
const judge = ofType("judge");
rows.push(["judge", judge.length, `2番目との差が200より小さい ${judge.filter((item) => !(item.gap >= 200)).length}`]);

if (WITH_ENGINE) {
  const engine = await createNodeEngine();
  let defendMated = 0;
  for (const item of defend) {
    // 全部の合法手を24手ずつ読み、正解の手に詰みが見つかるかを調べる(詰みが見つかった手は正解にしない約束)。
    // ざっと読んだ「詰まない手」は詰みを見落として多めに出るので、数そのものは比べない。
    const legal = legalOf(item.sfen);
    const mated = new Set();
    for (let index = 0; index < legal.length; index += 24) {
      const chunk = legal.slice(index, index + 24);
      const result = await search(engine, item.sfen, { nodes: 60000, multiPv: chunk.length, searchMoves: chunk });
      for (const { move, score } of result.candidates ?? []) if (move && isMate(score) && score.value < 0) mated.add(move);
    }
    if (item.accepted.some((usi) => mated.has(usi))) defendMated += 1;
  }
  rows.push(["defend(読み)", defend.length, `正解なのに詰みが見つかる手がある ${defendMated}`]);
  let judgeChanged = 0;
  let judgeNarrow = 0;
  for (const item of judge) {
    const result = await search(engine, item.sfen, { nodes: 400000, multiPv: 3, searchMoves: item.choices });
    const list = (result.candidates ?? []).filter(({ move }) => move).map(({ move, score }) => ({ move, value: comparableScore(score) })).sort((a, b) => b.value - a.value);
    if (list[0]?.move !== item.best) judgeChanged += 1;
    else if (list[0].value - list[1].value < 150) judgeNarrow += 1;
  }
  rows.push(["judge(読み直し)", judge.length, `40万nodesで答えが変わる ${judgeChanged}・差が150より小さい ${judgeNarrow}`]);
  engine.quit();
}
for (const [type, count, note] of rows) console.log(`${type}\t${count}問\t${note}`);
process.exit(0);
