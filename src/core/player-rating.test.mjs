import { describe, expect, it } from 'vitest';
import {
  INITIAL_RATING,
  RATING_STORAGE_KEY,
  applyDeclaredGrade,
  applyMeasuredRating,
  declarableGrades,
  applyRatedGame,
  createRatingState,
  levelRating,
  levelRatingText,
  usageRows,
  loadRatingState,
  recommendedLevel,
  saveRatingState,
  gradeName,
  losingStreakAt,
  nextRatingGoal,
  retrySuggestion,
  RATED_EVENTS,
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

  it('tallies results per CPU level for the picker text', () => {
    let state = createRatingState();
    expect(levelRatingText(state, 10)).toBe('R800・0勝0敗0引き分け');
    for (const outcome of ['win', 'win', 'loss', 'draw']) {
      state = applyRatedGame(state, { opponentLevel: 10, outcome }).state;
    }
    state = applyRatedGame(state, { opponentLevel: 11, outcome: 'win' }).state;
    expect(levelRatingText(state, 10)).toBe('R800・2勝1敗1引き分け');
    expect(levelRatingText(state, 11)).toBe('R880・1勝0敗0引き分け');
    expect(loadRatingState({ getItem: () => JSON.stringify(state) }).levels).toEqual(state.levels);
  });

  it('tallies colors and formations for the notebook statistics', () => {
    let state = createRatingState();
    const games = [
      ['win', 'black', { battle: '矢倉', rook: '居飛車', castle: '矢倉囲い', opponentRook: '四間飛車' }],
      ['loss', 'black', { battle: '矢倉', rook: '居飛車', castle: '矢倉囲い' }],
      ['win', 'white', { battle: '相振り飛車', rook: '三間飛車', castle: '' }],
    ];
    for (const [outcome, color, profile] of games) {
      state = applyRatedGame(state, { opponentLevel: 5, outcome, color, profile }).state;
    }
    expect(state.colors).toEqual({
      black: { wins: 1, losses: 1, draws: 0 },
      white: { wins: 1, losses: 0, draws: 0 },
    });
    const rows = usageRows(state, 'castle');
    expect(rows).toEqual([{ name: '矢倉囲い', wins: 1, losses: 1, draws: 0, games: 2, rate: 2 / 3 }]);
    expect(usageRows(state, 'battle').map(({ name }) => name)).toEqual(['矢倉', '相振り飛車']);
    expect(usageRows(state, 'opponentRook')).toHaveLength(1);
    expect(usageRows(createRatingState(), 'rook')).toEqual([]);
    const loaded = loadRatingState({ getItem: () => JSON.stringify(state) });
    expect(loaded.usage.rook).toEqual(state.usage.rook);
    expect(loaded.colors).toEqual(state.colors);
  });

  it('sets a measured rating without changing the game count and keeps it through later games', () => {
    const played = applyRatedGame(createRatingState(), { opponentLevel: 10, outcome: 'win', at: 1 }).state;
    const measured = applyMeasuredRating(played, { rating: 1234.4, label: '十一級程度', at: 2 });
    expect(measured).toMatchObject({ rating: 1234, games: 1, measured: { rating: 1234, label: '十一級程度', at: 2 } });
    expect(measured.history.at(-1)).toMatchObject({ rating: 1234, outcome: 'measure' });
    const next = applyRatedGame(measured, { opponentLevel: 15, outcome: 'win', at: 3 }).state;
    expect(next.measured).toEqual(measured.measured);
    expect(next.games).toBe(2);
    expect(loadRatingState({ getItem: () => JSON.stringify(next) }).measured).toEqual(measured.measured);
  });

  it('offers kyu/dan grades for self declaration and records results against the declaration', () => {
    const grades = declarableGrades();
    expect(grades[0]).toEqual({ label: '二十六級', level: 1 });
    expect(grades.find(({ label }) => label === 'アマ初段')).toEqual({ label: 'アマ初段', level: 32 });
    expect(grades.at(-1).label).toBe('アマ七段');
    expect(grades.some(({ label }) => label.includes('プロ') || label.includes('藤井'))).toBe(false);
    const declared = applyDeclaredGrade(createRatingState(), { label: '三級', level: 26, at: 5 });
    expect(declared).toMatchObject({ rating: 2080, games: 0, declared: { label: '三級', level: 26 } });
    let state = declared;
    for (const outcome of ['win', 'win', 'loss']) state = applyRatedGame(state, { opponentLevel: 26, outcome }).state;
    expect(state.declaredLevels['三級'][26]).toEqual({ wins: 2, losses: 1, draws: 0 });
    expect(loadRatingState({ getItem: () => JSON.stringify(state) }).declaredLevels).toEqual(state.declaredLevels);
    expect(applyRatedGame(createRatingState(), { opponentLevel: 5, outcome: 'win' }).state.declaredLevels).toEqual({});
  });

  it('shows the next grade goal and how far the rating has come', () => {
    // R800はLv10(十七級)。次の表示名はLv11の十六級で、目安はR840から。
    expect(nextRatingGoal(800)).toEqual({ label: '十六級程度', level: 11, remaining: 40, percent: 50 });
    // 同じ表示名が2レベルある五級(Lv22・23)では、Lv24の四級が次の目標になる。
    expect(nextRatingGoal(1800)).toMatchObject({ label: '四級程度', level: 24 });
    expect(nextRatingGoal(3200)).toBeNull();
    expect(gradeName('十六級程度')).toBe('十六級');
  });

  it('counts consecutive losses against the same level and suggests easier options after three', () => {
    let state = createRatingState();
    for (const outcome of ['loss', 'win', 'loss', 'loss']) {
      state = applyRatedGame(state, { opponentLevel: 12, outcome }).state;
    }
    expect(losingStreakAt(state, 12)).toBe(2);
    expect(retrySuggestion(state, 12)).toBeNull();
    // 申告・測定の記録は、連敗を途切れさせない。
    state = applyMeasuredRating(state, { rating: 900 });
    state = applyRatedGame(state, { opponentLevel: 12, outcome: 'loss' }).state;
    expect(retrySuggestion(state, 12)).toEqual({ level: 12, losses: 3, lowerLevel: 11 });
    // 別のLvとの対局を挟むと数え直す。
    expect(losingStreakAt(applyRatedGame(state, { opponentLevel: 11, outcome: 'loss' }).state, 12)).toBe(0);
    let bottom = createRatingState();
    for (let i = 0; i < 3; i += 1) bottom = applyRatedGame(bottom, { opponentLevel: 0, outcome: 'loss' }).state;
    expect(retrySuggestion(bottom, 0)).toEqual({ level: 0, losses: 3, lowerLevel: null });
  });

  it('竜王戦の対局も、棋戦・相手・段階を付けて同じ記録に数える', () => {
    let state = applyRatedGame(createRatingState(), { opponentLevel: 10, outcome: 'win', at: 1 }).state;
    state = applyRatedGame(state, {
      opponentLevel: 12, outcome: 'loss', event: 'ryuo', opponent: '桜井 一郎', stage: '6組 1回戦', at: 2,
    }).state;
    expect(state.games).toBe(2);
    expect(state.events).toEqual({
      free: { wins: 1, losses: 0, draws: 0 },
      ryuo: { wins: 0, losses: 1, draws: 0 },
    });
    expect(state.history[0]).toMatchObject({ event: 'free', outcome: 'win' });
    expect(state.history[1]).toMatchObject({ event: 'ryuo', opponent: '桜井 一郎', stage: '6組 1回戦', opponentLevel: 12 });
    expect(RATED_EVENTS.map(({ id }) => id)).toEqual(['free', 'ryuo']);

    const storage = memoryStorage();
    saveRatingState(storage, state);
    const loaded = loadRatingState(storage);
    expect(loaded.events).toEqual(state.events);
    expect(loaded.history[1]).toMatchObject({ event: 'ryuo', opponent: '桜井 一郎', stage: '6組 1回戦' });
  });

  it('知らない棋戦は自由対局として数える', () => {
    const { state } = applyRatedGame(createRatingState(), { opponentLevel: 5, outcome: 'draw', event: 'unknown' });
    expect(state.events).toEqual({ free: { wins: 0, losses: 0, draws: 1 } });
  });

  it('棋戦を記録する前の保存は、すべて自由対局として読む', () => {
    const storage = memoryStorage();
    storage.setItem(RATING_STORAGE_KEY, JSON.stringify({ rating: 900, games: 5, wins: 3, losses: 1, draws: 1 }));
    expect(loadRatingState(storage).events).toEqual({ free: { wins: 3, losses: 1, draws: 1 } });
    storage.setItem(RATING_STORAGE_KEY, JSON.stringify({ rating: 900, games: 0, wins: 0, losses: 0, draws: 0 }));
    expect(loadRatingState(storage).events).toEqual({});
  });
});
