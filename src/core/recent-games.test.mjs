import { describe, expect, it } from 'vitest';
import {
  RECENT_GAMES_KEY,
  RECENT_GAMES_MAX,
  RECENT_GAME_MIN_PLIES,
  addRecentGame,
  loadRecentGames,
  recentGameTitle,
  saveRecentGames,
} from './recent-games.mjs';

const longMoves = Array.from({ length: RECENT_GAME_MIN_PLIES }, () => '7g7f');

describe('最近の自分の対局', () => {
  it('終盤戦に使える長さで、勝ち負けのついた対局だけを、新しい順に残す', () => {
    expect(addRecentGame([], { moves: ['7g7f'], winner: 'black' })).toEqual([]);
    expect(addRecentGame([], { moves: longMoves, winner: null })).toEqual([]);
    let list = [];
    for (let index = 0; index < RECENT_GAMES_MAX + 2; index += 1) list = addRecentGame(list, { at: index, moves: longMoves, winner: 'white', opponent: 'Lv.5' });
    expect(list).toHaveLength(RECENT_GAMES_MAX);
    expect(list[0].at).toBe(RECENT_GAMES_MAX + 1);
  });

  it('対局の名前に、日付と相手を入れる', () => {
    expect(recentGameTitle({ at: new Date(2026, 9, 16).getTime(), opponent: 'Lv.10' })).toBe('あなたの対局（10/16 対 Lv.10）');
    expect(recentGameTitle({ at: new Date(2026, 0, 2).getTime(), opponent: '' })).toBe('あなたの対局（1/2）');
  });

  it('保存して読み直せ、壊れた保存では空にする', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    const list = addRecentGame([], { at: 1, moves: longMoves, winner: 'black', opponent: 'Lv.3' });
    saveRecentGames(storage, list);
    expect(loadRecentGames(storage)).toEqual(list);
    data.set(RECENT_GAMES_KEY, JSON.stringify([{ moves: [1], winner: 'black' }, { moves: [], winner: 'draw' }]));
    expect(loadRecentGames(storage)).toEqual([]);
    data.set(RECENT_GAMES_KEY, '{broken');
    expect(loadRecentGames(storage)).toEqual([]);
  });
});
