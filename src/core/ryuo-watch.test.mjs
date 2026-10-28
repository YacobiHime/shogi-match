import { describe, expect, it } from 'vitest';
import { USER_ID, createSeason, createSpectatorSeason, playSpectatorGame, recordUserGame } from './ryuo.mjs';
import { createRoster } from './ryuo-roster.mjs';
import {
  emptyWatchStore, loadWatchStore, noteWatchProgress, replaceWatchSeason, saveWatchStore, stepsAfterElimination, userWonSeason, watchFinale, watchSteps,
} from './ryuo-watch.mjs';

const settings = { difficulty: 9, scale: 3, revival: true };
const avatar = { rating: 1500, character: { abilities: { ending: 12, opening: -8 }, traits: [{ id: 'demon-reading', degree: 1 }] } };

describe('観戦の期(分身)', () => {
  const roster = createRoster({ seed: 41, userGroup: 6 });
  const before = JSON.stringify(roster);
  const season = createSpectatorSeason({ no: 3, mode: 'challenge', group: 6, settings, avatar, roster, seed: 77, userName: 'やこび', live: false });

  it('ふつうの期と同じく、分身の次の一局で止まる。「観戦する」で1局ずつ決めて進む(13-6)', () => {
    const live = createSpectatorSeason({ no: 3, mode: 'challenge', group: 6, settings, avatar, roster, seed: 77, userName: 'やこび' });
    expect(live).toMatchObject({ spectator: true, live: true, phase: 'ranking' });
    expect(live.pending).not.toBeNull();
    expect(live.userGames).toHaveLength(0);
    const next = playSpectatorGame(live);
    expect(next).toMatchObject({ spectator: true, live: true });
    expect(next.userGames).toHaveLength(1);
    expect(live.userGames).toHaveLength(0);
    // 同じ期・同じ局なら同じ結果。
    expect(playSpectatorGame(live).userGames[0].win).toBe(next.userGames[0].win);
    // 分身の対局は、中継に並ぶ(展開つき)。
    expect(watchSteps(next).flatMap(({ entries }) => entries).filter((entry) => entry.tags.self)).toHaveLength(1);
    // 最後まで進められる。
    let season = next;
    for (let guard = 0; guard < 200 && season.pending; guard += 1) season = playSpectatorGame(season);
    expect(season.phase).toBe('done');
    expect(JSON.stringify(roster)).toBe(before);
  });

  it('分身の対局も自動で決め、最後まで進む。名簿は変えない', () => {
    expect(season.phase).toBe('done');
    expect(season.spectator).toBe(true);
    expect(season.pending).toBeNull();
    expect(season.userGames.length).toBeGreaterThan(0);
    expect(season.players[USER_ID]).toMatchObject({ kind: 'avatar', rating: 1500, name: 'やこび' });
    expect(season.result.outcome).toBeTruthy();
    expect(JSON.stringify(roster)).toBe(before);
    // 同じ種なら同じ期。
    expect(createSpectatorSeason({ no: 3, mode: 'challenge', group: 6, settings, avatar, roster, seed: 77, live: false }).result).toEqual(season.result);
  });

  it('分身の対局は、展開つきで中継に並び、プロ並みの棋譜で作る', () => {
    const steps = watchSteps(season);
    const all = steps.flatMap(({ entries }) => entries);
    const own = all.filter((entry) => entry.tags.self);
    expect(own.length).toBe(season.userGames.length);
    expect(own.every((entry) => Array.isArray(entry.story) && entry.quality === 'pro')).toBe(true);
    expect(all.every((entry) => entry.quality === 'pro')).toBe(true);
    // 分身の対局は、その回戦の先頭(注目)。
    for (const step of steps) {
      const index = step.entries.findIndex((entry) => entry.tags.self);
      if (index >= 0) expect(index).toBe(0);
    }
  });

  it('回戦は期の順に並ぶ。ほかの組は1つにまとめる。最後は竜王と分身の成績', () => {
    const steps = watchSteps(season);
    const order = { ranking: 1, revival: 2, group: 3, main: 4, playoff: 5, finals: 6 };
    for (let index = 1; index < steps.length; index += 1) expect(order[steps[index].stage]).toBeGreaterThanOrEqual(order[steps[index - 1].stage]);
    expect(steps.filter(({ stage }) => stage === 'group')).toHaveLength(1);
    expect(steps.at(-1).stage).toBe('finals');
    expect(steps.at(-1).label).toMatch(/竜王戦七番勝負 第\d局/);
    const finale = watchFinale(season);
    expect(finale.champion).not.toBeNull();
    expect(finale.lines[0]).toMatch(/^第3期竜王は/);
    expect(finale.lines.some((line) => /分身の成績は\d+勝\d+敗/.test(line))).toBe(true);
  });
});

describe('敗退後の観戦', () => {
  const roster = createRoster({ seed: 21, userGroup: 6 });
  let season = createSeason({ no: 1, mode: 'challenge', group: 6, settings, userLevel: 28, seed: 5, roster });
  season = recordUserGame(season, 'win');
  season = recordUserGame(season, 'loss');
  while (season.pending) season = recordUserGame(season, 'loss');

  it('自分の最後の対局より後の回戦だけを、自分の対局なしで見る', () => {
    expect(season.phase).toBe('done');
    expect(userWonSeason(season)).toBe(false);
    const steps = watchSteps(season);
    const after = stepsAfterElimination(season, steps);
    expect(after.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThan(steps.length);
    expect(after.some(({ id }) => id === season.userGames.at(-1).label)).toBe(false);
    expect(after.flatMap(({ entries }) => entries).every((entry) => !entry.tags.self && entry.quality === '')).toBe(true);
    expect(after.at(-1).stage).toBe('finals');
  });
});

describe('観戦の保存', () => {
  function memoryStorage() {
    const map = new Map();
    return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
  }

  it('めくった数は多いほうを残し、観戦の期を置き換えると前の期の数を消す', () => {
    let store = emptyWatchStore();
    store = replaceWatchSeason(store, { id: 1 });
    store = noteWatchProgress(store, 1, 3);
    store = noteWatchProgress(store, 1, 2);
    store = noteWatchProgress(store, 99, 4);
    expect(store.progress).toEqual({ 1: 3, 99: 4 });
    store = replaceWatchSeason(store, { id: 2 });
    expect(store.progress).toEqual({ 99: 4 });
    const storage = memoryStorage();
    saveWatchStore(storage, store);
    expect(loadWatchStore(storage)).toEqual(store);
    expect(loadWatchStore({ getItem: () => '{oops' })).toEqual(emptyWatchStore());
  });
});
