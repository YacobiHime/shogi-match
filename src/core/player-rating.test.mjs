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
  dismissLadderNotice,
  isRatedLevel,
  ratingLevel,
} from './player-rating.mjs';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};

describe('player rating', () => {
  it('maps levels to ratings (24級=R30, 15級=R570, 5級=R1170, R60 per level) and back, from Lv1 to Lv49', () => {
    expect(levelRating(0)).toBe(0);
    expect(levelRating(1)).toBe(30);
    expect(levelRating(10)).toBe(570);
    expect(levelRating(20)).toBe(1170);
    expect(levelRating(24)).toBe(1410);
    expect(levelRating(49)).toBe(2910);
    expect(ratingLevel(1170)).toBe(20);
    expect(INITIAL_RATING).toBe(30);
    expect(recommendedLevel(INITIAL_RATING)).toBe(1);
    expect(recommendedLevel(levelRating(25))).toBe(25);
    expect(recommendedLevel(99999)).toBe(49);
    // Lv0は練習相手で、勧めない・数えない。
    expect(recommendedLevel(-50)).toBe(1);
    expect(isRatedLevel(0)).toBe(false);
    expect(isRatedLevel(1)).toBe(true);
    expect(isRatedLevel(undefined)).toBe(false);
  });

  it('moves up on a win against an equal opponent and down on a loss', () => {
    const state = { ...createRatingState(), rating: 570 };
    const win = applyRatedGame(state, { opponentLevel: 10, outcome: 'win' });
    expect(win.delta).toBe(20);
    expect(win.state).toMatchObject({ rating: 590, games: 1, wins: 1 });
    const loss = applyRatedGame(state, { opponentLevel: 10, outcome: 'loss' });
    expect(loss.delta).toBe(-20);
    expect(applyRatedGame(state, { opponentLevel: 10, outcome: 'draw' }).delta).toBe(0);
  });

  it('rewards beating a stronger CPU more and uses a smaller K after the provisional games', () => {
    const state = { ...createRatingState(), rating: 570 };
    const upset = applyRatedGame(state, { opponentLevel: 20, outcome: 'win' }).delta;
    expect(upset).toBeGreaterThan(20);
    const settled = { ...state, games: 10 };
    expect(applyRatedGame(settled, { opponentLevel: 10, outcome: 'win' }).delta).toBe(10);
  });

  it('never goes below zero and keeps a bounded history', () => {
    let state = { ...createRatingState(), rating: 5, games: 20 };
    state = applyRatedGame(state, { opponentLevel: 1, outcome: 'loss' }).state;
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
    expect(levelRatingText(state, 10)).toBe('R570・0勝0敗0引き分け');
    expect(levelRatingText(state, 0)).toBe('練習相手・0勝0敗0引き分け');
    for (const outcome of ['win', 'win', 'loss', 'draw']) {
      state = applyRatedGame(state, { opponentLevel: 10, outcome }).state;
    }
    state = applyRatedGame(state, { opponentLevel: 11, outcome: 'win' }).state;
    expect(levelRatingText(state, 10)).toBe('R570・2勝1敗1引き分け');
    expect(levelRatingText(state, 11)).toBe('R630・1勝0敗0引き分け');
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
    const measured = applyMeasuredRating(played, { rating: 1234.4, label: '11級程度', at: 2 });
    expect(measured).toMatchObject({ rating: 1234, games: 1, measured: { rating: 1234, label: '11級程度', at: 2 } });
    expect(measured.history.at(-1)).toMatchObject({ rating: 1234, outcome: 'measure' });
    const next = applyRatedGame(measured, { opponentLevel: 15, outcome: 'win', at: 3 }).state;
    expect(next.measured).toEqual(measured.measured);
    expect(next.games).toBe(2);
    expect(loadRatingState({ getItem: () => JSON.stringify(next) }).measured).toEqual(measured.measured);
  });

  it('offers kyu/dan grades for self declaration and records results against the declaration', () => {
    const grades = declarableGrades();
    expect(grades[0]).toEqual({ label: '24級', level: 1 });
    expect(grades).toHaveLength(24 + 7);
    // 同じ名前が3つある段は、真ん中のLv。
    expect(grades.find(({ label }) => label === 'アマ初段')).toEqual({ label: 'アマ初段', level: 26 });
    expect(grades.at(-1).label).toBe('アマ七段');
    expect(grades.some(({ label }) => /プロ|藤井|奨励会|タイトル/.test(label))).toBe(false);
    const declared = applyDeclaredGrade(createRatingState(), { label: '3級', level: 22, at: 5 });
    expect(declared).toMatchObject({ rating: 1290, games: 0, declared: { label: '3級', level: 22 } });
    let state = declared;
    for (const outcome of ['win', 'win', 'loss']) state = applyRatedGame(state, { opponentLevel: 22, outcome }).state;
    expect(state.declaredLevels['3級'][22]).toEqual({ wins: 2, losses: 1, draws: 0 });
    expect(loadRatingState({ getItem: () => JSON.stringify(state) }).declaredLevels).toEqual(state.declaredLevels);
    expect(applyRatedGame(createRatingState(), { opponentLevel: 5, outcome: 'win' }).state.declaredLevels).toEqual({});
  });

  it('shows the next grade goal and how far the rating has come', () => {
    // R30はLv1(24級)。次の表示名はLv2の23級で、目安はR60から。
    expect(nextRatingGoal(30)).toEqual({ label: '23級程度', level: 2, remaining: 30, percent: 50 });
    // 同じ表示名が3レベルあるアマ初段(Lv25〜27)では、Lv28のアマ二段が次の目標になる。
    expect(nextRatingGoal(1530)).toMatchObject({ label: 'アマ二段程度', level: 28, remaining: 90 });
    expect(nextRatingGoal(2910)).toBeNull();
    expect(gradeName('15級程度')).toBe('15級');
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
    expect(retrySuggestion(state, 12)).toEqual({ level: 12, losses: 3, lowerLevel: 10, handicapId: 'lance', handicapLabel: '香落ち' });
    // 別のLvとの対局を挟むと数え直す。
    expect(losingStreakAt(applyRatedGame(state, { opponentLevel: 11, outcome: 'loss' }).state, 12)).toBe(0);
    // 15級(Lv1)の下は、Lv0(練習相手)と飛車落ち。
    let bottom = createRatingState();
    for (let i = 0; i < 3; i += 1) bottom = applyRatedGame(bottom, { opponentLevel: 1, outcome: 'loss' }).state;
    expect(retrySuggestion(bottom, 1)).toEqual({ level: 1, losses: 3, lowerLevel: 0, handicapId: 'rook', handicapLabel: '飛車落ち' });
    let practice = createRatingState();
    for (let i = 0; i < 3; i += 1) practice = applyRatedGame(practice, { opponentLevel: 0, outcome: 'loss' }).state;
    expect(retrySuggestion(practice, 0)).toMatchObject({ level: 0, losses: 3, lowerLevel: null });
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
    expect(RATED_EVENTS.map(({ id }) => id)).toEqual(['free', 'ryuo', 'meijin', 'shoreikai', 'kenshukai']);

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

  it('1つ目の表(2026-10-21まで)の保存を、同じ強さの今の表へ1回だけ移し、知らせる', () => {
    const storage = memoryStorage();
    storage.setItem(RATING_STORAGE_KEY, JSON.stringify({
      rating: 1200, games: 12, wins: 5, losses: 7, draws: 0,
      levels: { 15: { wins: 1, losses: 2, draws: 0 }, 22: { wins: 1, losses: 0, draws: 0 }, 23: { wins: 0, losses: 1, draws: 0 }, 5: { wins: 1, losses: 0, draws: 0 } },
      declared: { label: '十二級', level: 15, at: 1 },
      declaredLevels: { 十二級: { 15: { wins: 1, losses: 2, draws: 0 } } },
      measured: { rating: 1200, label: '十二級程度', at: 1 },
      history: [{ at: 1, rating: 1200, opponentLevel: 15, outcome: 'loss' }],
    }));
    const state = loadRatingState(storage);
    // 前の十二級(Lv15、R1200)は、今の12級(Lv13、R750)。
    expect(state.rating).toBe(750);
    expect(state.ladderNotice).toEqual({ beforeRating: 1200, afterRating: 750, beforeLabel: '十二級', afterLabel: '12級' });
    expect(state.levels[13]).toEqual({ wins: 1, losses: 2, draws: 0 });
    // 前の五級の2つ(Lv22・23)は、今の5級(Lv20)にまとめる。前の22級(Lv5)は今の22級(Lv3)へ。
    expect(state.levels[20]).toEqual({ wins: 1, losses: 1, draws: 0 });
    expect(state.levels[3]).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(state.declared).toMatchObject({ label: '12級', level: 13 });
    expect(state.declaredLevels).toEqual({ '12級': { 13: { wins: 1, losses: 2, draws: 0 } } });
    expect(state.measured).toMatchObject({ rating: 750, label: '12級程度' });
    expect(state.history[0]).toMatchObject({ rating: 750, opponentLevel: 13 });
    // 一度移したら、もう移さない。知らせは見たら消す。
    saveRatingState(storage, dismissLadderNotice(state));
    const again = loadRatingState(storage);
    expect(again.rating).toBe(750);
    expect(again.levels[13]).toEqual({ wins: 1, losses: 2, draws: 0 });
    expect(again.ladderNotice).toBeNull();
    // 対局したことのない人には知らせない。
    storage.setItem(RATING_STORAGE_KEY, JSON.stringify({ rating: 800, games: 0, wins: 0, losses: 0, draws: 0 }));
    expect(loadRatingState(storage).ladderNotice).toBeNull();
  });

  it('2つ目の表(2026-10-22)の保存は、15級から上を9つ・R540上げ、名前はそのまま', () => {
    const storage = memoryStorage();
    storage.setItem(RATING_STORAGE_KEY, JSON.stringify({
      ladder: 2, rating: 630, games: 8, wins: 4, losses: 4, draws: 0,
      levels: { 11: { wins: 2, losses: 1, draws: 0 }, 0: { wins: 1, losses: 0, draws: 0 } },
      declared: { label: '5級', level: 11, at: 1 },
      declaredLevels: { '5級': { 11: { wins: 2, losses: 1, draws: 0 } } },
      history: [{ at: 1, rating: 630, opponentLevel: 11, outcome: 'win' }],
    }));
    const state = loadRatingState(storage);
    expect(state.rating).toBe(1170);
    expect(state.ladderNotice).toEqual({ beforeRating: 630, afterRating: 1170, beforeLabel: '5級', afterLabel: '5級' });
    expect(state.levels).toEqual({ 20: { wins: 2, losses: 1, draws: 0 }, 0: { wins: 1, losses: 0, draws: 0 } });
    expect(state.declared).toMatchObject({ label: '5級', level: 20 });
    expect(state.declaredLevels).toEqual({ '5級': { 20: { wins: 2, losses: 1, draws: 0 } } });
    expect(state.history[0]).toMatchObject({ rating: 1170, opponentLevel: 20 });
    // まだ対局していない人は、はじめの人と同じ24級(R30)から。知らせはない。
    storage.setItem(RATING_STORAGE_KEY, JSON.stringify({ ladder: 2, rating: 30, games: 0, wins: 0, losses: 0, draws: 0 }));
    expect(loadRatingState(storage)).toMatchObject({ rating: 30, ladderNotice: null });
  });

  it('moves fast after a measurement or a declaration, then settles back (docs/skill-measure-design.md 11章)', () => {
    // 30局指した人(いつもはK20)が、測定でLv24(R1410)と出た。本当はLv20くらいで、Lv24に3連敗した。
    let state = { ...createRatingState(), games: 30, rating: 1170 };
    state = applyMeasuredRating(state, { rating: levelRating(24), spread: 4 });
    expect(state.deviation).toBe(240);
    const before = state.rating;
    for (let index = 0; index < 3; index += 1) state = applyRatedGame(state, { opponentLevel: 24, outcome: 'loss' }).state;
    // 前は1敗で約10点(3敗で30点)。幅があるので、3敗で3Lv(R180)以上下がる。
    expect(before - state.rating).toBeGreaterThan(180);
    expect(state.deviation).toBeLessThan(240);
    // 幅は1局ごとに狭まり、狭くなったら持たず、いつもの動き方に戻る。
    for (let index = 0; index < 20; index += 1) state = applyRatedGame(state, { opponentLevel: 20, outcome: index % 2 ? 'win' : 'loss' }).state;
    expect(state.deviation).toBeNull();
    const settled = applyRatedGame(state, { opponentLevel: 20, outcome: 'loss' });
    expect(Math.abs(settled.delta)).toBeLessThanOrEqual(20);
    // 幅が狭い測定でも、少しは幅を持つ。申告は広い幅。幅は保存して読み直せる。
    expect(applyMeasuredRating(createRatingState(), { rating: 900, spread: 1 }).deviation).toBe(120);
    expect(applyDeclaredGrade(createRatingState(), { label: '3級', level: 22 }).deviation).toBe(300);
    const storage = memoryStorage();
    saveRatingState(storage, applyMeasuredRating(createRatingState(), { rating: 900, spread: 3 }));
    expect(loadRatingState(storage).deviation).toBe(180);
    expect(createRatingState().deviation).toBeNull();
  });
});
