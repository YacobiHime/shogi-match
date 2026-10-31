import { describe, expect, test } from 'vitest';

import {
  CALC_BOOSTERS,
  CALC_COURSE_SESSIONS,
  MEMORY_COURSE_SESSIONS,
  addDays,
  calcBoosterDue,
  calcCourseGames,
  calcNextBoosterDay,
  calcProgress,
  cleanCalcProgram,
  cleanMemoryProgram,
  completeCalcPlan,
  completeMemoryPractice,
  daysBetween,
  emptyCalcProgram,
  emptyMemoryProgram,
  memoryProgress,
  planCalcToday,
  planMemoryToday,
  recordMemoryTest,
} from './brain-program.mjs';

const VALUES = { speed: 2100, nback: 2, 'glance-sym': 4 };

/** コースを1日1回ずつn日進める。 */
function playDays(program, start, days) {
  let current = program;
  for (let index = 0; index < days; index += 1) {
    const day = addDays(start, index);
    const plan = planCalcToday(current, day);
    current = completeCalcPlan(current, plan, VALUES, day);
  }
  return current;
}

describe('日付', () => {
  test('日数の差と足し算は月と年をまたぐ', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-12-25', '2027-01-04')).toBe(10);
    expect(addDays('2026-10-31', 30)).toBe('2026-11-30');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('計算力のプログラム', () => {
  test('最初の日は測定。測った日は、もう一度押しても自由練習', () => {
    const plan = planCalcToday(emptyCalcProgram(), '2026-11-01');
    expect(plan.kind).toBe('measure');
    expect(plan.games.map(({ id, mode }) => `${id}:${mode}`)).toEqual(['speed:measure', 'nback:measure', 'glance-sym:measure']);
    const measured = completeCalcPlan(emptyCalcProgram(), plan, VALUES, '2026-11-01');
    expect(measured.before).toEqual({ day: '2026-11-01', label: '最初', values: VALUES });
    const again = planCalcToday(measured, '2026-11-01');
    expect(again.kind).toBe('free');
    expect(again.counted).toBe(false);
    expect(completeCalcPlan(measured, again, VALUES, '2026-11-01')).toBe(measured);
  });

  test('コースは速さの種目を毎回入れ、N問前と色で切り替えを日替わりにする', () => {
    for (let session = 1; session <= CALC_COURSE_SESSIONS; session += 1) {
      const games = calcCourseGames(session);
      expect(games).toContain('glance-sym');
      expect(games).toContain('speed');
      expect(games).toContain(session % 2 ? 'nback' : 'switch');
    }
  });

  test('1日1回だけ回が進み、10回目の終わりに測り直してコースを終える', () => {
    let program = playDays(emptyCalcProgram(), '2026-11-01', 1);
    const day = '2026-11-02';
    let plan = planCalcToday(program, day);
    expect(plan).toMatchObject({ kind: 'course', session: 1, counted: true, measure: null });
    program = completeCalcPlan(program, plan, VALUES, day);
    expect(program.sessions).toBe(1);
    // 同じ日に何度押しても回は進まない。
    plan = planCalcToday(program, day);
    expect(plan.counted).toBe(false);
    expect(completeCalcPlan(program, plan, VALUES, day).sessions).toBe(1);
    program = playDays(program, '2026-11-03', 8);
    expect(program.sessions).toBe(9);
    plan = planCalcToday(program, '2026-11-20');
    expect(plan.session).toBe(10);
    expect(plan.measure).toBe('after');
    expect(plan.games.filter(({ mode }) => mode === 'measure')).toHaveLength(3);
    program = completeCalcPlan(program, plan, { speed: 1600, nback: 4, 'glance-sym': 8 }, '2026-11-20');
    expect(program.sessions).toBe(CALC_COURSE_SESSIONS);
    expect(program.finishedDay).toBe('2026-11-20');
    expect(program.after).toEqual([{ day: '2026-11-20', label: 'コースの後', values: { speed: 1600, nback: 4, 'glance-sym': 8 } }]);
    expect(calcProgress(program, '2026-11-21').text).toBe('コース修了');
  });

  test('修了から約1か月後と約3か月後に、4回のおさらいを勧める。おさらいの最後にも測る', () => {
    let program = playDays(emptyCalcProgram(), '2026-01-01', 11);
    expect(program.finishedDay).toBe('2026-01-11');
    expect(calcBoosterDue(program, '2026-02-09')).toBeNull();
    expect(calcNextBoosterDay(program, '2026-01-20')).toBe('2026-02-10');
    expect(planCalcToday(program, '2026-02-01').kind).toBe('free');
    const due = calcBoosterDue(program, '2026-02-10');
    expect(due).toMatchObject({ index: 0, done: 0, sessions: CALC_BOOSTERS[0].sessions });
    expect(calcProgress(program, '2026-02-10').booster).toBe(true);
    program = playDays(program, '2026-02-10', 4);
    expect(program.boosters[0]).toBe(4);
    expect(program.after.at(-1).label).toBe('1か月後のおさらいの後');
    expect(calcBoosterDue(program, '2026-02-20')).toBeNull();
    expect(calcNextBoosterDay(program, '2026-02-20')).toBe('2026-04-11');
    expect(calcBoosterDue(program, '2026-04-11')).toMatchObject({ index: 1, done: 0 });
    // 1か月後のおさらいをしなくても、3か月後の時期にはそちらを勧める(何も消えない)。
    const skipped = playDays(emptyCalcProgram(), '2026-01-01', 11);
    expect(calcBoosterDue(skipped, '2026-05-01')).toMatchObject({ index: 1 });
  });

  test('壊れた保存を捨てる', () => {
    expect(cleanCalcProgram(null)).toEqual(emptyCalcProgram());
    const odd = cleanCalcProgram({ before: { day: 'x' }, sessions: 99, lastDay: 5, finishedDay: '2026-01-01', boosters: [9, -1], after: [{ day: '2026-01-02', values: { speed: 'a', nback: 3 } }, 'x'] });
    expect(odd.before).toBeNull();
    expect(odd.sessions).toBe(CALC_COURSE_SESSIONS);
    expect(odd.lastDay).toBe('');
    expect(odd.finishedDay).toBe('2026-01-01');
    expect(odd.boosters).toEqual([4, 0]);
    expect(odd.after).toEqual([{ day: '2026-01-02', label: '', values: { nback: 3 } }]);
    // 修了していないのに修了日だけある値は捨てる。
    expect(cleanCalcProgram({ sessions: 3, finishedDay: '2026-01-01' }).finishedDay).toBe('');
  });
});

describe('記憶力のプログラム', () => {
  const base = { hasPalace: true, practiceOpen: true, nextLesson: null, day: '2026-11-01' };

  test('記憶テスト → 宮殿づくり → 学校 → 毎日の練習の順', () => {
    const empty = emptyMemoryProgram();
    expect(planMemoryToday({ ...base, program: empty })).toMatchObject({ kind: 'test', measure: 'before' });
    const tested = recordMemoryTest(empty, 'before', { correct: 6, total: 15 }, '2026-11-01');
    expect(tested.before).toEqual({ day: '2026-11-01', correct: 6, total: 15 });
    expect(planMemoryToday({ ...base, program: tested, hasPalace: false })).toMatchObject({ kind: 'build' });
    expect(planMemoryToday({ ...base, program: tested, practiceOpen: false, nextLesson: 'walk' })).toMatchObject({ kind: 'lesson', lessonId: 'walk' });
    expect(planMemoryToday({ ...base, program: tested, day: '2026-11-02' })).toMatchObject({ kind: 'practice', session: 1, counted: true });
    // 最初のテストは1回だけ。
    expect(recordMemoryTest(tested, 'before', { correct: 15, total: 15 }, '2026-11-02')).toBe(tested);
  });

  test('6週間のコースは1日1回進み、30回でもう一度テスト', () => {
    let program = recordMemoryTest(emptyMemoryProgram(), 'before', { correct: 6, total: 15 }, '2026-10-01');
    for (let index = 0; index < MEMORY_COURSE_SESSIONS + 3; index += 1) {
      const day = addDays('2026-10-02', index);
      program = completeMemoryPractice(program, day);
      program = completeMemoryPractice(program, day);
    }
    expect(program.sessions).toBe(MEMORY_COURSE_SESSIONS);
    const plan = planMemoryToday({ ...base, program, day: '2026-12-01' });
    expect(plan).toMatchObject({ kind: 'test', measure: 'after' });
    program = recordMemoryTest(program, 'after', { correct: 15, total: 15 }, '2026-12-01');
    expect(program.after).toEqual([{ day: '2026-12-01', correct: 15, total: 15 }]);
    expect(planMemoryToday({ ...base, program, day: '2026-12-02' })).toMatchObject({ kind: 'practice', session: 0 });
    expect(memoryProgress(program, { hasPalace: true, practiceOpen: true, lessonsDone: 9 }).text).toBe('6週間コース修了');
  });

  test('入口の一言と、壊れた保存', () => {
    expect(memoryProgress(emptyMemoryProgram(), { hasPalace: false, practiceOpen: false, lessonsDone: 0 }).text).toBe('はじめに、いまの記憶を測ろう');
    const tested = recordMemoryTest(emptyMemoryProgram(), 'before', { correct: 6, total: 15 }, '2026-11-01');
    expect(memoryProgress(tested, { hasPalace: true, practiceOpen: false, lessonsDone: 2 }).text).toBe('学校 講3');
    expect(cleanMemoryProgram({ before: { day: '2026-11-01', correct: 30, total: 15 }, sessions: -2, after: [{ day: 'x' }] })).toEqual({
      before: { day: '2026-11-01', correct: 15, total: 15 },
      sessions: 0,
      lastDay: '',
      after: [],
    });
  });
});
