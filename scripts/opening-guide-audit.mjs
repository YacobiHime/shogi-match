// 定跡補助の監査の一覧を出す(開発用。docs/opening-guide-integrity-design.mdの6章)。
// 本番と同じデータ(エディターの保存を読んだ定義)で、完成形と手順の食い違い・合わない組・手順にない駒を動かす案内を並べる。
// 使い方: node scripts/opening-guide-audit.mjs
import { createRequire } from "node:module";
import {
  AUDIT_OPPONENTS, blockedPlanSteps, catalogDefinitions, catalogPairs, completionMismatches, incompatiblePairs, simulateOpeningGuide,
} from "../src/core/opening-audit.mjs";
import { openingDefinitionRookStyle } from "../src/core/opening-guide.mjs";

const require = createRequire(import.meta.url);
const { Record, Square } = require("tsshogi");

function newGame() {
  const record = Record.newByUSI("position startpos");
  return {
    sfen: () => record.position.sfen,
    legalMoves() {
      const position = record.position;
      const moves = new Set();
      for (const from of position.board.listNonEmptySquares()) {
        if (position.board.at(from)?.color !== position.color) continue;
        for (const to of Square.all) {
          const move = position.createMove(from, to);
          for (const candidate of [move, move?.withPromote()]) if (candidate && position.isValidMove(candidate)) moves.add(candidate.usi);
        }
      }
      return [...moves];
    },
    play(usi) {
      const move = record.position.createMoveByUSI(usi);
      return Boolean(move && record.append(move));
    },
  };
}

console.log("== 完成形と手順の食い違い(単独) ==");
for (const { kind, definition } of catalogDefinitions()) {
  const misses = completionMismatches(definition, kind);
  if (misses.length) console.log(`${kind}:${definition.id} ${definition.label}`, misses.map(({ square, expected, actual }) => `${square}${expected}→${actual ?? "空"}`).join(" "));
}
console.log("== 指せない手(単独) ==");
for (const { kind, definition } of catalogDefinitions()) {
  const blocked = blockedPlanSteps(definition, kind);
  if (blocked.length) console.log(`${kind}:${definition.id} ${definition.label}`, blocked.map(({ usi, reason }) => `${usi}(${reason})`).join(" "));
}
console.log("== 合わない組 ==");
for (const { planId, strategyId, castleId, conflicts } of incompatiblePairs()) {
  console.log(`${planId}: ${strategyId}+${castleId}`, conflicts.join(" / "));
}
console.log("== 手順にない駒を動かす案内 ==");
for (const pair of catalogPairs()) {
  const { castleId } = pair;
  // 振り飛車用の囲いだけのカードは、対局中に先に飛車の振り先を選ぶ。ここでは四間飛車にする。
  const strategyId = pair.strategyId || (openingDefinitionRookStyle(castleId, "castle") === "ranging" ? "shiken" : "");
  const ranging = openingDefinitionRookStyle(strategyId, "strategy") === "ranging" || openingDefinitionRookStyle(castleId, "castle") === "ranging";
  for (const color of ["black", "white"]) {
    const { offPlan } = simulateOpeningGuide({
      strategyId, castleId, color, opponentMoves: ranging ? AUDIT_OPPONENTS.static : AUDIT_OPPONENTS.ranging, game: newGame(),
    });
    if (offPlan.length) console.log(`${strategyId}+${castleId} ${color}`, offPlan.map(({ ply, usi }) => `${ply}:${usi}`).join(" "));
  }
}
