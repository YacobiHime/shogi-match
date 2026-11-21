import { describe, expect, it } from 'vitest';
import {
  BASE_FRIENDS, DISCIPLE_ICHIMON_KEY, ICHIMON_MAX, INHERIT_CARDS, SENPAI_POWER, TEAM_SIZE, defaultTeam, friendPool, friendWeight, ichimonEntry, joinIchimon,
  loadIchimon, pickTeam, saveIchimon, senpaiFriend,
} from './disciple-ichimon.mjs';
import { createDiscipleRun, discipleView, trainingPreview } from './disciple-run.mjs';
import { cardById, lessonDeck } from './disciple-lesson.mjs';

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
const ended = (seed, kind = 'pro', stats = { reading: 1200, plan: 1100, steady: 1000, mate: 900 }) => ({
  ...createDiscipleRun({ seed, discipleId: 'ao' }), stats, end: { kind, best: kind === 'pro' ? '奨励会四段' : '奨励会二段', rank: 'A', turn: 150 },
});

describe('一門(29-1)', () => {
  it('育て終えた弟子を1回だけ一門に入れ、保存して読み直せる', () => {
    const storage = memoryStorage();
    let ichimon = loadIchimon(storage);
    expect(ichimon.members).toEqual([]);
    const first = joinIchimon(ichimon, ended(1));
    expect(first.joined).toBe(true);
    expect(first.count).toBe(1);
    expect(first.state.ichimonJoined).toBe(1);
    expect(joinIchimon(first.ichimon, first.state).joined).toBe(false);
    expect(joinIchimon(first.ichimon, { ...ended(1), end: null }).joined).toBe(false);
    saveIchimon(storage, first.ichimon);
    ichimon = loadIchimon(storage);
    expect(ichimon.members[0]).toMatchObject({ name: ended(1).name, kind: 'pro', top: 'reading' });
    expect(storage.getItem(DISCIPLE_ICHIMON_KEY)).toContain('"version":1');
    let many = ichimon;
    for (let i = 2; i < ICHIMON_MAX + 5; i += 1) many = joinIchimon(many, ended(i)).ichimon;
    expect(many.members.length).toBe(ICHIMON_MAX);
  });

  it('先輩は能力が高いほど伸びの重みが大きく、いちばん高い能力の教え方のカードを残す', () => {
    const strong = senpaiFriend(ichimonEntry(ended(1)));
    const weak = senpaiFriend(ichimonEntry(ended(2, 'retired', { reading: 500, plan: 500, steady: 500, mate: 500 })));
    expect(strong.power).toBeGreaterThan(weak.power);
    expect(strong.power).toBeLessThanOrEqual(SENPAI_POWER.max + SENPAI_POWER.pro);
    expect(weak.power).toBe(0);
    expect(strong.card).toBe(INHERIT_CARDS.reading);
    expect(strong.likes).toContain('jissen');
    for (const id of Object.values(INHERIT_CARDS)) expect(cardById(id)).toBeTruthy();
  });
});

describe('連れていく仲間(29-2)', () => {
  it('はじめは3人で選ばない。先輩が入ると候補が増え、4人まで連れていける', () => {
    const empty = { version: 1, members: [] };
    expect(friendPool(empty).length).toBe(BASE_FRIENDS.length);
    let ichimon = empty;
    for (const seed of [1, 2]) ichimon = joinIchimon(ichimon, ended(seed)).ichimon;
    const pool = friendPool(ichimon);
    expect(pool.length).toBe(5);
    expect(pool[3].name).toBe(ended(2).name);
    expect(defaultTeam(pool)).toHaveLength(TEAM_SIZE);
    expect(pickTeam(pool, pool.map((f) => f.id))).toHaveLength(TEAM_SIZE);
    expect(pickTeam(pool, ['nope']).map((f) => f.id)).toEqual(BASE_FRIENDS.map((f) => f.id));
    expect(pickTeam(pool, null)).toHaveLength(3);
  });

  it('連れていった先輩は顔を出し、伸びを大きくし、教え方のカードが引き出しに入る', () => {
    const ichimon = joinIchimon({ version: 1, members: [] }, ended(1)).ichimon;
    const pool = friendPool(ichimon);
    const team = pickTeam(pool, [pool[3].id, 'momoka']);
    const s = createDiscipleRun({ seed: 9, discipleId: 'minato', team });
    expect(s.team.map((f) => f.id)).toEqual([pool[3].id, 'momoka']);
    expect(lessonDeck(s)).toContain(INHERIT_CARDS.reading);
    expect(Object.keys(s.bonds)).toEqual([pool[3].id, 'momoka']);
    expect(discipleView(s).friends.map((f) => f.id)).toEqual([pool[3].id, 'momoka']);
    expect(friendWeight(s.team, [pool[3].id])).toBeGreaterThan(friendWeight(s.team, ['momoka']));
    const withSenpai = { ...s, friends: { jissen: [pool[3].id] } };
    const withMomoka = { ...s, friends: { jissen: ['momoka'] } };
    expect(trainingPreview(withSenpai, 'jissen').gains.reading).toBeGreaterThan(trainingPreview(withMomoka, 'jissen').gains.reading);
  });

  it('前の版の保存(teamなし)ははじめからの3人', () => {
    const s = createDiscipleRun({ seed: 3, discipleId: 'ao' });
    const old = { ...s, team: undefined };
    expect(discipleView(old).friends.map((f) => f.id)).toEqual(BASE_FRIENDS.map((f) => f.id));
  });
});
