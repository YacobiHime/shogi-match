import { describe, expect, test, vi } from 'vitest';

import {
  COACH_ADVICE_MIN_DISPLAY_MS,
  createCoachAdviceScheduler,
  shouldDisplayCoachAdvice,
} from './coach-advice-scheduler.mjs';

describe('助言の表示時間', () => {
  test('先の助言を6秒保持し、後続の助言をあとから表示する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.text) });
    scheduler.present({ key: 'castle-mino', text: '相手は美濃囲いだね。' });
    scheduler.present({ key: 'candidate-evaluation-cliff', text: '何かあるよ、気を付けて！' });
    expect(shown).toEqual(['相手は美濃囲いだね。']);
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS - 1);
    expect(shown).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(shown).toEqual(['相手は美濃囲いだね。', '何かあるよ、気を付けて！']);
    vi.useRealTimers();
  });

  test('待機中は優先度の高い助言を残す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.key) });
    scheduler.present({ key: 'strategy-swinging-rook', text: '囲いの提案' });
    scheduler.present({ key: 'opening-even', text: '互角' });
    scheduler.present({ key: 'king-in-check', text: '王手' });
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS);
    expect(shown).toEqual(['strategy-swinging-rook', 'king-in-check']);
    vi.useRealTimers();
  });

  test('詰み助言は通常助言の表示時間を待たず即時表示する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.key) });
    scheduler.present({ key: 'opening-even', text: '互角' });
    scheduler.present({ key: 'mate-win-1', text: '1手詰めだね、頑張って！' });
    expect(shown).toEqual(['opening-even', 'mate-win-1']);
    vi.useRealTimers();
  });

  test('詰みの助言どうしは、あとから届いた助言を待たずに出す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.key) });
    scheduler.present({ key: 'mate-win-3', text: '3手で詰ませられるよ' });
    scheduler.present({ key: 'mate-win-1', text: '1手詰めだね、頑張って！' });
    scheduler.present({ key: 'mate-win-1', text: '1手詰めだね、頑張って！' });
    expect(shown).toEqual(['mate-win-3', 'mate-win-1']);
    vi.useRealTimers();
  });

  test('リセットすると待機中の助言を表示しない', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.key) });
    scheduler.present({ key: 'castle-yagura', text: '矢倉' });
    scheduler.present({ key: 'candidate-evaluation-cliff', text: '注意' });
    scheduler.reset();
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS);
    expect(shown).toEqual(['castle-yagura']);
    vi.useRealTimers();
  });
});

describe('助言を出してよいか', () => {
  const sfen = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 2';
  const later = 'lnsgkgsnl/1r5b1/ppppppp1p/7p1/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3';

  test('同じ助言は、直近8手のうちは繰り返さない', () => {
    const advice = { key: 'prefer-defense', sfen };
    expect(shouldDisplayCoachAdvice({ advice, currentSfen: sfen, moveCount: 30, lastShownAt: 26 })).toBe(false);
    expect(shouldDisplayCoachAdvice({ advice, currentSfen: sfen, moveCount: 34, lastShownAt: 26 })).toBe(true);
  });

  test('「待った」で手数が戻ったあとは、戻った先より後に出した記録を数えない', () => {
    // 40手目で出したあと、待ったで36手目に戻った。戻った先でも、同じ助言を出す。
    const advice = { key: 'candidate-evaluation-cliff', sfen };
    expect(shouldDisplayCoachAdvice({ advice, currentSfen: sfen, moveCount: 36, lastShownAt: 40 })).toBe(true);
  });

  test('局面についての助言は、表示を待つ間に局面が進んだら出さない', () => {
    expect(shouldDisplayCoachAdvice({
      advice: { key: 'mate-risk-top3', sfen }, currentSfen: later, moveCount: 3,
    })).toBe(false);
  });

  test('直前の着手への助言は、局面が進んでも出す', () => {
    for (const key of ['move-mistake--620', 'move-blunder--1500', 'praise-good-move', 'enter-enemy-camp']) {
      expect(shouldDisplayCoachAdvice({ advice: { key, sfen }, currentSfen: later, moveCount: 3 }), key).toBe(true);
    }
  });

  test('王手・詰みの助言は、続けて出す', () => {
    expect(shouldDisplayCoachAdvice({
      advice: { key: 'king-in-check', sfen }, currentSfen: sfen, moveCount: 30, lastShownAt: 28,
    })).toBe(true);
  });

  test('棋譜検討では、局面を行き来しても同じ助言を出す', () => {
    expect(shouldDisplayCoachAdvice({
      advice: { key: 'middle-even' }, review: true, currentSfen: sfen, moveCount: 40, lastShownAt: 42,
    })).toBe(true);
  });
});
