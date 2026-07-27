const DIFFICULTY_IDS = ['easy', 'normal', 'hard'];

export const DIFFICULTY_NAMES = {
  easy: 'やさしい',
  normal: 'ふつう',
  hard: 'むずかしい',
};

/**
 * difficulty.jsonの内容を検証して返す。
 * @param {unknown} data
 */
export function validateDifficulties(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('difficulty.jsonは難易度IDをキーとするオブジェクトにしてください');
  }

  for (const difficultyId of DIFFICULTY_IDS) {
    const modifier = data[difficultyId];
    if (!modifier || typeof modifier !== 'object' || Array.isArray(modifier)) {
      throw new Error(`difficulty.json.${difficultyId}がありません`);
    }
    if (!Number.isFinite(modifier.node_limit_mult) || modifier.node_limit_mult <= 0) {
      throw new Error(`${difficultyId}.node_limit_multは0より大きい数値にしてください`);
    }
    if (!Number.isFinite(modifier.node_limit_stddev_ratio)
      || modifier.node_limit_stddev_ratio < 0
      || modifier.node_limit_stddev_ratio > 0.5) {
      throw new Error(`${difficultyId}.node_limit_stddev_ratioは0以上0.5以下の数値にしてください`);
    }
    if (!Number.isInteger(modifier.move_rank_max_bonus)
      || modifier.move_rank_max_bonus < 0) {
      throw new Error(`${difficultyId}.move_rank_max_bonusは0以上の整数にしてください`);
    }
  }

  return data;
}

/**
 * 難易度マスタを取得・検証し、指定IDの係数と表示名を返す。
 * @param {string} difficultyId
 * @param {{ fetchImpl?: typeof fetch, url?: string }} [options]
 */
export async function loadDifficulty(difficultyId, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const url = options.url || '../../data/difficulty.json';
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`難易度データを取得できませんでした（HTTP ${response.status}）`);
  }

  const difficulties = validateDifficulties(await response.json());
  const modifier = difficulties[difficultyId];
  if (!modifier || !DIFFICULTY_NAMES[difficultyId]) {
    throw new Error(`指定された難易度が見つかりません: ${difficultyId}`);
  }
  return {
    difficulty_id: difficultyId,
    name: DIFFICULTY_NAMES[difficultyId],
    ...modifier,
  };
}

/**
 * 敵の基準ノード数へ難易度倍率を適用する。
 * @param {number} nodeLimit
 * @param {number} multiplier
 */
export function calculateEffectiveNodeLimit(nodeLimit, multiplier) {
  if (!Number.isInteger(nodeLimit) || nodeLimit < 1) {
    throw new Error('nodeLimitは1以上の整数にしてください');
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error('multiplierは0より大きい数値にしてください');
  }
  return Math.max(1, Math.round(nodeLimit * multiplier));
}

/**
 * 実効ノード数を正規分布を基に揺らす。上振れ幅は半分に圧縮し、
 * 極端値は圧縮前の平均から標準偏差2個分までに制限する。
 * @param {number} nodeLimit
 * @param {number} stddevRatio
 * @param {() => number} [random]
 */
export function varyNodeLimit(nodeLimit, stddevRatio, random = Math.random) {
  if (!Number.isInteger(nodeLimit) || nodeLimit < 1) {
    throw new Error('nodeLimitは1以上の整数にしてください');
  }
  if (!Number.isFinite(stddevRatio) || stddevRatio < 0 || stddevRatio > 0.5) {
    throw new Error('stddevRatioは0以上0.5以下の数値にしてください');
  }
  if (stddevRatio === 0) return nodeLimit;

  // Box-Muller法。0はlog(0)を避け、乱数源が境界値を返しても有限値にする。
  const u1 = Math.max(Number.MIN_VALUE, Math.min(1, random()));
  const u2 = Math.max(0, Math.min(1, random()));
  const standardNormal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const limitedNormal = Math.max(-2, Math.min(2, standardNormal));
  const adjustedNormal = limitedNormal > 0 ? limitedNormal * 0.5 : limitedNormal;
  return Math.max(1, Math.round(nodeLimit * (1 + stddevRatio * adjustedNormal)));
}
