import { describe, expect, it } from 'vitest';
import { opponentArrivalLine, seasonRoad } from './ryuo-road.mjs';
import { createSeason, describeSeason, recordUserGame } from './ryuo.mjs';

const settings = (overrides = {}) => ({ difficulty: 9, scale: 3, revival: true, ...overrides });
const fresh = (overrides = {}) => createSeason({ no: 1, mode: 'challenge', group: 6, settings: settings(), userLevel: 20, seed: 11, ...overrides });
const keys = (road) => road.steps.map(({ key }) => key);
const states = (road) => Object.fromEntries(road.steps.map(({ key, state }) => [key, state]));

describe('竜王への道', () => {
  it('6組の1回戦から竜王まで。いまの段に次の相手、組の決勝に昇級の印、山場は組の決勝・番勝負・竜王', () => {
    const season = fresh();
    const road = seasonRoad(season, { promote: 2 });
    expect(keys(road)).toEqual(['ranking-1', 'ranking-2', 'ranking-3', 'ranking-4', 'ranking-5', 'main', 'playoff', 'finals', 'ryuo']);
    expect(road.steps.map(({ short }) => short)).toEqual(['1回戦', '2回戦', '準々決勝', '準決勝', '組の決勝', '決勝T', '挑戦者決定戦', '七番勝負', '竜王']);
    expect(road.currentIndex).toBe(0);
    expect(road.lastIndex).toBe(-1);
    expect(road.steps[0]).toMatchObject({ state: 'current', face: { id: season.pending.opponentId } });
    expect(road.steps.filter(({ boss }) => boss).map(({ key }) => key)).toEqual(['ranking-5', 'playoff', 'finals', 'ryuo']);
    expect(road.steps.filter(({ mark }) => mark).map(({ key, mark }) => `${key}:${mark}`)).toEqual(['ranking-5:昇級']);
    // 七番勝負には、いまの竜王の顔。
    expect(road.steps.find(({ key }) => key === 'finals').face?.id).toBe(season.defender);
    // 期の画面に道を渡す。
    expect(describeSeason(season).road.steps).toHaveLength(9);
  });

  it('昇級が1名の規模では、組を優勝して決勝トーナメントへ進むところに昇級の印', () => {
    const season = fresh({ settings: settings({ scale: 1 }) });
    const road = seasonRoad(season, { promote: 1 });
    expect(road.steps.filter(({ mark }) => mark).map(({ key }) => key)).toEqual(['main']);
  });

  it('勝つと1段進み、直前の段が勝ち上がりの動きの出発点になる。勝ち続けると竜王', () => {
    let season = recordUserGame(fresh(), 'win');
    let road = seasonRoad(season, { promote: 2 });
    expect(states(road)).toMatchObject({ 'ranking-1': 'done', 'ranking-2': 'current' });
    expect(road.lastIndex).toBe(0);
    expect(road.currentIndex).toBe(1);
    let guard = 0;
    while (season.phase !== 'done' && guard < 30) {
      season = recordUserGame(season, 'win');
      guard += 1;
      road = seasonRoad(season, { promote: 2 });
      // 番勝負の途中は、同じ段にとどまる(スコアが進む)。
      if (season.pending?.kind === 'finals') expect(road.steps[road.currentIndex]).toMatchObject({ key: 'finals', score: expect.stringMatching(/^\d-\d$/) });
    }
    expect(states(road)).toMatchObject({ 'ranking-5': 'done', main: 'done', playoff: 'done', finals: 'done', ryuo: 'won' });
    expect(road.steps[road.currentIndex].key).toBe('ryuo');
    expect(road.steps[road.lastIndex].key).toBe('finals');
  });

  it('負けると、その段で止まる。敗者復活戦があれば、その段が道に入る', () => {
    const fifth = createSeason({ no: 1, mode: 'challenge', group: 5, settings: settings(), userLevel: 20, seed: 11 });
    const lost = recordUserGame(fifth, 'loss');
    const road = seasonRoad(lost, { promote: 2 });
    expect(keys(road)).toContain('revival');
    expect(states(road)).toMatchObject({ 'ranking-1': 'lost', 'ranking-2': 'skip', revival: 'current', main: 'todo' });
    expect(road.steps[road.lastIndex].key).toBe('ranking-1');
    // 6組(中)は敗者復活戦がないので、負ければ期が終わり、止まった段がいまの段。
    const out = recordUserGame(fresh(), 'loss');
    const outRoad = seasonRoad(out, { promote: 2 });
    expect(out.phase).toBe('done');
    expect(keys(outRoad)).not.toContain('revival');
    expect(outRoad.steps[outRoad.currentIndex]).toMatchObject({ key: 'ranking-1', state: 'lost' });
  });

  it('防衛戦は、七番勝負と竜王防衛の2段', () => {
    const season = createSeason({ no: 2, mode: 'defense', group: 1, settings: settings(), userLevel: 30, seed: 5 });
    const road = seasonRoad(season, { promote: 2 });
    expect(keys(road)).toEqual(['finals', 'ryuo']);
    expect(road.steps.map(({ label }) => label)).toEqual(['防衛戦 七番勝負', '竜王防衛']);
    expect(road.steps[0]).toMatchObject({ state: 'current', score: '0-0' });
  });

  it('次の相手が、前の回戦をどう勝ってきたかを1行で言う', () => {
    let season = fresh();
    expect(opponentArrivalLine(season)).toBe('');
    let line = '';
    for (let index = 0; index < 4 && !line; index += 1) {
      season = recordUserGame(season, 'win');
      line = opponentArrivalLine(season);
    }
    expect(line).toMatch(/^.+さんは、前の回戦を.+勝ち上がってきたよ。$/);
    expect(describeSeason(season).pending.arrival).toBe(line);
  });
});
