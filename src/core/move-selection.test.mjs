import { describe, expect, test } from 'vitest';
import { selectMoveByRank } from './move-selection.mjs';

const search = {
  move: '7g7f',
  candidates: [
    { rank: 1, move: '7g7f', score: { type: 'cp', value: 300 } },
    { rank: 2, move: '2g2f', score: { type: 'cp', value: 120 } },
    { rank: 3, move: '5g5f', score: { type: 'cp', value: -100 } },
    { rank: 4, move: '9g9f', score: { type: 'cp', value: -900 } },
  ],
};

describe('評価差を考慮したCPU候補選択', () => {
  test('順位内でも最善手から大きく劣る候補は除外する', () => {
    expect(selectMoveByRank(
      search,
      { min: 1, max: 4 },
      () => 0.999,
      { maxScoreLoss: 350 },
    )).toEqual({ move: '2g2f', rank: 2 });
  });

  test('許容範囲に候補がなければ最善手を選ぶ', () => {
    expect(selectMoveByRank(
      search,
      { min: 2, max: 4 },
      () => 0.5,
      { maxScoreLoss: 100 },
    )).toEqual({ move: '7g7f', rank: 1 });
  });

  test('詰みを逃す候補を選ばない', () => {
    const forcedMate = {
      move: '5c5b',
      candidates: [
        { rank: 1, move: '5c5b', score: { type: 'mate', value: 5 } },
        { rank: 2, move: '4c4b', score: { type: 'cp', value: 2000 } },
      ],
    };
    expect(selectMoveByRank(
      forcedMate,
      { min: 1, max: 2 },
      () => 0.999,
      { maxScoreLoss: 900 },
    )).toEqual({ move: '5c5b', rank: 1 });
  });
});
