import { describe, expect, test } from 'vitest';

import {
  NBACK_ANSWERS,
  NBACK_MAX,
  SPEED_LEVELS,
  SPEED_MAX_LEVEL,
  SWITCH_LEVELS,
  SWITCH_MAX_LEVEL,
  nbackPassed,
  nbackRound,
  nbackText,
  nextNback,
  nextSpeedLevel,
  perProblemText,
  scoreSwitch,
  speedProblems,
  switchAnswer,
  switchLevelText,
  switchResultText,
  switchSummary,
  switchTrial,
} from './brain-calc.mjs';

/** 画面に出す式を計算し直す(×÷−を使う)。 */
function evaluate(text) {
  const [a, op, b] = text.split(' ');
  const x = Number(a);
  const y = Number(b);
  if (op === '+') return x + y;
  if (op === '−') return x - y;
  if (op === '×') return x * y;
  if (op === '÷') return x / y;
  throw new Error(op);
}

describe('スピード計算', () => {
  test('同じ種と段なら同じ問題。答えはいつも0以上の整数で、式と合う', () => {
    expect(speedProblems(9, 2)).toEqual(speedProblems(9, 2));
    for (let level = 0; level <= SPEED_MAX_LEVEL; level += 1) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const list = speedProblems(seed, level);
        expect(list).toHaveLength(20);
        for (const problem of list) {
          expect(Number.isInteger(problem.answer)).toBe(true);
          expect(problem.answer).toBeGreaterThanOrEqual(0);
          expect(evaluate(problem.text)).toBe(problem.answer);
          expect(SPEED_LEVELS[level].kinds).toContain(problem.kind);
        }
        // 同じ式は1回の中で2度出さない。
        expect(new Set(list.map(({ text }) => text)).size).toBe(list.length);
      }
    }
  });

  test('段1は答えが1けた、段3からは答えが2けたの足し算・引き算、割り算は割り切れる', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const problem of speedProblems(seed, 0)) expect(problem.answer).toBeLessThanOrEqual(9);
      for (const problem of speedProblems(seed, 2)) {
        if (problem.kind === 'add2') expect(problem.answer).toBeGreaterThanOrEqual(10);
        if (problem.kind === 'add2' || problem.kind === 'sub2') expect(problem.answer).toBeLessThanOrEqual(99);
      }
      for (const problem of speedProblems(seed, 3)) {
        if (problem.kind === 'div') {
          const [a, , b] = problem.text.split(' ').map(Number);
          expect(a % b).toBe(0);
        }
      }
    }
  });

  test('目安より速ければ1段上、とても遅い回が2回続けば1段下', () => {
    expect(nextSpeedLevel({ level: 0, slow: 0 }, 1500)).toEqual({ level: 1, slow: 0, moved: 1 });
    expect(nextSpeedLevel({ level: SPEED_MAX_LEVEL, slow: 0 }, 1000)).toEqual({ level: SPEED_MAX_LEVEL, slow: 0, moved: 0 });
    const goal = SPEED_LEVELS[2].goalMs;
    expect(nextSpeedLevel({ level: 2, slow: 0 }, goal * 1.2)).toEqual({ level: 2, slow: 0, moved: 0 });
    const once = nextSpeedLevel({ level: 2, slow: 0 }, goal * 2);
    expect(once).toEqual({ level: 2, slow: 1, moved: 0 });
    expect(nextSpeedLevel(once, goal * 2)).toEqual({ level: 1, slow: 0, moved: -1 });
    // 間にふつうの回があれば数え直す。
    expect(nextSpeedLevel(once, goal * 1.2).slow).toBe(0);
    expect(perProblemText(1840)).toBe('1問1.8秒');
  });
});

describe('N問前の答え', () => {
  test('式は10＋N枚、答えは1けた。答えるのはN枚前の式の答え', () => {
    for (let n = 1; n <= NBACK_MAX; n += 1) {
      const round = nbackRound(n * 7, n);
      expect(round.items).toHaveLength(NBACK_ANSWERS + n);
      round.items.forEach((item, index) => {
        expect(evaluate(item.text)).toBe(item.answer);
        expect(item.answer).toBeGreaterThanOrEqual(0);
        expect(item.answer).toBeLessThanOrEqual(9);
        if (index > 0) expect(item.text).not.toBe(round.items[index - 1].text);
        expect(round.expected[index]).toBe(index >= n ? round.items[index - n].answer : null);
      });
    }
    expect(nbackRound(3, 2)).toEqual(nbackRound(3, 2));
    expect(nbackRound(3, 20).n).toBe(NBACK_MAX);
  });

  test('9問以上でNが上がり、6問以下で下がる', () => {
    expect(nextNback(2, 10)).toBe(3);
    expect(nextNback(2, 9)).toBe(3);
    expect(nextNback(2, 8)).toBe(2);
    expect(nextNback(2, 6)).toBe(1);
    expect(nextNback(1, 0)).toBe(1);
    expect(nextNback(NBACK_MAX, 10)).toBe(NBACK_MAX);
    expect(nbackPassed(9)).toBe(true);
    expect(nbackPassed(8)).toBe(false);
    expect(nbackText(3)).toBe('3つ前まで');
  });
});

describe('色で切り替え', () => {
  test('青は偶数か奇数か、赤は5より大きいか小さいか。5は出さない', () => {
    expect(switchAnswer('parity', 4)).toBe('even');
    expect(switchAnswer('parity', 7)).toBe('odd');
    expect(switchAnswer('size', 3)).toBe('small');
    expect(switchAnswer('size', 8)).toBe('large');
    for (let seed = 1; seed <= 200; seed += 1) {
      const trial = switchTrial(seed, seed % 2 ? 'parity' : null, seed % (SWITCH_MAX_LEVEL + 1));
      expect(trial.number).not.toBe(5);
      expect(trial.answer).toBe(switchAnswer(trial.rule, trial.number));
    }
    expect(switchTrial(5, 'size', 3)).toEqual(switchTrial(5, 'size', 3));
  });

  test('段が上がると、色の変わる割合が増え、答える時間が短くなる', () => {
    for (let level = 1; level <= SWITCH_MAX_LEVEL; level += 1) {
      expect(SWITCH_LEVELS[level].switchRate).toBeGreaterThanOrEqual(SWITCH_LEVELS[level - 1].switchRate);
      const [before, now] = [SWITCH_LEVELS[level - 1].limitMs || Infinity, SWITCH_LEVELS[level].limitMs || Infinity];
      expect(now).toBeLessThanOrEqual(before);
    }
    // 割合どおりに色が変わる(たくさん作ってだいたい合う)。
    let switched = 0;
    for (let seed = 1; seed <= 2000; seed += 1) if (switchTrial(seed, 'parity', SWITCH_MAX_LEVEL).switched) switched += 1;
    expect(switched / 2000).toBeGreaterThan(0.62);
    expect(switched / 2000).toBeLessThan(0.78);
    expect(switchLevelText(0)).toBe('時間の制限なしで切り替え');
    expect(switchLevelText(SWITCH_MAX_LEVEL)).toBe('0.8秒以内で切り替え');
  });

  test('時間を過ぎた答えはまちがい。まとめは2問続けて正解した段と、正解の平均の時間', () => {
    const trial = switchTrial(1, 'parity', SWITCH_MAX_LEVEL);
    expect(scoreSwitch(trial, trial.answer, 500)).toEqual({ correct: true, inTime: true });
    expect(scoreSwitch(trial, trial.answer, 5000)).toEqual({ correct: false, inTime: false });
    const free = switchTrial(1, 'parity', 0);
    expect(scoreSwitch(free, free.answer, 9000).correct).toBe(true);
    const summary = switchSummary([
      { level: 2, correct: true, ms: 800 },
      { level: 2, correct: true, ms: 1000 },
      { level: 3, correct: false, ms: 1500 },
      { level: 2, correct: true, ms: 900 },
    ]);
    expect(summary).toEqual({ value: 3, correct: 3, total: 4, averageMs: 900, accuracy: 0.75 });
    expect(switchResultText(summary)).toBe('1問0.9秒・正解8割');
    expect(switchSummary([]).value).toBe(0);
  });
});
