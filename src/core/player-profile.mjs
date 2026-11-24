// プレイヤーのプロフィール。大会で得た称号を端末に残す。
// (大会の成績や、いま何組かは、竜王戦のキャリア(ryuo-career.mjs)が持つ。)

export const PROFILE_STORAGE_KEY = 'yacobihime:shogi-match:player-profile';

export function createProfile() {
  /** featured: 代表の称号のid(やこびノートで選ぶ。空なら、いちばん高い称号。docs/pro-year-design.mdの39章)。 */
  return { titles: /** @type {{ id: string, label: string, detail: string, rank: number, at: number }[]} */ ([]), featured: '' };
}

/**
 * 代表の称号を選ぶ(空にすると、いちばん高い称号に戻る)。
 * @param {ReturnType<typeof createProfile>} profile
 * @param {string} id
 */
export function setFeaturedTitle(profile, id) {
  return { ...profile, featured: text(id) };
}

const text = (value) => (typeof value === 'string' ? value : '');

/**
 * 称号を授与する。同じ称号が既にあれば、最初に得た日を残して、内容(期数など)を新しくする。
 * @param {ReturnType<typeof createProfile>} profile
 * @param {{ id: string, label: string, detail?: string, rank?: number }} title
 */
export function grantTitle(profile, title, at = Date.now()) {
  const next = { id: title.id, label: title.label, detail: title.detail ?? '', rank: title.rank ?? 0 };
  const existing = profile.titles.find(({ id }) => id === title.id);
  if (!existing) return { ...profile, titles: [...profile.titles, { ...next, at }] };
  return { ...profile, titles: profile.titles.map((entry) => (entry.id === title.id ? { ...entry, ...next } : entry)) };
}

/** 今の称号。最も高いもの。なければnull。 */
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
      featured: text(parsed.featured),
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
