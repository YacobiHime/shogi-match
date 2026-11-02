import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_NAME, PLAYER_NAME_KEY, PLAYER_NAME_MAX, loadPlayerName, loadPlayerProfile, momokaCallName, normalizePlayerName, normalizePlayerProfile, playerCallName, playerDisplayName, savePlayerName, savePlayerProfile } from './player-name.mjs';

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

describe('名字と名前に分けて入れる', () => {
  const test = it;
  const memory = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  };

  test('日本語は続けて、ローマ字は空白を入れて名札の名前にする', () => {
    expect(normalizePlayerProfile({ mode: 'split', family: ' 天鷺 ', given: '羽音' })).toMatchObject({ mode: 'split', name: '天鷺羽音', family: '天鷺', given: '羽音' });
    expect(normalizePlayerProfile({ mode: 'split', family: 'Sato', given: 'Mai' }).name).toBe('Sato Mai');
    expect(normalizePlayerProfile({ mode: 'split', family: '', given: '羽音' }).name).toBe('羽音');
  });

  test('合わせて上限を超えたら、名前のほうから切る', () => {
    const profile = normalizePlayerProfile({ mode: 'split', family: 'あいうえお', given: 'かきくけこさしす' });
    expect(Array.from(profile.name)).toHaveLength(PLAYER_NAME_MAX);
    expect(profile.family).toBe('あいうえお');
    expect(profile.given).toBe('かきくけこ');
  });

  test('呼びかけは、分けたときは名字、そのままなら名前全体', () => {
    expect(playerCallName({ mode: 'split', family: '天鷺', given: '羽音' })).toBe('天鷺');
    expect(playerCallName({ mode: 'single', name: 'はねね' })).toBe('はねね');
    expect(playerCallName(null)).toBe('');
  });

  test('保存して読み直せる。前の版の保存(名前だけ)はそのまま入れた形で読む。空なら消す', () => {
    const storage = memory();
    savePlayerProfile(storage, { mode: 'split', family: '天鷺', given: '羽音' });
    expect(loadPlayerProfile(storage)).toMatchObject({ mode: 'split', name: '天鷺羽音', family: '天鷺', given: '羽音' });
    expect(loadPlayerName(storage)).toBe('天鷺羽音');
    storage.setItem(PLAYER_NAME_KEY, JSON.stringify({ name: 'むかし' }));
    expect(loadPlayerProfile(storage)).toEqual({ mode: 'single', name: 'むかし', family: '', given: '', call: { suffix: '', part: 'family' } });
    savePlayerProfile(storage, { mode: 'split', family: ' ', given: '' });
    expect(storage.getItem(PLAYER_NAME_KEY)).toBeNull();
  });
});

describe('百花の呼び方', () => {
  const test = it;
  test('選ばなければ「さん」、くん・ちゃん・呼び捨ても選べる。名前がなければ「あなた」', () => {
    expect(momokaCallName({ mode: 'single', name: 'はるか' })).toBe('はるかさん');
    expect(momokaCallName({ mode: 'single', name: 'はるか', call: { suffix: 'kun' } })).toBe('はるかくん');
    expect(momokaCallName({ mode: 'single', name: 'はるか', call: { suffix: 'chan' } })).toBe('はるかちゃん');
    expect(momokaCallName({ mode: 'single', name: 'はるか', call: { suffix: 'none' } })).toBe('はるか');
    expect(momokaCallName({ mode: 'single', name: '', call: { suffix: 'chan' } })).toBe('あなた');
    expect(momokaCallName({ mode: 'single', name: 'はるか', call: { suffix: 'sama' } })).toBe('はるかさん');
  });

  test('名字と名前に分けたときは、名字か名前のどちらで呼ぶかも選べる', () => {
    const base = { mode: 'split', family: '天鷺', given: '羽音' };
    expect(momokaCallName({ ...base, call: { suffix: 'kun' } })).toBe('天鷺くん');
    expect(momokaCallName({ ...base, call: { suffix: 'chan', part: 'given' } })).toBe('羽音ちゃん');
    expect(momokaCallName({ ...base, call: { suffix: 'none', part: 'given' } })).toBe('羽音');
  });

  test('呼び方も保存して読み直せる', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
    savePlayerProfile(storage, { mode: 'single', name: 'はるか', call: { suffix: 'chan' } });
    expect(momokaCallName(loadPlayerProfile(storage))).toBe('はるかちゃん');
  });
});
