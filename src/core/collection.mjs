/**
 * 将棋のコレクション(段階3のご褒美)。対局で「やったこと」を印として残し、印の数で着せ替えを解放する。
 *
 * 集めるもの(条件はすべて将棋の行為。Game_Nintendo_Implementation.mdの6-1):
 * - 定跡図鑑の戦法・囲いを、対局で組んだ(プレイヤーの側だけ。対CPUの対局すべてが対象)
 * - CPUのLvに初めて勝った(レーティングの対象の対局だけ)
 * - 神の一手を指した(数だけ数える。印の数には入れない)
 * - 竜王戦の組優勝の予想が当たった(数だけ数える。印の数には入れない。core/ryuo-oshi.mjs)
 *
 * まだ持っていないものも名前は見せる(存在だけ見せる)。保存は端末に置き、読めなくても遊びは止めない。
 */

export const COLLECTION_STORAGE_KEY = 'yacobihime:shogi-match:collection:v1';

/** 印に数えない戦法(基本の居飛車は、意識しなくても組めてしまうため)。 */
const EXCLUDED_STRATEGY_IDS = new Set(['ibisha']);

/**
 * 集める戦法・囲いの一覧。定跡図鑑と同じ定義から作る。
 * @param {{ strategies: { id: string, label: string }[], castles: { id: string, label: string }[] }} definitions
 * @returns {{ kind: 'strategy' | 'castle', id: string, label: string }[]}
 */
export function collectionCatalog({ strategies, castles }) {
  return [
    ...strategies.filter(({ id }) => !EXCLUDED_STRATEGY_IDS.has(id)).map(({ id, label }) => ({ kind: 'strategy', id, label })),
    ...castles.map(({ id, label }) => ({ kind: 'castle', id, label })),
  ];
}

/** Lvの壁。Lv1〜40に初めて勝つと印が1つ。 */
export const COLLECTION_LEVELS = Object.freeze(Array.from({ length: 40 }, (_, index) => index + 1));

export function createCollection() {
  return { formations: {}, levels: {}, godMoves: 0, predictionsHit: 0, grantedThemes: [] };
}

/**
 * 1局の結果をコレクションに加える。
 * @param {ReturnType<typeof createCollection>} state
 * @param {{ formations?: string[], wonLevel?: number | null, godMoves?: number, catalog: { kind: string, id: string, label: string }[], at?: number }} game
 *   formationsはこの対局でプレイヤーが組んだ戦型の名前。一覧にない名前は数えない。
 * @returns {{ state: ReturnType<typeof createCollection>, gained: { kind: 'strategy' | 'castle' | 'level', label: string }[], repeated: string[] }}
 *   gainedは初めて手に入った印、repeatedは前にも組んだ戦法・囲い。
 */
export function recordMatchCollection(state, { formations = [], wonLevel = null, godMoves = 0, catalog, at = Date.now() }) {
  const byLabel = new Map(catalog.map((entry) => [entry.label, entry]));
  const next = {
    ...state,
    formations: { ...state.formations },
    levels: { ...state.levels },
    godMoves: state.godMoves + Math.max(0, Math.trunc(godMoves) || 0),
  };
  const gained = [];
  const repeated = [];
  for (const label of new Set(formations)) {
    const entry = byLabel.get(label);
    if (!entry) continue;
    const current = next.formations[label];
    next.formations[label] = { count: (current?.count ?? 0) + 1, firstAt: current?.firstAt ?? at };
    if (current) repeated.push(label);
    else gained.push({ kind: /** @type {'strategy' | 'castle'} */ (entry.kind), label });
  }
  if (Number.isInteger(wonLevel) && COLLECTION_LEVELS.includes(wonLevel) && !next.levels[wonLevel]) {
    next.levels[wonLevel] = at;
    gained.push({ kind: 'level', label: `Lv.${wonLevel}` });
  }
  return { state: next, gained, repeated };
}

/** 竜王戦の組優勝の予想が当たった。 */
export function recordPredictionHit(state) {
  return { ...state, predictionsHit: (state.predictionsHit ?? 0) + 1 };
}

/** 印の数(組んだ戦法・囲いの種類と、勝ったLvの数)。 */
export function collectionCount(state) {
  return Object.keys(state.formations).length + Object.keys(state.levels).length;
}

/**
 * 着せ替えを使えるようになる印の数。0は最初から使える。
 * 盤・駒とも、最初から2つずつ選べる。
 */
export const THEME_UNLOCKS = Object.freeze({
  board: Object.freeze({ wood_light2: 0, sunfish_light: 0, sunfish_warm: 3, sunfish_dark: 8, sunfish_resin: 15 }),
  piece: Object.freeze({ hitomoji_wood: 0, hitomoji: 0, hitomoji_gothic: 3, futamoji: 6, hitomoji_dark: 10, hitomoji_gothic_dark: 15 }),
});

/**
 * 着せ替えの解放の様子。remainingは解放まであと何個か(使えるなら0)。
 * 前から選んでいた着せ替え(grantedThemes)は、印の数にかかわらず使える。一覧にないものも使える扱いにする。
 * @param {ReturnType<typeof createCollection>} state
 * @param {'board' | 'piece'} kind
 * @param {string} id
 */
export function themeUnlock(state, kind, id) {
  const need = THEME_UNLOCKS[kind]?.[id];
  if (need === undefined || state.grantedThemes.includes(`${kind}:${id}`)) return { unlocked: true, need: need ?? 0, remaining: 0 };
  const remaining = Math.max(0, need - collectionCount(state));
  return { unlocked: remaining === 0, need, remaining };
}

/** 前から選んでいた着せ替えを、解放済みとして残す。 */
export function grantTheme(state, kind, id) {
  const key = `${kind}:${id}`;
  return state.grantedThemes.includes(key) ? state : { ...state, grantedThemes: [...state.grantedThemes, key] };
}

/**
 * この対局で新しく使えるようになった着せ替え。
 * @param {ReturnType<typeof createCollection>} before
 * @param {ReturnType<typeof createCollection>} after
 */
export function newlyUnlockedThemes(before, after) {
  const unlocked = [];
  for (const kind of /** @type {const} */ (['board', 'piece'])) {
    for (const id of Object.keys(THEME_UNLOCKS[kind])) {
      if (!themeUnlock(before, kind, id).unlocked && themeUnlock(after, kind, id).unlocked) unlocked.push({ kind, id });
    }
  }
  return unlocked;
}

/** 次に解放される着せ替えまでの残り。全部解放済みならnull。 */
export function nextThemeUnlock(state) {
  const count = collectionCount(state);
  const needs = Object.values(THEME_UNLOCKS).flatMap((table) => Object.values(table)).filter((need) => need > count);
  if (!needs.length) return null;
  const need = Math.min(...needs);
  return { need, remaining: need - count };
}

function count(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function loadCollection(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(COLLECTION_STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return createCollection();
    const formations = {};
    for (const [label, entry] of Object.entries(parsed.formations ?? {})) {
      if (entry && count(entry.count)) formations[label] = { count: count(entry.count), firstAt: Number(entry.firstAt) || 0 };
    }
    const levels = {};
    for (const [level, at] of Object.entries(parsed.levels ?? {})) {
      if (COLLECTION_LEVELS.includes(Number(level))) levels[level] = Number(at) || 0;
    }
    return {
      formations,
      levels,
      godMoves: count(parsed.godMoves),
      predictionsHit: count(parsed.predictionsHit),
      grantedThemes: Array.isArray(parsed.grantedThemes) ? parsed.grantedThemes.filter((key) => typeof key === 'string') : [],
    };
  } catch {
    return createCollection();
  }
}

export function saveCollection(storage, state) {
  try {
    storage?.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
