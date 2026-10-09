// プレイヤーのプロフィール。大会で得た称号と、大会の成績を端末に残す。

export const PROFILE_STORAGE_KEY = 'yacobihime:shogi-match:player-profile';
const MAX_HISTORY = 50;

export function createProfile() {
  return { titles: [], history: [] };
}

const text = (value) => (typeof value === 'string' ? value : '');

/**
 * 称号を授与する。同じ称号が既にあれば、最初に得た日を残す。
 * @param {ReturnType<typeof createProfile>} profile
 * @param {{ id: string, label: string, detail?: string, rank?: number }} title
 */
export function grantTitle(profile, title, at = Date.now()) {
  if (profile.titles.some(({ id }) => id === title.id)) return profile;
  return {
    ...profile,
    titles: [...profile.titles, { id: title.id, label: title.label, detail: title.detail ?? '', rank: title.rank ?? 0, at }],
  };
}

/**
 * 大会の結果を履歴に残す。
 * @param {ReturnType<typeof createProfile>} profile
 * @param {{ id: string, label: string, passed: boolean, record: string, grade?: string | null }} entry
 */
export function recordTournamentResult(profile, entry, at = Date.now()) {
  return {
    ...profile,
    history: [...profile.history, { ...entry, grade: entry.grade ?? null, at }].slice(-MAX_HISTORY),
  };
}

/** 今の所属(研修会のクラスなど)。最も高い称号。なければnull。 */
export function currentAffiliation(profile) {
  return profile.titles.reduce((best, title) => (!best || title.rank > best.rank ? title : best), null);
}

export function loadProfile(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PROFILE_STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return createProfile();
    return {
      titles: Array.isArray(parsed.titles)
        ? parsed.titles
          .filter((title) => title && typeof title.id === 'string' && typeof title.label === 'string')
          .map((title) => ({ id: title.id, label: title.label, detail: text(title.detail), rank: Number(title.rank) || 0, at: Number(title.at) || 0 }))
        : [],
      history: Array.isArray(parsed.history)
        ? parsed.history
          .filter((entry) => entry && typeof entry.id === 'string')
          .map((entry) => ({
            id: entry.id, label: text(entry.label), passed: entry.passed === true, record: text(entry.record),
            grade: typeof entry.grade === 'string' ? entry.grade : null, at: Number(entry.at) || 0,
          }))
          .slice(-MAX_HISTORY)
        : [],
    };
  } catch {
    return createProfile();
  }
}

export function saveProfile(storage, profile) {
  try {
    storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
