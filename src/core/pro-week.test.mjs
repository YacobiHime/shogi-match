import { describe, expect, it } from 'vitest';
import {
  CONDITION_DEFAULT, autoActions, autoRatingBonus, conditionAfterGame, conditionHintBonus, mondayOf, prepCap, researched, starsFor, weekNumber, weekRange, weekSlots,
} from './pro-week.mjs';
import { PRO_USER_ID, advanceWeek, autoWeeks, chooseWeekAction, createProYear, packProYear, recordProGame, recordStudyGame, finishFestival, unpackProYear, weekView } from './pro-year.mjs';
import { createRoster } from './ryuo-roster.mjs';

const roster = createRoster({ seed: 11, userGroup: 6 });
const start = (seed = 7) => createProYear({ seed, fiscalYear: 2026, roster, settings: { world: 30 }, userLevel: 30, userName: 'やこび' });

describe('週の決まり', () => {
  it('週は月曜はじまりで、4月1日を含む週が第1週', () => {
    expect(mondayOf('2026-04-01')).toBe('2026-03-30');
    expect(weekNumber('2026-04-05', 2026)).toBe(1);
    expect(weekNumber('2026-04-06', 2026)).toBe(2);
    expect(weekRange('2026-04-01', 2026)).toMatchObject({ start: '2026-04-01', end: '2026-04-05' });
    expect(weekRange('2027-03-30', 2026).end).toBe('2027-03-31');
  });

  it('調子は対局で下がり、勝てば戻り、二日制は2段下がる', () => {
    expect(conditionAfterGame(2, { won: true })).toBe(2);
    expect(conditionAfterGame(2, { won: false })).toBe(1);
    expect(conditionAfterGame(3, { won: false, twoDay: true })).toBe(1);
    expect(conditionAfterGame(0, { won: false })).toBe(0);
    expect(conditionHintBonus(4)).toBe(2);
    expect(conditionHintBonus(0)).toBe(-2);
    expect(autoRatingBonus(3, 2)).toBe(80);
  });

  it('対策★は道具で上限と進み方が変わり、相手が変わると0から', () => {
    expect([0, 1, 2, 3].map(prepCap)).toEqual([1, 2, 3, 3]);
    expect(researched(null, 'a', 0)).toEqual({ id: 'a', stars: 1 });
    expect(researched({ id: 'a', stars: 1 }, 'a', 0)).toEqual({ id: 'a', stars: 1 });
    expect(researched({ id: 'a', stars: 1 }, 'a', 2)).toEqual({ id: 'a', stars: 2 });
    expect(researched({ id: 'a', stars: 2 }, 'b', 3)).toEqual({ id: 'b', stars: 2 });
    expect(starsFor({ id: 'a', stars: 2 }, 'b')).toBe(0);
  });

  it('行動の枠は対局の数で減り、おまかせは調子が低いと休む', () => {
    expect([0, 1, 2, 3].map(weekSlots)).toEqual([2, 1, 0, 0]);
    expect(autoActions({ slots: 2, condition: 1, stars: 0, cap: 1, canResearch: true })).toEqual(['rest', 'research']);
    expect(autoActions({ slots: 2, condition: 2, stars: 0, cap: 1, canResearch: true })).toEqual(['research', 'rest']);
    expect(autoActions({ slots: 1, condition: 3, stars: 0, cap: 2, canResearch: false })).toEqual(['rest']);
  });
});

describe('1週ずつ過ごす', () => {
  it('デビューの週は4月1日から日曜までで、調子はふつう', () => {
    const state = start();
    const view = weekView(state);
    expect(view.number).toBe(1);
    expect(view.start).toBe('2026-04-01');
    expect(view.condition).toBe(CONDITION_DEFAULT);
    expect(view.actions.map((item) => item.id)).toContain('rest');
  });

  it('休むと調子が上がり、週を進めると次の週になってまとめが残る', () => {
    let state = start();
    const view = weekView(state);
    expect(view.games).toEqual([]);
    state = chooseWeekAction(state, 0, 'rest');
    state = chooseWeekAction(state, 1, 'research');
    state = advanceWeek(state);
    expect(state.pending).toBeNull();
    expect(state.condition).toBe(CONDITION_DEFAULT + 1);
    expect(state.week.start).toBe('2026-04-06');
    expect(state.lastWeek.lines.some((line) => line.includes('調子'))).toBe(true);
    expect(state.prep.stars).toBe(1);
    expect(state.prep.id).toBe(weekView(state).prep.opponent.id);
  });

  it('対局の日で止まり、対局を記録すると続きから週が進む。対局で調子が変わる', () => {
    let state = start();
    for (let guard = 0; guard < 20 && !state.pending; guard += 1) state = advanceWeek(state);
    expect(state.pending?.gameId).toBeTruthy();
    expect(state.pending.prep).toBeTruthy();
    const conditionBefore = state.condition;
    const weekStart = state.week.start;
    state = recordProGame(state, 'loss').state;
    expect(state.condition).toBe(Math.max(0, conditionBefore - 1));
    expect(state.week.log.some((item) => item.kind === 'game')).toBe(true);
    state = advanceWeek(state);
    if (!state.pending) expect(state.week.start > weekStart).toBe(true);
  });

  it('対局のある週は行動の枠が減り、選べない枠には入れられない', () => {
    let state = start();
    for (let guard = 0; guard < 20; guard += 1) {
      const view = weekView(state);
      if (view.games.length) {
        expect(view.slots).toBeLessThan(2);
        const tried = chooseWeekAction(state, 1, 'rest');
        expect(tried.week.actions[1] ?? null).toBeNull();
        return;
      }
      state = advanceWeek(state);
    }
    throw new Error('対局のある週が来なかった');
  });

  it('研究会を選ぶと、その日に練習対局で止まる', () => {
    let state = start();
    for (let guard = 0; guard < 10; guard += 1) {
      const view = weekView(state);
      const study = view.actions.find((item) => item.id === 'study');
      if (study && view.slots > 0) {
        state = chooseWeekAction(state, 0, 'study');
        state = advanceWeek(state);
        if (state.pending?.kind === 'study') {
          expect(state.pending.date).toBe(study.date);
          state = recordStudyGame(state, 'win').state;
          expect(state.week.log.some((item) => item.kind === 'study')).toBe(true);
          return;
        }
        // 研究会の前に公式戦があった。
        state = recordProGame(state, 'auto').state;
        continue;
      }
      state = state.pending ? recordProGame(state, 'auto').state : advanceWeek(state);
    }
    throw new Error('研究会の週が来なかった');
  });

  it('おまかせは次の自分の公式戦で止まる', () => {
    const state = autoWeeks(start());
    expect(state.pending?.gameId).toBeTruthy();
    expect(state.pending.date >= state.week.start && state.pending.date <= state.week.end).toBe(true);
  });

  it('おまかせで1年を進めると、年度の終わりに着く', () => {
    let state = start(3);
    for (let guard = 0; guard < 200 && !state.yearDone; guard += 1) {
      state = autoWeeks(state);
      if (state.pending) state = recordProGame(state, 'auto').state;
      if (state.festival) state = finishFestival(state).state;
    }
    expect(state.yearDone).toBe(true);
    expect(state.summary).toBeTruthy();
  });

  it('保存して戻しても、週・調子・対策が残る。前の保存は今の日の週から', () => {
    let state = chooseWeekAction(start(), 0, 'rest');
    state = advanceWeek(state);
    const back = unpackProYear(JSON.parse(JSON.stringify(packProYear(state))), roster);
    expect(back.week.start).toBe(state.week.start);
    expect(back.condition).toBe(state.condition);
    const old = JSON.parse(JSON.stringify(packProYear(start())));
    delete old.week;
    delete old.condition;
    delete old.prep;
    const restored = unpackProYear(old, roster);
    expect(restored.week.start).toBe('2026-04-01');
    expect(restored.condition).toBe(CONDITION_DEFAULT);
    expect(PRO_USER_ID).toBe('user');
  });
});

describe('対局の重さ・今年の目標・次の大一番', () => {
  it('予選のブロックの序盤は小、番勝負と羽音戦は大一番', async () => {
    const { gameWeight } = await import('./pro-year.mjs');
    let state = start();
    const weights = [];
    for (let guard = 0; guard < 60 && !state.yearDone; guard += 1) {
      state = autoWeeks(state);
      if (!state.pending) continue;
      const game = state.games[state.pending.gameId];
      expect(state.pending.weight).toBe(gameWeight(state, game));
      weights.push(state.pending.weight);
      const opponent = state.players[state.pending.opponentId];
      if (opponent.story === 'hanane') expect(state.pending.weight).toBe('big');
      state = recordProGame(state, 'win').state;
    }
    expect(weights).toContain('small');
    expect(weights).toContain('big');
  });

  it('目標の候補は状況で変わり、はじめての年度は易しめを3つすすめる', async () => {
    const { goalChoices } = await import('./pro-year.mjs');
    const choices = goalChoices(start());
    expect(choices.filter((goal) => goal.recommended)).toHaveLength(3);
    expect(choices.map((goal) => goal.id)).toContain('shinjinBest4');
    expect(choices.find((goal) => goal.id === 'wins').label).toBe('年間15勝');
  });

  it('目標は3つちょうどで決まり、勝ちを数えて達成したらその場で返す', async () => {
    const { setYearGoals, goalProgress } = await import('./pro-year.mjs');
    let state = setYearGoals(start(), ['wins', 'junniPromote']);
    expect(state.goals ?? null).toBeNull();
    state = setYearGoals(start(), ['wins', 'junniWinning', 'rate']);
    expect(goalProgress(state).map((goal) => goal.id)).toEqual(['wins', 'junniWinning', 'rate']);
    state.goals.target.wins = 2;
    const done = [];
    for (let guard = 0; guard < 40 && !state.yearDone; guard += 1) {
      state = autoWeeks(state);
      if (!state.pending) continue;
      const result = recordProGame(state, 'win');
      state = result.state;
      done.push(...result.goalsDone.map((goal) => goal.id));
      if (done.includes('wins')) break;
    }
    expect(done).toContain('wins');
    expect(goalProgress(state).find((goal) => goal.id === 'wins').done).toBe(true);
    // 勝率は年度の終わりまで達成にしない。
    expect(goalProgress(state).find((goal) => goal.id === 'rate').done).toBe(false);
  });

  it('年度のまとめに目標の判子が付く', async () => {
    const { setYearGoals } = await import('./pro-year.mjs');
    let state = setYearGoals(start(5), ['wins', 'junniWinning', 'rate']);
    for (let guard = 0; guard < 200 && !state.yearDone; guard += 1) {
      state = autoWeeks(state);
      if (state.pending) state = recordProGame(state, 'win').state;
      if (state.festival) state = finishFestival(state).state;
    }
    expect(state.summary.goals.map((goal) => goal.stamp)).toEqual(['done', 'done', 'done']);
  });

  it('次の大一番は、決まった大一番か「勝ち進めば」の一言', async () => {
    const { nextBigGame } = await import('./pro-year.mjs');
    let state = start();
    let seen = null;
    for (let guard = 0; guard < 40 && !seen; guard += 1) {
      const big = nextBigGame(state);
      if (big?.kind === 'fixed') seen = big;
      else if (big) expect(big.text).toMatch(/あと\d勝/);
      state = autoWeeks(state);
      if (state.pending) state = recordProGame(state, 'win').state;
    }
    expect(seen?.whenText).toMatch(/今週|あと\d+週/);
  });
});
