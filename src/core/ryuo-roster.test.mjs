import { describe, expect, it } from 'vitest';
import { USER_ID, createSeason, recordUserGame, scaleById } from './ryuo.mjs';
import { applySeason, createCareer, nextEntry } from './ryuo-career.mjs';
import {
  DAN_ORDER,
  ROSTER_GROUP_SIZES,
  SPECIAL_SLOTS,
  USER_HOLDER,
  applySeasonToRoster,
  createRoster,
  loadRoster,
  rosterTarget,
  saveRoster,
} from './ryuo-roster.mjs';

const settings = (overrides = {}) => ({ difficulty: 9, scale: 5, revival: true, ...overrides });
const members = (roster) => Object.values(roster.players);
const groupOf = (roster, group) => members(roster).filter((member) => member.group === group && member.id !== roster.holder);
const pros = (roster) => members(roster).filter(({ kind }) => kind === 'pro');
const mean = (list) => list.reduce((sum, { rating }) => sum + rating, 0) / list.length;

/** 1期を最後まで進めて、キャリアと名簿に反映する。 */
function runSeason(career, roster, seed, policy = () => 'loss') {
  let season = createSeason({ ...nextEntry(career), settings: settings(), userLevel: 30, career, roster, seed });
  for (let guard = 0; season.phase !== 'done' && guard < 400; guard += 1) season = recordUserGame(season, policy(season));
  expect(season.phase).toBe('done');
  const applied = applySeason(career, season);
  const next = applySeasonToRoster(roster, season, { userGroup: applied.career.group, promote: scaleById(season.settings.scale).promote });
  return { career: applied.career, roster: next, season };
}

describe('initial roster', () => {
  it('fills each group to its size, with a champion and the special entries in group 6', () => {
    const roster = createRoster({ seed: 1 });
    expect(roster.players[roster.holder].dan).toBe('九段');
    expect(roster.players[roster.holder].ryuo).toBeGreaterThanOrEqual(1);
    for (const group of [1, 2, 3, 4, 5]) expect(groupOf(roster, group)).toHaveLength(rosterTarget(group, 6, true));
    expect(groupOf(roster, 6).filter(({ kind }) => kind === 'pro')).toHaveLength(ROSTER_GROUP_SIZES[6] - 1);
    for (const [kind, slots] of Object.entries(SPECIAL_SLOTS)) {
      expect(groupOf(roster, 6).filter((member) => member.kind === kind)).toHaveLength(slots);
    }
    expect(new Set(members(roster).map(({ name }) => name)).size).toBe(members(roster).length);
    // 全員が棋風と特徴を持ち、特徴のない棋士もいる。
    expect(members(roster).every(({ character }) => Number.isFinite(character.attack) && Array.isArray(character.traits))).toBe(true);
    expect(members(roster).some(({ character }) => character.traits.length === 0)).toBe(true);
    expect(members(roster).some(({ character }) => character.traits.length > 0)).toBe(true);
  });

  it('rebuilds a roster saved in an older format', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
    saveRoster(storage, { ...createRoster({ seed: 9 }), version: 1 });
    expect(loadRoster(storage)).toBeNull();
  });

  it('follows the Ryuo promotion rules for dan and has young and veteran players in group 6', () => {
    const roster = createRoster({ seed: 2 });
    const index = (dan) => DAN_ORDER.indexOf(dan);
    expect(groupOf(roster, 1).every(({ dan }) => index(dan) >= index('七段'))).toBe(true);
    expect(groupOf(roster, 2).every(({ dan }) => index(dan) >= index('六段'))).toBe(true);
    const sixth = groupOf(roster, 6).filter(({ kind }) => kind === 'pro');
    expect(sixth.some(({ age }) => age <= 25)).toBe(true);
    expect(sixth.some(({ age, dan }) => age >= 50 && index(dan) >= index('七段'))).toBe(true);
  });

  it('leaves the champion seat to the player when the player holds the title', () => {
    const roster = createRoster({ seed: 3, userIsChampion: true });
    expect(roster.holder).toBe(USER_HOLDER);
    expect(groupOf(roster, 1)).toHaveLength(rosterTarget(1, 1, false));
  });
});

describe('roster across seasons', () => {
  it('keeps the same players from one season to the next', () => {
    const first = runSeason(createCareer(), createRoster({ seed: 4 }), 100);
    const second = createSeason({ ...nextEntry(first.career), settings: settings(), userLevel: 30, career: first.career, roster: first.roster, seed: 101 });
    const before = new Set(Object.keys(first.season.players));
    const shared = Object.keys(second.players).filter((id) => id !== USER_ID && before.has(id));
    expect(shared.length).toBeGreaterThan(100);
    expect(second.champion).toBe(first.roster.holder);
    for (const id of shared) expect(second.players[id].character).toEqual(first.roster.players[id].character);
  });

  it('applies a season only once', () => {
    const { roster, season, career } = runSeason(createCareer(), createRoster({ seed: 5 }), 200);
    expect(applySeasonToRoster(roster, season, { userGroup: career.group, promote: 4 })).toBe(roster);
  });

  it('stays balanced over many seasons: group sizes, number of players, rating scale and unique names', () => {
    let career = createCareer();
    let roster = createRoster({ seed: 6 });
    const startPros = pros(roster).length;
    const startMean = mean(pros(roster));
    const holders = new Set([roster.holder]);
    for (let no = 0; no < 25; no += 1) {
      ({ career, roster } = runSeason(career, roster, 300 + no));
      holders.add(roster.holder);
      for (const group of [1, 2, 3, 4, 5]) {
        expect(groupOf(roster, group), `第${no + 1}期 ${group}組`).toHaveLength(rosterTarget(group, career.group, roster.holder !== USER_HOLDER));
      }
      expect(new Set(members(roster).map(({ name }) => name)).size).toBe(members(roster).length);
      expect(Math.abs(mean(pros(roster)) - startMean)).toBeLessThan(2);
    }
    expect(roster.season).toBe(25);
    expect(roster.history).toHaveLength(25);
    // 引退と新四段で、棋士の数は大きく変わらない。
    expect(Math.abs(pros(roster).length - startPros)).toBeLessThanOrEqual(10);
    expect(roster.retired).toBeGreaterThan(10);
    expect(members(roster).some(({ since }) => since > 0)).toBe(true);
    // 竜王は、ときどき入れ替わる。
    expect(holders.size).toBeGreaterThan(1);
    const index = (dan) => DAN_ORDER.indexOf(dan);
    expect(groupOf(roster, 1).filter(({ kind }) => kind === 'pro').every(({ dan }) => index(dan) >= index('七段'))).toBe(true);
    const champion = roster.players[roster.holder];
    if (champion) expect(index(champion.dan)).toBeGreaterThanOrEqual(index('八段'));
  });

  it('records the player as the champion and sends the former champion to group 1', () => {
    const roster = createRoster({ seed: 7 });
    const formerHolder = roster.holder;
    const { roster: next } = runSeason(createCareer(), roster, 400, () => 'win');
    expect(next.holder).toBe(USER_HOLDER);
    expect(next.players[formerHolder].group).toBe(1);
    expect(next.history.at(-1)).toMatchObject({ no: 1, holder: USER_HOLDER });
  });

  it('round-trips through storage', () => {
    const data = new Map();
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
    const roster = createRoster({ seed: 8 });
    expect(saveRoster(storage, roster)).toBe(true);
    expect(loadRoster(storage)).toEqual(roster);
    storage.setItem('yacobihime:shogi-match:ryuo-roster', '{broken');
    expect(loadRoster(storage)).toBeNull();
    expect(loadRoster(null)).toBeNull();
  });
});
