import { describe, expect, test } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves, STANDARD_SFEN } from '../game-state.ts';
import {
  createNaturalnessEvaluator,
  LOW_NATURALNESS_THRESHOLD,
  NATURALNESS_MIN,
} from './move-naturalness.mjs';

function positionAfter(moves, sfen = STANDARD_SFEN) {
  const position = Position.newBySFEN(sfen);
  for (const usi of moves) {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.doMove(move)) throw new Error(`illegal ${usi}`);
  }
  return position;
}

function evaluatorAfter(moves, sfen) {
  const position = positionAfter(moves, sfen);
  return {
    position,
    evaluate: createNaturalnessEvaluator(position.sfen, { moveHistory: moves }),
  };
}

describe('指し手の自然さ', () => {
  test('取り返しは無関係な手より重い', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d', '8h2b+']);
    const recapture = evaluate('3a2b');
    const unrelated = evaluate('9c9d');
    expect(recapture.tags).toContain('recapture');
    expect(recapture.weight).toBeGreaterThan(unrelated.weight * 2);
  });

  test('序盤の意味のない玉移動は軽く、囲いへ向かう玉移動は軽くしない', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d']);
    const pawn = evaluate('2g2f').weight;
    expect(evaluate('5i5h').weight).toBeLessThan(pawn * 0.2);
    expect(evaluate('5i4h').weight).toBeLessThan(pawn * 0.3);
    expect(evaluate('5i4h').tags).toContain('early-king');
    // 居飛車の飛車とは反対側へ寄る6八玉は、囲いへの一手として扱う。
    expect(evaluate('5i6h').tags).toContain('castle-build');
    expect(evaluate('5i6h').weight).toBeGreaterThanOrEqual(1);
  });

  test('自陣の隅や端への意図のない駒打ちは軽い', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d', '8h2b+', '3a2b']);
    const cornerDrop = evaluate('B*9h');
    expect(cornerDrop.tags).toContain('corner-drop');
    expect(cornerDrop.weight).toBeLessThan(LOW_NATURALNESS_THRESHOLD);
    expect(cornerDrop.weight).toBeLessThan(evaluate('2g2f').weight * 0.1);
    // 重みは0にしないので、ごくまれには選ばれる。
    expect(cornerDrop.weight).toBeGreaterThanOrEqual(NATURALNESS_MIN);
  });

  test('理由のない駒捨ては軽い', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d']);
    // 角を2二の銀・金で取られる升へ出る手(▲3三角不成相当の成り込みは駒得になるので別)。
    const sacrifice = evaluate('8h4d');
    expect(sacrifice.tags).toContain('sacrifice');
    expect(sacrifice.weight).toBeLessThan(0.1);
  });

  test('王手をかけられた局面では回避手を減点せず、王手駒を取る手を最も重くする', () => {
    const sfen = '4k4/9/9/9/9/9/9/4r4/3GK4 b - 1';
    const position = Position.newBySFEN(sfen);
    const evaluate = createNaturalnessEvaluator(sfen, { moveHistory: ['5b5h'], ply: 10 });
    const evasions = enumerateLegalMoves(position).map(({ usi }) => [usi, evaluate(usi)]);
    expect(evasions.length).toBeGreaterThan(0);
    for (const [, result] of evasions) {
      expect(result.tags.some((tag) => [
        'capture-checker', 'king-escape', 'drop-block', 'move-block',
      ].includes(tag))).toBe(true);
      expect(result.tags).not.toContain('early-king');
    }
    const byMove = Object.fromEntries(evasions);
    expect(byMove['6i5h'].tags).toContain('capture-checker');
    expect(byMove['6i5h'].weight).toBeGreaterThan(byMove['5i4i'].weight);
    expect(byMove['5i4i'].weight).toBeGreaterThanOrEqual(1);
  });

  test('王手を受けた局面の合駒打ちは、意図のない駒打ちとして減点しない', () => {
    const sfen = '4k4/9/9/9/4r4/9/9/9/4K4 b G 1';
    const evaluate = createNaturalnessEvaluator(sfen, { ply: 10 });
    const block = evaluate('G*5h');
    expect(block.tags).toContain('drop-block');
    expect(block.tags).not.toContain('idle-drop');
    expect(block.weight).toBeGreaterThanOrEqual(1);
  });

  test('同じ駒の往復は軽い', () => {
    const { evaluate } = evaluatorAfter(['7g7f', '3c3d', '6i5h', '4a4b']);
    expect(evaluate('5h6i').tags).toContain('shuffle');
    expect(evaluate('5h6i').weight).toBeLessThan(evaluate('2g2f').weight * 0.3);
  });

  test('後手番でも同じ基準で評価する', () => {
    const { evaluate } = evaluatorAfter(['7g7f']);
    expect(evaluate('5a5b').tags).toContain('early-king');
    expect(evaluate('5a4b').tags).toContain('castle-build');
  });
});
