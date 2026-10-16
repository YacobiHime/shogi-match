/**
 * 間をあけた出し直し(段階4)。問題集で苦労した問題を「復習の箱」に入れ、日をあけて「やこび姫からの1問」として出す。
 * Duolingo Chessの間隔をあけた復習にならう(Game_Nintendo_Design.mdの6-4)。
 *
 * - 一発で解けなかった(まちがえた・ヒントを見た)問題を、1日後に出す。
 * - 出した問題を一発で解いたら、次は3日後、その次は7日後。7日後も一発で解けたら箱から出す。
 * - 一発で解けなかったら、1日後からやり直す。
 * - 出なくても責めない。解かなくても先へ進める(5-8)。
 */

export const REVIEW_QUEUE_KEY = 'yacobihime:shogi-match:review-queue:v1';
/** 出し直すまでの日数。段階ごとに伸ばす。 */
export const REVIEW_INTERVAL_DAYS = Object.freeze([1, 3, 7]);
const DAY_MS = 24 * 60 * 60 * 1000;

export function createReviewQueue() {
  return { items: {} };
}

/**
 * 問題を解き終えた結果を、復習の箱に反映する。
 * @param {ReturnType<typeof createReviewQueue>} queue
 * @param {string} id 問題のID
 * @param {{ firstTry: boolean, now?: number }} result
 */
export function recordReviewResult(queue, id, { firstTry, now = Date.now() }) {
  const items = { ...queue.items };
  const current = items[id];
  if (!firstTry) {
    items[id] = { stage: 0, dueAt: now + REVIEW_INTERVAL_DAYS[0] * DAY_MS };
  } else if (current && now >= current.dueAt) {
    // 出し直した日に一発で解けたら、次の間隔へ進める。最後の間隔を越えたら箱から出す。
    const stage = current.stage + 1;
    if (stage >= REVIEW_INTERVAL_DAYS.length) delete items[id];
    else items[id] = { stage, dueAt: now + REVIEW_INTERVAL_DAYS[stage] * DAY_MS };
  }
  return { items };
}

/**
 * いま出し直す問題。期限の来たもののうち、いちばん古いもの。knownIdsにない問題(消えた問題)は出さない。
 * @param {ReturnType<typeof createReviewQueue>} queue
 * @param {{ now?: number, knownIds?: Set<string> | null }} [options]
 * @returns {string | null}
 */
export function dueReviewId(queue, { now = Date.now(), knownIds = null } = {}) {
  let best = null;
  for (const [id, item] of Object.entries(queue.items)) {
    if (item.dueAt > now || (knownIds && !knownIds.has(id))) continue;
    if (!best || item.dueAt < best.dueAt) best = { id, dueAt: item.dueAt };
  }
  return best?.id ?? null;
}

export function loadReviewQueue(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(REVIEW_QUEUE_KEY) ?? 'null');
    const items = {};
    for (const [id, item] of Object.entries(parsed?.items ?? {})) {
      if (item && Number.isInteger(item.stage) && item.stage >= 0 && item.stage < REVIEW_INTERVAL_DAYS.length && Number.isFinite(item.dueAt)) {
        items[id] = { stage: item.stage, dueAt: item.dueAt };
      }
    }
    return { items };
  } catch {
    return createReviewQueue();
  }
}

export function saveReviewQueue(storage, queue) {
  try {
    storage?.setItem(REVIEW_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // 保存できない端末では、その場限りにする。
  }
}
