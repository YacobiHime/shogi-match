import { describe, expect, test } from 'vitest';

import {
  BRAIN_DAYS_KEPT,
  BRAIN_TRAINING_KEY,
  brainStreak,
  dailySeries,
  dayKey,
  emptyBrainRecord,
  growthSince,
  loadBrainRecord,
  markTodayDone,
  nextStair,
  recordBrainSession,
  saveBrainRecord,
  startLevel,
  todayDone,
  todayMenu,
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

  test('1回の結果で、自己ベストと日ごとの記録と次の段を残す', () => {
    let { record, newBest } = recordBrainSession(emptyBrainRecord(), 'glance', { value: 5, level: 6 }, '2026-10-30');
    expect(newBest).toBe(true);
    expect(record.best.glance).toBe(5);
    expect(record.levels.glance).toBe(6);
    expect(record.days['2026-10-30'].glance).toBe(5);
    ({ record, newBest } = recordBrainSession(record, 'glance', { value: 3, level: 4 }, '2026-10-30'));
    expect(newBest).toBe(false);
    expect(record.best.glance).toBe(5);
    expect(record.days['2026-10-30'].glance).toBe(5);
    expect(record.levels.glance).toBe(4);
    // 記録0は自己ベストにしない。知らない種目は無視する。
    expect(recordBrainSession(emptyBrainRecord(), 'glance', { value: 0, level: 0 }, '2026-10-30').newBest).toBe(false);
    expect(recordBrainSession(emptyBrainRecord(), 'warp', { value: 9, level: 9 }, '2026-10-30').record.best).toEqual({});
  });

  test('日ごとの記録は30日分だけ残す', () => {
    let record = emptyBrainRecord();
    for (let day = 1; day <= 40; day += 1) {
      const date = new Date(2026, 8, day, 12);
      record = recordBrainSession(record, 'glance', { value: day, level: 1 }, dayKey(date)).record;
    }
    expect(Object.keys(record.days)).toHaveLength(BRAIN_DAYS_KEPT);
    expect(dailySeries(record, 'glance').at(-1).value).toBe(40);
  });

  test('今日の3種目を終えた印', () => {
    const record = markTodayDone(emptyBrainRecord(), '2026-10-30');
    expect(todayDone(record, '2026-10-30')).toBe(true);
    expect(todayDone(record, '2026-10-31')).toBe(false);
  });

  test('今日の3種目は遊べる種目から並べ、場所法は日替わりで入れ替える', () => {
    expect(todayMenu({ available: ['glance'], day: '2026-10-30' })).toEqual(['glance']);
    const all = ['glance', 'board-memory', 'mental', 'palace'];
    expect(todayMenu({ available: all, day: '2026-10-30' })).toEqual(['glance', 'board-memory', 'mental']);
    expect(todayMenu({ available: all, palaceOpen: true, day: '2026-10-30' })).toEqual(['glance', 'board-memory', 'mental']);
    expect(todayMenu({ available: all, palaceOpen: true, day: '2026-10-31' })).toEqual(['glance', 'palace', 'mental']);
    expect(todayMenu({ available: all, palaceOpen: true, day: '2026-10-29' })).toEqual(['glance', 'board-memory', 'palace']);
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
    for (const day of ['2026-10-27', '2026-10-28', '2026-10-29']) record = markTodayDone(record, day);
    expect(brainStreak(record, '2026-10-29')).toBe(3);
    expect(brainStreak(record, '2026-10-30')).toBe(3);
    expect(brainStreak(record, '2026-11-01')).toBe(0);
  });

  test('保存と、壊れた値を捨てる読み込み', () => {
    const storage = memoryStorage();
    expect(loadBrainRecord(storage)).toEqual(emptyBrainRecord());
    let record = recordBrainSession(emptyBrainRecord(), 'glance', { value: 3, level: 2 }, '2026-10-30').record;
    record = markTodayDone(record, '2026-10-30');
    record.palace.custom = ['玄関', '  ', '台所'];
    saveBrainRecord(storage, record);
    const loaded = loadBrainRecord(storage);
    expect(loaded.best).toEqual({ glance: 3 });
    expect(loaded.days['2026-10-30']).toEqual({ glance: 3, today: 1 });
    expect(loaded.palace.custom).toEqual(['玄関', '台所']);
    expect(loadBrainRecord(memoryStorage({ [BRAIN_TRAINING_KEY]: '{' }))).toEqual(emptyBrainRecord());
    expect(loadBrainRecord(memoryStorage({ [BRAIN_TRAINING_KEY]: JSON.stringify({ version: 2 }) }))).toEqual(emptyBrainRecord());
    const odd = loadBrainRecord(memoryStorage({ [BRAIN_TRAINING_KEY]: JSON.stringify({ version: 1, levels: { glance: -1, warp: 3, mental: 2 }, days: { nope: { glance: 1 }, '2026-10-01': { glance: 'x' } } }) }));
    expect(odd.levels).toEqual({ mental: 2 });
    expect(odd.days).toEqual({});
    // 保存できない環境でも投げない。
    expect(() => saveBrainRecord({ setItem() { throw new Error('full'); } }, record)).not.toThrow();
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
