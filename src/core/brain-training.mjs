// 脳トレの記録・難しさの階段・判子のカレンダー(docs/brain-training-design.mdの11章)。画面に依存しない。
// 計算力と記憶力の2つの部屋。今の将棋の種目(ちらっと盤・頭の中の盤・盤面の記憶)は、各部屋の「将棋の棚」に残す(11-7)。

import { cleanCalcProgram, cleanMemoryProgram, emptyCalcProgram, emptyMemoryProgram } from './brain-program.mjs';

/** 脳トレの記録の鍵(版2)。読めない値は捨てて、初めからにする。 */
export const BRAIN_TRAINING_KEY = 'yacobihime:shogi-match:brain-training:v2';
/** 前の版の鍵。版2がなければ読んで移しかえる(段・自己ベスト・日ごとの記録は将棋の棚の記録として残す)。 */
export const BRAIN_TRAINING_V1_KEY = 'yacobihime:shogi-match:brain-training:v1';
/** 日ごとの記録を残す日数(6週間のカレンダーと、3か月後のおさらいまでのグラフに足りる)。 */
export const BRAIN_DAYS_KEPT = 120;

/** 2つの部屋。 */
export const BRAIN_ROOMS = Object.freeze([
  Object.freeze({ id: 'calc', label: '計算力', emoji: '🧮' }),
  Object.freeze({ id: 'memory', label: '記憶力', emoji: '🏯' }),
]);

/**
 * 種目。roomは部屋、shelfが'shogi'なら将棋の棚。betterは記録の比べ方('high'は大きいほど良い、'low'は小さいほど良い)。
 * shortは測定・プログラムで遊ぶ短い版の問題の数、fullはふつうの1回の問題の数(数えない種目は1)。
 * 種目の中身(問題の作り方)は種目ごとのモジュール(brain-calc.mjs・brain-glance.mjsなど)にある。
 */
export const BRAIN_GAMES = Object.freeze([
  { id: 'speed', room: 'calc', label: 'スピード計算', desc: '簡単な計算を、できるだけ速く', better: 'low', short: 10, full: 20 },
  { id: 'nback', room: 'calc', label: 'N問前の答え', desc: 'いくつ前の計算の答えを言う', better: 'high', short: 1, full: 3 },
  { id: 'glance-sym', room: 'calc', label: 'ちらっと見る', desc: '一瞬で、真ん中とまわりを見る', better: 'high', short: 12, full: 20 },
  { id: 'switch', room: 'calc', label: '色で切り替え', desc: '枠の色で、答え方を切り替える', better: 'high', short: 16, full: 24 },
  { id: 'glance', room: 'calc', shelf: 'shogi', label: 'ちらっと盤', desc: '一瞬で、駒と玉の場所を見る', better: 'high', short: 8, full: 16 },
  { id: 'mental', room: 'calc', shelf: 'shogi', label: '頭の中の盤', desc: '見えない駒を、頭の中で動かす', better: 'high', short: 4, full: 8 },
  { id: 'intuition', room: 'calc', shelf: 'shogi', label: '直観の一手', desc: '3つの手から、良い手をぱっと選ぶ', better: 'high', short: 5, full: 10 },
  { id: 'einstellung', room: 'calc', shelf: 'shogi', label: '思い込み外し', desc: '目に付く手より、良い手を探す', better: 'high', short: 6, full: 6 },
  { id: 'blind', room: 'calc', shelf: 'shogi', label: '目隠しの詰将棋', desc: '盤を動かさずに、詰ませる手を読む', better: 'high', short: 4, full: 6 },
  { id: 'memory-test', room: 'memory', label: '記憶テスト', desc: '15個の言葉を、順番どおりに', better: 'high', short: 1, full: 1 },
  { id: 'palace', room: 'memory', label: '宮殿に置く', desc: '言葉を宮殿に置いて覚える', better: 'high', short: 1, full: 1 },
  { id: 'recall', room: 'memory', label: 'きのうの言葉', desc: '前の回に置いた言葉を思い出す', better: 'high', short: 1, full: 1 },
  { id: 'digits', room: 'memory', label: '数字', desc: '数字を絵にして覚える', better: 'high', short: 1, full: 1 },
  { id: 'board-memory', room: 'memory', shelf: 'shogi', label: '盤面の記憶', desc: '局面を覚えて、並べ直す', better: 'high', short: 3, full: 5 },
].map((game) => Object.freeze(game)));
const GAME_IDS = new Set(BRAIN_GAMES.map(({ id }) => id));
/** スピード計算の記録は段ごとに分ける(段で問題の難しさが違うため)。'speed-1'〜'speed-5'。 */
export const SPEED_LEVEL_COUNT = 5;
const SPEED_RECORD_IDS = Array.from({ length: SPEED_LEVEL_COUNT }, (_, index) => `speed-${index + 1}`);
/** 記録(自己ベスト・日ごとの値)に使える鍵。 */
const RECORD_IDS = new Set([...GAME_IDS, ...SPEED_RECORD_IDS]);
/** 段(次に始める段の元)に使える鍵。speed-slowはスピード計算の「遅い回が続いた数」。 */
const LEVEL_IDS = new Set([...GAME_IDS, 'speed-slow']);
const ROOM_IDS = new Set(BRAIN_ROOMS.map(({ id }) => id));

export function brainGame(id) {
  return BRAIN_GAMES.find((game) => game.id === id) ?? null;
}

/** 記録の鍵が、小さいほど良い記録か。 */
export function lowerIsBetter(recordId) {
  return recordId.startsWith('speed');
}

export function emptyBrainRecord() {
  return {
    version: 2,
    levels: {},
    best: {},
    days: {},
    program: { calc: emptyCalcProgram(), memory: emptyMemoryProgram() },
    room: '',
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanNumberMap(value, allowed) {
  const result = {};
  if (!isPlainObject(value)) return result;
  for (const [id, number] of Object.entries(value)) {
    if (allowed.has(id) && Number.isFinite(number) && number >= 0) result[id] = Math.floor(number);
  }
  return result;
}

function cleanDays(value, mapDay) {
  const days = {};
  if (!isPlainObject(value)) return days;
  for (const [day, games] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isPlainObject(games)) continue;
    const cleaned = mapDay(games);
    if (Object.keys(cleaned).length) days[day] = cleaned;
  }
  return trimDays(days);
}

/** 版2の値を整える。 */
function cleanV2(parsed) {
  const record = emptyBrainRecord();
  record.levels = cleanNumberMap(parsed.levels, LEVEL_IDS);
  record.best = cleanNumberMap(parsed.best, RECORD_IDS);
  record.days = cleanDays(parsed.days, (games) => {
    const cleaned = cleanNumberMap(games, RECORD_IDS);
    for (const room of ROOM_IDS) if (games[room] === 1) cleaned[room] = 1;
    return cleaned;
  });
  if (isPlainObject(parsed.program)) {
    record.program = { calc: cleanCalcProgram(parsed.program.calc), memory: cleanMemoryProgram(parsed.program.memory) };
  }
  record.room = ROOM_IDS.has(parsed.room) ? parsed.room : '';
  return record;
}

/**
 * 版1の記録を版2に移しかえる。ちらっと盤・頭の中の盤・盤面の記憶の段・自己ベスト・日ごとの記録は将棋の棚の記録としてそのまま残し、
 * 記憶の宮殿の毎日の練習(言葉の数)は「宮殿に置く」の記録にする。練習した日には、その部屋の判子を押す。
 * 前の講の進みは、学校の講が新しくなったので引き継がない(自分の宮殿の場所はpalace-builder.mjsが引き継ぐ)。
 */
export function migrateBrainRecordV1(parsed) {
  const record = emptyBrainRecord();
  if (!isPlainObject(parsed) || parsed.version !== 1) return record;
  const kept = new Set(['glance', 'board-memory', 'mental', 'palace']);
  record.levels = cleanNumberMap(parsed.levels, kept);
  record.best = cleanNumberMap(parsed.best, kept);
  record.days = cleanDays(parsed.days, (games) => {
    const cleaned = cleanNumberMap(games, kept);
    if (Number.isFinite(cleaned.glance) || Number.isFinite(cleaned.mental)) cleaned.calc = 1;
    if (Number.isFinite(cleaned['board-memory']) || Number.isFinite(cleaned.palace)) cleaned.memory = 1;
    return cleaned;
  });
  return record;
}

function readJson(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

/** 記録を読む。版2がなければ版1を移しかえる。形が違う値は捨てる。 */
export function loadBrainRecord(storage) {
  const parsed = readJson(storage, BRAIN_TRAINING_KEY);
  if (isPlainObject(parsed) && parsed.version === 2) return cleanV2(parsed);
  if (parsed !== null) return emptyBrainRecord();
  return migrateBrainRecordV1(readJson(storage, BRAIN_TRAINING_V1_KEY));
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
 * 正答率およそ7割のところに落ち着く(原則3)。
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

/**
 * その種目を始める段。前回の段から少し下げて始め、最初の数問を易しくする(D:4-1)。
 * @param {ReturnType<typeof emptyBrainRecord>} record
 * @param {string} gameId
 * @param {{ back?: number, min?: number }} [options]
 */
export function startLevel(record, gameId, { back = 2, min = 0 } = {}) {
  const saved = record.levels[gameId];
  return Number.isFinite(saved) ? Math.max(min, saved - back) : min;
}

/**
 * 1回の結果を記録に足す。valueはその回の記録(0は記録なし)、levelは次に始める段の元。
 * recordIdは記録の鍵(スピード計算は'speed-段')。省けば種目の鍵。
 * 自己ベストを更新したら`newBest`が真。日ごとの記録は、その日のいちばん良い値。練習した日には部屋の判子を押す。
 * @param {ReturnType<typeof emptyBrainRecord>} record
 * @param {string} gameId
 * @param {{ value: number, level: number, recordId?: string, extraLevels?: Record<string, number> }} result
 * @param {string} day
 */
export function recordBrainSession(record, gameId, result, day) {
  const game = brainGame(gameId);
  const recordId = result.recordId ?? gameId;
  if (!game || !RECORD_IDS.has(recordId)) return { record, newBest: false, previousBest: null };
  const value = Math.max(0, Math.floor(result.value));
  const low = lowerIsBetter(recordId);
  const previousBest = Number.isFinite(record.best[recordId]) ? record.best[recordId] : null;
  const better = (a, b) => (low ? a < b : a > b);
  const newBest = value > 0 && (previousBest === null || better(value, previousBest));
  const days = { ...record.days };
  const today = { ...(days[day] ?? {}), [game.room]: 1 };
  if (value > 0) today[recordId] = Number.isFinite(today[recordId]) && !better(value, today[recordId]) ? today[recordId] : value;
  days[day] = today;
  const levels = { ...record.levels, [gameId]: Math.max(0, Math.floor(result.level)) };
  for (const [id, number] of Object.entries(result.extraLevels ?? {})) {
    if (LEVEL_IDS.has(id) && Number.isFinite(number)) levels[id] = Math.max(0, Math.floor(number));
  }
  const next = {
    ...record,
    levels,
    best: newBest ? { ...record.best, [recordId]: value } : record.best,
    days: trimDays(days),
  };
  return { record: next, newBest, previousBest };
}

/** その日、その部屋の判子を押す(記録のない種目、たとえば学校の講を終えたとき)。 */
export function stampRoom(record, room, day) {
  if (!ROOM_IDS.has(room)) return record;
  const days = { ...record.days, [day]: { ...(record.days[day] ?? {}), [room]: 1 } };
  return { ...record, days: trimDays(days) };
}

function trimDays(days) {
  const keys = Object.keys(days).sort();
  if (keys.length <= BRAIN_DAYS_KEPT) return days;
  const kept = {};
  for (const key of keys.slice(-BRAIN_DAYS_KEPT)) kept[key] = days[key];
  return kept;
}

/** その日、その部屋で練習したか(判子)。roomを省けばどちらかの部屋。 */
export function stamped(record, day, room = null) {
  const entry = record.days[day];
  if (!entry) return false;
  return room ? entry[room] === 1 : [...ROOM_IDS].some((id) => entry[id] === 1);
}

/**
 * 今日の記録が、今日より前のいちばん新しい日の記録より伸びたか。比べる日がなければnull。
 * @returns {{ previous: number, today: number, grew: boolean } | null}
 */
export function growthSince(record, recordId, day) {
  const today = record.days[day]?.[recordId];
  if (!Number.isFinite(today)) return null;
  const earlier = Object.keys(record.days).filter((key) => key < day && Number.isFinite(record.days[key][recordId])).sort();
  if (!earlier.length) return null;
  const previous = record.days[earlier.at(-1)][recordId];
  return { previous, today, grew: lowerIsBetter(recordId) ? today < previous : today > previous };
}

/** 続けて練習した日の数(今日か昨日から数える)。途切れても何も言わない(D:9-2)。 */
export function brainStreak(record, day) {
  let cursor = new Date(`${day}T12:00:00`);
  if (!stamped(record, day)) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (stamped(record, dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** 日ごとの記録の線(古い順)。グラフに使う。 */
export function dailySeries(record, recordId) {
  return Object.keys(record.days).sort()
    .filter((key) => Number.isFinite(record.days[key][recordId]))
    .map((key) => ({ day: key, value: record.days[key][recordId] }));
}

/**
 * 判子のカレンダー。今日の週を最後にして、weeks週ぶん(日曜はじまり)。6週間は記憶力のコースの枠と同じ(11-6)。
 * @returns {{ day: string, date: number, calc: boolean, memory: boolean, today: boolean, future: boolean }[][]}
 */
export function stampCalendar(record, day, weeks = 6) {
  const today = new Date(`${day}T12:00:00`);
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);
  const rows = [];
  for (let week = 0; week < weeks; week += 1) {
    const row = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + weekday);
      const key = dayKey(date);
      row.push({
        day: key,
        date: date.getDate(),
        calc: stamped(record, key, 'calc'),
        memory: stamped(record, key, 'memory'),
        today: key === day,
        future: key > day,
      });
    }
    rows.push(row);
  }
  return rows;
}

/** 前に選んだ部屋を残す(入口に「つづき」を大きく出す。UD:3-2)。 */
export function rememberRoom(record, room) {
  return ROOM_IDS.has(room) ? { ...record, room } : record;
}
