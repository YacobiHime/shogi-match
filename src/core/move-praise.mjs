// プレイヤーの好手・形勢の転換点を、やこび姫が褒めるための判定。
// 追加のエンジン探索は行わず、手番開始時の浅い／深い解析とCPU探索の評価を使う。

/** 棋譜解析と同じ基準：最善手かつ次善手との差が350以上で好手。 */
export const GOOD_MOVE_GAP = 350;
/** 浅い読みで最善手より何点低く見えていれば「先まで読まないと気付けない」とするか。 */
export const GOD_MOVE_SHALLOW_DEFICIT = 150;
/** 褒める手の評価低下の許容量。探索深さの違いによる揺れだけを吸収する。 */
export const PRAISE_MAX_LOSS = 200;
/** 駒得として褒める正味の駒の価値（歩=1）。 */
export const MATERIAL_GAIN_MIN = 3;

const PIECE_VALUES = {
  pawn: 1,
  lance: 3,
  knight: 4,
  silver: 5,
  gold: 6,
  bishop: 8,
  rook: 10,
  king: 100,
  promPawn: 5,
  promLance: 5,
  promKnight: 5,
  promSilver: 5,
  horse: 10,
  dragon: 12,
};

/** @typedef {{ type: string, value: number }} PraiseScore */
/** @typedef {{ rank: number, move: string, score?: PraiseScore }} PraiseCandidate */
/** @typedef {{ key: string, text: string }} PraiseAdvice */

function comparableScore(score) {
  if (score?.type === 'cp' && Number.isFinite(score.value)) return score.value;
  if (score?.type === 'mate' && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - score.value;
    if (score.value < 0) return -100000 + Math.abs(score.value);
  }
  return undefined;
}

function rankedCandidates(candidates = []) {
  return [...candidates]
    .filter((candidate) => (
      Number.isInteger(candidate?.rank) && candidate.rank >= 1
      && typeof candidate.move === 'string' && comparableScore(candidate.score) !== undefined
    ))
    .sort((left, right) => left.rank - right.rank);
}

/**
 * 手番開始時の解析から、指した手が好手か神の一手かを判定する。
 * deep・shallowの評価はどちらも手番側（プレイヤー）視点。
 * @param {{ move?: string, deepCandidates?: PraiseCandidate[], shallowCandidates?: PraiseCandidate[] }} [options]
 */
export function classifyMoveQuality({ move, deepCandidates = [], shallowCandidates = [] } = {}) {
  const deep = rankedCandidates(deepCandidates);
  const best = deep[0];
  const second = deep[1];
  if (!move || best?.rank !== 1 || best.move !== move || !second) return null;
  const gap = comparableScore(best.score) - comparableScore(second.score);
  if (gap < GOOD_MOVE_GAP) return null;

  const shallow = rankedCandidates(shallowCandidates);
  const shallowBest = shallow[0];
  const shallowMove = shallow.find((candidate) => candidate.move === move);
  const hiddenFromShallow = shallowBest?.rank === 1 && shallowBest.move !== move && (
    !shallowMove
    || comparableScore(shallowBest.score) - comparableScore(shallowMove.score) >= GOD_MOVE_SHALLOW_DEFICIT
  );
  return { kind: hiddenFromShallow ? 'god' : 'good', score: best.score, gap };
}

/**
 * 取った駒から、直前に相手へ取られた駒と取り返される危険を差し引いた正味の駒得。
 * destinationAttacked: 着手後、相手がその升へ駒を取り返せるか。
 * @param {{ capturedPieceType?: string, moverPieceType?: string, destinationAttacked?: boolean, opponentPreviousCapture?: string }} [options]
 */
export function materialGain({
  capturedPieceType,
  moverPieceType,
  destinationAttacked = false,
  opponentPreviousCapture,
} = {}) {
  const captured = PIECE_VALUES[capturedPieceType];
  if (!captured) return 0;
  const lost = PIECE_VALUES[opponentPreviousCapture] ?? 0;
  const gain = captured - lost;
  if (!destinationAttacked) return gain;
  return Math.min(gain, gain - (PIECE_VALUES[moverPieceType] ?? 0));
}

export function createTurningPointState() {
  return { entries: [], reversalFrom: -1, narrowingFrom: -1, enduranceAt: -Infinity };
}

/** 待ったで消えた手の評価を取り除く。 */
export function rewindTurningPointState(state, ply) {
  const entries = (state?.entries ?? []).filter((entry) => entry.ply <= ply);
  return { ...createTurningPointState(), ...state, entries };
}

const TURNING_WINDOW = 12;
const REVERSAL_LOW = -500;
const REVERSAL_HIGH = 300;
const NARROWING_LOW = -800;
const NARROWING_RECOVERY = 500;
const ENDURANCE_SCORE = -800;
const ENDURANCE_STREAK_SCORE = -600;
const ENDURANCE_STREAK = 3;
const ENDURANCE_INTERVAL = 16;

/**
 * プレイヤー着手ごとの評価（プレイヤー視点）を記録し、形勢の転換点を1件返す。
 * 逆転・差が縮まった・粘っている、を同じ劣勢区間で繰り返し言わない。
 * @param {any} state
 * @param {{ ply?: number, afterScore?: PraiseScore, beforeScore?: PraiseScore }} [options]
 * @returns {{ state: any, advice: PraiseAdvice | null }}
 */
export function advanceTurningPoints(state, { ply, afterScore, beforeScore } = {}) {
  const current = { ...createTurningPointState(), ...state };
  const value = comparableScore(afterScore);
  if (!Number.isInteger(ply) || value === undefined) return { state: current, advice: null };
  const entries = [...current.entries.filter((entry) => entry.ply < ply), { ply, value }]
    .slice(-TURNING_WINDOW);
  const next = { ...current, entries };
  const before = comparableScore(beforeScore);
  const change = before === undefined ? undefined : value - before;
  const earlier = entries.slice(0, -1);

  const reversalLows = earlier.filter((entry) => entry.ply > next.reversalFrom && entry.value <= REVERSAL_LOW);
  if (value >= REVERSAL_HIGH && reversalLows.length) {
    next.reversalFrom = ply;
    next.narrowingFrom = ply;
    return { state: next, advice: { key: 'praise-reversal', text: '逆転！この調子だね。' } };
  }

  const narrowingWorst = Math.min(
    ...earlier.filter((entry) => entry.ply > next.narrowingFrom).map((entry) => entry.value),
  );
  if (
    value < 0 && narrowingWorst <= NARROWING_LOW && value - narrowingWorst >= NARROWING_RECOVERY
  ) {
    next.narrowingFrom = ply;
    return { state: next, advice: { key: 'praise-narrowing', text: '差が縮まってきたよ！まだやれる！' } };
  }

  const streak = entries.slice(-ENDURANCE_STREAK);
  if (
    value <= ENDURANCE_SCORE && value > -90000
    && change !== undefined && change >= -100
    && streak.length === ENDURANCE_STREAK
    && streak.every((entry) => entry.value <= ENDURANCE_STREAK_SCORE)
    && ply - next.enduranceAt >= ENDURANCE_INTERVAL
  ) {
    next.enduranceAt = ply;
    return {
      state: next,
      advice: { key: 'praise-endurance', text: '苦しい局面だけど、よく粘ってると思う！頑張って！' },
    };
  }
  return { state: next, advice: null };
}

function formatPraiseEvaluation(score) {
  if (score?.type === 'mate' && score.value > 0) return `${score.value}手詰め`;
  const value = Math.trunc(score?.value ?? 0);
  return `${value >= 0 ? '+' : ''}${value}`;
}

/**
 * 着手を褒める台詞を優先度順に1件返す。
 * fallback（敵陣へのかち込みなど）は好手系より後、粘りより前に扱う。
 * 「｜漢字《よみ》」はルビとして表示される。
 * @param {{
 *   level?: string, beforeScore?: PraiseScore, afterScore?: PraiseScore,
 *   quality?: { kind: string, score: PraiseScore, gap: number } | null,
 *   gaveMateThreat?: boolean, defendedMateThreat?: boolean, materialGain?: number,
 *   turningAdvice?: PraiseAdvice | null, fallback?: PraiseAdvice | null,
 * }} [options]
 * @returns {PraiseAdvice | null}
 */
export function getMovePraise({
  level = 'encourage',
  beforeScore,
  afterScore,
  quality = null,
  gaveMateThreat = false,
  defendedMateThreat = false,
  materialGain: gain = 0,
  turningAdvice = null,
  fallback = null,
} = {}) {
  if (level === 'off') return null;
  const endurance = turningAdvice?.key === 'praise-endurance' ? turningAdvice : null;
  const turning = endurance ? null : turningAdvice;
  if (level !== 'detailed') return turning ?? endurance ?? null;

  const before = comparableScore(beforeScore);
  const after = comparableScore(afterScore);
  const sound = before !== undefined && after !== undefined && after - before >= -PRAISE_MAX_LOSS;

  if (sound && quality?.kind === 'god') {
    return {
      key: 'praise-god-move',
      text: `評価値${formatPraiseEvaluation(quality.score)}、｜正《まさ》に神の一手だね！`,
    };
  }
  if (turning?.key === 'praise-reversal') return turning;
  if (sound && defendedMateThreat) {
    return { key: 'praise-mate-defense', text: '相手の詰めろを受けきったね！これで一安心。' };
  }
  if (sound && gaveMateThreat) {
    return { key: 'praise-mate-threat', text: '詰めろを掛けたね。良い手だと思うよ！' };
  }
  if (sound && quality?.kind === 'good') {
    return { key: 'praise-good-move', text: '好手だね、良い調子！' };
  }
  if (sound && gain >= MATERIAL_GAIN_MIN) {
    return { key: 'praise-material', text: '駒得ざっくざく～♪' };
  }
  return turning ?? fallback ?? endurance ?? null;
}

/**
 * 高価な詰めろ判定が、優先順位上の最終結果を変え得る場合だけtrueを返す。
 * @param {Parameters<typeof getMovePraise>[0] & { historyLength?: number }} [options]
 */
export function movePraiseNeedsMateThreatCheck(options = {}) {
  const preliminary = getMovePraise({ ...options, gaveMateThreat: false });
  if (['praise-god-move', 'praise-reversal', 'praise-mate-defense'].includes(preliminary?.key)) {
    return false;
  }
  const before = comparableScore(options.beforeScore);
  const after = comparableScore(options.afterScore);
  return options.level === 'detailed'
    && Number.isInteger(options.historyLength)
    && options.historyLength >= 20
    && before !== undefined
    && after !== undefined
    && after - before >= -PRAISE_MAX_LOSS;
}
