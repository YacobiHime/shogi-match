// 脳トレ「計算力」の問題の作り方と採点(docs/brain-training-design.mdの11-5)。
// スピード計算・N問前の答え・色で切り替え。乱数の種から同じ問題を作り、答えはいつも0以上の整数。画面に依存しない。

import { createRng } from './ryuo-random.mjs';

function between(rng, min, max) {
  return min + Math.floor(rng.next() * (max - min + 1));
}

// ===== スピード計算 =====

/**
 * スピード計算の段。kindsは出す式の種類。goalMsは1問の平均がこれより速ければ次の回に1段上がる目安。
 * 遅い回(目安の1.7倍より遅い)が2回続くと1段下がる。
 */
export const SPEED_LEVELS = Object.freeze([
  Object.freeze({ label: '1けたの足し算・引き算', kinds: Object.freeze(['add1', 'sub1']), goalMs: 1800 }),
  Object.freeze({ label: 'かけ算九九も', kinds: Object.freeze(['add1', 'sub1', 'mul']), goalMs: 2200 }),
  Object.freeze({ label: '答えが2けたの足し算・引き算', kinds: Object.freeze(['add2', 'sub2', 'mul']), goalMs: 2700 }),
  Object.freeze({ label: '割り算も', kinds: Object.freeze(['add2', 'sub2', 'mul', 'div']), goalMs: 2900 }),
  Object.freeze({ label: '2けた×1けた', kinds: Object.freeze(['add2', 'sub2', 'div', 'mul21']), goalMs: 4200 }),
]);
export const SPEED_MAX_LEVEL = SPEED_LEVELS.length - 1;
export const SPEED_SLOW_FACTOR = 1.7;
/** 測定は、いつも段1(いちばん易しい段)で測る。前と後を同じ条件でくらべるため。 */
export const SPEED_MEASURE_LEVEL = 0;

/** 1つの式。textは画面に出す式、answerは答え。 */
function speedExpression(rng, kind) {
  switch (kind) {
    case 'add1': {
      const a = between(rng, 1, 8);
      const b = between(rng, 1, 9 - a);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case 'sub1': {
      const a = between(rng, 2, 9);
      const b = between(rng, 1, a - 1);
      return { text: `${a} − ${b}`, answer: a - b };
    }
    case 'mul': {
      const a = between(rng, 2, 9);
      const b = between(rng, 2, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    case 'add2': {
      if (rng.next() < 0.5) {
        const a = between(rng, 2, 9);
        const b = between(rng, Math.max(2, 10 - a), 9);
        return { text: `${a} + ${b}`, answer: a + b };
      }
      const a = between(rng, 11, 89);
      const b = between(rng, 2, Math.min(9, 99 - a));
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case 'sub2': {
      const a = between(rng, 11, 59);
      const b = between(rng, 2, 9);
      return { text: `${a} − ${b}`, answer: a - b };
    }
    case 'div': {
      const b = between(rng, 2, 9);
      const q = between(rng, 2, 9);
      return { text: `${b * q} ÷ ${b}`, answer: q };
    }
    case 'mul21': {
      const a = between(rng, 11, 39);
      const b = between(rng, 2, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    default:
      throw new Error(`unknown kind: ${kind}`);
  }
}

/**
 * スピード計算の1回の問題。同じ種と段なら同じ問題。同じ式は1回の中で2度出さない。
 * @param {number} seed
 * @param {number} level 段(0から)
 * @param {number} count
 * @returns {{ text: string, answer: number, kind: string }[]}
 */
export function speedProblems(seed, level, count = 20) {
  const rng = createRng(seed);
  const { kinds } = SPEED_LEVELS[Math.max(0, Math.min(SPEED_MAX_LEVEL, Math.floor(level)))];
  const seen = new Set();
  const list = [];
  let guard = 0;
  while (list.length < count && guard < count * 50) {
    guard += 1;
    const kind = kinds[Math.floor(rng.next() * kinds.length)];
    const expression = speedExpression(rng, kind);
    if (seen.has(expression.text) && guard < count * 40) continue;
    seen.add(expression.text);
    list.push({ ...expression, kind });
  }
  return list;
}

/**
 * 次の回の段。1問の平均が目安より速ければ1段上、目安の1.7倍より遅い回が2回続けば1段下(D:4-2)。
 * @param {{ level: number, slow: number }} state
 * @param {number} averageMs
 */
export function nextSpeedLevel(state, averageMs) {
  const level = Math.max(0, Math.min(SPEED_MAX_LEVEL, Math.floor(state.level)));
  const { goalMs } = SPEED_LEVELS[level];
  if (averageMs <= goalMs) return { level: Math.min(SPEED_MAX_LEVEL, level + 1), slow: 0, moved: level < SPEED_MAX_LEVEL ? 1 : 0 };
  if (averageMs > goalMs * SPEED_SLOW_FACTOR) {
    const slow = (state.slow ?? 0) + 1;
    if (slow >= 2) return { level: Math.max(0, level - 1), slow: 0, moved: level > 0 ? -1 : 0 };
    return { level, slow, moved: 0 };
  }
  return { level, slow: 0, moved: 0 };
}

/** 記録の見せ方。「1問1.8秒」。 */
export function perProblemText(ms) {
  return `1問${(Math.max(0, ms) / 1000).toFixed(1)}秒`;
}

// ===== N問前の答え =====

export const NBACK_MIN = 1;
export const NBACK_MAX = 9;
/** 1回(ラウンド)で答える数。初めのN枚は覚えるだけなので、1回の式は10＋N枚。 */
export const NBACK_ANSWERS = 10;
/** 1回で9問以上合えばNを1つ上げ、6問以下ならNを1つ下げる(Nは1回の途中では変えない)。 */
export const NBACK_UP_AT = 9;
export const NBACK_DOWN_AT = 6;
/** 測定は、N=1から合格するかぎり上げていき、この数で止める。 */
export const NBACK_MEASURE_MAX = 5;

/** 答えが1けた(0〜9)の、易しい式。Nを主な難しさにし、式は易しく保つ(11-5)。 */
function easyExpression(rng) {
  if (rng.next() < 0.5) {
    const a = between(rng, 0, 9);
    const b = between(rng, 0, 9 - a);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  const a = between(rng, 1, 9);
  const b = between(rng, 0, a);
  return { text: `${a} − ${b}`, answer: a - b };
}

/**
 * N問前の答えの1回分。itemsは出る順の式、expected[i]はi枚目の式が出たときに答える数(初めのN枚はnull)。
 * 同じ種とNなら同じ並び。続けて同じ式は出さない。
 * @param {number} seed
 * @param {number} n
 */
export function nbackRound(seed, n) {
  const back = Math.max(NBACK_MIN, Math.min(NBACK_MAX, Math.floor(n)));
  const rng = createRng(seed);
  const items = [];
  while (items.length < back + NBACK_ANSWERS) {
    const expression = easyExpression(rng);
    if (items.at(-1)?.text === expression.text) continue;
    items.push(expression);
  }
  const expected = items.map((_, index) => (index >= back ? items[index - back].answer : null));
  return { n: back, items, expected };
}

/** 1回の結果から、次のN。 */
export function nextNback(n, correct) {
  if (correct >= NBACK_UP_AT) return Math.min(NBACK_MAX, n + 1);
  if (correct <= NBACK_DOWN_AT) return Math.max(NBACK_MIN, n - 1);
  return n;
}

/** 1回で合格したか(記録は合格したいちばん大きいN)。 */
export function nbackPassed(correct) {
  return correct >= NBACK_UP_AT;
}

export function nbackText(n) {
  return n > 0 ? `${n}つ前まで` : '';
}

// ===== 色で切り替え =====

/**
 * 段ごとの、枠の色が変わる割合と、答えるまでの時間(0は制限なし)。
 * 時間を過ぎたら「まちがい」として次へ進む(ライフや負けはない。D:7-1)。
 */
export const SWITCH_LEVELS = Object.freeze([
  { switchRate: 0.2, limitMs: 0 },
  { switchRate: 0.3, limitMs: 0 },
  { switchRate: 0.4, limitMs: 0 },
  { switchRate: 0.5, limitMs: 3000 },
  { switchRate: 0.5, limitMs: 2400 },
  { switchRate: 0.5, limitMs: 1900 },
  { switchRate: 0.6, limitMs: 1500 },
  { switchRate: 0.6, limitMs: 1200 },
  { switchRate: 0.7, limitMs: 1000 },
  { switchRate: 0.7, limitMs: 800 },
].map((level) => Object.freeze(level)));
export const SWITCH_MAX_LEVEL = SWITCH_LEVELS.length - 1;
/** 枠の色と答え方。青は偶数か奇数か、赤は5より大きいか小さいか。5は出さない。 */
export const SWITCH_RULES = Object.freeze({
  parity: Object.freeze({ color: 'blue', label: '青', question: '偶数？奇数？', options: Object.freeze([{ id: 'even', label: '偶数' }, { id: 'odd', label: '奇数' }]) }),
  size: Object.freeze({ color: 'red', label: '赤', question: '5より小さい？大きい？', options: Object.freeze([{ id: 'small', label: '小さい' }, { id: 'large', label: '大きい' }]) }),
});
const SWITCH_NUMBERS = [1, 2, 3, 4, 6, 7, 8, 9];

export function switchLevel(level) {
  return SWITCH_LEVELS[Math.max(0, Math.min(SWITCH_MAX_LEVEL, Math.floor(level)))];
}

/**
 * 1問を作る。前の問題の規則(prevRule)から、段の割合で枠の色を変える。同じ種なら同じ問題。
 * @param {number} seed
 * @param {'parity' | 'size' | null} prevRule
 * @param {number} level
 */
export function switchTrial(seed, prevRule, level) {
  const rng = createRng(seed);
  const { switchRate, limitMs } = switchLevel(level);
  const other = prevRule === 'parity' ? 'size' : 'parity';
  const rule = prevRule ? (rng.next() < switchRate ? other : prevRule) : (rng.next() < 0.5 ? 'parity' : 'size');
  const number = SWITCH_NUMBERS[Math.floor(rng.next() * SWITCH_NUMBERS.length)];
  return { rule, number, answer: switchAnswer(rule, number), limitMs, level: Math.max(0, Math.min(SWITCH_MAX_LEVEL, Math.floor(level))), switched: Boolean(prevRule) && rule !== prevRule };
}

export function switchAnswer(rule, number) {
  if (rule === 'parity') return number % 2 === 0 ? 'even' : 'odd';
  return number > 5 ? 'large' : 'small';
}

/** 答えの採点。時間の制限がある段では、時間を過ぎた答えもまちがい。 */
export function scoreSwitch(trial, answer, ms) {
  const inTime = trial.limitMs === 0 || ms <= trial.limitMs;
  return { correct: inTime && answer === trial.answer, inTime };
}

/**
 * 1回のまとめ。記録(value)は、2問続けて正解したいちばん上の段+1(ちらっと盤と同じ。0は記録なし)。
 * averageMsは正解した問題の平均の時間、accuracyは正解の割合。
 * @param {{ level: number, correct: boolean, ms: number }[]} trials
 */
export function switchSummary(trials) {
  let best = -1;
  let streak = 0;
  for (const trial of trials) {
    if (trial.correct) {
      streak += 1;
      if (streak >= 2) best = Math.max(best, trial.level);
    } else {
      streak = 0;
    }
  }
  const right = trials.filter((trial) => trial.correct);
  const averageMs = right.length ? Math.round(right.reduce((sum, trial) => sum + trial.ms, 0) / right.length) : 0;
  return {
    value: best + 1,
    correct: right.length,
    total: trials.length,
    averageMs,
    accuracy: trials.length ? right.length / trials.length : 0,
  };
}

/** 段の見せ方。「1.5秒以内で切り替え」。 */
export function switchLevelText(level) {
  const { limitMs } = switchLevel(level);
  return limitMs ? `${(limitMs / 1000).toFixed(1)}秒以内で切り替え` : '時間の制限なしで切り替え';
}

/** 1回の記録の言い方。「1問0.9秒・正解9割」(11-5)。 */
export function switchResultText(summary) {
  if (!summary.total) return '';
  return `${perProblemText(summary.averageMs)}・正解${Math.round(summary.accuracy * 10)}割`;
}
