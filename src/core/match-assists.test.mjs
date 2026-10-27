import { describe, expect, it } from 'vitest';
import {
  getHintMoves,
  getHintSearchSettings,
  getIdleCoachSearchSettings,
  getMateCheckSearchSettings,
  getOpeningFollowupSearchSettings,
  getOpeningGuideSafetySearchSettings,
  hintMoveAssessment,
  hintScoreForArrow,
  settleMultiPvCandidates,
} from './match-assists.mjs';

describe('hint arrow evaluations', () => {
  it('keeps engine scores when selecting hint candidates', () => {
    const moves = getHintMoves({
      move: '7g7f',
      candidates: [
        { rank: 1, move: '7g7f', score: { type: 'cp', value: 120 } },
        { rank: 2, move: '2g2f', score: { type: 'cp', value: 54 } },
      ],
    }, 3);

    expect(moves[0].score).toEqual({ type: 'cp', value: 120 });
    expect(hintScoreForArrow(moves[0].score)).toBe(120);
    expect(hintScoreForArrow(moves[1].score)).toBe(54);
  });

  it('orders mate scores outside ordinary centipawn evaluations', () => {
    expect(hintScoreForArrow({ type: 'mate', value: 3 }))
      .toBeGreaterThan(hintScoreForArrow({ type: 'cp', value: 9999 }));
    expect(hintScoreForArrow({ type: 'mate', value: -7 }))
      .toBeLessThan(hintScoreForArrow({ type: 'cp', value: -9999 }));
  });

  it('uses a stronger bounded search for hints', () => {
    expect(getHintSearchSettings(false)).toEqual({
      nodes: 1000000,
      maxTimeMs: 10000,
      multiPv: 3,
    });
    expect(getHintSearchSettings(true)).toEqual({
      nodes: 300000,
      maxTimeMs: 6000,
      multiPv: 3,
    });
  });

  it('reuses one hint search when assessing the move that was played', () => {
    const candidates = [
      { rank: 1, move: '7g7f', score: { type: 'cp', value: 180 } },
      { rank: 2, move: '2g2f', score: { type: 'cp', value: -120 } },
    ];
    expect(hintMoveAssessment(candidates, '7g7f')).toEqual({
      beforeScore: { type: 'cp', value: 180 },
      afterScore: { type: 'cp', value: 180 },
    });
    expect(hintMoveAssessment(candidates, '2g2f')).toEqual({
      beforeScore: { type: 'cp', value: 180 },
      afterScore: { type: 'cp', value: -120 },
    });
    expect(hintMoveAssessment(candidates, '5g5f')).toBeNull();
  });

  it('shares the stronger hint search with idle coaching so both recommend the same best move', () => {
    expect(getIdleCoachSearchSettings(false)).toEqual({
      nodes: 1000000,
      maxTimeMs: 10000,
      multiPv: 3,
    });
    expect(getIdleCoachSearchSettings(true)).toEqual({
      nodes: 300000,
      maxTimeMs: 6000,
      multiPv: 3,
    });
  });

  it('keeps automatic opening follow-ups short enough for the main thread', () => {
    expect(getOpeningFollowupSearchSettings(false)).toEqual({
      nodes: 12000,
      maxTimeMs: 500,
      multiPv: 3,
    });
    expect(getOpeningFollowupSearchSettings(true)).toEqual({
      nodes: 6000,
      maxTimeMs: 300,
      multiPv: 3,
    });
  });

  it('bounds the safety check used while building a formation', () => {
    expect(getOpeningGuideSafetySearchSettings(false)).toEqual({
      nodes: 8000,
      maxTimeMs: 400,
      multiPv: 4,
      forcedNodes: 4000,
      forcedMaxTimeMs: 200,
    });
    expect(getOpeningGuideSafetySearchSettings(true)).toEqual({
      nodes: 4000,
      maxTimeMs: 250,
      multiPv: 4,
      forcedNodes: 2000,
      forcedMaxTimeMs: 150,
    });
  });

  it('bounds normal engine searches used for mate checks', () => {
    expect(getMateCheckSearchSettings(false)).toEqual({ nodes: 30000, maxTimeMs: 150 });
    expect(getMateCheckSearchSettings(true)).toEqual({ nodes: 15000, maxTimeMs: 250 });
  });
});

describe('悪手判定の読み', () => {
  it('CPU本体の探索よりずっと深く、時間の上限つきで読む', async () => {
    const { getMoveJudgeSearchSettings } = await import('./match-assists.mjs');
    const { getStrengthSearchSettings, CPU_STRENGTH_PRESETS } = await import('./strength-settings.mjs');
    // 6級程度(Lv10。段級位の作り直しの前のLv21)。
    const lv21 = getStrengthSearchSettings(CPU_STRENGTH_PRESETS.find(({ level }) => level === 10).value);
    for (const mobile of [false, true]) {
      const judge = getMoveJudgeSearchSettings(mobile);
      expect(judge.nodes).toBeGreaterThanOrEqual(100 * lv21.nodes);
      expect(judge.maxTimeMs).toBeLessThanOrEqual(2000);
    }
  });
});

describe('MultiPVの候補を同じ物差しにそろえる', () => {
  const cp = (value) => ({ type: 'cp', value });
  it('止めた探索で2番目からが浅いとき、最善手より評価の高い古い候補を出さない(最善手が変わった)', () => {
    // 実際のエンジンの出力: 深さ16で読み直した1番目と、深さ15の古い値を出し直した2・3番目。
    const candidates = [
      { rank: 1, move: 'B*5e', depth: 16, score: cp(1628) },
      { rank: 2, move: 'B*2d', depth: 15, score: cp(2715) },
      { rank: 3, move: 'B*3c', depth: 15, score: cp(2022) },
    ];
    const completed = [
      { rank: 1, move: 'B*4b', depth: 15, score: cp(2971) },
      { rank: 2, move: 'B*5b', depth: 15, score: cp(2790) },
      { rank: 3, move: 'B*1b', depth: 15, score: cp(2406) },
    ];
    const settled = settleMultiPvCandidates(candidates, completed);
    expect(settled.map(({ move }) => move)).toEqual(['B*5e']);
    expect(settled[0].score).toEqual(cp(1628));
  });

  it('最善手が同じなら、読み終えた深さの候補を、その深さでの差のまま出す', () => {
    const candidates = [
      { rank: 1, move: 'G*3e', depth: 16, score: cp(-500) },
      { rank: 2, move: 'S*7d', depth: 15, score: cp(-209) },
      { rank: 3, move: 'P*3d', depth: 15, score: cp(-400) },
    ];
    const completed = [
      { rank: 1, move: 'G*3e', depth: 15, score: cp(-150) },
      { rank: 2, move: 'S*7d', depth: 15, score: cp(-209) },
      { rank: 3, move: 'P*3d', depth: 15, score: cp(-441) },
    ];
    const settled = settleMultiPvCandidates(candidates, completed);
    expect(settled.map(({ rank, move, score }) => [rank, move, score.value])).toEqual([
      [1, 'G*3e', -500], [2, 'S*7d', -559], [3, 'P*3d', -791],
    ]);
    // 言葉の最善手(1番目)と、矢印の「最善」(評価がいちばん高い手)が同じになる。
    const arrows = settled.map(({ move, score }) => ({ move, value: hintScoreForArrow(score) }));
    expect(arrows.reduce((best, arrow) => (arrow.value > best.value ? arrow : best)).move).toBe(getHintMoves({ candidates: settled }, 3)[0].move);
  });

  it('すべて同じ深さなら変えない', () => {
    const candidates = [
      { rank: 1, move: '7g7f', depth: 12, score: cp(50) },
      { rank: 2, move: '2g2f', depth: 12, score: cp(40) },
    ];
    expect(settleMultiPvCandidates(candidates, candidates)).toEqual(candidates);
  });

  it('最善手より高い評価の候補は、同じ深さでも外す', () => {
    const settled = settleMultiPvCandidates([
      { rank: 1, move: '7g7f', depth: 12, score: cp(50) },
      { rank: 2, move: '2g2f', depth: 12, score: cp(80) },
      { rank: 3, move: '5g5f', depth: 12, score: cp(10) },
    ]);
    expect(settled.map(({ rank, move }) => [rank, move])).toEqual([[1, '7g7f'], [2, '5g5f']]);
  });
});
