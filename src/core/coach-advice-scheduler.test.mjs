import { describe, expect, test, vi } from 'vitest';

import {
  COACH_ADVICE_MIN_DISPLAY_MS,
  createCoachAdviceScheduler,
  isStaleAdvice,
  shouldDisplayCoachAdvice,
} from './coach-advice-scheduler.mjs';

const S1 = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 2';
const S2 = 'lnsgkgsnl/1r5b1/ppppppp1p/7p1/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 3';
const S3 = 'lnsgkgsnl/1r5b1/ppppppp1p/7p1/9/2PP5/PP2PPPPP/1B5R1/LNSGKGSNL w - 4';

describe('助言の表示時間', () => {
  test('先の助言を6秒保持し、後続の助言をあとから表示する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.text) });
    scheduler.present({ key: 'castle-mino', text: '相手は美濃囲いだね。', sfen: S1, ply: 2 });
    scheduler.present({ key: 'middle-even', text: '互角だよ。', sfen: S1, ply: 2 });
    expect(shown).toEqual(['相手は美濃囲いだね。']);
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS - 1);
    expect(shown).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(shown).toEqual(['相手は美濃囲いだね。', '互角だよ。']);
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
    scheduler.present({ key: 'middle-even', text: '互角' });
    scheduler.reset();
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS);
    expect(shown).toEqual(['castle-yagura']);
    vi.useRealTimers();
  });
});

describe('過ぎた局面の話を残さない(11-5)', () => {
  test('盤が進んだら、表示中の局面の助言を待たずに、新しい局面の助言を出す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.key) });
    scheduler.present({ key: 'threat-silver', text: '銀が取られそう', sfen: S1, ply: 2 });
    vi.advanceTimersByTime(1000);
    scheduler.present({ key: 'middle-even', text: '互角', sfen: S2, ply: 3 });
    expect(shown).toEqual(['threat-silver', 'middle-even']);
    vi.useRealTimers();
  });

  test('プレイヤーの手へのほめ言葉は、CPUの応手のあとも保持する。次の手を指したあとは保持しない', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.key) });
    scheduler.present({ key: 'praise-good-move', text: '好手！', sfen: S1, ply: 2 });
    scheduler.present({ key: 'middle-even', text: '互角', sfen: S2, ply: 3 });
    expect(shown).toEqual(['praise-good-move']);
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS);
    expect(shown).toEqual(['praise-good-move', 'middle-even']);
    scheduler.present({ key: 'praise-tesuji', text: '手筋！', sfen: S3, ply: 4 });
    vi.advanceTimersByTime(1000);
    // 次のほめ言葉を見せているあいだに、2手先の局面の助言が来たら待たずに出す。
    scheduler.present({ key: 'endgame-defend-first', text: '受けよう', sfen: S1, ply: 6 });
    expect(shown.at(-1)).toBe('endgame-defend-first');
    vi.useRealTimers();
  });

  test('危険の知らせは、表示中の助言より重ければ待たずに出す。軽ければ待つ', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.key) });
    scheduler.present({ key: 'middle-even', text: '互角', sfen: S2, ply: 3 });
    scheduler.present({ key: 'threat-silver', text: '銀が取られそう', sfen: S2, ply: 3 });
    scheduler.present({ key: 'candidate-evaluation-cliff', text: '何かあるよ', sfen: S2, ply: 3 });
    expect(shown).toEqual(['middle-even', 'threat-silver']);
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS);
    expect(shown).toEqual(['middle-even', 'threat-silver', 'candidate-evaluation-cliff']);
    vi.useRealTimers();
  });

  test('待機中の局面の助言は、出す前に盤が進んだら出さない(画面の側で捨てる)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    let current = S2;
    const scheduler = createCoachAdviceScheduler({
      display: (advice) => {
        if (!shouldDisplayCoachAdvice({ advice, currentSfen: current, moveCount: 3 })) return false;
        shown.push(advice.key);
        return true;
      },
    });
    scheduler.present({ key: 'castle-mino', text: '美濃', sfen: S2, ply: 3 });
    scheduler.present({ key: 'middle-even', text: '互角', sfen: S2, ply: 3 });
    current = S3;
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS);
    expect(shown).toEqual(['castle-mino']);
    vi.useRealTimers();
  });

  test('遅れて届いた古い局面の助言は、待機中の助言を消さない', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const shown = [];
    const scheduler = createCoachAdviceScheduler({ display: (advice) => shown.push(advice.key) });
    scheduler.present({ key: 'castle-mino', text: '美濃', sfen: S2, ply: 3 });
    scheduler.present({ key: 'middle-even', text: '互角', sfen: S2, ply: 3 });
    scheduler.present({ key: 'opening-even', text: '前の局面の一言', sfen: S1, ply: 2 });
    vi.advanceTimersByTime(COACH_ADVICE_MIN_DISPLAY_MS);
    expect(shown).toEqual(['castle-mino', 'middle-even']);
    vi.useRealTimers();
  });

  test('過ぎた局面の話かの判定', () => {
    expect(isStaleAdvice({ key: 'threat-silver', sfen: S1, ply: 2 }, { sfen: S2, ply: 3 })).toBe(true);
    expect(isStaleAdvice({ key: 'threat-silver', sfen: S1, ply: 2 }, { sfen: S1, ply: 2 })).toBe(false);
    expect(isStaleAdvice({ key: 'praise-good-move', sfen: S1, ply: 2 }, { sfen: S2, ply: 3 })).toBe(false);
    expect(isStaleAdvice({ key: 'move-mistake--400', sfen: S1, ply: 2 }, { sfen: S3, ply: 4 })).toBe(true);
    expect(isStaleAdvice({ key: 'castle-mino' }, { sfen: S2, ply: 3 })).toBe(false);
    expect(isStaleAdvice(null, { sfen: S2, ply: 3 })).toBe(false);
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

  test('直前の着手への助言は、CPUの応手のあとまで。次の手を指したあとには出さない', () => {
    const advice = { key: 'move-mistake--620', sfen, ply: 2 };
    expect(shouldDisplayCoachAdvice({ advice, currentSfen: later, moveCount: 3 })).toBe(true);
    expect(shouldDisplayCoachAdvice({ advice, currentSfen: later, moveCount: 4 })).toBe(false);
  });

  test('いま出ている助言が過ぎた局面の話なら、繰り返しになっても出す(古い台詞を残さない)', () => {
    const advice = { key: 'middle-even', sfen: later };
    expect(shouldDisplayCoachAdvice({ advice, currentSfen: later, moveCount: 30, lastShownAt: 26 })).toBe(false);
    expect(shouldDisplayCoachAdvice({
      advice, currentSfen: later, moveCount: 30, lastShownAt: 26, displayed: { key: 'threat-silver', sfen, ply: 29 },
    })).toBe(true);
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
