import { describe, expect, it } from 'vitest';
import {
  ABILITIES, ABILITY_OF_TYPE, TARGET_SUCCESS, TEST_LENGTH, TEST_PLAN, answerItem, createTestState, nextItem, posteriorLevel,
  successProbability, testFinished, testResult,
} from './skill-test.mjs';

/** 再現できる乱数(mulberry32)。 */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 種類ごとに、難しさ0〜46の問題を2Lvおきに並べた束。 */
const BANK = Object.keys(ABILITY_OF_TYPE).flatMap((type) => Array.from({ length: 24 }, (_, index) => ({
  id: `${type}-${index}`, type, b: index * 2, guess: type === 'judge' ? 1 / 3 : 0,
})));

/** 決まった強さ(力ごとの差つき)の模擬の受験者に、テストを最後まで受けさせる。 */
function takeTest(trueLevel, { random, prior = null, abilityShift = {} }) {
  let state = createTestState({ prior });
  while (!testFinished(state)) {
    const item = nextItem(state, BANK, random);
    if (!item) break;
    const level = trueLevel + (abilityShift[ABILITY_OF_TYPE[item.type]] ?? 0);
    state = answerItem(state, item, { correct: random() < successProbability(level, item), ms: 20000 });
  }
  return { state, result: testResult(state) };
}

describe('棋力テスト', () => {
  it('出題の順は16問で、見る・読む・受ける・判断が4問ずつ', () => {
    expect(TEST_PLAN).toHaveLength(TEST_LENGTH);
    for (const { id } of ABILITIES) expect(TEST_PLAN.filter((type) => ABILITY_OF_TYPE[type] === id)).toHaveLength(4);
    // 正解しやすさは強いほど高く、3択は当て推量の1/3より下がらない。
    expect(successProbability(30, { b: 20 })).toBeGreaterThan(successProbability(10, { b: 20 }));
    expect(successProbability(0, { b: 40, guess: 1 / 3 })).toBeGreaterThan(0.33);
  });

  it('今の推定で、正解の見込みが6〜7割の問題を選び、同じ問題は2度出さない', () => {
    const random = seeded(1);
    let state = createTestState({ prior: { band: [16, 24] } });
    const seen = new Set();
    for (let index = 0; index < TEST_LENGTH; index += 1) {
      const item = nextItem(state, BANK, random);
      expect(item).not.toBeNull();
      expect(seen.has(item.id)).toBe(false);
      seen.add(item.id);
      // 選んだ問題は、その種類の残りの中で、正解の見込みが狙い(6〜7割)に近い3問のどれか。
      const { level } = posteriorLevel(state.answers, state.prior);
      const distance = (entry) => Math.abs(successProbability(level, entry) - TARGET_SUCCESS);
      const sameType = BANK.filter(({ id, type }) => type === item.type && !seen.has(id));
      const third = sameType.map(distance).sort((x, y) => x - y)[2] ?? Infinity;
      expect(distance(item)).toBeLessThanOrEqual(third + 1e-9);
      state = answerItem(state, item, { correct: index % 3 !== 0 });
    }
    expect(testFinished(state)).toBe(true);
    expect(nextItem(state, BANK, random)).toBeNull();
  });

  it('模擬の受験者(答え方が式どおり)なら、16問で本当の強さの近くに出る', () => {
    const random = seeded(20261027);
    const errors = [];
    let covered = 0;
    for (const trueLevel of [4, 10, 16, 20, 24, 30, 36, 42]) {
      for (let trial = 0; trial < 12; trial += 1) {
        const { result } = takeTest(trueLevel, { random });
        errors.push(Math.abs(result.level - trueLevel));
        if (Math.abs(result.level - trueLevel) <= result.spread) covered += 1;
      }
    }
    const mean = errors.reduce((sum, error) => sum + error, 0) / errors.length;
    // 出し方と採点の手順の確かめ(人での精度ではない。docs/skill-assessment-design.mdの8章)。
    expect(mean).toBeLessThan(3);
    expect(covered / errors.length).toBeGreaterThan(0.55);
  });

  it('力ごとの強さを出し、いちばん良い力と伸びしろの力を返す', () => {
    const random = seeded(7);
    const { result } = takeTest(20, { random, abilityShift: { defend: 8, judge: -8 } });
    expect(result.total).toBe(TEST_LENGTH);
    for (const { id } of ABILITIES) expect(result.abilities[id].n).toBe(4);
    expect(result.abilities.defend.level).toBeGreaterThan(result.abilities.judge.level);
    expect(result.best).not.toBe('judge');
    // 「わからない」は不正解として数える。
    const state = answerItem(createTestState(), BANK[0], { correct: true, skipped: true, ms: 1200.6 });
    expect(state.answers[0]).toMatchObject({ correct: false, skipped: true, ms: 1201 });
  });

  it('全部まちがえても、力ごとの強さが全部、全体より下にずれない(札の幅は全体にだけ効く)', () => {
    let state = createTestState({ prior: { band: [16, 24] } });
    const pick = (type, index) => BANK.find((item) => item.type === type && item.b === 2 * (index + 1));
    TEST_PLAN.forEach((type, index) => { state = answerItem(state, pick(type, index % 12), { correct: false, skipped: true }); });
    const result = testResult(state);
    for (const { id } of ABILITIES) expect(Math.abs(/** @type {number} */ (result.abilities[id].level) - result.level)).toBeLessThan(2.5);
    expect(result.best).toBeNull();
  });
});
