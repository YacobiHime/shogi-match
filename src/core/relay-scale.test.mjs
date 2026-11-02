import { describe, expect, test } from 'vitest';

import { RELAY_SCALES, bumpScale, relayAudience, relayCommentCount, relayScale } from './relay-commentary.mjs';

describe('大会の規模でコメントの量を変える(48章)', () => {
  test('規模を持たない項目は重さから決め、前の項目と同じ量になる', () => {
    expect(relayScale({ weight: 'plain' })).toBe('mid');
    expect(relayScale({ weight: 'big' })).toBe('big');
    expect(relayScale({ weight: 'title' })).toBe('title');
    expect(relayScale({ weight: 'plain', scale: 'local' })).toBe('local');
    expect(bumpScale('local')).toBe('small');
    expect(bumpScale('title')).toBe('title');
    expect(bumpScale('local', -1)).toBe('local');
  });

  test('規模が大きいほど、量・来場者・コメント数の表示が増える', () => {
    const order = ['local', 'small', 'mid', 'upper', 'big', 'title'];
    for (let i = 1; i < order.length; i += 1) {
      const [a, b] = [RELAY_SCALES[order[i - 1]], RELAY_SCALES[order[i]]];
      expect(b.density).toBeGreaterThan(a.density);
      expect(b.audience).toBeGreaterThan(a.audience);
      expect(b.countRate).toBeGreaterThan(a.countRate);
      expect(relayCommentCount({ scale: order[i] }, 80, 40)).toBeGreaterThan(relayCommentCount({ scale: order[i - 1] }, 80, 40));
    }
    const spec = { key: 'k', black: { rating: 1500 }, white: { rating: 1500 } };
    expect(relayAudience({ ...spec, scale: 'title' }, 0)).toBeGreaterThan(relayAudience({ ...spec, scale: 'local' }, 0));
  });
});
