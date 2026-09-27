import { describe, expect, it } from 'vitest';
import {
  flipSideToMove,
  isContinuousCheckMate,
  parseMateScore,
} from './engine-mate-check.mjs';

describe('parseMateScore', () => {
  it('正のmateスコアだけを詰み手数として扱う', () => {
    expect(parseMateScore({ score: { type: 'mate', value: 7 } })).toBe(7);
    expect(parseMateScore({ score: { type: 'mate', value: -3 } })).toBeNull();
    expect(parseMateScore({ score: { type: 'cp', value: 9999 } })).toBeNull();
    expect(parseMateScore({})).toBeNull();
  });
});

describe('isContinuousCheckMate', () => {
  const blackMate = '4k4/9/4P4/9/9/9/9/9/4K4 b G 1';

  it('先手と後手の1手詰を検証する', () => {
    expect(isContinuousCheckMate(blackMate, ['G*5b'], 1)).toBe(true);
    expect(isContinuousCheckMate(
      '4k4/9/9/9/9/9/4p4/9/4K4 w g 1',
      ['G*5h'],
      1,
    )).toBe(true);
  });

  it('3手の連続王手と終局を検証する', () => {
    expect(isContinuousCheckMate(
      '4k4/9/4P4/9/9/9/9/9/4K4 b RG 1',
      ['R*5b', '5a6a', 'G*7b'],
      3,
    )).toBe(true);
  });

  it('詰まない手順、途中の非王手、短いPVを除外する', () => {
    expect(isContinuousCheckMate(blackMate, ['G*4b'], 1)).toBe(false);
    expect(isContinuousCheckMate(
      '4k4/9/4P4/9/9/9/9/9/4K4 b RG 1',
      ['G*7c', '5a6a', 'R*9a'],
      3,
    )).toBe(false);
    expect(isContinuousCheckMate(blackMate, [], 1)).toBe(false);
  });
});

describe('flipSideToMove', () => {
  it('盤面を変えずに手番だけを反転する', () => {
    expect(flipSideToMove('4k4/9/4P4/9/9/9/9/9/4K4 b G 1'))
      .toBe('4k4/9/4P4/9/9/9/9/9/4K4 w G 1');
  });

  it('王手中の局面は反転しない', () => {
    expect(flipSideToMove('4k4/9/4R4/9/9/9/9/9/4K4 w - 1')).toBeNull();
  });
});
