export const COACH_ADVICE_MIN_DISPLAY_MS = 6000;

export function coachAdvicePriority(advice) {
  const key = advice?.key ?? '';
  if (/forced-mate|king-in-check|mate-danger|mate-risk|mate-win/.test(key)) return 100;
  if (/move-blunder|move-mistake/.test(key)) return 90;
  if (/candidate-evaluation-cliff/.test(key)) return 70;
  if (/strategy-|castle-/.test(key)) return 40;
  return 20;
}

/** 連続して届く助言を待機させ、先の台詞を読める時間だけ保持する。 */
export function createCoachAdviceScheduler({
  display,
  minimumDisplayMs = COACH_ADVICE_MIN_DISPLAY_MS,
  now = () => Date.now(),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (timer) => clearTimeout(timer),
} = {}) {
  let displayedAt = Number.NEGATIVE_INFINITY;
  let displayedKey = '';
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
    if (remaining <= 0) {
      cancelTimer();
      pending = null;
      displayNow(advice);
      return;
    }
    if (advice.key === displayedKey) return;
    if (!pending || coachAdvicePriority(advice) >= coachAdvicePriority(pending)) {
      pending = advice;
    }
    if (timer === null) timer = setTimer(flush, remaining);
  }

  function reset() {
    cancelTimer();
    pending = null;
    displayedAt = Number.NEGATIVE_INFINITY;
    displayedKey = '';
  }

  return { present, reset };
}
