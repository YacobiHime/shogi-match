import { describe, expect, test } from "vitest";
import { Position } from "tsshogi";
import { enumerateLegalMoves } from "../game-state";
import { cpuPositionVariants } from "./cpu-position-set.mjs";
import { chooseLogicMove } from "./logic-ai.mjs";
import { createNaturalnessEvaluator } from "./move-naturalness.mjs";
import { mirrorUsiMove } from "./opening-guide.mjs";
import { createRng } from "./ryuo-random.mjs";
import { applyUsiToBoard, attackersOf, guardsSquare, parseSfenState } from "./piece-movement.mjs";

const results = new Map();
describe("ロジックAIは目的のある手から選ぶ", () => {
  for (const fixture of cpuPositionVariants()) {
    const legalMoves = enumerateLegalMoves(Position.newBySFEN(fixture.sfen)).map(({ usi }) => usi);
    const evaluate = createNaturalnessEvaluator(fixture.sfen, { moveHistory: fixture.moveHistory });
    const values = new Map(legalMoves.map((usi) => [usi, evaluate(usi)]));
    for (const level of [1, 3, 5, 8, 10]) {
      test(`${fixture.id} ${fixture.mirrored ? "反転" : "元"} Lv${level}: 固定200種で目的なし0%、600ms以内`, () => {
        const choices = [];
        for (let seed = 1; seed <= 200; seed += 1) {
          const started = performance.now();
          const choice = chooseLogicMove({ sfen: fixture.sfen, moveHistory: fixture.moveHistory, legalMoves, level, random: createRng(seed).next });
          expect(performance.now() - started).toBeLessThan(600);
          expect(values.get(choice.move)?.purposeful).toBe(true);
          choices.push(choice);
        }
        results.set(`${fixture.id}:${fixture.mirrored}:${level}`, choices);
      }, 30000);
    }
    test(`${fixture.id} ${fixture.mirrored}: 気づきと方針のレベル差`, () => {
      const choices = (level) => results.get(`${fixture.id}:${fixture.mirrored}:${level}`);
      const move = (usi) => fixture.mirrored ? mirrorUsiMove(usi) : usi;
      const count = (level, predicate) => choices(level).filter(predicate).length;
      if (["bougin-push", "center-trade"].includes(fixture.id)) {
        const capture = move(fixture.id === "bougin-push" ? "2c2d" : "5c5d");
        expect(count(10, ({ move }) => move === capture)).toBeGreaterThan(count(1, ({ move }) => move === capture));
      }
      if (fixture.id === "rook-attacked") {
        const { board, turn } = parseSfenState(fixture.sfen);
        const rook = move("8b");
        const bishop = move("5e");
        // この局面では、飛車の当たりのほかに、2三の歩も先手の飛車(2六)に成られながら取られる。
        // 取り合いを読めるレベルは、飛車と角の交換(−400)より歩を成られる損(−500)を重く見て、歩を守ることもある。
        // どちらかの当たりに応じる手を「応じた」と数える。
        const pawn = move("2c");
        const responding = ({ move: usi }) => {
          const after = applyUsiToBoard(board, usi, turn).board;
          return (usi.startsWith(rook) && values.get(usi).tags.includes("escape"))
            || guardsSquare(board, after, rook, turn)
            || guardsSquare(board, after, pawn, turn)
            || attackersOf(after, bishop, turn).length > attackersOf(board, bishop, turn).length;
        };
        expect(count(5, responding)).toBeGreaterThan(count(1, responding));
        expect(count(10, responding)).toBeGreaterThan(count(5, responding));
      }
      if (fixture.id === "hopeless") {
        for (const [level, expected] of [[1, 0.9], [10, 0.5]]) {
          const policies = choices(level).filter(({ policy }) => policy);
          expect(policies.length).toBeGreaterThan(0);
          const rate = policies.filter(({ policy }) => policy === "take").length / policies.length;
          expect(Math.abs(rate - expected)).toBeLessThanOrEqual(0.1);
        }
      }
    });
  }
});
