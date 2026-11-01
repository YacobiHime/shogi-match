import { describe, expect, it } from 'vitest';
import {
  AUTO_SPEEDS,
  DEFAULT_NOVEL_SETTINGS,
  NOVEL_READ_KEY,
  NOVEL_SETTINGS_KEY,
  READ_LINES_PER_SCENE,
  READ_SCENES_MAX,
  TEXT_SPEEDS,
  autoWaitMs,
  backlogEntries,
  charDelayMs,
  faceChangedAt,
  isLineRead,
  isSceneRead,
  lineKey,
  loadNovelRead,
  loadNovelSettings,
  markLineRead,
  normalizeNovelSettings,
  saveNovelRead,
  saveNovelSettings,
  shouldShowSummary,
} from './novel-ui.mjs';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    data,
  };
}

const SCENE = {
  id: 'invite',
  summary: '羽音に団体戦に誘われる。',
  lines: [
    { who: 'narration', face: 'neutral', name: '', text: '放課後。' },
    { who: 'hanane', face: 'neutral', name: '天鷺羽音', text: 'あ、来た。' },
    { who: 'hanane', face: 'smile', name: '天鷺羽音', text: 'どう？' },
  ],
};

describe('ノベルの場面の設定(docs/novel-scene-design.mdの4-4・4-5)', () => {
  it('知らない値はふつうに戻し、保存して読み直せる', () => {
    expect(normalizeNovelSettings(null)).toEqual(DEFAULT_NOVEL_SETTINGS);
    expect(normalizeNovelSettings({ text: 'warp', auto: 'fast' })).toEqual({ text: 'normal', auto: 'fast' });
    const storage = memoryStorage();
    saveNovelSettings(storage, { text: 'instant', auto: 'slow' });
    expect(JSON.parse(storage.data.get(NOVEL_SETTINGS_KEY))).toEqual({ text: 'instant', auto: 'slow' });
    expect(loadNovelSettings(storage)).toEqual({ text: 'instant', auto: 'slow' });
    expect(loadNovelSettings(memoryStorage({ [NOVEL_SETTINGS_KEY]: '{壊れた' }))).toEqual(DEFAULT_NOVEL_SETTINGS);
    expect(loadNovelSettings(null)).toEqual(DEFAULT_NOVEL_SETTINGS);
  });

  it('文字の速さは、ふつうが今までの30ms。すぐは0', () => {
    expect(charDelayMs({ text: 'normal' })).toBe(30);
    expect(charDelayMs({ text: 'instant' })).toBe(0);
    expect(TEXT_SPEEDS.slow.charMs).toBeGreaterThan(TEXT_SPEEDS.normal.charMs);
    expect(TEXT_SPEEDS.fast.charMs).toBeLessThan(TEXT_SPEEDS.normal.charMs);
  });

  it('オートは長い文ほど長く待ち、上限で止まる。速いほど短い', () => {
    const short = autoWaitMs('うん。', { auto: 'normal' });
    const long = autoWaitMs('夏の団体戦、一緒に出ない？ 3人で1チームなんだけど、あと1人足りなくて。', { auto: 'normal' });
    expect(short).toBe(AUTO_SPEEDS.normal.baseMs + 3 * AUTO_SPEEDS.normal.perCharMs);
    expect(long).toBeGreaterThan(short);
    expect(autoWaitMs('あ'.repeat(500), { auto: 'normal' })).toBe(AUTO_SPEEDS.normal.maxMs);
    expect(autoWaitMs('あいう', { auto: 'fast' })).toBeLessThan(autoWaitMs('あいう', { auto: 'slow' }));
  });
});

describe('読んだ行の印(4-5)', () => {
  it('話す人と文で印を作り、同じ文でも話す人が違えば別の印', () => {
    expect(lineKey({ who: 'hanane', text: 'うん。' })).toBe(lineKey({ who: 'hanane', text: 'うん。' }));
    expect(lineKey({ who: 'hanane', text: 'うん。' })).not.toBe(lineKey({ who: 'momoka', text: 'うん。' }));
  });

  it('全部の行を読んだ場面だけ「読んだ」。読んだ場面はあらすじを出さずに飛ばす', () => {
    let read = loadNovelRead(memoryStorage());
    expect(isSceneRead(read, SCENE)).toBe(false);
    expect(shouldShowSummary(read, SCENE)).toBe(true);
    for (const line of SCENE.lines.slice(0, 2)) read = markLineRead(read, SCENE.id, lineKey(line));
    expect(isLineRead(read, SCENE.id, lineKey(SCENE.lines[1]))).toBe(true);
    expect(isSceneRead(read, SCENE)).toBe(false);
    read = markLineRead(read, SCENE.id, lineKey(SCENE.lines[2]));
    expect(isSceneRead(read, SCENE)).toBe(true);
    expect(shouldShowSummary(read, SCENE)).toBe(false);
    // あらすじのない場面は、読んでいなくてもすぐ飛ばす。
    expect(shouldShowSummary(loadNovelRead(null), { ...SCENE, summary: '' })).toBe(false);
  });

  it('保存して読み直せ、壊れた保存は空にする。上限を超えたら古いものから捨てる', () => {
    const storage = memoryStorage();
    let read = markLineRead(loadNovelRead(storage), 'a', 'k1');
    expect(markLineRead(read, 'a', 'k1')).toBe(read);
    saveNovelRead(storage, read);
    expect(loadNovelRead(storage).scenes.a).toEqual(['k1']);
    expect(loadNovelRead(memoryStorage({ [NOVEL_READ_KEY]: 'null' }))).toEqual({ order: [], scenes: {} });

    for (let i = 0; i < READ_LINES_PER_SCENE + 5; i += 1) read = markLineRead(read, 'a', `line-${i}`);
    expect(read.scenes.a).toHaveLength(READ_LINES_PER_SCENE);
    expect(read.scenes.a).not.toContain('k1');
    for (let i = 0; i < READ_SCENES_MAX + 3; i += 1) read = markLineRead(read, `scene-${i}`, 'x');
    expect(read.order).toHaveLength(READ_SCENES_MAX);
    expect(read.scenes.a).toBeUndefined();
  });
});

describe('読み返し(ログ)と立ち絵の跳ね(4-1・4-3)', () => {
  it('いまの行は文が出きってから入れ、選んだ答えはその行に付ける', () => {
    expect(backlogEntries(SCENE.lines, 0, false)).toEqual([]);
    expect(backlogEntries(SCENE.lines, 1, false).map(({ text }) => text)).toEqual(['放課後。']);
    const entries = backlogEntries(SCENE.lines, 2, true, { 1: '出る' });
    expect(entries).toHaveLength(3);
    expect(entries[1]).toEqual({ who: 'hanane', name: '天鷺羽音', text: 'あ、来た。', picked: '出る' });
    expect(entries[0].picked).toBeUndefined();
  });

  it('同じ人の前の行と表情が違うときだけ跳ねる', () => {
    expect(faceChangedAt(SCENE.lines, 1)).toBe(false);
    expect(faceChangedAt(SCENE.lines, 2)).toBe(true);
    expect(faceChangedAt(SCENE.lines, 0)).toBe(false);
  });
});
