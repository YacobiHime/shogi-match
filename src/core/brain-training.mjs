// 脳トレ道場の記録・難しさの階段・今日の3種目(docs/brain-training-design.mdの3章・6章)。画面に依存しない。

/** 脳トレの記録の鍵。読めない値は捨てて、初めからにする。 */
export const BRAIN_TRAINING_KEY = 'yacobihime:shogi-match:brain-training:v1';
/** 日ごとの記録を残す日数。 */
export const BRAIN_DAYS_KEPT = 30;

/**
 * 種目。valueは記録の比べ方(大きいほど良い)。shortは今日の3種目で遊ぶ短い版の問題の数、fullはふつうの1回の問題の数。
 * 種目の中身(問題の作り方)は種目ごとのモジュール(brain-glance.mjsなど)にある。
 */
export const BRAIN_GAMES = Object.freeze([
  { id: 'glance', label: 'ちらっと盤', short: 8, full: 16 },
  { id: 'board-memory', label: '盤面の記憶', short: 3, full: 5 },
  { id: 'mental', label: '頭の中の盤', short: 4, full: 8 },
  { id: 'palace', label: '記憶の宮殿', short: 1, full: 1 },
]);
const GAME_IDS = new Set(BRAIN_GAMES.map(({ id }) => id));

export function emptyBrainRecord() {
  return { version: 1, levels: {}, best: {}, days: {}, palace: { lessons: [], custom: [] } };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanNumberMap(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  for (const [id, number] of Object.entries(value)) {
    if (GAME_IDS.has(id) && Number.isFinite(number) && number >= 0) result[id] = Math.floor(number);
  }
  return result;
}

/** 記録を読む。形が違う値は捨てる。 */
export function loadBrainRecord(storage) {
  let parsed = null;
  try {
    parsed = JSON.parse(storage?.getItem(BRAIN_TRAINING_KEY) ?? 'null');
  } catch {
    parsed = null;
  }
  const record = emptyBrainRecord();
  if (!isPlainObject(parsed) || parsed.version !== 1) return record;
  record.levels = cleanNumberMap(parsed.levels);
  record.best = cleanNumberMap(parsed.best);
  if (isPlainObject(parsed.days)) {
    for (const [day, games] of Object.entries(parsed.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isPlainObject(games)) continue;
      const cleaned = cleanNumberMap(games);
      if (games.today === 1 || games.today === true) cleaned.today = 1;
      if (Object.keys(cleaned).length) record.days[day] = cleaned;
    }
  }
  if (isPlainObject(parsed.palace)) {
    const lessons = Array.isArray(parsed.palace.lessons) ? parsed.palace.lessons : [];
    record.palace.lessons = [...new Set(lessons.filter((id) => typeof id === 'string' && id.length <= 40))];
    const custom = Array.isArray(parsed.palace.custom) ? parsed.palace.custom : [];
    record.palace.custom = custom.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim().slice(0, 20)).slice(0, 30);
  }
  return record;
}

/** 記録を残す。保存できなくても遊べる。 */
export function saveBrainRecord(storage, record) {
  try {
    storage?.setItem(BRAIN_TRAINING_KEY, JSON.stringify(record));
  } catch {
    // 保存できない環境でも、その場では遊べる。
  }
}

/** 端末の暦での日付(YYYY-MM-DD)。 */
export function dayKey(date = new Date()) {
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 難しさの階段(2-up-1-down)。続けて正解がupAfter回で1段上、1回まちがえで1段下。
 * 正答率およそ7割のところに落ち着く(3-1)。
 * @param {{ level: number, streak: number }} state
 * @param {boolean} correct
 * @param {{ min?: number, max: number, upAfter?: number }} limits
 * @returns {{ level: number, streak: number, moved: -1 | 0 | 1 }}
 */
export function nextStair(state, correct, limits) {
  const { min = 0, max, upAfter = 2 } = limits;
  if (!correct) {
    const level = Math.max(min, state.level - 1);
    return { level, streak: 0, moved: level < state.level ? -1 : 0 };
  }
  const streak = state.streak + 1;
  if (streak < upAfter) return { level: state.level, streak, moved: 0 };
  const level = Math.min(max, state.level + 1);
  return { level, streak: 0, moved: level > state.level ? 1 : 0 };
}

/** その種目を始める段。前回の段から少し下げて始め、最初の数問を易しくする(D:4-1)。 */
export function startLevel(record, gameId, { back = 2, min = 0 } = {}) {
  const saved = record.levels[gameId];
  return Number.isFinite(saved) ? Math.max(min, saved - back) : min;
}

/**
 * 1回の結果を記録に足す。valueはその回の記録(大きいほど良い)、levelは次に始める段の元。
 * 自己ベストを更新したら`newBest`が真。日ごとの記録は、その日のいちばん良い値。
 * @param {ReturnType<typeof emptyBrainRecord>} record
 * @param {string} gameId
 * @param {{ value: number, level: number }} result
 * @param {string} day
 */
export function recordBrainSession(record, gameId, result, day) {
  if (!GAME_IDS.has(gameId)) return { record, newBest: false, previousBest: null };
  const value = Math.max(0, Math.floor(result.value));
  const previousBest = Number.isFinite(record.best[gameId]) ? record.best[gameId] : null;
  const newBest = previousBest === null ? value > 0 : value > previousBest;
  const days = { ...record.days };
  const today = { ...(days[day] ?? {}) };
  today[gameId] = Math.max(today[gameId] ?? 0, value);
  days[day] = today;
  const next = {
    ...record,
    levels: { ...record.levels, [gameId]: Math.max(0, Math.floor(result.level)) },
    best: newBest ? { ...record.best, [gameId]: value } : record.best,
    days: trimDays(days),
  };
  return { record: next, newBest, previousBest };
}

/** 今日の3種目を終えたことを残す。 */
export function markTodayDone(record, day) {
  const days = { ...record.days, [day]: { ...(record.days[day] ?? {}), today: 1 } };
  return { ...record, days: trimDays(days) };
}

function trimDays(days) {
  const keys = Object.keys(days).sort();
  if (keys.length <= BRAIN_DAYS_KEPT) return days;
  const kept = {};
  for (const key of keys.slice(-BRAIN_DAYS_KEPT)) kept[key] = days[key];
  return kept;
}

/** 今日の3種目を終えたか。 */
export function todayDone(record, day) {
  return Boolean(record.days[day]?.today);
}

/**
 * 今日の3種目の並び。遊べる種目(available)から、ちらっと盤・盤面の記憶・頭の中の盤の順に3つ。
 * 記憶の宮殿の毎日の練習が開いていれば、日替わりで盤面の記憶か頭の中の盤の1つと入れ替える(3-5)。
 * @param {{ available: string[], palaceOpen?: boolean, day: string }} input
 */
export function todayMenu({ available, palaceOpen = false, day }) {
  const base = ['glance', 'board-memory', 'mental'].filter((id) => available.includes(id));
  if (!palaceOpen || !available.includes('palace') || base.length < 3) return base;
  const parity = Number(day.slice(-2)) % 3;
  if (parity === 1) return ['glance', 'palace', 'mental'];
  if (parity === 2) return ['glance', 'board-memory', 'palace'];
  return base;
}

/**
 * 今日の記録が、今日より前のいちばん新しい日の記録より伸びたか。比べる日がなければnull。
 * @returns {{ previous: number, today: number, grew: boolean } | null}
 */
export function growthSince(record, gameId, day) {
  const today = record.days[day]?.[gameId];
  if (!Number.isFinite(today)) return null;
  const earlier = Object.keys(record.days).filter((key) => key < day && Number.isFinite(record.days[key][gameId])).sort();
  if (!earlier.length) return null;
  const previous = record.days[earlier.at(-1)][gameId];
  return { previous, today, grew: today > previous };
}

/** 続けて練習した日の数(今日か昨日から数える)。途切れても何も言わない(D:9-2)。 */
export function brainStreak(record, day) {
  const has = (key) => Object.keys(record.days[key] ?? {}).length > 0;
  let cursor = new Date(`${day}T12:00:00`);
  if (!has(day)) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** 日ごとの記録の線(古い順)。グラフに使う。 */
export function dailySeries(record, gameId) {
  return Object.keys(record.days).sort()
    .filter((key) => Number.isFinite(record.days[key][gameId]))
    .map((key) => ({ day: key, value: record.days[key][gameId] }));
}
