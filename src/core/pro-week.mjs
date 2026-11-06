// 棋士の1年を1週ずつ過ごす形の、画面にも1年の進め方にも依存しない小さな決まり(docs/pro-year-design.mdの13章)。
// 調子(5段)・次の相手の対策★・1週の行動の枠・行動の言葉。1年の進め方(pro-year.mjs)がこれを使う。

/** 調子の5段(13-3の3)。 */
export const CONDITION_LABELS = Object.freeze(['絶不調', '不調', 'ふつう', '好調', '絶好調']);
export const CONDITION_DEFAULT = 2;
export const CONDITION_MAX = CONDITION_LABELS.length - 1;
/** 分身に任せる・勝負どころの局面の勝率で、調子1段・対策★1つが足すレーティング。 */
export const CONDITION_RATING = 40;
export const PREP_RATING = 20;
/** 1週の行動の枠(公式戦が1局あれば1つ、2局以上なら0)。 */
export const WEEK_SLOTS = 2;

export const clampCondition = (value) => Math.min(CONDITION_MAX, Math.max(0, Math.round(Number(value) || 0)));

/**
 * 公式戦を1局指したあとの調子(1局で−1、二日制は−2。勝つと＋1)。
 * @param {number} condition
 * @param {{ won?: boolean, twoDay?: boolean }} [game]
 */
export function conditionAfterGame(condition, { won = false, twoDay = false } = {}) {
  return clampCondition(condition - (twoDay ? 2 : 1) + (won ? 1 : 0));
}

/** 自分で指すときの閃きの増減(−2〜＋2)。 */
export const conditionHintBonus = (condition) => clampCondition(condition) - CONDITION_DEFAULT;

/**
 * 分身に任せる・勝負どころの局面を作るときに、分身のレーティングに足す値。
 * @param {number} condition
 * @param {number} stars
 */
export const autoRatingBonus = (condition, stars = 0) => conditionHintBonus(condition) * CONDITION_RATING + Math.max(0, stars) * PREP_RATING;

/** 研究の道具の段で、対策★の上限(道具なし★1・ノート★2・デスクトップから★3)。 */
export const prepCap = (gear = 0) => (gear >= 2 ? 3 : gear === 1 ? 2 : 1);
/** 研究1回で進む★(高性能パソコンは2つ)。 */
export const prepGain = (gear = 0) => (gear >= 3 ? 2 : 1);

/**
 * 研究したあとの★。相手が変わっていたら0から。
 * @param {{ id: string | null, stars: number } | null | undefined} prep
 * @param {string | null} target 次の公式戦の相手
 * @param {number} gear
 */
export function researched(prep, target, gear = 0) {
  const base = prep && prep.id === target ? prep.stars : 0;
  return { id: target, stars: Math.min(prepCap(gear), base + prepGain(gear)) };
}

/** その相手への★(違う相手のための研究は数えない)。 */
export const starsFor = (prep, opponentId) => (prep && (prep.id === opponentId || prep.id === null) ? Math.max(0, prep.stars ?? 0) : 0);

/** 行動の種類(13-3の2)。 */
export const WEEK_ACTIONS = Object.freeze({
  research: Object.freeze({ id: 'research', label: '研究', icon: '研', note: '次の相手の作戦を調べる' }),
  rest: Object.freeze({ id: 'rest', label: '休む', icon: '休', note: 'ゆっくり休んで、調子を整える' }),
  study: Object.freeze({ id: 'study', label: '研究会', icon: '会', note: '研究仲間と練習対局' }),
  festival: Object.freeze({ id: 'festival', label: '将棋まつり', icon: '祭', note: '指導対局・トークショー・揮毫' }),
});

// ---- 週の暦(月曜はじまり)

const pad = (value) => String(value).padStart(2, '0');
const toDate = (text) => new Date(`${text}T00:00:00Z`);
const fromDate = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const shift = (text, days) => {
  const date = toDate(text);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDate(date);
};

/** その日を含む週の月曜。 */
export function mondayOf(text) {
  const day = toDate(text).getUTCDay();
  return shift(text, -((day + 6) % 7));
}

/**
 * 年度の何週目か(4月1日を含む週が第1週)。
 * @param {string} date
 * @param {number} fy
 */
export function weekNumber(date, fy) {
  const first = mondayOf(`${fy}-04-01`);
  return Math.floor((toDate(mondayOf(date)) - toDate(first)) / (7 * 86400000)) + 1;
}

/**
 * 週の始まりと終わり(年度の外の日は使わない)。
 * @param {string} date 週の中の日
 * @param {number} fy
 */
export function weekRange(date, fy) {
  const monday = mondayOf(date);
  const first = `${fy}-04-01`;
  const last = `${fy + 1}-03-31`;
  const sunday = shift(monday, 6);
  return { monday, start: monday < first ? first : monday, end: sunday > last ? last : sunday, days: Array.from({ length: 7 }, (_, index) => shift(monday, index)) };
}

/** 週の行動の枠の数。 */
export const weekSlots = (userGames) => Math.max(0, WEEK_SLOTS - Math.max(0, userGames));

/**
 * おまかせの行動(13-3の10)。調子がふつうより下なら休み、そうでなければ研究(★が上限なら休む)。研究会とまつりには行かない。
 * @param {{ slots: number, condition: number, stars: number, cap: number, canResearch: boolean }} input
 */
export function autoActions({ slots, condition, stars, cap, canResearch }) {
  const actions = [];
  let cond = condition;
  let star = stars;
  for (let index = 0; index < slots; index += 1) {
    if (cond < CONDITION_DEFAULT || !canResearch || star >= cap) {
      actions.push('rest');
      cond += 1;
    } else {
      actions.push('research');
      star += 1;
    }
  }
  return actions;
}
