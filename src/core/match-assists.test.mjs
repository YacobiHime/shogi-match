import { describe, expect, it } from 'vitest';
import { getHintMoves, hintScoreForArrow } from './match-assists.mjs';

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
});
