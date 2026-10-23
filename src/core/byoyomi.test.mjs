import { describe, expect, it } from 'vitest';
import { BYOYOMI_BEEP_FROM, byoyomiLabel, byoyomiRing, byoyomiSeconds, byoyomiSound } from './byoyomi.mjs';

describe('秒読みの演出', () => {
  it('設定がない前の版の期は、なし', () => {
    expect(byoyomiSeconds(undefined)).toBe(0);
    expect(byoyomiSeconds({})).toBe(0);
    expect(byoyomiSeconds({ byoyomi: 30 })).toBe(30);
    expect(byoyomiSeconds({ byoyomi: 17 })).toBe(0);
    expect(byoyomiLabel(30)).toBe('30秒');
    expect(byoyomiLabel(0)).toBe('なし');
  });

  it('10秒から1秒ごとに鳴らし、0秒で長い音', () => {
    expect(byoyomiSound(BYOYOMI_BEEP_FROM + 1)).toBeNull();
    expect(byoyomiSound(BYOYOMI_BEEP_FROM)).toBe('byoyomi');
    expect(byoyomiSound(1)).toBe('byoyomi');
    expect(byoyomiSound(0)).toBe('byoyomi-end');
    expect(byoyomiSound(-1)).toBeNull();
  });

  it('輪は残りの割合と段を持ち、0秒は時間いっぱい(負けにはしない)', () => {
    expect(byoyomiRing(30, 30)).toMatchObject({ fraction: 1, stage: 'calm', label: '残り30秒' });
    expect(byoyomiRing(10, 30)).toMatchObject({ stage: 'hurry' });
    expect(byoyomiRing(0, 30)).toMatchObject({ fraction: 0, stage: 'up', label: '時間いっぱい' });
    expect(byoyomiRing(-3, 30).left).toBe(0);
  });
});
