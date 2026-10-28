// 回戦ごとの観戦の保存(docs/tournament-relay-design.mdの13-2)。観戦の期1つと、期ごとのめくった数。画面に依存しない。

export const RYUO_WATCH_KEY = 'yacobihime:shogi-match:ryuo-watch:v1';
/** めくった数を残す期の数(古いものから消す)。 */
const PROGRESS_LIMIT = 12;

export function emptyWatchStore() {
  return { season: null, progress: {}, order: [] };
}

/** @param {Storage | null} storage */
export function loadWatchStore(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(RYUO_WATCH_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return emptyWatchStore();
    return {
      season: parsed.season && typeof parsed.season === 'object' ? parsed.season : null,
      progress: parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {},
      order: Array.isArray(parsed.order) ? parsed.order.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return emptyWatchStore();
  }
}

/** @param {Storage | null} storage @param {ReturnType<typeof emptyWatchStore>} store */
export function saveWatchStore(storage, store) {
  try {
    storage?.setItem(RYUO_WATCH_KEY, JSON.stringify(store));
  } catch {
    // 保存できなくても、その場では観戦できる。
  }
}

/**
 * 期のめくった数を記録する(多いほうを残す)。
 * @param {ReturnType<typeof emptyWatchStore>} store
 * @param {string | number} seasonId
 * @param {number} revealed
 */
export function noteWatchProgress(store, seasonId, revealed) {
  const id = String(seasonId);
  const progress = { ...store.progress, [id]: Math.max(store.progress[id] ?? 0, revealed) };
  const order = [...store.order.filter((item) => item !== id), id];
  while (order.length > PROGRESS_LIMIT) delete progress[order.shift()];
  return { ...store, progress, order };
}

/** 観戦の期を置き換える(前の観戦の期のめくった数は消す)。 */
export function replaceWatchSeason(store, season) {
  const previous = store.season ? String(store.season.id) : null;
  const progress = { ...store.progress };
  if (previous) delete progress[previous];
  return { ...store, season, progress, order: store.order.filter((id) => id !== previous) };
}
