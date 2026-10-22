import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_NAME, PLAYER_NAME_KEY, PLAYER_NAME_MAX, loadPlayerName, normalizePlayerName, playerDisplayName, savePlayerName } from './player-name.mjs';

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key), map };
};

describe('player name', () => {
  it('trims, removes control characters, collapses spaces and caps the length', () => {
    expect(normalizePlayerName('  やこび　ハル  ')).toBe('やこび ハル');
    expect(normalizePlayerName('a\u0000b\nc')).toBe('abc');
    expect(normalizePlayerName('あ'.repeat(20))).toHaveLength(PLAYER_NAME_MAX);
    // 絵文字などのサロゲートペアを途中で切らない。
    expect(Array.from(normalizePlayerName('🍡'.repeat(12)))).toHaveLength(PLAYER_NAME_MAX);
    expect(normalizePlayerName(42)).toBe('');
  });

  it('falls back to あなた when no name is set', () => {
    expect(playerDisplayName('')).toBe(DEFAULT_PLAYER_NAME);
    expect(playerDisplayName('  ')).toBe(DEFAULT_PLAYER_NAME);
    expect(playerDisplayName('ハル')).toBe('ハル');
  });

  it('saves, loads and clears the name', () => {
    const storage = memoryStorage();
    expect(loadPlayerName(storage)).toBe('');
    expect(savePlayerName(storage, ' ハル ')).toBe('ハル');
    expect(loadPlayerName(storage)).toBe('ハル');
    expect(savePlayerName(storage, '')).toBe('');
    expect(storage.map.has(PLAYER_NAME_KEY)).toBe(false);
    storage.setItem(PLAYER_NAME_KEY, '{broken');
    expect(loadPlayerName(storage)).toBe('');
    expect(loadPlayerName(null)).toBe('');
  });
});
