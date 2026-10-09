import { describe, expect, it } from 'vitest';
import {
  PROFILE_STORAGE_KEY,
  createProfile,
  currentAffiliation,
  grantTitle,
  loadProfile,
  saveProfile,
} from './player-profile.mjs';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};

describe('player profile', () => {
  it('grants a title once, keeps the first date and refreshes the detail', () => {
    const title = { id: 'ryuo', label: '竜王', detail: '通算1期', rank: 20 };
    const first = grantTitle(createProfile(), title, 100);
    const again = grantTitle(first, { ...title, detail: '通算2期' }, 200);
    expect(again.titles).toHaveLength(1);
    expect(again.titles[0]).toMatchObject({ at: 100, detail: '通算2期' });
  });

  it('shows the highest title as the current affiliation', () => {
    let profile = grantTitle(createProfile(), { id: 'a', label: '挑戦者', rank: 10 }, 1);
    profile = grantTitle(profile, { id: 'b', label: '竜王', rank: 20 }, 2);
    expect(currentAffiliation(profile).label).toBe('竜王');
    expect(currentAffiliation(createProfile())).toBeNull();
  });

  it('round-trips through storage, drops old data it no longer uses and ignores broken data', () => {
    const storage = memoryStorage();
    const profile = grantTitle(createProfile(), { id: 'ryuo', label: '竜王', rank: 20 }, 6);
    expect(saveProfile(storage, profile)).toBe(true);
    expect(loadProfile(storage)).toEqual(profile);
    storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ titles: profile.titles, history: [{ id: 'x' }] }));
    expect(loadProfile(storage)).toEqual(profile);
    storage.setItem(PROFILE_STORAGE_KEY, '{broken');
    expect(loadProfile(storage)).toEqual(createProfile());
    expect(loadProfile(null)).toEqual(createProfile());
  });
});
