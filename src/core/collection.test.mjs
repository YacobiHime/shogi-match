import { describe, expect, it } from 'vitest';
import {
  ALBUM_PAGES,
  ALBUM_PAGE_GROUPS,
  albumPageId,
  COLLECTION_STORAGE_KEY,
  albumCards,
  albumPageOf,
  levelWall,
  loadCollectionSeen,
  planCardsByFormation,
  saveCollectionSeen,
  THEME_UNLOCKS,
  collectionCatalog,
  collectionCount,
  createCollection,
  grantTheme,
  loadCollection,
  newlyUnlockedThemes,
  recordPredictionHit,
  nextThemeUnlock,
  recordMatchCollection,
  saveCollection,
  themeUnlock,
} from './collection.mjs';
import { OPENING_CASTLES, OPENING_STRATEGIES } from './opening-guide.mjs';

const catalog = collectionCatalog({
  strategies: [{ id: 'ibisha', label: '居飛車' }, { id: 'shiken', label: 'ノーマル四間飛車' }],
  castles: [{ id: 'mino', label: '本美濃' }, { id: 'funa', label: '舟囲い' }],
});

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

describe('コレクション', () => {
  it('定跡図鑑の戦法・囲いだけを集め、基本の居飛車は除く', () => {
    expect(catalog.map(({ label }) => label)).toEqual(['ノーマル四間飛車', '本美濃', '舟囲い']);
    const real = collectionCatalog({ strategies: OPENING_STRATEGIES, castles: OPENING_CASTLES });
    expect(real.length).toBe(OPENING_STRATEGIES.length - 1 + OPENING_CASTLES.length);
    expect(new Set(real.map(({ label }) => label)).size).toBe(real.length);
  });

  it('初めて組んだものと、前にも組んだものを分けて返す', () => {
    const first = recordMatchCollection(createCollection(), {
      formations: ['本美濃', 'ノーマル四間飛車', '居飛車', '知らない戦型', '本美濃'],
      wonLevel: 12,
      godMoves: 1,
      catalog,
      at: 5,
    });
    expect(first.gained).toEqual([
      { kind: 'castle', label: '本美濃' },
      { kind: 'strategy', label: 'ノーマル四間飛車' },
      { kind: 'level', label: 'Lv.12' },
    ]);
    expect(first.repeated).toEqual([]);
    expect(collectionCount(first.state)).toBe(3);
    expect(first.state.godMoves).toBe(1);
    const second = recordMatchCollection(first.state, { formations: ['本美濃'], wonLevel: 12, catalog, at: 9 });
    expect(second.gained).toEqual([]);
    expect(second.repeated).toEqual(['本美濃']);
    expect(second.state.formations['本美濃']).toEqual({ count: 2, firstAt: 5 });
    // Lv0や範囲外のLvは数えない。
    expect(recordMatchCollection(createCollection(), { wonLevel: 0, catalog }).gained).toEqual([]);
  });

  it('印の数で着せ替えが解放され、前から選んでいたものは残す', () => {
    let state = createCollection();
    expect(themeUnlock(state, 'board', 'wood_light2')).toEqual({ unlocked: true, need: 0, remaining: 0 });
    expect(themeUnlock(state, 'board', 'sunfish_warm')).toEqual({ unlocked: false, need: 3, remaining: 3 });
    expect(nextThemeUnlock(state)).toEqual({ need: 3, remaining: 3 });
    const before = state;
    state = recordMatchCollection(state, { formations: ['本美濃', '舟囲い', 'ノーマル四間飛車'], catalog }).state;
    expect(themeUnlock(state, 'board', 'sunfish_warm').unlocked).toBe(true);
    expect(newlyUnlockedThemes(before, state)).toEqual([{ kind: 'board', id: 'sunfish_warm' }, { kind: 'piece', id: 'hitomoji_gothic' }]);
    expect(themeUnlock(state, 'piece', 'futamoji').remaining).toBe(3);
    const granted = grantTheme(createCollection(), 'piece', 'futamoji');
    expect(themeUnlock(granted, 'piece', 'futamoji').unlocked).toBe(true);
    expect(grantTheme(granted, 'piece', 'futamoji')).toBe(granted);
    // 最初から使える着せ替えは、盤・駒とも2つ。
    for (const table of Object.values(THEME_UNLOCKS)) expect(Object.values(table).filter((need) => need === 0)).toHaveLength(2);
  });

  it('保存して読み直せ、壊れた保存でも空のコレクションで遊べる', () => {
    const storage = memoryStorage();
    const { state } = recordMatchCollection(createCollection(), { formations: ['本美濃'], wonLevel: 3, catalog, at: 1 });
    expect(saveCollection(storage, grantTheme(state, 'board', 'sunfish_dark'))).toBe(true);
    expect(loadCollection(storage)).toEqual({
      ladder: 3,
      formations: { 本美濃: { count: 1, firstAt: 1 } },
      tesuji: {},
      levels: { 3: 1 },
      godMoves: 0,
      predictionsHit: 0,
      grantedThemes: ['board:sunfish_dark'],
    });
    expect(loadCollection({ getItem: (key) => (key === COLLECTION_STORAGE_KEY ? '{broken' : null) })).toEqual(createCollection());
    expect(loadCollection(null)).toEqual(createCollection());
  });

  it('指した手筋も印にし、知らない手筋は数えない', () => {
    const names = { 'head-gold': '頭金', 'knight-fork': 'ふんどしの桂' };
    const first = recordMatchCollection(createCollection(), { tesuji: ['head-gold', 'unknown', 'head-gold'], catalog, tesujiNames: names, at: 3 });
    expect(first.gained).toEqual([{ kind: 'tesuji', label: '頭金' }]);
    expect(collectionCount(first.state)).toBe(1);
    const second = recordMatchCollection(first.state, { tesuji: ['head-gold', 'knight-fork'], catalog, tesujiNames: names, at: 4 });
    expect(second.gained).toEqual([{ kind: 'tesuji', label: 'ふんどしの桂' }]);
    expect(second.repeated).toEqual(['頭金']);
    expect(second.state.tesuji['head-gold']).toEqual({ count: 2, firstAt: 3 });
    // 手筋を持たない古い保存も読める。
    expect(loadCollection({ getItem: () => JSON.stringify({ formations: {}, levels: {} }) }).tesuji).toEqual({});
  });

  it('竜王戦の予想の的中は、印に数えず回数だけ残す', () => {
    const state = recordPredictionHit(recordPredictionHit(createCollection()));
    expect(state.predictionsHit).toBe(2);
    expect(collectionCount(state)).toBe(0);
  });

  it('アルバム: 戦法は居飛車・振り飛車・奇襲のページに分け、作戦カードで使えるのにまだ組んでいないものを「挑戦できる」として先に出す', () => {
    const real = collectionCatalog({ strategies: OPENING_STRATEGIES, castles: OPENING_CASTLES });
    expect(albumPageOf(real.find(({ id }) => id === 'shiken'))).toBe('ranging');
    expect(albumPageOf(real.find(({ id }) => id === 'kakugawari'))).toBe('static');
    expect(albumPageOf(real.find(({ id }) => id === 'onigoroshi'))).toBe('surprise');
    // 囲いは、定義の場面(contextsの最初)で居飛車の囲いと振り飛車の囲いに分ける。
    const castlePage = (id) => albumPageOf(real.find((entry) => entry.kind === 'castle' && entry.id === id));
    expect(castlePage('mino')).toBe('castle-ranging');
    expect(castlePage('funagakoi')).toBe('castle-static');
    expect(castlePage('yagura')).toBe('castle-static');
    expect(castlePage('millennium')).toBe('castle-static');
    expect(castlePage('kinmusou')).toBe('castle-ranging');
    // 前の版で覚えた「囲い」のページは、居飛車の囲いで開く。
    expect(albumPageId('castle')).toBe('castle-static');
    expect(albumPageId('levels')).toBe('levels');
    expect(albumPageId('???')).toBe('static');
    // ページの見出しは、戦法・囲い・そのほかの順に並ぶ。
    expect([...new Set(ALBUM_PAGES.map(({ group }) => group))]).toEqual([...ALBUM_PAGE_GROUPS]);
    // すべての戦法・囲いが、どれかのページに入る。
    const pages = new Set(ALBUM_PAGES.map(({ id }) => id));
    expect(real.every((entry) => pages.has(albumPageOf(entry)))).toBe(true);

    const plans = [
      { id: 'p-shiken', strategyId: 'shiken', castles: ['mino'] },
      { id: 'p-yagura', strategyId: 'yagura-strategy', castles: ['kin-yagura'], name: '矢倉' },
      { id: 'p-locked', strategyId: 'kakugawari', castles: [] },
    ];
    const playable = planCardsByFormation(plans, ['p-shiken', 'p-yagura']);
    expect([...playable.keys()]).toEqual(['strategy:shiken', 'castle:kin-yagura']);
    const state = recordMatchCollection(createCollection(), { formations: ['本美濃'], catalog: real, at: 200 }).state;
    const ranging = albumCards(state, real, 'ranging', { playable, seenAt: 100 });
    expect(ranging[0]).toMatchObject({ id: 'shiken', ready: true, got: false, planId: 'p-shiken' });
    const castles = albumCards(state, real, 'castle-ranging', { playable, seenAt: 100 });
    expect(castles.find(({ label }) => label === '本美濃')).toMatchObject({ got: true, count: 1, isNew: true, ready: false });
    expect(albumCards(state, real, 'castle-ranging', { playable, seenAt: 300 }).find(({ label }) => label === '本美濃').isNew).toBe(false);
  });

  it('Lvの壁: 入門(24級〜16級の9段)と10段ずつ4本。次の壁は、まだ勝っていないいちばん低いLv。おすすめの前後に印', () => {
    let state = createCollection();
    for (const level of [1, 2, 3, 5]) state = recordMatchCollection(state, { wonLevel: level, catalog }).state;
    const wall = levelWall(state, { recommended: 12 });
    expect(wall.rows.map(({ label }) => label)).toEqual(['入門', '初級', '中級', '上級', '達人']);
    expect(wall.rows.map(({ levels }) => levels.length)).toEqual([9, 10, 10, 10, 10]);
    expect(wall.rows.at(-1).levels.at(-1).level).toBe(49);
    expect(wall.next).toBe(4);
    expect(wall.rows[0]).toMatchObject({ got: 4 });
    expect(wall.rows[1].levels.filter(({ recommended }) => recommended).map(({ level }) => level)).toEqual([11, 12, 13]);
  });

  it('最後にコレクションを開いた時刻を覚える(読めなければ0)', () => {
    const storage = memoryStorage();
    expect(loadCollectionSeen(storage)).toBe(0);
    saveCollectionSeen(storage, 1234);
    expect(loadCollectionSeen(storage)).toBe(1234);
    expect(loadCollectionSeen({ getItem: () => { throw new Error('blocked'); } })).toBe(0);
  });

  it('1つ目の表(2026-10-21まで)の、勝ったLvを同じ強さの今のLvへ移し、解放していた着せ替えは残す', () => {
    const storage = memoryStorage();
    // 前の表の15級(Lv12)・五級の2つ(Lv22・23)・三級(Lv26)に勝っていた。印は7個(形4つ+Lv4つ)。
    storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify({
      formations: { 本美濃: { count: 1, firstAt: 1 }, 矢倉囲い: { count: 1, firstAt: 1 }, 棒銀: { count: 1, firstAt: 1 }, 船囲い: { count: 1, firstAt: 1 } },
      levels: { 12: 5, 22: 7, 23: 6, 26: 9 },
    }));
    const state = loadCollection(storage);
    expect(state.ladder).toBe(3);
    // 前の15級は今の15級(Lv10)。前の五級の2つは、今の5級(Lv20)の1つにまとまる(早いほうの日付)。
    expect(state.levels[10]).toBe(5);
    expect(state.levels[20]).toBe(6);
    expect(Object.keys(state.levels)).toHaveLength(3);
    // 印は6個に減るが、移す前の7個で解放していた着せ替え(6個以下)は残す。
    expect(themeUnlock(state, 'piece', 'futamoji').unlocked).toBe(true);
    expect(themeUnlock(state, 'piece', 'hitomoji_dark').unlocked).toBe(false);
    // もう一度読んでも、移し直さない。
    saveCollection(storage, state);
    expect(loadCollection(storage).levels).toEqual(state.levels);
  });

  it('2つ目の表(2026-10-22)の勝ったLvは、15級から上を9つ上げる', () => {
    const storage = memoryStorage();
    storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify({ ladder: 2, formations: {}, levels: { 1: 5, 16: 7, 40: 9 } }));
    const state = loadCollection(storage);
    expect(state.ladder).toBe(3);
    expect(state.levels).toEqual({ 10: 5, 25: 7, 49: 9 });
  });
});
