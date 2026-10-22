import { describe, expect, it } from 'vitest';
import { clearExhibitRecords } from './exhibit-reset.mjs';
import { DISCOVER_FEATURES, SEEN_FEATURES_KEY, discoveryPlan, loadSeenFeatures, markFeatureSeen, nearRewardLines, todayPlan } from './home-extras.mjs';
import { normalReason } from './play-coach.mjs';

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

describe('今日の1局(docs/home-next-adaptive-design.mdの15章)', () => {
  it('今日まだ指していなければ出す。続けている日があれば日数、途切れていれば「おかえり！」', () => {
    expect(todayPlan({ playedToday: true, streak: 3, level: 15, everPlayed: true })).toBeNull();
    expect(todayPlan({ playedToday: false, streak: 2, level: 15, everPlayed: true })).toEqual({ title: '今日の1局', reason: '3日続けて指そう。今日もLv.15と1局' });
    expect(todayPlan({ playedToday: false, streak: 0, level: 15, everPlayed: true }).reason).toBe('おかえり！ Lv.15と、肩ならしに1局');
    expect(todayPlan({ playedToday: false, streak: 0, level: 3, everPlayed: false }).reason).toBe('Lv.3と、今日の1局を指そう');
  });
});

describe('まだ見ていない遊び', () => {
  it('今日1局以上指していて、対局数が3の倍数のときだけ、決まった順に1つ', () => {
    expect(discoveryPlan({ seen: [], games: 9, playedToday: true })?.id).toBe('endgame');
    expect(discoveryPlan({ seen: [], games: 10, playedToday: true })).toBeNull();
    expect(discoveryPlan({ seen: [], games: 9, playedToday: false })).toBeNull();
    expect(discoveryPlan({ seen: ['endgame'], games: 9, playedToday: true })?.id).toBe('opening-dex');
    const allButMeasure = DISCOVER_FEATURES.map(({ id }) => id).filter((id) => id !== 'measure');
    expect(discoveryPlan({ seen: allButMeasure, games: 9, playedToday: true })?.id).toBe('measure');
    expect(discoveryPlan({ seen: allButMeasure, games: 9, playedToday: true, measured: true })).toBeNull();
  });

  it('開いたことを残し、知らないIDや読めない値は捨てる。展示の「最初から」で消える', () => {
    const storage = memoryStorage();
    expect(loadSeenFeatures(storage)).toEqual([]);
    expect(markFeatureSeen(storage, 'endgame')).toBe(true);
    expect(markFeatureSeen(storage, 'endgame')).toBe(false);
    expect(markFeatureSeen(storage, 'unknown')).toBe(false);
    expect(loadSeenFeatures(storage)).toEqual(['endgame']);
    expect(loadSeenFeatures(memoryStorage({ [SEEN_FEATURES_KEY]: '["endgame","x"]' }))).toEqual(['endgame']);
    expect(loadSeenFeatures(memoryStorage({ [SEEN_FEATURES_KEY]: '{' }))).toEqual([]);
    clearExhibitRecords(storage);
    expect(loadSeenFeatures(storage)).toEqual([]);
  });
});

describe('あと少しのご褒美', () => {
  it('まだ勝っていないLvの★と、着せ替えまで印あと2個以内', () => {
    expect(nearRewardLines({ level: 15, wonLevels: [14], themeRemaining: 1 })).toEqual([
      'Lv.15にはまだ勝っていないね。初めて勝つと★がもらえるよ',
      '次の着せ替えまで、印あと1個。新しい戦法や囲いを組むと増えるよ',
    ]);
    expect(nearRewardLines({ level: 15, wonLevels: [15], themeRemaining: 3 })).toEqual([]);
    expect(nearRewardLines({ level: 0, wonLevels: [], themeRemaining: null })).toEqual([]);
  });

  it('「対局する」の言い換えの候補に入る', () => {
    const state = { games: 4, rating: 1150, levels: { 15: { wins: 1, losses: 0, draws: 0 } } };
    const games = [{ opponentLevel: 15, outcome: 'win' }];
    const reasons = [0, 1, 2, 3, 4, 5].map((n) => normalReason({ ...state, games: n }, games, 15, [], { wonLevels: [], themeRemaining: null }));
    expect(reasons).toContain('Lv.15にはまだ勝っていないね。初めて勝つと★がもらえるよ');
  });
});
