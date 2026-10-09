import { describe, expect, it } from 'vitest';
import { findTurningPoints, turningPointText } from './turning-points.mjs';

const points = (values, annotations = {}) => values.map((graphValue, ply) => ({
  ply, graphValue, annotation: annotations[ply] ?? null,
}));

describe('turning points', () => {
  it('finds the winner move that settles the game and the loser blunder before it', () => {
    // 先手勝ち。5手目(先手)で一気に優勢になり、そのまま終局まで続く。4手目(後手)が最大の損。
    const found = findTurningPoints(
      points([0, 50, 0, 80, 100, 900, 1000, 1500], { 4: { mover: 'white', loss: 300 }, 2: { mover: 'white', loss: 100 } }),
      'black',
    );
    expect(found).toEqual({ decisive: 5, losing: 4 });
  });

  it('gives the decisive move to the winner move after a loser blunder', () => {
    // 先手勝ち。4手目(後手)の悪手で優勢になり、決め手は次の5手目(先手)。
    const found = findTurningPoints(
      points([0, 0, 0, 0, 800, 900, 1000], { 4: { mover: 'white', loss: 800 } }),
      'black',
    );
    expect(found).toEqual({ decisive: 5, losing: 4 });
  });

  it('works for white wins using the side-to-move parity', () => {
    const found = findTurningPoints(points([0, 0, 0, 0, -100, -700, -900, -1200]), 'white');
    expect(found.decisive).toBe(6);
    expect(found.losing).toBe(5);
  });

  it('ignores an earlier lead that was later thrown away', () => {
    const found = findTurningPoints(points([0, 900, 900, 100, 100, 600, 700, 800]), 'black');
    expect(found.decisive).toBe(5);
  });

  it('returns nothing for draws, unclear games and games that never became decisive', () => {
    const none = { decisive: null, losing: null };
    expect(findTurningPoints(points([0, 900, 900]), null)).toEqual(none);
    expect(findTurningPoints(points([0, 100, 200, 300]), 'black')).toEqual(none);
    expect(findTurningPoints([], 'black')).toEqual(none);
  });

  it('words the losing move for the player side', () => {
    expect(turningPointText('decisive')).toBe('この手が勝負の決め手になったね！');
    expect(turningPointText('losing')).toBe('この手が敗着みたい。悔しい～！');
    expect(turningPointText('losing', { playerWon: true })).toContain('相手の敗着');
  });
});
