import { describe, expect, it } from 'vitest';
import { CHUNK_RELOAD_KEY, CHUNK_RELOAD_WINDOW_MS, claimChunkReload, isChunkLoadError } from './chunk-reload.mjs';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => { data.set(key, String(value)); }, data };
}

describe('遅れて読み込む部分が読めなかったとき(docs/chunk-reload-design.md)', () => {
  it('ブラウザごとの言い方を見分け、ほかの失敗は見分けない', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/dist/chunks/endgame-start-a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'moves')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('読み込み直すのは1分に1回まで(繰り返さない)', () => {
    const storage = memoryStorage();
    expect(claimChunkReload(storage, 1_000_000)).toBe(true);
    expect(storage.data.get(CHUNK_RELOAD_KEY)).toBe('1000000');
    expect(claimChunkReload(storage, 1_000_000 + 5_000)).toBe(false);
    expect(claimChunkReload(storage, 1_000_000 + CHUNK_RELOAD_WINDOW_MS + 1)).toBe(true);
    expect(claimChunkReload(null, 1)).toBe(false);
  });
});
