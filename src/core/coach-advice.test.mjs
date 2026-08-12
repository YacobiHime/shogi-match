import { describe, expect, test } from 'vitest';

import {
  getCoachAdvice,
  getCandidateRiskAdvice,
  getMoveFeedback,
  isSideToMoveInCheck,
  scoreAfterOpponentMove,
  scoreFromOpponentPerspective,
  scoreForPlayer,
} from './coach-advice.mjs';

describe('候補手ごとの危険度助言', () => {
  test('最善手でも被詰みなら詰み手数を表示する', () => {
    expect(getCandidateRiskAdvice([
      { rank: 1, score: { type: 'mate', value: -7 } },
    ])?.text).toBe('詰んじゃった……7手詰めだね。');
  });

  test('王手と厳密な詰めろを区別して警告する', () => {
    expect(getCandidateRiskAdvice([
      { rank: 1, score: { type: 'cp', value: 20 } },
    ], { inCheck: true })?.text).toBe('王手きたーっ！！');
    expect(getCandidateRiskAdvice([
      { rank: 1, score: { type: 'cp', value: 20 } },
    ], { mateThreat: true })?.text).toBe('間違えたら詰みだよ。慎重に受けよう。');
  });

  test('4～5番手で被詰みになる場合は詰みの気配を伝える', () => {
    expect(getCandidateRiskAdvice([
      { rank: 1, score: { type: 'cp', value: 20 } },
      { rank: 4, score: { type: 'mate', value: -5 } },
    ])?.text).toBe('詰みがありそうな気がするな～？');
  });

  test('上位候補に大きな評価差があれば注意を促す', () => {
    expect(getCandidateRiskAdvice([
      { rank: 1, score: { type: 'cp', value: 500 } },
      { rank: 2, score: { type: 'cp', value: -250 } },
    ])?.text).toBe('何かあるよ、気を付けて！');
  });
});

describe('対局中の応援・助言', () => {
  test('CPU視点の評価値を着手後のプレイヤー視点へ反転する', () => {
    expect(scoreAfterOpponentMove({ type: 'cp', value: 320 }))
      .toEqual({ type: 'cp', value: -320 });
    expect(scoreAfterOpponentMove({ type: 'mate', value: -8 }))
      .toEqual({ type: 'mate', value: 7 });
    expect(scoreFromOpponentPerspective({ type: 'cp', value: 1235 }))
      .toEqual({ type: 'cp', value: -1235 });
  });

  test('探索時の手番とプレイヤーの先後から評価値を明示的に正規化する', () => {
    expect(scoreForPlayer({ type: 'cp', value: 900 }, 'black', 'black'))
      .toEqual({ type: 'cp', value: 900 });
    expect(scoreForPlayer({ type: 'cp', value: 900 }, 'black', 'white'))
      .toEqual({ type: 'cp', value: -900 });
    expect(scoreForPlayer({ type: 'mate', value: 7 }, 'white', 'black', 1))
      .toEqual({ type: 'mate', value: -6 });
  });

  test('序盤の有利・不利に応じて応援する', () => {
    expect(getCoachAdvice({ score: { type: 'cp', value: 300 }, moveCount: 20 })?.text)
      .toBe('良い出だしだね！');
    expect(getCoachAdvice({ score: { type: 'cp', value: -300 }, moveCount: 20 })?.text)
      .toContain('まだまだやれるよ');
  });

  test('互角の局面と81手目以降にも助言する', () => {
    expect(getCoachAdvice({ score: { type: 'cp', value: 0 }, moveCount: 20 })?.key)
      .toBe('opening-even');
    expect(getCoachAdvice({ score: { type: 'cp', value: 0 }, moveCount: 50 })?.key)
      .toBe('middle-even');
    expect(getCoachAdvice({ score: { type: 'cp', value: 0 }, moveCount: 100 })?.key)
      .toBe('endgame-even');
    expect(getCoachAdvice({ score: { type: 'cp', value: -700 }, moveCount: 100 })?.key)
      .toBe('endgame-behind');
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
    })?.text).toBe('悪手だね…評価値変動-600だよ。');
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: 200 },
      afterScore: { type: 'cp', value: -1235 },
    })?.text).toBe('あちゃ～。やっちゃった…評価値変動-1435だよ。');
  });

  test('着手後もプラス評価の場合も絶対値ではなく変動量を表示する', () => {
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: 2200 },
      afterScore: { type: 'cp', value: 1000 },
    })?.text).toBe('あちゃ～。やっちゃった…評価値変動-1200だよ。');
  });

  test('着手直後の評価だけでは勝敗を断定せず相対的な悪化を伝える', () => {
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: -500 },
      afterScore: { type: 'mate', value: -7 },
    })).toBeNull();
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: 1000 },
      afterScore: { type: 'cp', value: -3500 },
    })?.text).toBe('あちゃ～。やっちゃった…評価値変動-4500だよ。');
  });

  test('不利でも評価を改善した手は悪手扱いしない', () => {
    expect(getMoveFeedback({
      level: 'detailed',
      beforeScore: { type: 'cp', value: -4000 },
      afterScore: { type: 'cp', value: -3000 },
    })).toBeNull();
  });
});
