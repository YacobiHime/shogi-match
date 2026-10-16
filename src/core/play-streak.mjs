/**
 * 続けて遊んだ日の記録(段階6の習慣)。Duolingoのストリークにならい、少しの「ゆとり」を入れる
 * (Game_Nintendo_Design.mdの9-2、Game_Nintendo_Implementation.mdの6-3)。
 *
 * - 数えるのは将棋の行為(1局指し終える・問題を1問解く・教室のレッスンを終える)。開いただけでは数えない。
 * - 1日休んでも、その前の7日のうちに休みがなければ、記録は続く(週に1日のおやすみ)。
 * - 途切れても、いちばん長い記録は残す。今日まだ遊んでいなくても、記録は昨日までで続いているとみなす。
 * - 「今日やらないと失う」とは言わない。
 */

export const PLAY_STREAK_KEY = 'yacobihime:shogi-match:play-streak:v1';
/** おやすみを認める間隔(日)。この日数のうちに休みは1日まで。 */
export const REST_WINDOW_DAYS = 7;
/** 覚えておく日数。 */
const KEEP_DAYS = 120;

/** 端末の暦での日付(YYYY-MM-DD)。 */
export function localDay(time = Date.now()) {
  const date = new Date(time);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 日付を、日数だけずらす。 */
function shiftDay(day, delta) {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year, month - 1, date + delta).getTime());
}

export function createPlayStreak() {
  return { days: [], best: 0 };
}

/**
 * いまの連続記録。今日から(今日まだなら昨日から)さかのぼり、遊んだ日を数える。
 * 遊ばなかった日は、直前の7日のうちにほかの休みがなければ「おやすみ」として飛ばす。休みの日は数に入れない。
 * @param {{ days: string[] }} state
 * @param {string} [today]
 * @returns {{ current: number, rested: number, playedToday: boolean }}
 */
export function currentStreak(state, today = localDay()) {
  const played = new Set(state.days);
  const playedToday = played.has(today);
  let day = playedToday ? today : shiftDay(today, -1);
  let current = 0;
  let rested = 0;
  // 休みは、遊んだ日にはさまれたときだけ数える(記録の端の休みは数えない)。
  let pendingRest = false;
  let lastRestAt = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < KEEP_DAYS; offset += 1, day = shiftDay(day, -1)) {
    if (played.has(day)) {
      current += 1;
      if (pendingRest) rested += 1;
      pendingRest = false;
      continue;
    }
    // 休みは、ひとつ前の休みから7日以上あいているときだけ認める。続けて2日休んだら、そこで途切れる。
    if (offset - lastRestAt >= REST_WINDOW_DAYS) {
      lastRestAt = offset;
      pendingRest = true;
      continue;
    }
    break;
  }
  return { current, rested, playedToday };
}

/**
 * 将棋の行為をしたことを記録する。最長記録も更新する。
 * @param {{ days: string[], best: number }} state
 * @param {string} [today]
 */
export function recordPlay(state, today = localDay()) {
  const days = state.days.includes(today) ? state.days : [...state.days, today].sort().slice(-KEEP_DAYS);
  const next = { days, best: state.best };
  next.best = Math.max(state.best, currentStreak(next, today).current);
  return next;
}

/**
 * やこび姫の一言。2日目から話す。休みを認めたときは、責めずにそう伝える。
 * @param {ReturnType<typeof currentStreak>} streak
 */
export function streakLine(streak) {
  if (streak.current < 2) return '';
  const rest = streak.rested ? '（おやすみの日もあったけど、ちゃんと続いてるよ）' : '';
  return `${streak.current}日、将棋を続けてるね！${rest}`;
}

/** タイトル画面の吹き出し用の、短い一言。2日目から。 */
export function streakGreeting(streak) {
  return streak.current >= 2 ? `${streak.current}日つづけてるね！` : '';
}

export function loadPlayStreak(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PLAY_STREAK_KEY) ?? 'null');
    if (!parsed || !Array.isArray(parsed.days)) return createPlayStreak();
    const days = parsed.days.filter((day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)).sort().slice(-KEEP_DAYS);
    return { days, best: Number.isFinite(parsed.best) && parsed.best > 0 ? Math.floor(parsed.best) : 0 };
  } catch {
    return createPlayStreak();
  }
}

export function savePlayStreak(storage, state) {
  try {
    storage?.setItem(PLAY_STREAK_KEY, JSON.stringify(state));
  } catch {
    // 保存できない環境では、記録しない。遊びは止めない。
  }
}
