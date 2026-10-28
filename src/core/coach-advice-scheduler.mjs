export const COACH_ADVICE_MIN_DISPLAY_MS = 6000;

export function coachAdvicePriority(advice) {
  const key = advice?.key ?? '';
  if (/forced-mate|king-in-check|mate-danger|mate-risk|mate-win/.test(key)) return 100;
  // 悪手と、指した手で逃した詰み・タダの駒(N4。docs/coach-advice-expansion-design.md)。
  if (/move-blunder|move-mistake|move-missed/.test(key)) return 90;
  // 終盤の「攻めるか、受けるか」(N3)。相手の狙いより上、悪手の指摘より下。
  if (/^endgame-/.test(key)) return 80;
  // 相手の狙い(駒を取られそう)は、評価の崖より具体的なので先に出す。相手のミス(N5)も同じ重さ。
  if (/^(threat|chance)-/.test(key)) return 75;
  if (/candidate-evaluation-cliff/.test(key)) return 70;
  // 直前の着手への褒め言葉は、CPU着手後の通常助言に上書きされないようにする。
  if (/^praise-/.test(key)) return 60;
  // 作戦の提案と、そのあとにほめる一言は、札と一緒に読めるよう形勢の一言より先にする。
  if (/^plan-swing/.test(key)) return 50;
  if (/strategy-|castle-|^opponent-style-|^proverb-/.test(key)) return 40;
  // 大会の物語(N9)。形勢の一言より上、ほかの助言より下。
  if (/^story-/.test(key)) return 30;
  return 20;
}

/** 同じ助言を、この手数のうちは繰り返さない(詰み・王手などの優先度100は除く)。 */
export const COACH_ADVICE_REPEAT_PLIES = 8;
/** 直前の着手についての助言(悪手・好手・かち込み)。表示を待つ間に局面が進んでも、出す意味がある。 */
const MOVE_ADVICE_KEY = /^(move-|praise-|enter-enemy-camp$)/;

/**
 * 助言を、いま出してよいか。
 * - 棋譜検討では局面ごとに見るので、同じ助言でも出す。
 * - 局面についての助言は、表示を待つ間に局面が進んだら出さない(古い局面の「王手だね」などを後から出さない)。
 * - 同じ助言は、直近の手数のうちは繰り返さない。ただし「待った」で手数が戻ったあとは、戻った先より後に出した記録を数えない。
 * @param {{
 *   advice: { key: string, sfen?: string },
 *   review?: boolean,
 *   currentSfen?: string,
 *   moveCount: number,
 *   lastShownAt?: number,
 * }} options
 */
export function shouldDisplayCoachAdvice({ advice, review = false, currentSfen, moveCount, lastShownAt }) {
  if (review) return true;
  if (
    typeof advice.sfen === 'string' && typeof currentSfen === 'string'
    && advice.sfen !== currentSfen && !MOVE_ADVICE_KEY.test(advice.key)
  ) return false;
  if (
    lastShownAt !== undefined && lastShownAt <= moveCount
    && moveCount - lastShownAt < COACH_ADVICE_REPEAT_PLIES
    && coachAdvicePriority(advice) < 100
  ) return false;
  return true;
}

/**
 * 連続して届く助言を待機させ、先の台詞を読める時間だけ保持する。
 * @param {{
 *   display?: (advice: any) => void, minimumDisplayMs?: number, now?: () => number,
 *   setTimer?: (callback: () => void, delay: number) => any, clearTimer?: (timer: any) => void,
 * }} [options]
 */
export function createCoachAdviceScheduler({
  display,
  minimumDisplayMs = COACH_ADVICE_MIN_DISPLAY_MS,
  now = () => Date.now(),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (timer) => clearTimeout(timer),
} = {}) {
  let displayedAt = Number.NEGATIVE_INFINITY;
  let displayedKey = '';
  let displayedPriority = 0;
  let pending = null;
  let timer = null;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function displayNow(advice) {
    if (display?.(advice) === false) return false;
    displayedAt = now();
    displayedKey = advice.key;
    displayedPriority = coachAdvicePriority(advice);
    return true;
  }

  function flush() {
    timer = null;
    const advice = pending;
    pending = null;
    if (advice) displayNow(advice);
  }

  function present(advice) {
    if (!advice?.key || !advice?.text) return;
    const remaining = minimumDisplayMs - (now() - displayedAt);
    const priority = coachAdvicePriority(advice);
    if (remaining <= 0) {
      cancelTimer();
      pending = null;
      displayNow(advice);
      return;
    }
    // 詰み・王手などは局面が進む前に伝える必要があるため、通常助言の保持時間を待たない。
    // 詰みの助言どうしでも待たない。あとから届くほうが新しい局面・深い読みなので(前は、先の「3手詰め」が
    // 6秒残り、あとから見つけた1手詰めを出す前にプレイヤーが指してしまうことがあった)。
    if (priority >= 100 && advice.key !== displayedKey) {
      cancelTimer();
      pending = null;
      displayNow(advice);
      return;
    }
    if (advice.key === displayedKey) return;
    if (!pending || priority >= coachAdvicePriority(pending)) {
      pending = advice;
    }
    if (timer === null) timer = setTimer(flush, remaining);
  }

  function reset() {
    cancelTimer();
    pending = null;
    displayedAt = Number.NEGATIVE_INFINITY;
    displayedKey = '';
    displayedPriority = 0;
  }

  return { present, reset };
}
