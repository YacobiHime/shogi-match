import { describe, expect, it } from 'vitest';
import { groupMeanLevel, ratingToLevel, tournamentLevel, recommendedDifficulty, recommendedTournamentLevel, winProbability } from './ryuo-strength.mjs';
import { levelRating } from './player-rating.mjs';
import { USER_ID, createSeason, recordUserGame } from './ryuo.mjs';
import { createRoster } from './ryuo-roster.mjs';
import { loadSeason, saveSeason } from './ryuo-career.mjs';
import { MEIJIN_CLASSES, createLeague, createMeijinSeason, recordMeijinGame, saveMeijinSeason, loadMeijinSeason } from './meijin.mjs';

const expected = (playerLevel, opponentLevel) => winProbability(levelRating(playerLevel), levelRating(opponentLevel));
function checkOpponents(season, playerLevel) {
  const opponents = Object.values(season.players).filter(player => player.id !== USER_ID);
  expect(opponents.length).toBeGreaterThan(0);
  for (const opponent of opponents) {
    expect(Number.isInteger(opponent.level)).toBe(true);
    expect(expected(playerLevel, opponent.level)).toBeGreaterThanOrEqual(0.6);
    expect(expected(playerLevel, opponent.level)).toBeLessThanOrEqual(0.8);
  }
}
function memoryStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

describe('大会のおすすめの強さ', () => {
  it('測定結果と同じElo尺度で、丸めた後の見込み勝率を6〜8割に収める', () => {
    for (let level = 3; level <= 40; level += 0.25) {
      let previous = 0;
      for (let rating = 800; rating <= 2500; rating += 25) {
        const opponent = recommendedTournamentLevel(rating, level);
        expect(opponent).toBeGreaterThanOrEqual(previous);
        expect(expected(level, opponent)).toBeGreaterThanOrEqual(0.6);
        expect(expected(level, opponent)).toBeLessThanOrEqual(0.8);
        previous = opponent;
      }
    }
    expect(recommendedTournamentLevel(1450, 11)).toBe(9);
    expect(groupMeanLevel(6, recommendedDifficulty(11), 11)).toBe(9);
  });

  it('最低レベルでは24級(Lv1)を下回らず、保存済みの旧設定は従来の換算を保つ', () => {
    for (const level of [0.5, 1, 2]) {
      for (const rating of [800, 1450, 2130]) expect(recommendedTournamentLevel(rating, level)).toBe(1);
    }
    const roster = createRoster({ seed: 51 });
    const season = createSeason({ no: 1, mode: 'challenge', group: 6, roster, userLevel: 11, settings: { difficulty: 9, scale: 1, revival: false }, seed: 51 });
    for (const opponent of Object.values(season.players).filter(player => player.id !== USER_ID && !player.story)) {
      expect(opponent.level).toBe(ratingToLevel(opponent.rating, 9));
    }
  });

  it('手動で番号を上げると強く、下げると弱くなり、おすすめと逆転しない', () => {
    for (let level = 1; level <= 49; level += 0.5) {
      for (let rating = 800; rating <= 2500; rating += 50) {
        let previous = 0;
        for (let difficulty = 1; difficulty <= 14; difficulty++) {
          const opponent = tournamentLevel(rating, difficulty, level);
          expect(opponent).toBeGreaterThanOrEqual(previous);
          expect(opponent).toBeGreaterThanOrEqual(1);
          expect(opponent).toBeLessThanOrEqual(49);
          previous = opponent;
        }
      }
    }
  });

  for (const level of [3, 11.25, 18, 29, 40]) {
    it(`棋力Lv${level}のおすすめで、竜王戦の初戦からタイトル戦まで強すぎる相手を出さない`, () => {
      const seed = 50 + Math.round(level);
      const roster = createRoster({ seed });
      const settings = { difficulty: recommendedDifficulty(level), scale: 1, revival: true, recommended: true };
      for (const [group, mode] of [[6, 'challenge'], [1, 'challenge'], [1, 'defense']]) {
        let season = createSeason({ no: 1, mode, group, roster, userLevel: level, settings, seed });
        checkOpponents(season, level);
        let games = 0;
        while (season.pending && games++ < 80) season = recordUserGame(season, 'win');
        expect(season.phase).toBe('done');
        checkOpponents(season, level);
        const storage = memoryStorage(); saveSeason(storage, season);
        expect(loadSeason(storage)).toEqual(season);
      }
    });

    it(`棋力Lv${level}のおすすめを、名人戦の全クラスと防衛戦にも使う`, () => {
      const roster = createRoster({ seed: 61 });
      for (const cls of [...MEIJIN_CLASSES, 'meijin']) {
        const league = createLeague(roster);
        for (const name of MEIJIN_CLASSES) league.classes[name] = league.classes[name].filter(id => id !== USER_ID);
        if (cls === 'meijin') league.holder = USER_ID;
        else league.classes[cls].push(USER_ID);
        let season = createMeijinSeason({ no: 1, league, roster, userLevel: level, settings: { difficulty: recommendedDifficulty(level), scale: 'short', recommended: true }, seed: 61 });
        checkOpponents(season, level);
        let games = 0;
        while (season.pending && games++ < 80) season = recordMeijinGame(season, 'win');
        expect(season.result).toBeTruthy();
        checkOpponents(season, level);
        const storage = memoryStorage(); saveMeijinSeason(storage, season);
        expect(loadMeijinSeason(storage)).toEqual(season);
      }
    });
  }
});
