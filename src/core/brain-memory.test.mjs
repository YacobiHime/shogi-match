import { describe, expect, test } from 'vitest';

import { appendUsiMove, createGameRecord } from '../game-state';
import {
  BOARD_MEMORY_LEVELS,
  BOARD_MEMORY_MAX_LEVEL,
  MEMORY_FORMATIONS,
  boardMemoryProblem,
  boardMemorySummary,
  nextBoardMemoryLevel,
  paletteKinds,
  rotateSquare,
  scoreBoardMemory,
} from './brain-board-memory.mjs';
import {
  MENTAL_LEVELS,
  MENTAL_MAX_LEVEL,
  mentalPieceChoices,
  mentalProblem,
  mentalSummary,
  piecesFromSfen,
  scoreMental,
} from './brain-mental-board.mjs';
import { openingFormation } from './opening-formation.mjs';

/** 盤の駒が合法な配置か(重ならない・行き所のない駒がない・二歩がない)。 */
function expectLegalPlacement(pieces) {
  const squares = pieces.map(({ square }) => square);
  expect(new Set(squares).size).toBe(squares.length);
  const pawnFiles = new Set();
  for (const { square, kind, color } of pieces) {
    const rank = square.charCodeAt(1) - 96;
    const relative = color === 'black' ? rank : 10 - rank;
    if (kind === 'P' || kind === 'L') expect(relative).toBeGreaterThan(1);
    if (kind === 'N') expect(relative).toBeGreaterThan(2);
    if (kind === 'P') {
      const key = `${color}${square[0]}`;
      expect(pawnFiles.has(key)).toBe(false);
      pawnFiles.add(key);
    }
  }
}

describe('盤面の記憶', () => {
  test('使う形は、どれも玉があり駒が重ならない', () => {
    for (const [strategyId, castleId] of MEMORY_FORMATIONS) {
      const { pieces } = openingFormation(strategyId, castleId);
      expect(pieces.filter(({ kind }) => kind === 'K')).toHaveLength(1);
      expect(new Set(pieces.map(({ square }) => square)).size).toBe(pieces.length);
    }
  });

  test('段ごとの駒の数で、合法な配置。同じ種なら同じ局面', () => {
    expect(boardMemoryProblem(5, 3)).toEqual(boardMemoryProblem(5, 3));
    for (let level = 0; level <= BOARD_MEMORY_MAX_LEVEL; level += 1) {
      for (let seed = 1; seed <= 25; seed += 1) {
        for (const random of [false, true]) {
          const problem = boardMemoryProblem(seed, level, { random });
          expect(problem.pieces.length).toBeLessThanOrEqual(BOARD_MEMORY_LEVELS[level].pieces);
          expect(problem.pieces.length).toBeGreaterThanOrEqual(BOARD_MEMORY_LEVELS[level].pieces - 2);
          expectLegalPlacement(problem.pieces);
          expect(problem.bothSides).toBe(BOARD_MEMORY_LEVELS[level].source === 'both');
          expect(problem.memorizeMs).toBeGreaterThanOrEqual(3000);
          expect(problem.memorizeMs).toBeLessThanOrEqual(15000);
        }
      }
    }
  });

  test('囲いのまわりの段は、玉から近い駒を出す', () => {
    const problem = boardMemoryProblem(1, 0);
    expect(problem.pieces).toHaveLength(3);
    expect(problem.pieces[0].kind).toBe('K');
    expect(problem.pieces.every(({ color }) => color === 'black')).toBe(true);
  });

  test('後手の陣は盤を180度回した形', () => {
    expect(rotateSquare('7h')).toBe('3b');
    expect(rotateSquare('5e')).toBe('5e');
    const problem = boardMemoryProblem(3, BOARD_MEMORY_MAX_LEVEL);
    const whiteKing = problem.pieces.find(({ kind, color }) => kind === 'K' && color === 'white');
    expect(whiteKing.square.charCodeAt(1) - 96).toBeLessThanOrEqual(3);
  });

  test('採点は、マス・種類・先後が全部同じ駒だけ数え、置きすぎは割合を下げる', () => {
    const problem = boardMemoryProblem(9, 5);
    const perfect = Object.fromEntries(problem.pieces.map(({ square, kind, color }) => [square, { kind, color }]));
    const full = scoreBoardMemory(problem, perfect);
    expect(full.correct).toBe(problem.pieces.length);
    expect(full.accuracy).toBe(1);
    const [first, second] = problem.pieces;
    const partial = scoreBoardMemory(problem, { [first.square]: { kind: first.kind, color: first.color }, [second.square]: { kind: 'R', color: 'white' } });
    expect(partial.correct).toBe(1);
    expect(partial.marks[second.square]).toBe('wrong');
    expect(partial.marks[problem.pieces[2].square]).toBe('missed');
    // 全部のマスに置いても当たらない。
    const everything = {};
    for (let file = 1; file <= 9; file += 1) for (let rank = 1; rank <= 9; rank += 1) everything[`${file}${String.fromCharCode(96 + rank)}`] = { kind: 'P', color: 'black' };
    expect(scoreBoardMemory(problem, everything).accuracy).toBeLessThan(0.2);
  });

  test('囲いをまるごと当てたか', () => {
    const problem = boardMemoryProblem(2, 3);
    const answer = Object.fromEntries(problem.pieces.map(({ square, kind, color }) => [square, { kind, color }]));
    expect(scoreBoardMemory(problem, answer).castleWhole).toBe(problem.castleSquares.length >= 3);
    expect(boardMemoryProblem(2, 3, { random: true }).castleSquares).toEqual([]);
  });

  test('段の上げ下げと1回のまとめ', () => {
    expect(nextBoardMemoryLevel(3, 0.95)).toBe(4);
    expect(nextBoardMemoryLevel(3, 0.7)).toBe(3);
    expect(nextBoardMemoryLevel(3, 0.5)).toBe(2);
    expect(nextBoardMemoryLevel(3, 1, true)).toBe(3);
    expect(nextBoardMemoryLevel(BOARD_MEMORY_MAX_LEVEL, 1)).toBe(BOARD_MEMORY_MAX_LEVEL);
    const summary = boardMemorySummary([
      { pieces: 6, accuracy: 1, random: false },
      { pieces: 7, accuracy: 0.92, random: false },
      { pieces: 8, accuracy: 0.5, random: true },
      { pieces: 8, accuracy: 0.75, random: false },
    ]);
    expect(summary.value).toBe(7);
    expect(summary.correct).toBe(2);
    expect(summary.total).toBe(3);
    expect(summary.randomAccuracy).toBe(0.5);
  });

  test('駒箱は局面にある種類だけを決まった順に', () => {
    const problem = { pieces: [{ square: '1a', kind: 'P', color: 'black' }, { square: '2a', kind: 'K', color: 'black' }, { square: '3a', kind: 'G', color: 'black' }] };
    expect(paletteKinds(problem)).toEqual(['K', 'G', 'P']);
  });
});

describe('頭の中の盤', () => {
  test('同じ種と段なら同じ問題', () => {
    expect(mentalProblem(11, 4)).toEqual(mentalProblem(11, 4));
  });

  test('指し手はすべて合法で、答えは指したあとの盤と一致する', () => {
    for (let level = 0; level <= MENTAL_MAX_LEVEL; level += 1) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const problem = mentalProblem(seed * 31 + level, level);
        expect(problem.moves).toHaveLength(MENTAL_LEVELS[level].plies);
        expect(problem.labels).toHaveLength(problem.moves.length);
        expect(problem.start).toHaveLength(MENTAL_LEVELS[level].pieces + 2);
        const record = createGameRecord(problem.startSfen);
        for (const usi of problem.moves) expect(appendUsiMove(record, usi)).toBe(true);
        const final = piecesFromSfen(record.position.sfen);
        expect(final).toEqual(problem.finalPieces);
        const { question } = problem;
        if (question.type === 'square') {
          expect(final.some(({ square }) => square === question.answer)).toBe(true);
        } else {
          const at = final.find(({ square }) => square === question.square);
          expect(question.answer).toBe(`${at.color}:${at.kind}${at.promoted ? '+' : ''}`);
          expect(mentalPieceChoices(problem).some(({ id }) => id === question.answer)).toBe(true);
        }
        expect(scoreMental(problem, question.answer).correct).toBe(true);
        expect(scoreMental(problem, 'nope').correct).toBe(false);
      }
    }
  });

  test('指し手の名前は先手から▲△の順', () => {
    const problem = mentalProblem(7, 3);
    problem.labels.forEach((label, index) => expect(label.startsWith(index % 2 === 0 ? '▲' : '△')).toBe(true));
  });

  test('1回の記録は正解したいちばん多い手数', () => {
    expect(mentalSummary([{ plies: 3, correct: true }, { plies: 4, correct: false }, { plies: 2, correct: true }])).toEqual({ value: 3, correct: 2, total: 3 });
  });
});
