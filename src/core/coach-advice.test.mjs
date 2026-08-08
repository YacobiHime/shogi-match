import { describe, expect, test } from 'vitest';

import {
  getCoachAdvice,
  getMoveFeedback,
  isSideToMoveInCheck,
  scoreAfterOpponentMove,
  scoreFromOpponentPerspective,
} from './coach-advice.mjs';

describe('対局中の応援・助言', () => {
  test('CPU視点の評価値を着手後のプレイヤー視点へ反転する', () => {
    expect(scoreAfterOpponentMove({ type: 'cp', value: 320 }))
      .toEqual({ type: 'cp', value: -320 });
    expect(scoreAfterOpponentMove({ type: 'mate', value: -8 }))
      .toEqual({ type: 'mate', value: 7 });
    expect(scoreFromOpponentPerspective({ type: 'cp', value: 1235 }))
      .toEqual({ type: 'cp', value: -1235 });
  });

  test('序盤の有利・不利に応じて応援する', () => {
    expect(getCoachAdvice({ score: { type: 'cp', value: 300 }, moveCount: 20 })?.text)
      .toBe('良い出だしだね！');
    expect(getCoachAdvice({ score: { type: 'cp', value: -300 }, moveCount: 20 })?.text)
      .toContain('まだまだやれるよ');
  });

  test('詳しい助言では詰み手数と詰めろを知らせる', () => {
    expect(getCoachAdvice({ level: 'detailed', score: { type: 'mate', value: 7 } })?.text)
      .toBe('7手詰めだね、頑張って！');
    expect(getCoachAdvice({ level: 'detailed', score: { type: 'mate', value: -5 } })?.text)
      .toContain('詰めろだね');
  });

  test('手番側の玉に王手がかかっているかを判定する', () => {
    expect(isSideToMoveInCheck('4r4/9/9/9/9/9/9/9/4K4 b - 1')).toBe(true);
    expect(isSideToMoveInCheck('4k4/9/9/9/9/9/9/9/4K4 b - 1')).toBe(false);
  });

  test('エルモ囲いの助言は未案内のときだけ返す', () => {
    expect(getCoachAdvice({
      level: 'detailed', opponentFormations: ['エルモ囲い'], advisedTopics: [],
    })?.text).toContain('上からの攻め');
    expect(getCoachAdvice({
      level: 'detailed', opponentFormations: ['エルモ囲い'], advisedTopics: ['elmo'],
    })).toBeNull();
  });

  test('助言なしでは何も表示しない', () => {
    expect(getCoachAdvice({ level: 'off', score: { type: 'mate', value: 7 } })).toBeNull();
  });

  test('詳しい助言では大きな評価低下を悪手として指摘する', () => {
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: 100 },
      afterScore: { type: 'cp', value: -500 },
    })?.text).toBe('悪手だね…評価値-500だよ。');
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: 200 },
      afterScore: { type: 'cp', value: -1235 },
    })?.text).toBe('あちゃ～。やっちゃった…評価値-1235だよ。');
  });

  test('被詰みが確定した局面では投了を示唆する', () => {
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: -500 },
      afterScore: { type: 'mate', value: -7 },
    })?.text).toContain('投了する…？');
  });

  test('不利でも評価を改善した手は悪手扱いしない', () => {
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: -4000 },
      afterScore: { type: 'cp', value: -3000 },
    })).toBeNull();
  });
});
