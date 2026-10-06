import { describe, expect, test, vi } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves, STANDARD_SFEN } from '../game-state.ts';
import {
  BLUNDER_LOSS, canBlunder, chooseCpuMove, chooseNaturalMove, isBlunderChoice, pickWeighted, visibleMoves,
} from './cpu-move-choice.mjs';
import { createNaturalnessEvaluator, PIECE_SACRIFICE_TAG } from './move-naturalness.mjs';
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
  // 読まない手と損失上限を守る抽選を外し(常に読んで上限を守る)、乱数の消費を固定する。
  const lowStrength = { ...getStrengthSearchSettings(2000), naturalMoveRate: 0, carefulRate: 1 };
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
    const strength = { ...lowStrength, oversightRate: 0 };
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
      const scores = nodes === lowStrength.nodes ? shallowScores : deepScores;
      return {
        move: '2g2f',
        candidates: moves
          .filter((move) => scores[move] !== undefined)
          .map((move, index) => ({ rank: index + 1, move, score: cp(scores[move]) })),
      };
    });
  }

  test('見落としは浅い読みで良く見え深い読みで悪い手を、追加探索を直列2回で選ぶ', async () => {
    const strength = lowStrength;
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
    const strength = lowStrength;
    const verify = twoStageVerify(
      { '2g2f': 60, '6i7h': 50 },
      { '2g2f': 80, '6i7h': 60 },
    );
    const result = await chooseCpuMove({
      strength, sfen, legalMoves, moveHistory, search, verify,
      random: sequence([0, 0]),
    });
    // 見落とし判定の2回のあとは、目に付いた手の読み直しへ進む。
    expect(verify.mock.calls[1][1]).toBe(strength.oversightNodes);
    expect(result.kind).not.toBe('oversight');
  });

  test('見落とし抽選に外れたら深い探索をしない', async () => {
    const strength = lowStrength;
    const verify = vi.fn();
    await chooseCpuMove({
      strength, sfen, legalMoves, moveHistory, search, verify, random: sequence([0.99, 0.5]),
    });
    expect(verify.mock.calls.every(([, nodes]) => nodes !== strength.oversightNodes)).toBe(true);
  });

  // 目に付いた手を読み直す検証用エンジン。scoresにない手は最善手より900低い。
  function visionVerify(scores) {
    return vi.fn(async (moves) => ({
      move: moves[0],
      candidates: moves.map((move, index) => ({ rank: index + 1, move, score: cp(scores[move] ?? -840) })),
    }));
  }

  test('低レベルは目に付く手だけを読み、その中から選ぶ', async () => {
    const strength = { ...lowStrength, oversightRate: 0, bestMoveRate: 0, moveLossCap: 3000 };
    const naturalness = createNaturalnessEvaluator(sfen, { moveHistory, simplicity: strength.simplicity });
    const weight = (move) => naturalness(move).weight;
    weight.isSacrifice = (move) => naturalness(move).tags.some((tag) => tag === PIECE_SACRIFICE_TAG || tag === 'sacrifice');
    const visible = visibleMoves({ search, candidates: search.candidates, legalMoves, strength, naturalness: weight });
    expect(visible.length).toBeLessThanOrEqual(strength.visionWidth + strength.engineVision);
    expect(visible.length).toBeLessThan(legalMoves.length / 4);
    const verify = visionVerify({ '2g2f': 60 });
    const random = seededRandom(5);
    for (let i = 0; i < 200; i += 1) {
      const result = await chooseCpuMove({ strength, sfen, legalMoves, moveHistory, search, verify, random });
      expect(visible).toContain(result.move);
    }
    // 最善手と目に付いた手を並べ、駒のただ取られが分かる量で読む。
    expect(verify.mock.calls[0][0][0]).toBe('2g2f');
    expect(verify.mock.calls[0][1]).toBeGreaterThanOrEqual(1000);
  });

  test('目に付く手には、駒をただで渡す手を入れない', () => {
    const evaluate = createNaturalnessEvaluator(sfen, { moveHistory, simplicity: 1 });
    const weight = (move) => evaluate(move).weight;
    weight.isSacrifice = (move) => evaluate(move).tags.some((tag) => tag === PIECE_SACRIFICE_TAG || tag === 'sacrifice');
    const visible = visibleMoves({
      search, candidates: search.candidates, legalMoves, strength: { visionWidth: 30, engineVision: 0 }, naturalness: weight,
    });
    for (const move of visible) {
      expect(evaluate(move).tags, move).not.toContain(PIECE_SACRIFICE_TAG);
      expect(evaluate(move).tags, move).not.toContain('sacrifice');
    }
  });

  test('強いレベルほど、探索上位の手も目に付く', () => {
    const level = (value) => getStrengthSearchSettings(value);
    expect(level(5000).engineVision).toBe(0);
    expect(level(250000).engineVision).toBeGreaterThan(level(80000).engineVision);
    expect(level(250000).visionWidth).toBeGreaterThan(level(5000).visionWidth);
    // 技量0.6以上は視野を狭めず、探索候補から選ぶ。
    expect(level(320000).visionWidth).toBeUndefined();
  });

  test('最善手より大きく悪い駒捨ては、探索の2番手以下にあっても選ばない', async () => {
    const strength = {
      ...lowStrength, oversightRate: 0, bestMoveRate: 0, naturalnessAlpha: 0,
      maxScoreLoss: 1000, scoreTemperature: 100000,
    };
    const withSacrifice = (score) => ({
      move: '2g2f',
      candidates: [
        { rank: 1, move: '2g2f', score: cp(60) },
        { rank: 2, move: '8h3c+', score: cp(score) },
      ],
    });
    const random = seededRandom(9);
    const count = async (search) => {
      let picked = 0;
      for (let i = 0; i < 400; i += 1) {
        const { move } = await chooseCpuMove({ strength, sfen, legalMoves, moveHistory, search, random });
        if (move === '8h3c+') picked += 1;
      }
      return picked;
    };
    // 最善手との差が400なら選ばない。
    expect(await count(withSacrifice(-340))).toBe(0);
    // エンジンがほぼ互角と見る捨て駒の手筋は残す。
    expect(await count(withSacrifice(-40))).toBeGreaterThan(100);
  });

  test('最高難度は常に最善手を選ぶ', async () => {
    const result = await chooseCpuMove({
      strength: getStrengthSearchSettings(480000),
      sfen, legalMoves, moveHistory, search, random: seededRandom(1),
    });
    expect(result).toMatchObject({ move: '2g2f', kind: 'best' });
  });

  test('1手の損失上限を超える候補は、許容損失の内側でも選ばない', async () => {
    const strength = {
      ...lowStrength, oversightRate: 0, bestMoveRate: 0, naturalnessAlpha: 0,
      maxScoreLoss: 1000, scoreTemperature: 100000, moveLossCap: 400,
    };
    const wide = {
      move: '2g2f',
      candidates: [
        { rank: 1, move: '2g2f', score: cp(60) },
        { rank: 2, move: '6i7h', score: cp(-300) },
        { rank: 3, move: '5i5h', score: cp(-700) },
      ],
    };
    const random = seededRandom(17);
    const picked = new Set();
    for (let i = 0; i < 300; i += 1) {
      const result = await chooseCpuMove({ strength, sfen, legalMoves, moveHistory, search: wide, random });
      picked.add(result.move);
      expect(result.loss).toBeLessThanOrEqual(400);
    }
    expect(picked.has('5i5h')).toBe(false);
    expect(picked.has('6i7h')).toBe(true);
  });

  // 最善手の5八玉は目に付かず(自然さが低い)、目に付いた手はどれも900損する局面。
  const hiddenBest = {
    move: '5i5h',
    candidates: [
      { rank: 1, move: '5i5h', score: cp(60) },
      { rank: 2, move: '6i7h', score: cp(40) },
    ],
  };

  test('目に付いた手が全部上限を超える損なら、探索候補から選び直す', async () => {
    const strength = {
      ...lowStrength, oversightRate: 0, bestMoveRate: 0, moveLossCap: 400, engineVision: 0, visionWidth: 1,
    };
    const verify = visionVerify({ '5i5h': 60 });
    const random = seededRandom(19);
    for (let i = 0; i < 50; i += 1) {
      const result = await chooseCpuMove({ strength, sfen, legalMoves, moveHistory, search: hiddenBest, verify, random });
      expect(['5i5h', '6i7h']).toContain(result.move);
      expect(result.loss).toBeLessThanOrEqual(400);
    }
    expect(verify).toHaveBeenCalled();
  });

  test('目に付いた手は、上限以内の損なら損失を添えて指す', async () => {
    const strength = { ...lowStrength, oversightRate: 0, bestMoveRate: 0, moveLossCap: 400, engineVision: 0 };
    const verify = visionVerify(new Proxy({}, { get: (_, move) => (move === '2g2f' ? 60 : -290) }));
    const result = await chooseCpuMove({ strength, sfen, legalMoves, moveHistory, search, verify, random: seededRandom(23) });
    expect(['vision', 'best']).toContain(result.kind);
    expect(result.loss === 0 || result.loss === 350).toBe(true);
  });

  test('最も弱いレベルでは、損失上限を守る手の割合を下げてLv0へつなぐ', async () => {
    expect(getStrengthSearchSettings(5000).carefulRate).toBeGreaterThan(0);
    expect(getStrengthSearchSettings(5000).carefulRate).toBeLessThan(1);
    expect(getStrengthSearchSettings(6000).carefulRate).toBe(1);
    // 上限を守らない手番では、上限を超える手も選ぶ。
    const strength = {
      ...lowStrength, oversightRate: 0, bestMoveRate: 0, moveLossCap: 400, carefulRate: 0.5,
      engineVision: 0, visionWidth: 1, naturalnessAlpha: 0,
    };
    const verify = visionVerify({ '5i5h': 60 });
    let overCap = 0;
    const random = seededRandom(31);
    for (let i = 0; i < 200; i += 1) {
      const result = await chooseCpuMove({ strength, sfen, legalMoves, moveHistory, search: hiddenBest, verify, random });
      if (result.loss > 400) overCap += 1;
    }
    expect(overCap).toBeGreaterThan(40);
    expect(overCap).toBeLessThan(160);
  });

  test('大きな悪手を使い切ったら、見落としも300以上損する候補も選ばない', async () => {
    const strength = {
      ...lowStrength, oversightRate: 1, bestMoveRate: 0, naturalnessAlpha: 0,
      maxScoreLoss: 1000, scoreTemperature: 100000, moveLossCap: 800,
    };
    // 目に付いた手は、最善手以外どれも900損する。
    const verify = visionVerify({ '2g2f': 60 });
    const wide = {
      move: '2g2f',
      candidates: [
        { rank: 1, move: '2g2f', score: cp(60) },
        { rank: 2, move: '6i7h', score: cp(-100) },
        { rank: 3, move: '5i5h', score: cp(-400) },
      ],
    };
    const random = seededRandom(29);
    for (let i = 0; i < 200; i += 1) {
      const result = await chooseCpuMove({
        strength, sfen, legalMoves, moveHistory, search: wide, verify, random, blunderAllowed: false,
      });
      expect(result.move).not.toBe('5i5h');
      expect(isBlunderChoice(result)).toBe(false);
    }
    // 見落としの深い検証は行わない。
    expect(verify.mock.calls.every(([, nodes]) => nodes !== strength.oversightNodes)).toBe(true);
  });

  test('大きな悪手は1局の回数と間隔で制限し、待ったで戻した分は数えない', () => {
    const strength = { blunderLimit: 2, blunderCooldown: 5 };
    expect(canBlunder(strength, [], 10)).toBe(true);
    // 前の悪手から相手の手を挟んで5手(10手数)たつまでは指さない。
    expect(canBlunder(strength, [10], 19)).toBe(false);
    expect(canBlunder(strength, [10], 20)).toBe(true);
    expect(canBlunder(strength, [10, 30], 60)).toBe(false);
    // 待ったで30手目より前へ戻ったら、30手目の悪手は数えない。
    expect(canBlunder(strength, [10, 30], 28)).toBe(true);
    expect(isBlunderChoice({ loss: BLUNDER_LOSS })).toBe(true);
    expect(isBlunderChoice({ loss: BLUNDER_LOSS - 1 })).toBe(false);
    expect(isBlunderChoice({})).toBe(false);
  });

  test('許可されていない手は探索候補にあっても選ばない', async () => {
    const strength = { ...lowStrength, oversightRate: 0, bestMoveRate: 0 };
    const random = seededRandom(11);
    for (let i = 0; i < 200; i += 1) {
      const { move } = await chooseCpuMove({
        strength, sfen, legalMoves: ['2g2f', '5i5h'], moveHistory, search, random,
      });
      expect(['2g2f', '5i5h']).toContain(move);
    }
  });
});
