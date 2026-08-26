export const MATCH_SNAPSHOT_VERSION = 1;
export const MATCH_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function matchSnapshotKey({ pathname = "/", matchId = "" } = {}) {
  const scope = matchId || "standalone";
  return `yacobihime:shogi-match:${encodeURIComponent(pathname)}:${encodeURIComponent(scope)}`;
}

export function saveMatchSnapshot(storage, key, snapshot, now = Date.now()) {
  if (!storage || !key || !snapshot) return false;
  try {
    storage.setItem(key, JSON.stringify({
      ...snapshot,
      version: MATCH_SNAPSHOT_VERSION,
      savedAt: now,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadMatchSnapshot(storage, key, expected, now = Date.now()) {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    const valid = snapshot
      && typeof snapshot === "object"
      && snapshot.version === MATCH_SNAPSHOT_VERSION
      && typeof snapshot.savedAt === "number"
      && now - snapshot.savedAt <= MATCH_SNAPSHOT_MAX_AGE_MS
      && snapshot.initialSfen === expected.initialSfen
      && snapshot.mode === expected.mode;
    if (valid) return snapshot;
    storage.removeItem(key);
    return null;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be unavailable in private browsing or a restricted embed.
    }
    return null;
  }
}

export function clearMatchSnapshot(storage, key) {
  if (!storage || !key) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
