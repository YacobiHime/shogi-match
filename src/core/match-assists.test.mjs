import { describe, expect, it } from 'vitest';
import {
  getHintMoves,
  getHintSearchSettings,
  getIdleCoachSearchSettings,
  getOpeningFollowupSearchSettings,
  getOpeningGuideSafetySearchSettings,
  hintMoveAssessment,
  hintScoreForArrow,
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
});
