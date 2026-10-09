import { describe, expect, it } from 'vitest';
import {
  createTournamentRun,
  examOpponentLevels,
  examPassLine,
  examVerdict,
  nextRound,
  recordTournamentGame,
  roundColor,
  sanitizeTournamentRun,
  tallyText,
} from './tournament.mjs';
import {
  createProfile,
  currentAffiliation,
  grantTitle,
  loadProfile,
  recordTournamentResult,
  saveProfile,
} from './player-profile.mjs';

const play = (run, outcomes) => outcomes.reduce((current, outcome) => recordTournamentGame(current, { outcome }), run);

describe('kenshukai exam', () => {
  it('raises the opponent level every game around the base level', () => {
    expect(examOpponentLevels(26, 1)).toEqual([26]);
    expect(examOpponentLevels(26, 3)).toEqual([24, 26, 28]);
    expect(examOpponentLevels(26, 5)).toEqual([22, 24, 26, 28, 30]);
    expect(examOpponentLevels(1, 3)).toEqual([0, 1, 3]);
    expect(examOpponentLevels(40, 3).at(-1)).toBe(40);
  });

  it('alternates the player color from black', () => {
    expect([0, 1, 2, 3].map(roundColor)).toEqual(['black', 'white', 'black', 'white']);
  });

  it('needs more than half of the games to pass', () => {
    expect([1, 3, 5].map(examPassLine)).toEqual([1, 2, 3]);
  });

  it('passes with F2 on a majority and F1 on a clean sweep of three or more games', () => {
    const run = createTournamentRun({ total: 3, baseLevel: 26 });
    expect(examVerdict(play(run, ['win', 'loss']))).toBeNull();
    expect(nextRound(play(run, ['win', 'loss']))).toBe(2);
    const passed = examVerdict(play(run, ['win', 'loss', 'win']));
    expect(passed).toMatchObject({ passed: true, grade: 'F2', record: '2勝1敗' });
    expect(passed.title).toMatchObject({ id: 'kenshukai-F2', label: '研修会 F2クラス' });
    expect(examVerdict(play(run, ['win', 'win', 'win']))).toMatchObject({ passed: true, grade: 'F1' });
    expect(examVerdict(play(run, ['loss', 'win', 'loss']))).toMatchObject({ passed: false, grade: null, title: null });
  });

  it('never gives F1 for a one-game exam', () => {
    const run = createTournamentRun({ total: 1, baseLevel: 20 });
    expect(examVerdict(play(run, ['win']))).toMatchObject({ passed: true, grade: 'F2' });
    expect(examVerdict(play(run, ['loss']))).toMatchObject({ passed: false });
  });

  it('counts a draw as half a win', () => {
    const run = createTournamentRun({ total: 3, baseLevel: 20 });
    expect(examVerdict(play(run, ['win', 'draw', 'loss']))).toMatchObject({ passed: false, record: '1勝1敗1引き分け' });
    expect(examVerdict(play(run, ['win', 'draw', 'draw']))).toMatchObject({ passed: true });
    expect(tallyText({ wins: 2, losses: 0, draws: 1 })).toBe('2勝0敗1引き分け');
  });

  it('ignores games after the exam is over and falls back to a valid length', () => {
    const run = play(createTournamentRun({ total: 1, baseLevel: 20 }), ['win', 'loss']);
    expect(run.results).toHaveLength(1);
    expect(createTournamentRun({ total: 4 }).total).toBe(3);
    expect(() => createTournamentRun({ id: 'unknown' })).toThrow();
  });

  it('restores a saved run and rejects broken ones', () => {
    const run = play(createTournamentRun({ total: 3, baseLevel: 30 }), ['win', 'loss']);
    expect(sanitizeTournamentRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
    expect(sanitizeTournamentRun(null)).toBeNull();
    expect(sanitizeTournamentRun({ ...run, id: 'unknown' })).toBeNull();
    expect(sanitizeTournamentRun({ ...run, total: 4 })).toBeNull();
    expect(sanitizeTournamentRun({ ...run, results: [{ outcome: 'bad' }] })).toBeNull();
    expect(sanitizeTournamentRun({ ...run, results: Array(4).fill({ outcome: 'win' }) })).toBeNull();
  });
});

describe('player profile', () => {
  const memoryStorage = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  };

  it('grants a title once and keeps the first date', () => {
    const title = { id: 'kenshukai-F2', label: '研修会 F2クラス', detail: '合格', rank: 1 };
    const first = grantTitle(createProfile(), title, 100);
    const again = grantTitle(first, title, 200);
    expect(again.titles).toHaveLength(1);
    expect(again.titles[0].at).toBe(100);
  });

  it('shows the highest title as the current affiliation', () => {
    let profile = grantTitle(createProfile(), { id: 'a', label: 'F2', rank: 1 }, 1);
    profile = grantTitle(profile, { id: 'b', label: 'F1', rank: 2 }, 2);
    expect(currentAffiliation(profile).label).toBe('F1');
    expect(currentAffiliation(createProfile())).toBeNull();
  });

  it('records tournament results, round-trips through storage and ignores broken data', () => {
    const storage = memoryStorage();
    let profile = recordTournamentResult(createProfile(), { id: 'kenshukai-exam', label: '研修会入会試験', passed: false, record: '1勝2敗' }, 5);
    profile = grantTitle(profile, { id: 'kenshukai-F2', label: '研修会 F2クラス', rank: 1 }, 6);
    expect(saveProfile(storage, profile)).toBe(true);
    expect(loadProfile(storage)).toEqual(profile);
    storage.setItem('yacobihime:shogi-match:player-profile', '{broken');
    expect(loadProfile(storage)).toEqual(createProfile());
    expect(loadProfile(null)).toEqual(createProfile());
  });
});
