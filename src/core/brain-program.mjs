// 脳トレの毎日のプログラム(docs/brain-training-design.mdの11-5・11-6)。
// 部屋ごとに、コースの回・測定の前と後・おさらい(ブースター)の時期・今日の分を決める。
// 画面と保存の仕組みに依存しない。日付は'YYYY-MM-DD'(brain-training.mjsのdayKey)。

/** 計算力のコースの回数。10回目の終わりに、最初の測定と同じ種目でもう一度測る(11-5)。 */
export const CALC_COURSE_SESSIONS = 10;
/**
 * コースを終えたあとのおさらい。研究の約1年後・約3年後(B10)を、ゲームの中では約1か月後・約3か月後に置き換えた。
 * 勧めるだけで、やらなくても何も消えない(原則2)。
 */
export const CALC_BOOSTERS = Object.freeze([
  Object.freeze({ afterDays: 30, sessions: 4, label: '1か月後のおさらい' }),
  Object.freeze({ afterDays: 90, sessions: 4, label: '3か月後のおさらい' }),
]);
/** 測定の種目。前と後で同じ条件(スピード計算は段1、ほかは同じ段から)で測る。 */
export const CALC_MEASURE = Object.freeze(['speed', 'nback', 'glance-sym']);
/** 記憶力のコース。研究の練習(約6週間、毎日。B12)に合わせ、6週間・週5回を目安にする(11-6)。 */
export const MEMORY_COURSE_WEEKS = 6;
export const MEMORY_COURSE_SESSIONS = 30;
/** 記憶テストの言葉の数と、覚える時間。 */
export const MEMORY_TEST_WORDS = 15;
export const MEMORY_TEST_SECONDS = 60;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function cleanDay(value) {
  return typeof value === 'string' && DAY_PATTERN.test(value) ? value : '';
}
function cleanCount(value, max) {
  return Number.isFinite(value) && value >= 0 ? Math.min(max, Math.floor(value)) : 0;
}
function cleanValues(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  for (const [id, number] of Object.entries(value)) {
    if (typeof id === 'string' && id.length <= 20 && Number.isFinite(number) && number >= 0) result[id] = Math.round(number);
  }
  return result;
}
function cleanMeasure(value) {
  if (!isPlainObject(value)) return null;
  const day = cleanDay(value.day);
  if (!day) return null;
  return { day, label: typeof value.label === 'string' ? value.label.slice(0, 30) : '', values: cleanValues(value.values) };
}

/** 2つの日付の間の日数(toがあとなら正)。 */
export function daysBetween(from, to) {
  const toUtc = (day) => {
    const [year, month, date] = day.split('-').map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

/** 日付に日数を足す。 */
export function addDays(day, count) {
  const [year, month, date] = day.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + count));
  const pad = (number) => String(number).padStart(2, '0');
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

// ===== 計算力 =====

export function emptyCalcProgram() {
  return { before: null, sessions: 0, lastDay: '', finishedDay: '', boosters: CALC_BOOSTERS.map(() => 0), after: [] };
}

/** 保存から読んだ計算力のプログラムを整える。形が違う値は捨てる。 */
export function cleanCalcProgram(value) {
  const program = emptyCalcProgram();
  if (!isPlainObject(value)) return program;
  program.before = cleanMeasure(value.before);
  program.sessions = cleanCount(value.sessions, CALC_COURSE_SESSIONS);
  program.lastDay = cleanDay(value.lastDay);
  program.finishedDay = program.sessions >= CALC_COURSE_SESSIONS ? cleanDay(value.finishedDay) : '';
  if (Array.isArray(value.boosters)) program.boosters = CALC_BOOSTERS.map((booster, index) => cleanCount(value.boosters[index], booster.sessions));
  if (Array.isArray(value.after)) program.after = value.after.map(cleanMeasure).filter(Boolean).slice(0, 1 + CALC_BOOSTERS.length);
  return program;
}

/** コースの1回の種目。速さの種目(ちらっと見る・スピード計算)を毎回入れ、N問前の答えと色で切り替えを日替わりで1つ(原則1)。 */
export function calcCourseGames(session) {
  return ['glance-sym', 'speed', session % 2 === 1 ? 'nback' : 'switch'];
}

/**
 * いま勧めるおさらい。コースを終えた日から数えて、時期の来たいちばん新しいおさらいで、まだ4回終えていないもの。
 * @returns {{ index: number, afterDays: number, sessions: number, label: string, done: number } | null}
 */
export function calcBoosterDue(program, day) {
  if (program.sessions < CALC_COURSE_SESSIONS || !program.finishedDay) return null;
  const elapsed = daysBetween(program.finishedDay, day);
  let index = -1;
  CALC_BOOSTERS.forEach((booster, at) => {
    if (elapsed >= booster.afterDays) index = at;
  });
  if (index < 0) return null;
  const booster = CALC_BOOSTERS[index];
  const done = program.boosters[index] ?? 0;
  return done >= booster.sessions ? null : { index, ...booster, done };
}

/** 次のおさらいが始まる日(もう全部の時期が来ていればnull)。入口の札の「○月○日ごろ」に使う。 */
export function calcNextBoosterDay(program, day) {
  if (program.sessions < CALC_COURSE_SESSIONS || !program.finishedDay) return null;
  const elapsed = daysBetween(program.finishedDay, day);
  const next = CALC_BOOSTERS.find((booster) => booster.afterDays > elapsed);
  return next ? addDays(program.finishedDay, next.afterDays) : null;
}

/**
 * 今日の計算力のトレーニング。gamesは{ id, mode }の並び(modeは'train'か'measure')。
 * countedは、プログラムの回を進めるか(1日1回だけ。2回目からは自由練習。原則4)。
 * @param {ReturnType<typeof emptyCalcProgram>} program
 * @param {string} day
 */
export function planCalcToday(program, day) {
  const measure = CALC_MEASURE.map((id) => ({ id, mode: 'measure' }));
  const train = (session) => calcCourseGames(session).map((id) => ({ id, mode: 'train' }));
  const counted = program.lastDay !== day;
  if (!program.before) {
    return { kind: 'measure', counted: true, session: 0, total: 0, games: measure, measure: 'before', label: '最初の測定' };
  }
  const parity = Number(day.slice(-2));
  if (!counted) return { kind: 'free', counted: false, session: 0, total: 0, games: train(parity), measure: null, label: '自由練習' };
  if (program.sessions < CALC_COURSE_SESSIONS) {
    const session = program.sessions + 1;
    const last = session === CALC_COURSE_SESSIONS;
    return {
      kind: 'course',
      counted: true,
      session,
      total: CALC_COURSE_SESSIONS,
      games: last ? [...train(session), ...measure] : train(session),
      measure: last ? 'after' : null,
      label: `コース ${session}/${CALC_COURSE_SESSIONS}`,
    };
  }
  const booster = calcBoosterDue(program, day);
  if (booster) {
    const session = booster.done + 1;
    const last = session === booster.sessions;
    return {
      kind: 'booster',
      counted: true,
      session,
      total: booster.sessions,
      booster: booster.index,
      games: last ? [...train(session), ...measure] : train(session),
      measure: last ? 'booster' : null,
      label: `${booster.label} ${session}/${booster.sessions}`,
    };
  }
  return { kind: 'free', counted: true, session: 0, total: 0, games: train(parity), measure: null, label: 'いつもの練習' };
}

/**
 * 今日のトレーニングを最後まで終えたとき、プログラムを進める。measureValuesは測定の種目の記録(speedはミリ秒)。
 * 途中でやめた回は呼ばない(その回は次にもう一度)。
 */
export function completeCalcPlan(program, plan, measureValues, day) {
  if (!plan.counted) return program;
  const next = { ...program, boosters: [...program.boosters], after: [...program.after], lastDay: day };
  const values = cleanValues(measureValues);
  if (plan.kind === 'measure') {
    next.before = { day, label: '最初', values };
    return next;
  }
  if (plan.kind === 'course') {
    next.sessions = Math.min(CALC_COURSE_SESSIONS, program.sessions + 1);
    if (plan.measure === 'after') {
      next.after.push({ day, label: 'コースの後', values });
      next.finishedDay = day;
    }
    return next;
  }
  if (plan.kind === 'booster') {
    const booster = CALC_BOOSTERS[plan.booster];
    next.boosters[plan.booster] = Math.min(booster.sessions, (program.boosters[plan.booster] ?? 0) + 1);
    if (plan.measure === 'booster') next.after.push({ day, label: `${booster.label}の後`, values });
  }
  return next;
}

/** 入口の札の一言(コースの何回目か・おさらいの時期・修了)。 */
export function calcProgress(program, day) {
  if (!program.before) return { text: 'はじめに、いまの力を測ろう', step: 0, total: CALC_COURSE_SESSIONS, done: false };
  if (program.sessions < CALC_COURSE_SESSIONS) {
    return { text: `コース ${program.sessions}/${CALC_COURSE_SESSIONS}`, step: program.sessions, total: CALC_COURSE_SESSIONS, done: false };
  }
  const booster = calcBoosterDue(program, day);
  if (booster) return { text: `おさらいの時期だよ（${booster.done}/${booster.sessions}）`, step: booster.done, total: booster.sessions, done: true, booster: true };
  return { text: 'コース修了', step: CALC_COURSE_SESSIONS, total: CALC_COURSE_SESSIONS, done: true };
}

// ===== 記憶力 =====

export function emptyMemoryProgram() {
  return { before: null, sessions: 0, lastDay: '', after: [] };
}

function cleanTest(value) {
  if (!isPlainObject(value)) return null;
  const day = cleanDay(value.day);
  if (!day || !Number.isFinite(value.correct) || !Number.isFinite(value.total) || value.total <= 0) return null;
  const total = Math.min(99, Math.floor(value.total));
  return { day, correct: Math.max(0, Math.min(total, Math.floor(value.correct))), total };
}

export function cleanMemoryProgram(value) {
  const program = emptyMemoryProgram();
  if (!isPlainObject(value)) return program;
  program.before = cleanTest(value.before);
  program.sessions = cleanCount(value.sessions, MEMORY_COURSE_SESSIONS);
  program.lastDay = cleanDay(value.lastDay);
  if (Array.isArray(value.after)) program.after = value.after.map(cleanTest).filter(Boolean).slice(0, 3);
  return program;
}

/**
 * 今日の記憶力のトレーニング。方法を教える前に記憶テスト → 宮殿づくり → 学校の講(講3まで) → 毎日の練習、の順(11-6)。
 * 6週間のコースを終えたら、最初と同じ記憶テストをもう一度。
 * @param {{ program: ReturnType<typeof emptyMemoryProgram>, hasPalace: boolean, practiceOpen: boolean, nextLesson: string | null, day: string }} input
 */
export function planMemoryToday({ program, hasPalace, practiceOpen, nextLesson, day }) {
  const counted = program.lastDay !== day;
  if (!program.before) return { kind: 'test', measure: 'before', counted, label: '最初の記憶テスト' };
  if (!hasPalace) return { kind: 'build', measure: null, counted, label: '自分の宮殿を作る' };
  if (!practiceOpen && nextLesson) return { kind: 'lesson', lessonId: nextLesson, measure: null, counted, label: '学校' };
  if (program.sessions >= MEMORY_COURSE_SESSIONS && !program.after.length) {
    return { kind: 'test', measure: 'after', counted, label: 'コースの後の記憶テスト' };
  }
  const session = counted && program.sessions < MEMORY_COURSE_SESSIONS ? program.sessions + 1 : 0;
  return { kind: 'practice', measure: null, counted, session, label: session ? `6週間コース ${session}/${MEMORY_COURSE_SESSIONS}` : '毎日の練習' };
}

/** 毎日の練習を終えたとき。コースの回は1日1回だけ進む。 */
export function completeMemoryPractice(program, day) {
  if (program.lastDay === day) return program;
  return { ...program, sessions: Math.min(MEMORY_COURSE_SESSIONS, program.sessions + 1), lastDay: day };
}

/** 記憶テストの結果を残す。最初の1回は「前」、コースのあとは「後」。 */
export function recordMemoryTest(program, measure, score, day) {
  const test = cleanTest({ day, correct: score.correct, total: score.total });
  if (!test) return program;
  if (measure === 'before') return program.before ? program : { ...program, before: test, lastDay: day };
  if (measure === 'after') return { ...program, after: [...program.after, test].slice(-3), lastDay: day };
  return program;
}

/** 入口の札の一言。 */
export function memoryProgress(program, { hasPalace, practiceOpen, lessonsDone }) {
  if (!program.before) return { text: 'はじめに、いまの記憶を測ろう', step: 0, total: MEMORY_COURSE_SESSIONS };
  if (!hasPalace) return { text: '自分の宮殿を作ろう', step: 0, total: MEMORY_COURSE_SESSIONS };
  if (!practiceOpen) return { text: `学校 講${lessonsDone + 1}`, step: 0, total: MEMORY_COURSE_SESSIONS };
  if (program.sessions >= MEMORY_COURSE_SESSIONS) return { text: program.after.length ? '6週間コース修了' : 'もう一度、記憶テスト', step: MEMORY_COURSE_SESSIONS, total: MEMORY_COURSE_SESSIONS };
  return { text: `6週間コース ${program.sessions}/${MEMORY_COURSE_SESSIONS}`, step: program.sessions, total: MEMORY_COURSE_SESSIONS };
}
