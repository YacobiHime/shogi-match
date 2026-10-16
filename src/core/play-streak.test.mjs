import { describe, expect, it } from 'vitest';
import {
  PLAY_STREAK_KEY,
  createPlayStreak,
  currentStreak,
  loadPlayStreak,
  localDay,
  recordPlay,
  savePlayStreak,
  streakGreeting,
  streakLine,
} from './play-streak.mjs';

const days = (...list) => ({ days: list, best: 0 });

describe('続けて遊んだ日', () => {
  it('端末の暦で日付を作る', () => {
    expect(localDay(new Date(2026, 9, 16, 23, 59).getTime())).toBe('2026-10-16');
    expect(localDay(new Date(2026, 0, 3, 0, 1).getTime())).toBe('2026-01-03');
  });

  it('今日まだ遊んでいなくても、昨日までの記録は続いているとみなす', () => {
    const state = days('2026-10-14', '2026-10-15');
    expect(currentStreak(state, '2026-10-16')).toEqual({ current: 2, rested: 0, playedToday: false });
    expect(currentStreak({ days: [...state.days, '2026-10-16'] }, '2026-10-16')).toEqual({ current: 3, rested: 0, playedToday: true });
  });

  it('週に1日のおやすみは記録を途切れさせず、続けて2日休んだら途切れる', () => {
    // 10/13を休んだ。休みは数に入れない。
    expect(currentStreak(days('2026-10-11', '2026-10-12', '2026-10-14', '2026-10-15'), '2026-10-15'))
      .toEqual({ current: 4, rested: 1, playedToday: true });
    // 昨日を休んで、今日はまだ: おととい以前が続く。
    expect(currentStreak(days('2026-10-13', '2026-10-14'), '2026-10-16')).toEqual({ current: 2, rested: 1, playedToday: false });
    // 2日続けて休むと途切れる。
    expect(currentStreak(days('2026-10-10', '2026-10-11', '2026-10-14'), '2026-10-14')).toEqual({ current: 1, rested: 0, playedToday: true });
    // 7日のうちに2回休むと、2回目で途切れる。8日以上あいていれば、また休める。
    expect(currentStreak(days('2026-10-01', '2026-10-03', '2026-10-04', '2026-10-06'), '2026-10-06').current).toBe(3);
    const long = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-15'];
    // 10/14と10/07は休める(7日あいている)。10/02の休みは10/07から5日しかあいていないので、そこで途切れる。
    expect(currentStreak(days(...long.filter((day) => day !== '2026-10-02')), '2026-10-15')).toEqual({ current: 11, rested: 2, playedToday: true });
    expect(currentStreak(days(...long), '2026-10-15')).toEqual({ current: 14, rested: 2, playedToday: true });
    // 長く遊んでいなければ0。
    expect(currentStreak(days('2026-09-01'), '2026-10-16').current).toBe(0);
  });

  it('遊んだ日を記録し、最長記録は途切れても残す', () => {
    let state = createPlayStreak();
    for (const day of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-03']) state = recordPlay(state, day);
    expect(state).toEqual({ days: ['2026-10-01', '2026-10-02', '2026-10-03'], best: 3 });
    state = recordPlay(state, '2026-10-10');
    expect(currentStreak(state, '2026-10-10').current).toBe(1);
    expect(state.best).toBe(3);
  });

  it('やこび姫は2日目から話し、休みの日があっても責めない', () => {
    expect(streakLine({ current: 1, rested: 0, playedToday: true })).toBe('');
    expect(streakLine({ current: 3, rested: 0, playedToday: true })).toBe('3日、将棋を続けてるね！');
    expect(streakLine({ current: 5, rested: 1, playedToday: false })).toContain('おやすみの日もあったけど');
    // タイトル画面の吹き出しは短くする。
    expect(streakGreeting({ current: 3, rested: 1, playedToday: true })).toBe('3日つづけてるね！');
    expect(streakGreeting({ current: 1, rested: 0, playedToday: true })).toBe('');
  });

  it('保存して読み直せ、壊れた保存でも遊べる', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    savePlayStreak(storage, { days: ['2026-10-02', '2026-10-01'], best: 2 });
    expect(loadPlayStreak(storage)).toEqual({ days: ['2026-10-01', '2026-10-02'], best: 2 });
    data.set(PLAY_STREAK_KEY, '{broken');
    expect(loadPlayStreak(storage)).toEqual(createPlayStreak());
    expect(loadPlayStreak(null)).toEqual(createPlayStreak());
  });
});
