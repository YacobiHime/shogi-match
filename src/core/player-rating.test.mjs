import { describe, expect, it } from 'vitest';
import {
  INITIAL_RATING,
  RATING_STORAGE_KEY,
  applyRatedGame,
  createRatingState,
  levelRating,
  loadRatingState,
  recommendedLevel,
  saveRatingState,
} from './player-rating.mjs';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};

describe('player rating', () => {
  it('maps levels to ratings and back, capped at Lv40', () => {
    expect(levelRating(15)).toBe(1200);
    expect(recommendedLevel(INITIAL_RATING)).toBe(10);
    expect(recommendedLevel(levelRating(25))).toBe(25);
    expect(recommendedLevel(99999)).toBe(40);
    expect(recommendedLevel(-50)).toBe(0);
  });

  it('moves up on a win against an equal opponent and down on a loss', () => {
    const state = createRatingState();
    const win = applyRatedGame(state, { opponentLevel: 10, outcome: 'win' });
    expect(win.delta).toBe(20);
    expect(win.state).toMatchObject({ rating: 820, games: 1, wins: 1 });
    const loss = applyRatedGame(state, { opponentLevel: 10, outcome: 'loss' });
    expect(loss.delta).toBe(-20);
    expect(applyRatedGame(state, { opponentLevel: 10, outcome: 'draw' }).delta).toBe(0);
  });

  it('rewards beating a stronger CPU more and uses a smaller K after the provisional games', () => {
    const state = createRatingState();
    const upset = applyRatedGame(state, { opponentLevel: 20, outcome: 'win' }).delta;
    expect(upset).toBeGreaterThan(20);
    const settled = { ...state, games: 10 };
    expect(applyRatedGame(settled, { opponentLevel: 10, outcome: 'win' }).delta).toBe(10);
  });

  it('never goes below zero and keeps a bounded history', () => {
    let state = { ...createRatingState(), rating: 5, games: 20 };
    state = applyRatedGame(state, { opponentLevel: 0, outcome: 'loss' }).state;
    expect(state.rating).toBe(0);
    for (let i = 0; i < 40; i += 1) state = applyRatedGame(state, { opponentLevel: 5, outcome: 'win' }).state;
    expect(state.history).toHaveLength(30);
  });

  it('round-trips through storage and ignores broken data', () => {
    const storage = memoryStorage();
    const { state } = applyRatedGame(createRatingState(), { opponentLevel: 12, outcome: 'win', at: 1 });
    expect(saveRatingState(storage, state)).toBe(true);
    expect(loadRatingState(storage)).toEqual(state);
    storage.setItem(RATING_STORAGE_KEY, '{broken');
    expect(loadRatingState(storage)).toEqual(createRatingState());
    expect(loadRatingState(null)).toEqual(createRatingState());
  });
});
