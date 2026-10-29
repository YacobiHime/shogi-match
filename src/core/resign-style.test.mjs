import { describe, expect, it } from 'vitest';
import { RESIGN_STYLES, RESIGN_STYLE_SHARES, matedIn, resignStyleById, resignStyleOf, resignsBy } from './resign-style.mjs';
import { HANANE, YOSHIHIKO } from './ryuo-story.mjs';

describe('投了の早さ(docs/tournament-relay-design.mdの29章)', () => {
  it('詰みの読みから、自分の手のあとに残る相手の何手詰めか', () => {
    expect(matedIn({ type: 'mate', value: -6 })).toBe(5);
    expect(matedIn({ type: 'mate', value: -1 })).toBe(1);
    expect(matedIn({ type: 'mate', value: 3 })).toBeNull();
    expect(matedIn({ type: 'cp', value: -9000 })).toBeNull();
  });

  it('段ごとに、何手詰めまで指すか・どの点で投げるかが違う(詰みまで指す人もいる)', () => {
    const mated = (plies) => ({ value: -100000 + plies, score: { type: 'mate', value: -plies } });
    expect(resignsBy(resignStyleById('clean'), { best: mated(10) })).toBe(true);
    expect(resignsBy(resignStyleById('normal'), { best: mated(10) })).toBe(false);
    expect(resignsBy(resignStyleById('normal'), { best: mated(6) })).toBe(true);
    expect(resignsBy(resignStyleById('stubborn'), { best: mated(6) })).toBe(false);
    expect(resignsBy(resignStyleById('stubborn'), { best: mated(4) })).toBe(true);
    expect(resignsBy(resignStyleById('full'), { best: mated(2) })).toBe(false);
    // 点は2回続けて。詰みまで指す人は点では投げない。
    const lost = { value: -9500 };
    expect(resignsBy(resignStyleById('stubborn'), { best: lost, lastValue: null })).toBe(false);
    expect(resignsBy(resignStyleById('stubborn'), { best: lost, lastValue: -9500 })).toBe(true);
    expect(resignsBy(resignStyleById('full'), { best: lost, lastValue: -9500 })).toBe(false);
    expect(resignStyleById('unknown').id).toBe('normal');
  });

  it('棋士ごとに毎回同じに決まり、名簿全体では割合どおり。粘りの特徴で粘る側へ寄る', () => {
    const counts = Object.fromEntries(RESIGN_STYLES.map(({ id }) => [id, 0]));
    for (let index = 0; index < 2000; index += 1) counts[resignStyleOf({ id: `p${index}` }).id] += 1;
    for (const [id, share] of Object.entries(RESIGN_STYLE_SHARES)) {
      expect(counts[id] / 2000).toBeGreaterThan(share / 100 - 0.04);
      expect(counts[id] / 2000).toBeLessThan(share / 100 + 0.04);
    }
    expect(resignStyleOf({ id: 'p7' })).toBe(resignStyleOf({ id: 'p7' }));
    const order = RESIGN_STYLES.map(({ id }) => id);
    for (let index = 0; index < 50; index += 1) {
      const plain = order.indexOf(resignStyleOf({ id: `q${index}` }).id);
      const tough = order.indexOf(resignStyleOf({ id: `q${index}`, character: { traits: [{ id: 'tenacious' }] } }).id);
      expect(tough).toBe(Math.min(order.length - 1, plain + 1));
    }
  });

  it('分身はふつう、善彦は潔い、羽音は粘る', () => {
    expect(resignStyleOf({ id: 'user' }).id).toBe('normal');
    expect(resignStyleOf({ id: 'p1', story: YOSHIHIKO }).id).toBe('clean');
    expect(resignStyleOf({ id: 'p2', story: HANANE }).id).toBe('stubborn');
    expect(resignStyleOf(null).id).toBe('normal');
  });
});
