import { describe, expect, test } from 'vitest';
import { enumerateLegalMoves, STANDARD_SFEN } from '../game-state.ts';
import { Position } from 'tsshogi';
import {
  RISK_MARGIN, chooseCpuMove, chooseRiskAwareMove, expectedWinRateLoss, riskStance,
} from './cpu-move-choice.mjs';
import { CPU_STRENGTH_PRESETS, RISK_MAX_LEVEL, getStrengthSearchSettings, sourceLevelSettings } from './strength-settings.mjs';

const cp = (value) => ({ type: 'cp', value });
const naturalness = Object.assign(() => 1, { isSacrifice: () => false });
const strengthAt = (level) => getStrengthSearchSettings(CPU_STRENGTH_PRESETS.find((preset) => preset.level === level).value);

/** movesを指した局面の読みを返す偽の追加探索。呼ばれた手順も記録する。 */
function fakeProbe(table) {
  const calls = [];
  const probe = async (moves, options) => {
    calls.push({ moves, options });
    return { candidates: (table[moves.join(' ')] ?? []).map((value, index) => ({ rank: index + 1, move: `m${index}`, score: cp(value) })) };
  };
  return { probe, calls };
}

describe('正解の道の細さ', () => {
  test('どの手でも同じなら0、正解が1手しかないほど大きい', () => {
    const flat = [300, 300, 300, 300].map((value) => ({ score: cp(value) }));
    const narrow = [300, -500, -600, -700].map((value) => ({ score: cp(value) }));
    const wide = [300, 280, 260, 240].map((value) => ({ score: cp(value) }));
    expect(expectedWinRateLoss(flat, 500)).toBeCloseTo(0, 6);
    expect(expectedWinRateLoss([{ score: cp(300) }], 500)).toBe(0);
    expect(expectedWinRateLoss(narrow, 500)).toBeGreaterThan(10);
    expect(expectedWinRateLoss(wide, 500)).toBeLessThan(2);
    // 温度が高い(弱い)ほど、悪い手も選ぶので、失う見込みが大きい。
    expect(expectedWinRateLoss(narrow, 1500)).toBeGreaterThan(expectedWinRateLoss(narrow, 500));
  });
});

describe('形勢による危険への態度', () => {
  test('優勢ほど手堅く、劣勢ほど勝負手を好み、その間はどちらでもない', () => {
    expect(riskStance(30, 0)).toEqual({ safe: 0, swindle: 0 });
    expect(riskStance(50, 1)).toEqual({ safe: 1, swindle: 0 });
    expect(riskStance(100, 1).safe).toBeCloseTo(2, 6);
    expect(riskStance(45, 1).safe).toBeCloseTo(0.5, 6);
    expect(riskStance(40, 1)).toEqual({ safe: 0, swindle: 0 });
    expect(riskStance(30, 1).swindle).toBeCloseTo(0.5, 6);
    expect(riskStance(10, 1).swindle).toBe(1);
  });

  test(`もとの校正のLv${RISK_MAX_LEVEL}以下の強さだけが持ち、強いほど弱める`, () => {
    for (const { level, source } of CPU_STRENGTH_PRESETS) {
      if (level < 1 || level >= 40) continue;
      const { riskAttitude } = strengthAt(level);
      // もとのLv30と31のあいだを混ぜたLvは、Lv30の態度を引き継ぐ(Lv31は持たない)。
      if (source < RISK_MAX_LEVEL + 1) expect(riskAttitude, `Lv${level}`).toBeGreaterThan(0);
      else expect(riskAttitude, `Lv${level}`).toBeUndefined();
    }
    expect(strengthAt(1).riskAttitude).toBeGreaterThan(sourceLevelSettings(RISK_MAX_LEVEL).riskAttitude);
    expect(sourceLevelSettings(RISK_MAX_LEVEL).riskAttitude).toBe(0.5);
  });
});

describe('危険を見積もって選び直す', () => {
  const strength = { riskAttitude: 1, nodes: 1000, scoreTemperature: 500 };

  test('優勢では、正解の道が細い最善手より、少し損でも無難な手を選ぶ', async () => {
    const { probe, calls } = fakeProbe({
      'A a1': [300, -500, -600, -700],
      'B b1': [250, 240, 230, 220],
    });
    const candidates = [
      { rank: 1, move: 'A', score: cp(300), pv: ['A', 'a1'] },
      { rank: 2, move: 'B', score: cp(250), pv: ['B', 'b1'] },
      // 最善手との勝率差がRISK_MARGINを超える手は選ばない。
      { rank: 3, move: 'C', score: cp(100), pv: ['C', 'c1'] },
    ];
    const choice = await chooseRiskAwareMove({ search: { move: 'A' }, candidates, strength, naturalness, probe });
    expect(choice).toMatchObject({ move: 'B', rank: 2, kind: 'safe', loss: 50 });
    // 相手の最善の応手の後の局面を読む。
    expect(calls.map(({ moves }) => moves.join(' '))).toEqual(['A a1', 'B b1']);
    expect(calls[0].options).toEqual({ nodes: 1000, multiPv: 4 });
  });

  test('最善手がいちばん無難なら選び直さない', async () => {
    const { probe } = fakeProbe({
      'A a1': [300, 290, 280, 270],
      'B b1': [250, -500, -600, -700],
    });
    const candidates = [
      { rank: 1, move: 'A', score: cp(300), pv: ['A', 'a1'] },
      { rank: 2, move: 'B', score: cp(250), pv: ['B', 'b1'] },
    ];
    expect(await chooseRiskAwareMove({ search: { move: 'A' }, candidates, strength, naturalness, probe })).toBeNull();
  });

  test('劣勢では、相手が間違えやすい勝負手を選ぶ', async () => {
    const { probe, calls } = fakeProbe({
      // 指した後は相手の手番なので、相手から見た評価値。
      A: [900, 880, 870, 860],
      B: [1000, -200, -300, -400],
    });
    const candidates = [
      { rank: 1, move: 'A', score: cp(-900), pv: ['A', 'a1'] },
      { rank: 2, move: 'B', score: cp(-1000), pv: ['B', 'b1'] },
    ];
    const choice = await chooseRiskAwareMove({ search: { move: 'A' }, candidates, strength, naturalness, probe });
    expect(choice).toMatchObject({ move: 'B', kind: 'swindle', loss: 100 });
    expect(calls.map(({ moves }) => moves.join(' '))).toEqual(['A', 'B']);
  });

  test('危険への態度がない設定、詰みの見えた局面、近い候補がない局面、1手の損の上限を超える手では読まない', async () => {
    const { probe, calls } = fakeProbe({});
    const run = (candidates, lossCap, options = strength) => chooseRiskAwareMove({
      search: { move: 'A' }, candidates, strength: options, naturalness, probe, lossCap,
    });
    expect(await run([
      { rank: 1, move: 'A', score: cp(300), pv: ['A', 'a1'] },
      { rank: 2, move: 'B', score: cp(250), pv: ['B', 'b1'] },
    ], Infinity, { nodes: 1000 })).toBeNull();
    expect(await run([
      { rank: 1, move: 'A', score: { type: 'mate', value: 3 }, pv: ['A', 'a1'] },
      { rank: 2, move: 'B', score: cp(2000), pv: ['B', 'b1'] },
    ])).toBeNull();
    // 勝率62%と50%で、差がRISK_MARGINを超える。
    expect(RISK_MARGIN).toBeLessThan(12);
    expect(await run([
      { rank: 1, move: 'A', score: cp(300), pv: ['A', 'a1'] },
      { rank: 2, move: 'B', score: cp(0), pv: ['B', 'b1'] },
    ])).toBeNull();
    expect(await run([
      { rank: 1, move: 'A', score: cp(300), pv: ['A', 'a1'] },
      { rank: 2, move: 'B', score: cp(250), pv: ['B', 'b1'] },
    ], 40)).toBeNull();
    expect(calls).toEqual([]);
  });

  test('chooseCpuMoveでは、見落としの判定の後、ふだんの選び方の前に選び直す', async () => {
    const position = Position.newBySFEN(STANDARD_SFEN);
    const legalMoves = enumerateLegalMoves(position).map(({ usi }) => usi);
    const search = {
      move: '7g7f',
      candidates: [
        { rank: 1, move: '7g7f', score: cp(300), pv: ['7g7f', '3c3d'] },
        { rank: 2, move: '2g2f', score: cp(250), pv: ['2g2f', '8c8d'] },
      ],
    };
    const { probe } = fakeProbe({
      '7g7f 3c3d': [300, -500, -600, -700],
      '2g2f 8c8d': [250, 240, 230, 220],
    });
    // 見落とし・最善手の抽選が起きない乱数にする。
    const random = () => 0.99;
    const level25 = sourceLevelSettings(25);
    const choice = await chooseCpuMove({ strength: level25, sfen: STANDARD_SFEN, legalMoves, search, probe, random });
    expect(choice).toMatchObject({ move: '2g2f', kind: 'safe' });
    // もとの校正のLv31以上の強さ(アマ初段より上)は危険を気にしない。
    const level35 = strengthAt(26);
    const strong = await chooseCpuMove({ strength: level35, sfen: STANDARD_SFEN, legalMoves, search, probe, random });
    expect(strong.kind).not.toBe('safe');
  });
});
