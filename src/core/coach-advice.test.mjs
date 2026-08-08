import { describe, expect, test } from 'vitest';

import {
  getCoachAdvice,
  isSideToMoveInCheck,
  scoreAfterOpponentMove,
} from './coach-advice.mjs';

describe('対局中の応援・助言', () => {
  test('CPU視点の評価値を着手後のプレイヤー視点へ反転する', () => {
    expect(scoreAfterOpponentMove({ type: 'cp', value: 320 }))
      .toEqual({ type: 'cp', value: -320 });
    expect(scoreAfterOpponentMove({ type: 'mate', value: -8 }))
      .toEqual({ type: 'mate', value: 7 });
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
});
