// 棋力テストの出題と採点(docs/skill-assessment-design.mdの4章)。問題の束(skill-test-bank.mjs)から、
// 今の推定で正解の見込みが6〜7割になる問題を選び、答えからテストで見た強さ(Lv)と幅、力ごとの強さを出す。
// 画面・保存・問題のデータに依存しない(問題の束は呼び出し側が渡す)。

export const TEST_LENGTH = 16;
/**
 * 出題の順(種類)。見る4(取る2・守る2)、読む4(手筋2・詰み2)、受ける4、判断4。
 * 同じ種類が続かないように回す。その種類の問題が残っていなければ、残っているほかの種類から出す。
 */
export const TEST_PLAN = Object.freeze([
  'take', 'tactic', 'defend', 'judge', 'save', 'mate', 'defend', 'judge',
  'take', 'tactic', 'defend', 'judge', 'save', 'mate', 'defend', 'judge',
]);
/** 問題の種類が測る力。 */
export const ABILITY_OF_TYPE = Object.freeze({ take: 'see', save: 'see', tactic: 'read', mate: 'read', defend: 'defend', judge: 'judge' });
export const ABILITIES = Object.freeze([
  Object.freeze({ id: 'see', label: '見る力', short: '見る', note: 'タダの駒を取る・取られそうな駒を守る' }),
  Object.freeze({ id: 'read', label: '読む力', short: '読む', note: '手筋で駒得する・詰ませる' }),
  Object.freeze({ id: 'defend', label: '受ける力', short: '受ける', note: '詰めろを受ける' }),
  Object.freeze({ id: 'judge', label: '判断する力', short: '判断', note: 'いちばん良い方針の手を選ぶ' }),
]);
/** 1Lvあたりの正解しやすさの傾き(ロジット)。 */
export const ITEM_SLOPE = 0.5;
/** うっかり(強い人でも外す見込み)。 */
export const ITEM_SLIP = 0.05;
/** 出す問題を選ぶときに狙う、正解の見込み。5割より少しやさしくして、外し続けて萎えないようにする(G:4-1)。 */
export const TARGET_SUCCESS = 0.65;
const MIN_LEVEL = 0;
const MAX_LEVEL = 49;
const STEP = 0.25;
const BAND_TAIL = 5;
const POPULATION_MEAN = 15;
const POPULATION_SD = 12;
/** 力ごとの強さを出すときの、全体の強さのまわりの幅(力ごとの問題は4問なので、全体に寄せる)。 */
const ABILITY_PRIOR_SD = 6;
/** 力ごとの差を全体に寄せる強さ(問題の数nに対して、n/(n+この値)だけ差を残す)。 */
const ABILITY_SHRINK = 4;

/**
 * 正解の起こりやすさ。g: 当て推量(3択は1/3)、b: 問題の難しさ(Lv)。
 * @param {number} level
 * @param {{ b: number, guess?: number }} item
 */
export function successProbability(level, { b, guess = 0 }) {
  return guess + (1 - guess - ITEM_SLIP) / (1 + Math.exp(-ITEM_SLOPE * (level - b)));
}

const levels = (() => {
  const list = [];
  for (let level = MIN_LEVEL; level <= MAX_LEVEL + 1e-9; level += STEP) list.push(level);
  return list;
})();

/**
 * 最初の目安の対数の起こりやすさ。band(札の幅)、または{ level, spread }(今の棋力)。どちらもなければ広い山。
 * @param {{ band?: readonly number[] | null, level?: number, spread?: number } | null} prior
 */
function priorLog(prior, level) {
  if (prior?.band) {
    const [low, high] = prior.band;
    const outside = level < low ? low - level : level > high ? level - high : 0;
    return -(outside ** 2) / (2 * BAND_TAIL ** 2);
  }
  if (Number.isFinite(prior?.level) && Number.isFinite(prior?.spread)) {
    return -((level - /** @type {number} */ (prior.level)) ** 2) / (2 * Math.max(4, /** @type {number} */ (prior.spread)) ** 2);
  }
  return -((level - POPULATION_MEAN) ** 2) / (2 * POPULATION_SD ** 2);
}

/**
 * 答えから、テストで見た強さ(平均)と幅(標準偏差)。
 * @param {{ b: number, guess?: number, correct: boolean }[]} answers
 * @param {Parameters<typeof priorLog>[0]} prior
 */
export function posteriorLevel(answers, prior) {
  const logs = levels.map((level) => answers.reduce((sum, answer) => {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, successProbability(level, answer)));
    return sum + (answer.correct ? Math.log(p) : Math.log(1 - p));
  }, priorLog(prior, level)));
  const max = Math.max(...logs);
  const weights = logs.map((log) => Math.exp(log - max));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const mean = weights.reduce((sum, weight, index) => sum + weight * levels[index], 0) / total;
  const variance = weights.reduce((sum, weight, index) => sum + weight * (levels[index] - mean) ** 2, 0) / total;
  return { level: mean, spread: Math.sqrt(Math.max(0, variance)) };
}

/**
 * テストを始める。priorは札の幅か今の棋力(なければ広い山)。
 * @param {{ prior?: Parameters<typeof priorLog>[0] }} [options]
 */
export function createTestState({ prior = null } = {}) {
  return { prior, answers: /** @type {{ id: string, type: string, b: number, guess: number, correct: boolean, skipped: boolean, ms: number }[]} */ ([]) };
}

/** テストが終わったか。 */
export const testFinished = (state) => state.answers.length >= TEST_LENGTH;

/**
 * 次に出す問題。出題の順の種類から、今の推定で正解の見込みがTARGET_SUCCESSに近い問題を選ぶ
 * (近い3問から乱数で1つ。同じ人が受け直しても、少しずつ違う問題になる)。出した問題は2度出さない。
 * @template {{ id: string, type: string, b: number, guess?: number }} T
 * @param {ReturnType<typeof createTestState>} state
 * @param {readonly T[]} bank
 * @param {() => number} [random]
 * @returns {T | null}
 */
export function nextItem(state, bank, random = Math.random) {
  if (testFinished(state)) return null;
  const used = new Set(state.answers.map(({ id }) => id));
  const left = bank.filter(({ id }) => !used.has(id));
  if (!left.length) return null;
  const type = TEST_PLAN[state.answers.length];
  const pool = left.some((item) => item.type === type) ? left.filter((item) => item.type === type) : left;
  const { level } = posteriorLevel(state.answers, state.prior);
  const ranked = [...pool].sort((a, b) => Math.abs(successProbability(level, a) - TARGET_SUCCESS) - Math.abs(successProbability(level, b) - TARGET_SUCCESS));
  return ranked[Math.floor(random() * Math.min(3, ranked.length))] ?? null;
}

/**
 * 答えを足す。skippedは「わからない」(不正解として数える)。msは考えた時間(採点には使わない)。
 * @param {ReturnType<typeof createTestState>} state
 * @param {{ id: string, type: string, b: number, guess?: number }} item
 * @param {{ correct: boolean, skipped?: boolean, ms?: number }} answer
 */
export function answerItem(state, item, { correct, skipped = false, ms = 0 }) {
  return {
    ...state,
    answers: [...state.answers, { id: item.id, type: item.type, b: item.b, guess: item.guess ?? 0, correct: Boolean(correct) && !skipped, skipped, ms: Math.max(0, Math.round(ms)) }],
  };
}

/**
 * テストの結果。全体の強さと幅、力ごとの強さ(その力の問題だけで、全体のまわりに寄せて出す)、正解の数。
 * @param {ReturnType<typeof createTestState>} state
 */
export function testResult(state) {
  const overall = posteriorLevel(state.answers, state.prior);
  // 力ごとの強さは、全体との差で出す。札の幅は全体にだけ効くので、力ごとに出し直すと、全部の力が全体より低い
  // (高い)ようなちぐはぐな見え方になる。広い山の上で「その力の問題だけ」と「全部の問題」の強さの差を取り、
  // 問題の数で全体へ寄せてから、全体の強さに足す。
  const flat = posteriorLevel(state.answers, null).level;
  const abilities = Object.fromEntries(ABILITIES.map(({ id }) => {
    const answers = state.answers.filter(({ type }) => ABILITY_OF_TYPE[type] === id);
    if (!answers.length) return [id, { n: 0, correct: 0, level: null, spread: null }];
    const own = posteriorLevel(answers, null).level;
    const level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, overall.level + (own - flat) * (answers.length / (answers.length + ABILITY_SHRINK))));
    const { spread } = posteriorLevel(answers, { level: overall.level, spread: ABILITY_PRIOR_SD });
    return [id, { n: answers.length, correct: answers.filter(({ correct }) => correct).length, level, spread }];
  }));
  const ranked = ABILITIES.filter(({ id }) => abilities[id].n).sort((a, b) => /** @type {number} */ (abilities[b.id].level) - /** @type {number} */ (abilities[a.id].level));
  return {
    level: overall.level,
    spread: overall.spread,
    correct: state.answers.filter(({ correct }) => correct).length,
    total: state.answers.length,
    abilities,
    // いちばん良かった力と、伸びしろの力(差が2Lvより小さければ、伸びしろは言わない)。
    // 測った力が1つだけのときや、いちばんの力でも1問も解けていないときは、ほめる力を言わない。
    best: ranked.length > 1 && abilities[ranked[0].id].correct > 0 ? ranked[0].id : null,
    weakest: ranked.length > 1 && /** @type {number} */ (abilities[ranked[0].id].level) - /** @type {number} */ (abilities[ranked.at(-1).id].level) >= 2 ? ranked.at(-1).id : null,
  };
}
