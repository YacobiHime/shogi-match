// 脳トレ道場を続けるための決まり(docs/brain-training-design.mdの14-4の柱1〜3、14-9)。画面と保存の仕組みに依存しない。
// 今週の判子(月曜はじまり)・週の目安・目安に届いた週・今日のおすすめの部屋・いつ稽古するか・次の目標の1行。
// 毎日の連続は数えない(1日休んでも大丈夫。14-3のB30、D:9-2)。

import { BRAIN_CUE_IDS, lowerIsBetter, stamped } from './brain-training.mjs';
import { CALC_BOOSTERS, CALC_COURSE_SESSIONS, MEMORY_COURSE_SESSIONS, addDays, calcBoosterDue, calcNextBoosterDay } from './brain-program.mjs';

/** 週の目安(11-2の原則4)。計算力は週3回、記憶力は6週間コースのあいだ週5回、コースのあとは週3回。 */
export const WEEK_TARGETS = Object.freeze({ calc: 3, memory: 5, memoryAfterCourse: 3 });
const WEEKDAY_LABELS = Object.freeze(['月', '火', '水', '木', '金', '土', '日']);

/** いつ稽古するか(実行意図。14-3のB29)。「決めない」も選べる。 */
export const CUE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'morning', label: '朝ごはんのあと', short: '朝ごはんのあと' }),
  Object.freeze({ id: 'lunch', label: '昼休み', short: '昼休み' }),
  Object.freeze({ id: 'evening', label: '夕ごはんのあと', short: '夕ごはんのあと' }),
  Object.freeze({ id: 'bed', label: '寝る前', short: '寝る前' }),
  Object.freeze({ id: 'match', label: '対局の前', short: '対局の前' }),
  Object.freeze({ id: 'none', label: '決めない', short: '' }),
]);
const CUE_IDS = new Set(BRAIN_CUE_IDS);

/** 保存から読んだ「いつ稽古するか」を整える。知らない値は空(まだ決めていない)。 */
export function cleanCue(value) {
  return typeof value === 'string' && CUE_IDS.has(value) ? value : '';
}

/** 入口に出す「⏰ 寝る前に稽古する」の言葉。決めていない・決めないなら空。 */
export function cueText(cue) {
  const option = CUE_OPTIONS.find(({ id }) => id === cue);
  return option?.short ? `${option.short}に稽古する` : '';
}

function weekdayIndex(day) {
  const [year, month, date] = day.split('-').map(Number);
  return (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
}

/** その日を含む週の月曜日。 */
export function weekStart(day) {
  return addDays(day, -weekdayIndex(day));
}

/**
 * 今週の7日(月曜はじまり)。それぞれに判子(計算力・記憶力)と、今日・これからの日の印。
 * @param {{ days: Record<string, Record<string, number>> }} record
 * @param {string} day
 */
export function weekStrip(record, day) {
  const start = weekStart(day);
  return WEEKDAY_LABELS.map((weekday, index) => {
    const key = addDays(start, index);
    return {
      day: key,
      weekday,
      date: Number(key.slice(8)),
      calc: stamped(record, key, 'calc'),
      memory: stamped(record, key, 'memory'),
      today: key === day,
      future: key > day,
    };
  });
}

/** 記憶力の週の目安(6週間コースのあいだは5、コースのあとは3)。 */
export function memoryTarget(memoryProgram) {
  return (memoryProgram?.sessions ?? 0) >= MEMORY_COURSE_SESSIONS ? WEEK_TARGETS.memoryAfterCourse : WEEK_TARGETS.memory;
}

/**
 * その週に判子のある日の数と、目安。自由練習の日も数える(習慣の目安のため)。
 * @returns {{ calc: { done: number, target: number }, memory: { done: number, target: number } }}
 */
export function weekCounts(record, day) {
  const strip = weekStrip(record, day);
  return {
    calc: { done: strip.filter((cell) => cell.calc).length, target: WEEK_TARGETS.calc },
    memory: { done: strip.filter((cell) => cell.memory).length, target: memoryTarget(record.program?.memory) },
  };
}

/**
 * 目安に届いた週の数(記録の残る日のうち、計算力か記憶力のどちらかが目安に届いた週)。途切れても消えない数(14-4の柱2)。
 * 今週は、目安に届いていれば数える。
 */
export function metWeeks(record, day) {
  const starts = new Set(Object.keys(record.days ?? {}).filter((key) => key <= day).map(weekStart));
  let count = 0;
  for (const start of starts) {
    const counts = weekCounts(record, start);
    if (counts.calc.done >= counts.calc.target || counts.memory.done >= counts.memory.target) count += 1;
  }
  return count;
}

/**
 * 今日のおすすめの部屋(14-9)。
 * 1. 今日まだ判子のない部屋だけ。2つとも押してあれば null(今日の稽古はおしまい)。
 * 2. 時期の来たものがある部屋を先に(計算力のおさらい・記憶力の思い出しの箱や講7)。
 * 3. 今週の目安に対して、残りの割合が大きい部屋。
 * 4. 同じなら前に選んだ部屋、それもなければ計算力。
 * @param {{ record: any, day: string, memoryDue?: boolean }} input
 * @returns {'calc' | 'memory' | null}
 */
export function todayPick({ record, day, memoryDue = false }) {
  const open = ['calc', 'memory'].filter((room) => !stamped(record, day, room));
  if (!open.length) return null;
  if (open.length === 1) return /** @type {'calc' | 'memory'} */ (open[0]);
  const calcDue = Boolean(calcBoosterDue(record.program.calc, day));
  if (calcDue !== memoryDue) return calcDue ? 'calc' : 'memory';
  const counts = weekCounts(record, day);
  const remain = (room) => Math.max(0, counts[room].target - counts[room].done) / counts[room].target;
  const calcRemain = remain('calc');
  const memoryRemain = remain('memory');
  if (Math.abs(calcRemain - memoryRemain) > 1e-9) return calcRemain > memoryRemain ? 'calc' : 'memory';
  return record.room === 'memory' ? 'memory' : 'calc';
}

function monthDay(day) {
  return `${Number(day.slice(5, 7))}月${Number(day.slice(8))}日`;
}

/**
 * 計算力の次の目標の1行(14-9)。コースの残り → おさらいの時期 → 今週の目安の残り、の順で最初に当てはまるもの。
 * @param {any} record
 * @param {string} day
 */
export function calcNextGoal(record, day) {
  const program = record.program.calc;
  if (!program.before) return '最初の測定で、いまの力を知ろう';
  if (program.sessions < CALC_COURSE_SESSIONS) {
    const left = CALC_COURSE_SESSIONS - program.sessions;
    return `あと${left}回で、最初の自分とくらべる日`;
  }
  const booster = calcBoosterDue(program, day);
  if (booster) return `${booster.label} あと${booster.sessions - booster.done}回`;
  const next = calcNextBoosterDay(program, day);
  if (next) {
    const index = CALC_BOOSTERS.findIndex((item) => addDays(program.finishedDay, item.afterDays) === next);
    return `${index >= 0 ? CALC_BOOSTERS[index].label : 'おさらい'}は${monthDay(next)}ごろから`;
  }
  return weekGoalText(record, day, 'calc');
}

/**
 * 記憶力の次の目標の1行。学校の次の講 → 6週間コースの残り → 思い出しの箱の次の日 → 今週の目安。
 * @param {any} record
 * @param {string} day
 * @param {{ nextLessonTitle?: string, practiceOpen?: boolean, nextBoxDay?: string }} [memory]
 */
export function memoryNextGoal(record, day, memory = {}) {
  const program = record.program.memory;
  if (!program.before) return '最初の記憶テストで、いまの記憶を知ろう';
  if (!memory.practiceOpen && memory.nextLessonTitle) return `次は${memory.nextLessonTitle}`;
  if (program.sessions < MEMORY_COURSE_SESSIONS) {
    return `あと${MEMORY_COURSE_SESSIONS - program.sessions}回で、最初の記憶テストとくらべる日`;
  }
  if (memory.nextBoxDay) return memory.nextBoxDay <= day ? '思い出しの箱が待っているよ' : `思い出しの箱は${monthDay(memory.nextBoxDay)}`;
  return weekGoalText(record, day, 'memory');
}

function weekGoalText(record, day, room) {
  const counts = weekCounts(record, day)[room];
  const left = counts.target - counts.done;
  return left > 0 ? `今週の目安まで、あと${left}回` : '今週の目安に届いたよ';
}

/**
 * 今日の記録を前の日の記録とくらべる(成績表の「前より0.3秒速い」。14-4の柱5)。
 * kindは'up'(伸びた)・'same'(同じ)・'prev'(前の値を並べるだけ。下がったと責めない。G:6-2)。前の記録がなければnull。
 * スピード計算(小さいほど良い)は、50ms未満の差を「同じくらい」とし、速くなった秒数(0.1秒単位)をdiffSecondsに入れる。
 * @param {string} recordId
 * @param {number} value
 * @param {number | null | undefined} previous
 * @returns {{ kind: 'up' | 'same' | 'prev', diffSeconds: number } | null}
 */
export function compareRecord(recordId, value, previous) {
  if (!Number.isFinite(previous) || !Number.isFinite(value) || !value || !previous) return null;
  // 数独は解いた秒(16-7)。3秒より小さい差は「前と同じくらい」。
  if (recordId.startsWith('sudoku-')) {
    const diff = /** @type {number} */ (previous) - value;
    if (Math.abs(diff) < 3) return { kind: 'same', diffSeconds: 0 };
    return diff > 0 ? { kind: 'up', diffSeconds: diff } : { kind: 'prev', diffSeconds: 0 };
  }
  if (lowerIsBetter(recordId)) {
    const diff = /** @type {number} */ (previous) - value;
    if (Math.abs(diff) < 50) return { kind: 'same', diffSeconds: 0 };
    return diff > 0 ? { kind: 'up', diffSeconds: Math.max(0.1, Math.round(diff / 100) / 10) } : { kind: 'prev', diffSeconds: 0 };
  }
  if (value === previous) return { kind: 'same', diffSeconds: 0 };
  return value > /** @type {number} */ (previous) ? { kind: 'up', diffSeconds: 0 } : { kind: 'prev', diffSeconds: 0 };
}
