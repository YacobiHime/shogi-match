import { describe, expect, test, vi } from 'vitest';

import {
  COACH_ADVICE_MIN_DISPLAY_MS,
  createCoachAdviceScheduler,
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
