import { describe, expect, it } from 'vitest';
import {
  ANCHOR,
  BASE_DIFFICULTY,
  GROUP_MEAN_RATING,
  LEVELS_PER_DIFFICULTY,
  SELFPLAY_LEVEL_RATINGS,
  anchorLevel,
  exactLevelForRating,
  groupMeanLevel,
  levelForSelfplayRating,
  levelToRating,
  ratingToLevel,
  recommendedDifficulty,
  selfplayRating,
  winProbability,
} from './ryuo-strength.mjs';

describe('self-play table', () => {
  it('covers Lv0 to Lv40 and rises with the level', () => {
    expect(SELFPLAY_LEVEL_RATINGS[0][0]).toBe(0);
    expect(SELFPLAY_LEVEL_RATINGS.at(-1)[0]).toBe(40);
    for (let index = 1; index < SELFPLAY_LEVEL_RATINGS.length; index += 1) {
      expect(SELFPLAY_LEVEL_RATINGS[index][0]).toBeGreaterThan(SELFPLAY_LEVEL_RATINGS[index - 1][0]);
      expect(SELFPLAY_LEVEL_RATINGS[index][1]).toBeGreaterThan(SELFPLAY_LEVEL_RATINGS[index - 1][1]);
    }
  });

  it('inverts between level and self-play rating, also outside the table', () => {
    for (const level of [-3, 0, 7.5, 21, 33.3, 40, 44]) {
      expect(levelForSelfplayRating(selfplayRating(level))).toBeCloseTo(level, 6);
    }
  });
});

describe('rating to level', () => {
  it('moves the anchor by the difficulty', () => {
    expect(anchorLevel(BASE_DIFFICULTY)).toBe(ANCHOR.level);
    expect(anchorLevel(BASE_DIFFICULTY + 1) - anchorLevel(BASE_DIFFICULTY)).toBe(LEVELS_PER_DIFFICULTY);
    expect(ratingToLevel(ANCHOR.rating, BASE_DIFFICULTY)).toBe(ANCHOR.level);
    expect(ratingToLevel(ANCHOR.rating, BASE_DIFFICULTY - 2)).toBe(ANCHOR.level - 2 * LEVELS_PER_DIFFICULTY);
  });

  it('keeps the rating order and clamps to Lv0..40', () => {
    for (let difficulty = 1; difficulty <= 12; difficulty += 1) {
      let previous = -Infinity;
      for (let rating = 800; rating <= 2400; rating += 25) {
        const level = ratingToLevel(rating, difficulty);
        expect(level).toBeGreaterThanOrEqual(previous);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(40);
        previous = level;
      }
    }
  });

  it('gives the same rating gap the same self-play gap', () => {
    const gap = (difficulty) => selfplayRating(exactLevelForRating(1700, difficulty)) - selfplayRating(exactLevelForRating(1500, difficulty));
    expect(gap(5)).toBeCloseTo(200, 6);
    expect(gap(9)).toBeCloseTo(200, 6);
  });

  it('round-trips a level through the rating', () => {
    for (const difficulty of [3, 7, 10]) {
      for (const level of [12, 25, 30, 36]) {
        expect(ratingToLevel(levelToRating(level, difficulty), difficulty)).toBe(level);
      }
    }
  });

  it('orders the groups by strength and recommends a difficulty near the player', () => {
    for (let group = 2; group <= 6; group += 1) {
      expect(GROUP_MEAN_RATING[group - 1]).toBeGreaterThan(GROUP_MEAN_RATING[group]);
      expect(groupMeanLevel(group - 1, 7)).toBeGreaterThan(groupMeanLevel(group, 7));
    }
    expect(recommendedDifficulty(30)).toBe(7);
    expect(Math.abs(groupMeanLevel(6, recommendedDifficulty(22)) - 22)).toBeLessThanOrEqual(LEVELS_PER_DIFFICULTY / 2);
  });

  it('decides automatic games by rating only', () => {
    expect(winProbability(1900, 1500)).toBeCloseTo(1 / (1 + 10 ** (-1)), 6);
  });
});
