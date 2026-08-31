import { describe, expect, it } from 'vitest';
import {
  coachAdviceForPosition,
  normalizeCoachAdviceHistory,
  pruneCoachAdviceAfterPly,
  recordCoachAdvice,
} from './coach-advice-history.mjs';

const first = { ply: 12, sfen: 'position-a', key: 'middle-even', text: 'まだ互角だよ。' };
const second = { ply: 14, sfen: 'position-b', key: 'prefer-defense', text: '今は守ろう。' };

describe('やこび姫助言の局面別記録', () => {
  it('同じ局面には最後に表示された助言だけを残す', () => {
    const history = recordCoachAdvice([first], {
      ...first,
      key: 'still-resilient',
      text: 'まだ耐えられるよ！',
    });
    expect(history).toEqual([{ ...first, key: 'still-resilient', text: 'まだ耐えられるよ！' }]);
  });

  it('SFENが完全に一致する局面だけから助言を取り出す', () => {
    const history = [first, second];
    expect(coachAdviceForPosition(history, 'position-b')).toEqual(second);
    expect(coachAdviceForPosition(history, 'different-position')).toBeNull();
  });

  it('待ったで外れた手数の記録を削除する', () => {
    expect(pruneCoachAdviceAfterPly([first, second], 12)).toEqual([first]);
  });

  it('保存データから不正・過大・範囲外の項目を除外する', () => {
    expect(normalizeCoachAdviceHistory([
      first,
      { ...second, ply: 999 },
      { ...second, text: '' },
      { ...second, sfen: 'x'.repeat(513) },
    ], 20)).toEqual([first]);
  });
});
