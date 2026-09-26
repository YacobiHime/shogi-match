import { describe, expect, test, vi } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves, STANDARD_SFEN } from '../game-state.ts';
import { chooseCpuMove, chooseNaturalMove, pickWeighted } from './cpu-move-choice.mjs';
import { createNaturalnessEvaluator } from './move-naturalness.mjs';
import { getStrengthSearchSettings } from './strength-settings.mjs';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sequence(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

function positionAfter(moves) {
  const position = Position.newBySFEN(STANDARD_SFEN);
  for (const usi of moves) position.doMove(position.createMoveByUSI(usi));
  return position;
}

const cp = (value) => ({ type: 'cp', value });

describe('重み付き抽選', () => {
  test('固定乱数で重みに比例した分布になる', () => {
    const random = seededRandom(42);
    const entries = [{ id: 'a', weight: 6 }, { id: 'b', weight: 3 }, { id: 'c', weight: 1 }];
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 20000; i += 1) counts[pickWeighted(entries, random).id] += 1;
    expect(counts.a / 20000).toBeCloseTo(0.6, 1);
    expect(counts.b / 20000).toBeCloseTo(0.3, 1);
    expect(counts.c / 20000).toBeCloseTo(0.1, 1);
  });
});

describe('Lv0の自然さ抽選', () => {
  test('一様ランダムではなく、隅への駒打ちや無意味な玉移動をまれにしか選ばない', () => {
    const moves = ['7g7f', '3c3d', '8h2b+', '3a2b'];
    const position = positionAfter(moves);
    const legalMoves = enumerateLegalMoves(position).map(({ usi }) => usi);
    const evaluate = createNaturalnessEvaluator(position.sfen, { moveHistory: moves });
    const weights = new Map(legalMoves.map((move) => [move, evaluate(move).weight]));
    const naturalness = (move) => weights.get(move);
    const random = seededRandom(7);
    let low = 0;
    const trials = 3000;
    for (let i = 0; i < trials; i += 1) {
      const { move } = chooseNaturalMove({
        sfen: position.sfen, legalMoves, moveHistory: moves, random, naturalness,
      });
      if (naturalness(move) < 0.3) low += 1;
    }
    const uniformLowShare = legalMoves.filter((move) => naturalness(move) < 0.3).length
      / legalMoves.length;
    // 角打ちの多い局面では、一様ランダムだと不自然な手がかなりの割合を占める。
    expect(uniformLowShare).toBeGreaterThan(0.25);
    expect(low / trials).toBeLessThan(uniformLowShare / 3);
    expect(low).toBeGreaterThan(0);
  });
});

describe('CPU着手の共通選択', () => {
  const sfen = positionAfter(['7g7f', '3c3d']).sfen;
  const moveHistory = ['7g7f', '3c3d'];
  const legalMoves = enumerateLegalMoves(Position.newBySFEN(sfen)).map(({ usi }) => usi);
  const search = {
    move: '2g2f',
    candidates: [
      { rank: 1, move: '2g2f', score: cp(60) },
      { rank: 2, move: '6i7h', score: cp(40) },
      { rank: 3, move: '5i5h', score: cp(30) },
      { rank: 4, move: '8h2b+', score: cp(-1500) },
    ],
  };

  test('探索結果がなければ自然さだけで選ぶ', async () => {
    const result = await chooseCpuMove({
      strength: getStrengthSearchSettings(1000),
      sfen, legalMoves, moveHistory, random: () => 0,
    });
    expect(result.kind).toBe('natural');
    expect(legalMoves).toContain(result.move);
  });

  test('評価差と自然さを掛けた重みで選び、許容損失を超える手は選ばない', async () => {
    const strength = { ...getStrengthSearchSettings(2000), oversightRate: 0 };
    const random = seededRandom(3);
    const counts = {};
    for (let i = 0; i < 4000; i += 1) {
      const { move } = await chooseCpuMove({ strength, sfen, legalMoves, moveHistory, search, random });
      counts[move] = (counts[move] ?? 0) + 1;
    }
    expect(counts['8h2b+'] ?? 0).toBe(0);
    // 評価値がほぼ同じでも、序盤の無意味な玉移動は自然さで大きく減る。
    expect(counts['5i5h'] ?? 0).toBeLessThan((counts['6i7h'] ?? 0) / 4);
    expect(counts['2g2f']).toBeGreaterThan(counts['5i5h'] ?? 0);
  });

  // 浅い読み直し(レベル本来のnodes)と深い検証(oversightNodes)を順番に行う検証用エンジン。
  function twoStageVerify(shallowScores, deepScores) {
    return vi.fn(async (moves, nodes) => {
      expect(moves[0]).toBe('2g2f');
      const scores = nodes === getStrengthSearchSettings(2000).nodes ? shallowScores : deepScores;
      return {
        move: '2g2f',
        candidates: moves
          .filter((move) => scores[move] !== undefined)
          .map((move, index) => ({ rank: index + 1, move, score: cp(scores[move]) })),
      };
    });
  }

  test('見落としは浅い読みで良く見え深い読みで悪い手を、追加探索を直列2回で選ぶ', async () => {
    const strength = getStrengthSearchSettings(2000);
    const verify = twoStageVerify(
      { '2g2f': 60, '6i7h': 50, '7f7e': -600 },
      { '2g2f': 80, '6i7h': -400 },
    );
    const result = await chooseCpuMove({
      strength, sfen, legalMoves, moveHistory, search, verify,
      random: sequence([0, 0.5]),
    });
    expect(verify).toHaveBeenCalledTimes(2);
    expect(verify.mock.calls[0][1]).toBe(strength.nodes);
    expect(verify.mock.calls[1][1]).toBe(strength.oversightNodes);
    // 浅い読みで悪く見えた手は深く読み直さない。
    expect(verify.mock.calls[1][0]).not.toContain('7f7e');
    expect(result).toMatchObject({ move: '6i7h', kind: 'oversight', deepLoss: 480 });
  });

  test('深い読みでも悪くない手しかなければ通常の抽選に戻る', async () => {
    const strength = getStrengthSearchSettings(2000);
    const verify = twoStageVerify(
      { '2g2f': 60, '6i7h': 50 },
      { '2g2f': 80, '6i7h': 60 },
    );
    const result = await chooseCpuMove({
      strength, sfen, legalMoves, moveHistory, search, verify,
      random: sequence([0, 0]),
    });
    expect(verify).toHaveBeenCalledTimes(2);
    expect(result.kind).not.toBe('oversight');
  });

  test('見落とし抽選に外れたら深い探索をしない', async () => {
    const strength = getStrengthSearchSettings(2000);
    const verify = vi.fn();
    await chooseCpuMove({
      strength, sfen, legalMoves, moveHistory, search, verify, random: sequence([0.99, 0.5]),
    });
    expect(verify).not.toHaveBeenCalled();
  });

  test('最高難度は常に最善手を選ぶ', async () => {
    const result = await chooseCpuMove({
      strength: getStrengthSearchSettings(480000),
      sfen, legalMoves, moveHistory, search, random: seededRandom(1),
    });
    expect(result).toMatchObject({ move: '2g2f', kind: 'best' });
  });

  test('許可されていない手は探索候補にあっても選ばない', async () => {
    const strength = { ...getStrengthSearchSettings(2000), oversightRate: 0, bestMoveRate: 0 };
    const random = seededRandom(11);
    for (let i = 0; i < 200; i += 1) {
      const { move } = await chooseCpuMove({
        strength, sfen, legalMoves: ['2g2f', '5i5h'], moveHistory, search, random,
      });
      expect(['2g2f', '5i5h']).toContain(move);
    }
  });
});
