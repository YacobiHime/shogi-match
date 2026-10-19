import { expect, test } from "vitest";
import { Position, Square } from "tsshogi";
import { enumerateLegalMoves } from "../game-state";
import { cpuPositionVariants } from "./cpu-position-set.mjs";
import { kingZonePressure } from "./logic-position.mjs";
import { applyUsiToBoard, attackersOf, breakthroughSquares, countHanging, createBoardQueries, isHanging, isKingAttacked, parseSfenState } from "./piece-movement.mjs";

test("局面内で再利用する利きの集計は、全升・先後・合法手の後も直接計算と同じ", () => {
  for (const fixture of cpuPositionVariants()) {
    const { board, turn } = parseSfenState(fixture.sfen);
    const moves = enumerateLegalMoves(Position.newBySFEN(fixture.sfen)).map(({ usi }) => usi);
    const queries = createBoardQueries();
    for (const position of [board, ...moves.filter((_, i) => i % 11 === 0).map((move) => applyUsiToBoard(board, move, turn).board)]) {
      queries.prepare(position);
      for (const color of ["black", "white"]) {
        const king = [...position].find(([, piece]) => piece.color === color && piece.kind === "K")?.[0];
        const opposite = color === "black" ? "white" : "black";
        const pressure = king ? Square.all.filter(({ usi }) => Math.abs(Number(usi[0]) - Number(king[0])) <= 1
          && Math.abs(usi.charCodeAt(1) - king.charCodeAt(1)) <= 1 && attackersOf(position, usi, opposite).length > 0).length : 0;
        expect(kingZonePressure(position, color)).toBe(pressure);
        expect(queries.isKingAttacked(position, color)).toBe(isKingAttacked(position, color));
        expect(queries.countHanging(position, color)).toBe(countHanging(position, color));
        expect(queries.breakthroughSquares(position, color)).toEqual(breakthroughSquares(position, color));
        for (const square of Square.all.map((square) => square.usi)) {
          expect(queries.attackersOf(position, square, color)).toEqual(attackersOf(position, square, color));
          expect(queries.isHanging(position, square)).toBe(isHanging(position, square));
        }
      }
    }
  }
}, 15000);

test("玉を取り除いた仮の盤でも、利きの集計前後で直接計算と同じ結果になる", () => {
  const { board } = parseSfenState("4k4/9/9/9/4R4/9/9/9/4K4 b - 1");
  for (const color of ["black", "white"]) {
    const hypothetical = new Map([...board].filter(([, piece]) => piece.color !== color || piece.kind !== "K"));
    const queries = createBoardQueries();
    expect(queries.isKingAttacked(hypothetical, color)).toBe(isKingAttacked(hypothetical, color));
    queries.prepare(hypothetical);
    expect(queries.isKingAttacked(hypothetical, color)).toBe(false);
  }
});
