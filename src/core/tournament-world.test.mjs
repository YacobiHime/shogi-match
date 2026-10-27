import { describe, expect, it } from 'vitest';
import {
  GROUP_MEAN_RATING, WORLD_SPREAD, recommendedDifficulty, recommendedWorldLevel, winProbability, worldCpuLevel, worldExactLevel, worldRating,
} from './ryuo-strength.mjs';
import {
  TOURNAMENT_WORLD_KEY, defaultWorldDifficulty, loadTournamentWorld, rankTag, resolveWorld, saveTournamentWorld, worldReview,
} from './tournament-world.mjs';
import { GROUPS, USER_ID, createSeason } from './ryuo.mjs';

const memory = () => {
  const data = new Map();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
/** 棋力levelの人が、レーティングratingの棋士に勝つ見込み(このゲームの1Lv=R60のElo式)。 */
const userWins = (level, rating, world) => winProbability(level * 60, worldExactLevel(rating, world) * 60);

describe('世界の物差し(docs/tournament-strength-spread-design.md)', () => {
  it('おすすめの世界では、6組の平均に7割。上の組ほど強く、竜王がいちばん強い(頭打ちなし)', () => {
    const level = 20;
    const world = recommendedWorldLevel(level);
    expect(userWins(level, GROUP_MEAN_RATING[6], world)).toBeCloseTo(0.7, 2);
    const levels = [6, 5, 4, 3, 1].map((group) => worldExactLevel(GROUP_MEAN_RATING[group], world));
    for (let index = 1; index < levels.length; index += 1) expect(levels[index]).toBeGreaterThan(levels[index - 1]);
    // 6組の平均と1組の平均は、差R336を0.6倍した約3.4Lv。竜王(R2130)は、6組の平均より約6.8Lv上。
    expect(levels.at(-1) - levels[0]).toBeCloseTo((336 * WORLD_SPREAD) / 60, 5);
    expect(userWins(level, GROUP_MEAN_RATING[1], world)).toBeGreaterThan(0.35);
    expect(userWins(level, GROUP_MEAN_RATING[1], world)).toBeLessThan(0.5);
    expect(userWins(level, 2130, world)).toBeGreaterThan(0.12);
    expect(userWins(level, 2130, world)).toBeLessThan(0.25);
    // 指すLvは整数で、Lv1〜49に収める。プレイヤーのレーティングは、同じ物差しの逆。
    expect(worldCpuLevel(2130, 48)).toBe(49);
    expect(worldCpuLevel(900, 1)).toBe(1);
    expect(worldExactLevel(worldRating(23.4, world), world)).toBeCloseTo(23.4, 1);
  });

  it('世界は保存して使い続け、同じ番号なら同じ世界。番号1つで1.5Lv動く', () => {
    const storage = memory();
    expect(loadTournamentWorld(storage)).toBeNull();
    expect(defaultWorldDifficulty(null, 20)).toBe(recommendedDifficulty(20));
    const first = resolveWorld({ stored: null, playerLevel: 20, difficulty: recommendedDifficulty(20), at: 1 });
    expect(first.level).toBeCloseTo(recommendedWorldLevel(20), 5);
    saveTournamentWorld(storage, first);
    const stored = loadTournamentWorld(storage);
    expect(stored).toEqual(first);
    // 強くなっても、同じ番号なら同じ世界(合わせ直さない)。入口ではいつもの番号を選んでおく。
    expect(resolveWorld({ stored, playerLevel: 25, difficulty: first.difficulty })).toBe(stored);
    expect(defaultWorldDifficulty(stored, 25)).toBe(first.difficulty);
    expect(resolveWorld({ stored, playerLevel: 25, difficulty: first.difficulty + 2 }).level).toBeCloseTo(first.level + 3, 5);
    storage.data.set(TOURNAMENT_WORLD_KEY, '{broken');
    expect(loadTournamentWorld(storage)).toBeNull();
  });

  it('強くなったら伸びを伝え、弱くなった・2期続けて降級したら、やさしい世界を勧める', () => {
    const stored = { level: 17, difficulty: 6, playerLevel: 20, at: 0 };
    expect(worldReview({ stored, playerLevel: 23.1 })).toEqual({ kind: 'grown', delta: 3.1 });
    expect(worldReview({ stored, playerLevel: 17.5 })).toEqual({ kind: 'dropped', delta: -2.5 });
    expect(worldReview({ stored, playerLevel: 20.5, history: [{ relegated: true }, { relegated: true }] })).toMatchObject({ kind: 'struggling' });
    expect(worldReview({ stored, playerLevel: 20.5, history: [{ relegated: false }, { relegated: true }] })).toBeNull();
    expect(worldReview({ stored: null, playerLevel: 20 })).toBeNull();
    // 次の相手の札: 2Lv以上の差で「格上」「格下」。
    expect(rankTag(22, 20)).toBe('格上');
    expect(rankTag(18, 20.4)).toBe('格下');
    expect(rankTag(21, 20)).toBeNull();
    expect(rankTag(Number.NaN, 20)).toBeNull();
  });

  it('世界を持つ期では、上の組の棋士ほど強いLvで指す。竜王はいちばん上', () => {
    const settings = { difficulty: 6, scale: 3, revival: true, recommended: true, world: recommendedWorldLevel(20) };
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, settings, userLevel: 20, seed: 21 });
    const mean = (group) => {
      const levels = season.fields[group].filter((id) => id !== USER_ID).map((id) => season.players[id].level);
      return levels.reduce((sum, value) => sum + value, 0) / levels.length;
    };
    const means = GROUPS.map(mean);
    expect(means[0]).toBeGreaterThan(means[5] + 2);
    expect(season.players[season.champion].level).toBeGreaterThanOrEqual(Math.max(...GROUPS.flatMap((group) => season.fields[group].filter((id) => id !== USER_ID).map((id) => season.players[id].level))) - 1);
    // プレイヤーの名簿の尺度のレーティングは、6組の平均に7割勝てる強さ(6組の平均より上)。
    expect(season.players[USER_ID].rating).toBeGreaterThan(GROUP_MEAN_RATING[6] + 150);
  });
});
