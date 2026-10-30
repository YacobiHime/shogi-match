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
 * 直前の着手についての助言を出してよい、その手からの手数。プレイヤーの手への一言は、CPUの応手(1手)のあとまで。
 * それより後(プレイヤーが次の手を指したあと)に出すと、1つ前の手の話になる(docs/coach-advice-expansion-design.mdの11-5)。
 */
export const MOVE_ADVICE_LIFETIME_PLIES = 1;
/** 表示中の助言を待たずに出す、危険の知らせの優先度(評価の崖・相手の狙い・終盤の方針・悪手)。 */
export const URGENT_ADVICE_PRIORITY = 70;

/** 直前の着手についての助言か。 */
export function isMoveAdvice(advice) {
  return MOVE_ADVICE_KEY.test(advice?.key ?? '');
}

/**
 * 表示中(または待機中)の助言が、もう過ぎた局面の話か。局面の助言は局面(sfen)が変わったら、
 * 着手の助言はその手からMOVE_ADVICE_LIFETIME_PLIESより先へ進んだら、古い。局面の分からない助言は古いと言わない。
 * @param {{ key: string, sfen?: string, ply?: number } | null | undefined} advice
 * @param {{ sfen?: string, ply?: number }} now いまの局面(sfen)と手数(ply)
 */
export function isStaleAdvice(advice, { sfen, ply } = {}) {
  if (!advice) return false;
  if (isMoveAdvice(advice)) {
    return Number.isInteger(advice.ply) && Number.isInteger(ply) && /** @type {number} */ (ply) - /** @type {number} */ (advice.ply) > MOVE_ADVICE_LIFETIME_PLIES;
  }
  return typeof advice.sfen === 'string' && typeof sfen === 'string' && advice.sfen !== sfen;
}

/**
 * 助言を、いま出してよいか。
 * - 棋譜検討では局面ごとに見るので、同じ助言でも出す。
 * - 局面についての助言は、表示を待つ間に局面が進んだら出さない(古い局面の「王手だね」などを後から出さない)。
 * - 直前の着手についての助言は、CPUの応手のあとまで出す。プレイヤーが次の手を指したあとには出さない。
 * - 同じ助言は、直近の手数のうちは繰り返さない。ただし「待った」で手数が戻ったあとは、戻った先より後に出した記録を数えない。
 *   また、いま出ている助言が過ぎた局面の話(displayed)なら、繰り返しになっても出す(古い話を盤に残さないほうが大事)。
 * @param {{
 *   advice: { key: string, sfen?: string, ply?: number },
 *   review?: boolean,
 *   currentSfen?: string,
 *   moveCount: number,
 *   lastShownAt?: number,
 *   displayed?: { key: string, sfen?: string, ply?: number } | null,
 * }} options
 */
export function shouldDisplayCoachAdvice({ advice, review = false, currentSfen, moveCount, lastShownAt, displayed = null }) {
  if (review) return true;
  if (isStaleAdvice(advice, { sfen: currentSfen, ply: moveCount })) return false;
  if (
    lastShownAt !== undefined && lastShownAt <= moveCount
    && moveCount - lastShownAt < COACH_ADVICE_REPEAT_PLIES
    && coachAdvicePriority(advice) < 100
    && !isStaleAdvice(displayed, { sfen: currentSfen, ply: moveCount })
  ) return false;
  return true;
}

/**
 * 連続して届く助言を待機させ、先の台詞を読める時間だけ保持する。
 * 保持するのは、表示中の助言がまだ今の局面の話のときだけ。盤が進んで表示中の助言が過ぎた局面の話になったら、
 * 新しい局面の助言を待たずに出す(前は、プレイヤーやCPUが指したあとも6秒間、1つ前の局面の台詞が残り、
 * 新しい局面の助言がそのぶん遅れて出た。docs/coach-advice-expansion-design.mdの11-5)。
 * 危険の知らせ(URGENT_ADVICE_PRIORITY以上)は、表示中の助言より優先度が高ければ待たずに出す(G:5 危険の知らせはほめ言葉より先)。
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
  /** 表示中の助言の局面と手数(過ぎた局面の話かを見る)。 */
  let displayedAdvice = null;
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
    displayedAdvice = { key: advice.key, sfen: advice.sfen, ply: advice.ply };
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
    // 表示中の助言より前の局面の話(遅れて届いた読み)は、もう出す意味がないので捨てる(待機中の助言も消さない)。
    // 「待った」では順番待ちを最初に戻す(reset)ので、手数は戻らない。
    const older = Number.isInteger(advice.ply) && Number.isInteger(displayedAdvice?.ply) && advice.ply < displayedAdvice.ply;
    if (older && isStaleAdvice(advice, { sfen: displayedAdvice.sfen, ply: displayedAdvice.ply })) return;
    // 表示中の助言が、新しい助言の局面から見て過ぎた局面の話なら、待たずに出す(待つあいだ古い台詞が残るため)。
    // 危険の知らせは、表示中の助言より重ければ待たずに出す。
    const outdated = !older && isStaleAdvice(displayedAdvice, { sfen: advice.sfen, ply: advice.ply });
    if (outdated || (priority >= URGENT_ADVICE_PRIORITY && priority > displayedPriority)) {
      cancelTimer();
      pending = null;
      if (!displayNow(advice) && outdated) displayedAt = Number.NEGATIVE_INFINITY;
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
    displayedAdvice = null;
  }

  /** 表示中の助言(局面と手数つき)。対局画面が、繰り返しの判定で過ぎた局面の話かを見る。 */
  function displayed() {
    return displayedAdvice;
  }

  return { present, reset, displayed };
}
