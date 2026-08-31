export const MAX_COACH_ADVICE_HISTORY = 1001;

function validText(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function normalizeEntry(value, maxPly) {
  if (!value || typeof value !== 'object') return null;
  if (!Number.isInteger(value.ply) || value.ply < 0 || value.ply > maxPly) return null;
  if (!validText(value.sfen, 512) || !validText(value.key, 160) || !validText(value.text, 1000)) {
    return null;
  }
  if (value.topic !== undefined && !validText(value.topic, 160)) return null;
  return {
    ply: value.ply,
    sfen: value.sfen,
    key: value.key,
    text: value.text,
    ...(value.topic ? { topic: value.topic } : {}),
  };
}

/** 保存データを検証し、同一局面には最後の助言だけを残す。 */
export function normalizeCoachAdviceHistory(value, maxPly = 1000) {
  if (!Array.isArray(value) || !Number.isInteger(maxPly) || maxPly < 0) return [];
  const bySfen = new Map();
  for (const candidate of value.slice(-MAX_COACH_ADVICE_HISTORY * 2)) {
    const entry = normalizeEntry(candidate, maxPly);
    if (entry) bySfen.set(entry.sfen, entry);
  }
  return [...bySfen.values()].slice(-MAX_COACH_ADVICE_HISTORY);
}

/** 局面で実際に提示された最新の助言を記録する。 */
export function recordCoachAdvice(history, advice) {
  const entry = normalizeEntry(advice, Number.MAX_SAFE_INTEGER);
  if (!entry) return Array.isArray(history) ? [...history] : [];
  const retained = (Array.isArray(history) ? history : [])
    .filter((candidate) => candidate?.sfen !== entry.sfen);
  return [...retained, entry].slice(-MAX_COACH_ADVICE_HISTORY);
}

export function coachAdviceForPosition(history, sfen) {
  if (!Array.isArray(history) || typeof sfen !== 'string' || !sfen) return null;
  return history.findLast((entry) => entry?.sfen === sfen) ?? null;
}

/** 待ったで棋譜から外れた局面の助言を削除する。 */
export function pruneCoachAdviceAfterPly(history, maxPly) {
  if (!Array.isArray(history) || !Number.isInteger(maxPly) || maxPly < 0) return [];
  return history.filter((entry) => Number.isInteger(entry?.ply) && entry.ply <= maxPly);
}
