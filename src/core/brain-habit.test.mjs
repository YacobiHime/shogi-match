import { describe, expect, test } from 'vitest';
import { emptyBrainRecord, stampRoom } from './brain-training.mjs';
import { CALC_COURSE_SESSIONS, MEMORY_COURSE_SESSIONS } from './brain-program.mjs';
import {
  CUE_OPTIONS,
  WEEK_TARGETS,
  calcNextGoal,
  compareRecord,
  cleanCue,
  cueText,
  memoryNextGoal,
  memoryTarget,
  metWeeks,
  todayPick,
  weekCounts,
  weekStart,
  weekStrip,
} from './brain-habit.mjs';

function stampDays(record, room, days) {
  return days.reduce((next, day) => stampRoom(next, room, day), record);
}

describe('今週の判子と週の目安(docs/brain-training-design.mdの14-9)', () => {
  test('週は月曜はじまり', () => {
    // 2026-11-02は月曜日。
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    const strip = weekStrip(emptyBrainRecord(), '2026-11-05');
    expect(strip.map(({ weekday }) => weekday)).toEqual(['月', '火', '水', '木', '金', '土', '日']);
    expect(strip[0].day).toBe('2026-11-02');
    expect(strip[3]).toMatchObject({ today: true, future: false });
    expect(strip[4]).toMatchObject({ today: false, future: true });
  });

  test('週の判子の数と目安。記憶力はコースのあと週3回', () => {
    let record = stampDays(emptyBrainRecord(), 'calc', ['2026-11-02', '2026-11-04']);
    record = stampDays(record, 'memory', ['2026-11-03', '2026-11-04', '2026-11-05']);
    record = stampRoom(record, 'calc', '2026-11-01');
    const counts = weekCounts(record, '2026-11-05');
    expect(counts.calc).toEqual({ done: 2, target: WEEK_TARGETS.calc });
    expect(counts.memory).toEqual({ done: 3, target: WEEK_TARGETS.memory });
    expect(memoryTarget({ sessions: MEMORY_COURSE_SESSIONS })).toBe(WEEK_TARGETS.memoryAfterCourse);
  });

  test('目安に届いた週を数える(途切れても消えない)', () => {
    let record = stampDays(emptyBrainRecord(), 'calc', ['2026-10-20', '2026-10-21', '2026-10-22']);
    record = stampDays(record, 'calc', ['2026-10-27']);
    record = stampDays(record, 'memory', ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    // 10月20日の週は計算力が3回(目安に届いた)、10月27日の週は1回、今週の記憶力は4回(まだ)。
    expect(metWeeks(record, '2026-11-05')).toBe(1);
    record = stampRoom(record, 'memory', '2026-11-06');
    expect(metWeeks(record, '2026-11-06')).toBe(2);
  });
});

describe('今日のおすすめの部屋', () => {
  test('判子のない部屋だけ。2つとも済んだらnull', () => {
    let record = stampRoom(emptyBrainRecord(), 'calc', '2026-11-02');
    expect(todayPick({ record, day: '2026-11-02' })).toBe('memory');
    record = stampRoom(record, 'memory', '2026-11-02');
    expect(todayPick({ record, day: '2026-11-02' })).toBeNull();
  });

  test('時期の来たものがある部屋を先に', () => {
    const record = emptyBrainRecord();
    expect(todayPick({ record, day: '2026-11-02', memoryDue: true })).toBe('memory');
    record.program.calc = { ...record.program.calc, before: { day: '2026-08-01', label: '最初', values: {} }, sessions: CALC_COURSE_SESSIONS, finishedDay: '2026-09-01' };
    expect(todayPick({ record, day: '2026-10-05' })).toBe('calc');
  });

  test('今週の目安の残りの割合が大きい部屋。同じなら前に選んだ部屋', () => {
    let record = stampDays(emptyBrainRecord(), 'memory', ['2026-11-02', '2026-11-03']);
    record = stampDays(record, 'calc', ['2026-11-02']);
    // 計算力の残り2/3 > 記憶力の残り3/5
    expect(todayPick({ record, day: '2026-11-04' })).toBe('calc');
    const fresh = { ...emptyBrainRecord(), room: 'memory' };
    expect(todayPick({ record: fresh, day: '2026-11-04' })).toBe('memory');
    expect(todayPick({ record: emptyBrainRecord(), day: '2026-11-04' })).toBe('calc');
  });
});

describe('いつ稽古するかと次の目標', () => {
  test('いつ稽古するか', () => {
    expect(CUE_OPTIONS.map(({ id }) => id)).toContain('none');
    expect(cleanCue('bed')).toBe('bed');
    expect(cleanCue('midnight')).toBe('');
    expect(cueText('bed')).toBe('寝る前に稽古する');
    expect(cueText('none')).toBe('');
  });

  test('計算力: コースの残り → おさらいの時期 → 今週の目安', () => {
    const record = emptyBrainRecord();
    expect(calcNextGoal(record, '2026-11-02')).toContain('最初の測定');
    record.program.calc = { ...record.program.calc, before: { day: '2026-11-01', label: '最初', values: {} }, sessions: 4 };
    expect(calcNextGoal(record, '2026-11-02')).toBe('あと6回で、最初の自分とくらべる日');
    record.program.calc = { ...record.program.calc, sessions: CALC_COURSE_SESSIONS, finishedDay: '2026-11-01' };
    expect(calcNextGoal(record, '2026-11-02')).toBe('1か月後のおさらいは12月1日ごろから');
    expect(calcNextGoal(record, '2026-12-02')).toBe('1か月後のおさらい あと4回');
  });

  test('記憶力: 学校の次の講 → コースの残り → 思い出しの箱 → 今週の目安', () => {
    const record = emptyBrainRecord();
    expect(memoryNextGoal(record, '2026-11-02')).toContain('最初の記憶テスト');
    record.program.memory = { ...record.program.memory, before: { day: '2026-11-01', correct: 6, total: 15 } };
    expect(memoryNextGoal(record, '2026-11-02', { nextLessonTitle: '講2「絵にする」', practiceOpen: false })).toBe('次は講2「絵にする」');
    record.program.memory = { ...record.program.memory, sessions: 8 };
    expect(memoryNextGoal(record, '2026-11-02', { practiceOpen: true })).toBe(`あと${MEMORY_COURSE_SESSIONS - 8}回で、最初の記憶テストとくらべる日`);
    record.program.memory = { ...record.program.memory, sessions: MEMORY_COURSE_SESSIONS };
    expect(memoryNextGoal(record, '2026-11-02', { practiceOpen: true, nextBoxDay: '2026-11-05' })).toBe('思い出しの箱は11月5日');
    expect(memoryNextGoal(record, '2026-11-02', { practiceOpen: true })).toBe('今週の目安まで、あと3回');
  });
});

describe('いつ稽古するかの保存', () => {
  test('決めた答えと、聞いたことが残る。前の保存(cueのない版2)もそのまま読める', async () => {
    const { setBrainCue, loadBrainRecord, saveBrainRecord, BRAIN_TRAINING_KEY } = await import('./brain-training.mjs');
    const data = {};
    const storage = { getItem: (key) => (key in data ? data[key] : null), setItem: (key, value) => { data[key] = String(value); } };
    const record = setBrainCue(emptyBrainRecord(), 'bed');
    expect(record).toMatchObject({ cue: 'bed', cueAsked: true });
    saveBrainRecord(storage, record);
    expect(loadBrainRecord(storage)).toMatchObject({ cue: 'bed', cueAsked: true });
    data[BRAIN_TRAINING_KEY] = JSON.stringify({ version: 2, levels: {}, best: {}, days: {}, room: 'calc' });
    expect(loadBrainRecord(storage)).toMatchObject({ cue: '', cueAsked: false, room: 'calc' });
    expect(setBrainCue(emptyBrainRecord(), 'midnight')).toMatchObject({ cue: '', cueAsked: true });
  });
});

describe('成績表の前との差', () => {
  test('スピード計算は速くなった秒数、50ms未満は同じくらい、遅くなったら前の値を並べるだけ', () => {
    expect(compareRecord('speed-2', 1900, 2200)).toEqual({ kind: 'up', diffSeconds: 0.3 });
    expect(compareRecord('speed-2', 1980, 2000)).toEqual({ kind: 'same', diffSeconds: 0 });
    expect(compareRecord('speed-2', 2300, 2000)).toEqual({ kind: 'prev', diffSeconds: 0 });
    expect(compareRecord('speed-1', 1960, 2010)).toEqual({ kind: 'up', diffSeconds: 0.1 });
  });
  test('大きいほど良い記録', () => {
    expect(compareRecord('nback', 4, 3)).toEqual({ kind: 'up', diffSeconds: 0 });
    expect(compareRecord('nback', 3, 3)).toEqual({ kind: 'same', diffSeconds: 0 });
    expect(compareRecord('nback', 2, 3)).toEqual({ kind: 'prev', diffSeconds: 0 });
    expect(compareRecord('nback', 2, null)).toBeNull();
    expect(compareRecord('palace', 0, 9)).toBeNull();
  });
});
