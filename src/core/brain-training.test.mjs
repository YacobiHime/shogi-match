import { describe, expect, test } from 'vitest';

import {
  BRAIN_DAYS_KEPT,
  BRAIN_TRAINING_KEY,
  BRAIN_TRAINING_V1_KEY,
  brainStreak,
  dailySeries,
  dayKey,
  emptyBrainRecord,
  growthSince,
  loadBrainRecord,
  migrateBrainRecordV1,
  nextStair,
  recordBrainSession,
  rememberRoom,
  saveBrainRecord,
  stampCalendar,
  stampRoom,
  stamped,
  startLevel,
} from './brain-training.mjs';
import {
  GLANCE_CENTER,
  GLANCE_DIRECTIONS,
  GLANCE_LEVELS,
  GLANCE_MAX_LEVEL,
  fileRankOf,
  glanceLevelLabel,
  glanceProblem,
  glanceSummary,
  glanceTimingValid,
  scoreGlance,
} from './brain-glance.mjs';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    data,
  };
}

describe('脳トレの記録', () => {
  test('階段は2問続けて正解で上がり、1問まちがえで下がる。上限と下限で止まる', () => {
    let state = { level: 3, streak: 0 };
    state = nextStair(state, true, { max: 5 });
    expect(state).toEqual({ level: 3, streak: 1, moved: 0 });
    state = nextStair(state, true, { max: 5 });
    expect(state).toEqual({ level: 4, streak: 0, moved: 1 });
    state = nextStair(state, false, { max: 5 });
    expect(state).toEqual({ level: 3, streak: 0, moved: -1 });
    expect(nextStair({ level: 0, streak: 0 }, false, { max: 5 })).toEqual({ level: 0, streak: 0, moved: 0 });
    expect(nextStair({ level: 5, streak: 1 }, true, { max: 5 })).toEqual({ level: 5, streak: 0, moved: 0 });
  });

  test('前の段から少し下げて始める', () => {
    const record = emptyBrainRecord();
    expect(startLevel(record, 'glance')).toBe(0);
    record.levels.glance = 7;
    expect(startLevel(record, 'glance')).toBe(5);
    record.levels.glance = 1;
    expect(startLevel(record, 'glance')).toBe(0);
  });

  test('1回の結果で、自己ベストと日ごとの記録と次の段を残し、部屋の判子を押す', () => {
    let { record, newBest } = recordBrainSession(emptyBrainRecord(), 'glance', { value: 5, level: 6 }, '2026-10-30');
    expect(newBest).toBe(true);
    expect(record.best.glance).toBe(5);
    expect(record.levels.glance).toBe(6);
    expect(record.days['2026-10-30']).toEqual({ calc: 1, glance: 5 });
    ({ record, newBest } = recordBrainSession(record, 'glance', { value: 3, level: 4 }, '2026-10-30'));
    expect(newBest).toBe(false);
    expect(record.best.glance).toBe(5);
    expect(record.days['2026-10-30'].glance).toBe(5);
    expect(record.levels.glance).toBe(4);
    // 記録0は自己ベストにしない(判子は押す)。知らない種目は無視する。
    const zero = recordBrainSession(emptyBrainRecord(), 'board-memory', { value: 0, level: 0 }, '2026-10-30');
    expect(zero.newBest).toBe(false);
    expect(zero.record.days['2026-10-30']).toEqual({ memory: 1 });
    expect(recordBrainSession(emptyBrainRecord(), 'warp', { value: 9, level: 9 }, '2026-10-30').record.best).toEqual({});
  });

  test('スピード計算は段ごとに記録し、小さいほど良い', () => {
    let { record, newBest } = recordBrainSession(emptyBrainRecord(), 'speed', { value: 2100, level: 1, recordId: 'speed-1', extraLevels: { 'speed-slow': 1 } }, '2026-10-30');
    expect(newBest).toBe(true);
    expect(record.best['speed-1']).toBe(2100);
    expect(record.levels).toEqual({ speed: 1, 'speed-slow': 1 });
    ({ record, newBest } = recordBrainSession(record, 'speed', { value: 2400, level: 1, recordId: 'speed-1' }, '2026-10-30'));
    expect(newBest).toBe(false);
    expect(record.days['2026-10-30']['speed-1']).toBe(2100);
    ({ record, newBest } = recordBrainSession(record, 'speed', { value: 1800, level: 2, recordId: 'speed-1' }, '2026-10-31'));
    expect(newBest).toBe(true);
    expect(growthSince(record, 'speed-1', '2026-10-31')).toEqual({ previous: 2100, today: 1800, grew: true });
    expect(dailySeries(record, 'speed-1').map(({ value }) => value)).toEqual([2100, 1800]);
  });

  test('日ごとの記録は決めた日数だけ残す', () => {
    let record = emptyBrainRecord();
    for (let day = 1; day <= BRAIN_DAYS_KEPT + 10; day += 1) {
      const date = new Date(2026, 0, day, 12);
      record = recordBrainSession(record, 'glance', { value: day, level: 1 }, dayKey(date)).record;
    }
    expect(Object.keys(record.days)).toHaveLength(BRAIN_DAYS_KEPT);
    expect(dailySeries(record, 'glance').at(-1).value).toBe(BRAIN_DAYS_KEPT + 10);
  });

  test('判子とカレンダー。6週間を日曜はじまりで並べる', () => {
    let record = stampRoom(emptyBrainRecord(), 'memory', '2026-10-29');
    record = recordBrainSession(record, 'nback', { value: 2, level: 2 }, '2026-10-31').record;
    expect(stamped(record, '2026-10-29', 'memory')).toBe(true);
    expect(stamped(record, '2026-10-29', 'calc')).toBe(false);
    expect(stamped(record, '2026-10-31')).toBe(true);
    const weeks = stampCalendar(record, '2026-10-31');
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(new Date(`${weeks[0][0].day}T12:00:00`).getDay()).toBe(0);
    const today = weeks.flat().find((cell) => cell.today);
    expect(today).toMatchObject({ day: '2026-10-31', calc: true, memory: false, future: false });
    expect(weeks.flat().find((cell) => cell.day === '2026-10-29').memory).toBe(true);
    expect(stampRoom(record, 'nope', '2026-10-31')).toBe(record);
  });

  test('前の日より伸びたか', () => {
    let record = recordBrainSession(emptyBrainRecord(), 'glance', { value: 4, level: 4 }, '2026-10-28').record;
    expect(growthSince(record, 'glance', '2026-10-28')).toBeNull();
    record = recordBrainSession(record, 'glance', { value: 6, level: 6 }, '2026-10-30').record;
    expect(growthSince(record, 'glance', '2026-10-30')).toEqual({ previous: 4, today: 6, grew: true });
    expect(growthSince(record, 'mental', '2026-10-30')).toBeNull();
  });

  test('続けた日数は今日か昨日から数え、途切れたら0から', () => {
    let record = emptyBrainRecord();
    for (const day of ['2026-10-27', '2026-10-28', '2026-10-29']) record = stampRoom(record, 'calc', day);
    expect(brainStreak(record, '2026-10-29')).toBe(3);
    expect(brainStreak(record, '2026-10-30')).toBe(3);
    expect(brainStreak(record, '2026-11-01')).toBe(0);
  });

  test('保存と、壊れた値を捨てる読み込み', () => {
    const storage = memoryStorage();
    expect(loadBrainRecord(storage)).toEqual(emptyBrainRecord());
    let record = recordBrainSession(emptyBrainRecord(), 'glance', { value: 3, level: 2 }, '2026-10-30').record;
    record = rememberRoom(record, 'calc');
    saveBrainRecord(storage, record);
    const loaded = loadBrainRecord(storage);
    expect(loaded.best).toEqual({ glance: 3 });
    expect(loaded.days['2026-10-30']).toEqual({ glance: 3, calc: 1 });
    expect(loaded.room).toBe('calc');
    expect(loadBrainRecord(memoryStorage({ [BRAIN_TRAINING_KEY]: '{' }))).toEqual(emptyBrainRecord());
    expect(loadBrainRecord(memoryStorage({ [BRAIN_TRAINING_KEY]: JSON.stringify({ version: 3 }) }))).toEqual(emptyBrainRecord());
    const odd = loadBrainRecord(memoryStorage({ [BRAIN_TRAINING_KEY]: JSON.stringify({ version: 2, room: 'gym', levels: { glance: -1, warp: 3, mental: 2, 'speed-slow': 1 }, best: { 'speed-9': 3, 'speed-2': 1500 }, days: { nope: { glance: 1 }, '2026-10-01': { glance: 'x' } }, program: { calc: { sessions: 3 } } }) }));
    expect(odd.levels).toEqual({ mental: 2, 'speed-slow': 1 });
    expect(odd.best).toEqual({ 'speed-2': 1500 });
    expect(odd.days).toEqual({});
    expect(odd.room).toBe('');
    expect(odd.program.calc.sessions).toBe(3);
    // 保存できない環境でも投げない。
    expect(() => saveBrainRecord({ setItem() { throw new Error('full'); } }, record)).not.toThrow();
  });

  test('版1の記録は将棋の棚の記録として残り、練習した日に部屋の判子が押される', () => {
    const v1 = {
      version: 1,
      levels: { glance: 6, palace: 9, mental: 3 },
      best: { glance: 7, 'board-memory': 12 },
      days: { '2026-10-30': { glance: 7, today: 1 }, '2026-10-31': { palace: 9 } },
      palace: { lessons: ['walk'], custom: [] },
    };
    const migrated = migrateBrainRecordV1(v1);
    expect(migrated.version).toBe(2);
    expect(migrated.levels).toEqual({ glance: 6, palace: 9, mental: 3 });
    expect(migrated.best).toEqual({ glance: 7, 'board-memory': 12 });
    expect(migrated.days).toEqual({ '2026-10-30': { glance: 7, calc: 1 }, '2026-10-31': { palace: 9, memory: 1 } });
    // 版2がなければ版1を読み、版2があれば版1は読まない。
    const storage = memoryStorage({ [BRAIN_TRAINING_V1_KEY]: JSON.stringify(v1) });
    expect(loadBrainRecord(storage).best.glance).toBe(7);
    saveBrainRecord(storage, emptyBrainRecord());
    expect(loadBrainRecord(storage).best).toEqual({});
    expect(migrateBrainRecordV1({ version: 2 })).toEqual(emptyBrainRecord());
  });
});

describe('ちらっと盤', () => {
  test('同じ種と段なら同じ問題。玉は真ん中から4マスの8方向のどれか', () => {
    expect(glanceProblem(42, 3)).toEqual(glanceProblem(42, 3));
    const center = fileRankOf(GLANCE_CENTER);
    const seen = new Set();
    for (let seed = 1; seed <= 200; seed += 1) {
      const problem = glanceProblem(seed, 0);
      const king = fileRankOf(problem.king);
      const direction = GLANCE_DIRECTIONS.find(({ id }) => id === problem.direction);
      expect(king.file - center.file).toBe(direction.dx);
      expect(king.rank - center.rank).toBe(direction.dy);
      expect(['G', 'S']).toContain(problem.center);
      seen.add(problem.direction);
    }
    expect(seen.size).toBe(8);
  });

  test('じゃまの駒は段どおりの数で、真ん中のまわりと玉に重ならない', () => {
    for (let level = 0; level <= GLANCE_MAX_LEVEL; level += 1) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const problem = glanceProblem(seed, level);
        expect(problem.distractors).toHaveLength(GLANCE_LEVELS[level].distractors);
        expect(new Set(problem.distractors).size).toBe(problem.distractors.length);
        for (const square of problem.distractors) {
          expect(square).not.toBe(problem.king);
          const { file, rank } = fileRankOf(square);
          expect(Math.max(Math.abs(file - 5), Math.abs(rank - 5))).toBeGreaterThan(1);
        }
      }
    }
  });

  test('見せる時間は、じゃまの駒が同じあいだは段ごとに短くなる', () => {
    for (let level = 1; level <= GLANCE_MAX_LEVEL; level += 1) {
      const [before, now] = [GLANCE_LEVELS[level - 1], GLANCE_LEVELS[level]];
      if (before.distractors === now.distractors) expect(now.ms).toBeLessThan(before.ms);
      else expect(now.distractors).toBeGreaterThan(before.distractors);
    }
    expect(glanceLevelLabel(0)).toBe('0.8秒');
    expect(glanceLevelLabel(7)).toBe('0.12秒');
    expect(glanceLevelLabel(GLANCE_MAX_LEVEL)).toBe('0.05秒（じゃま駒8枚）');
  });

  test('採点は両方合えば正解', () => {
    const problem = glanceProblem(7, 2);
    expect(scoreGlance(problem, { center: problem.center, direction: problem.direction }).correct).toBe(true);
    expect(scoreGlance(problem, { center: problem.center === 'G' ? 'S' : 'G', direction: problem.direction })).toEqual({ centerOk: false, directionOk: true, correct: false });
  });

  test('出ていた時間が約束と1コマ以上違えば数えない', () => {
    expect(glanceTimingValid(100, 100)).toBe(true);
    expect(glanceTimingValid(100, 116)).toBe(true);
    expect(glanceTimingValid(50, 84)).toBe(false);
    expect(glanceTimingValid(100, Number.NaN)).toBe(false);
  });

  test('1回の記録は、2問続けて正解したいちばん上の段', () => {
    const trials = [
      { level: 2, correct: true, counted: true },
      { level: 2, correct: true, counted: true },
      { level: 3, correct: true, counted: true },
      { level: 3, correct: false, counted: true },
      { level: 2, correct: true, counted: false },
      { level: 2, correct: true, counted: true },
    ];
    expect(glanceSummary(trials)).toEqual({ bestLevel: 3, correct: 4, total: 5, value: 4 });
    expect(glanceSummary([{ level: 0, correct: false, counted: true }]).value).toBe(0);
  });
});
