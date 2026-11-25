import { describe, expect, it } from 'vitest';
import { ERA_BASE_YEAR, eraForAge, eraOfYear, eraOpeningShares } from './pro-eras.mjs';
import { PRO_OPENING_ERAS } from '../data/pro-opening-eras.mjs';
import { createRepertoire } from './ryuo-repertoire.mjs';
import { createRng } from './ryuo-random.mjs';

describe('棋士の育った時代と作戦の割合(docs/disciple-mode-design.mdの40章)', () => {
  it('年齢から、20歳の頃の時代を決める', () => {
    expect(eraOfYear(1850)).toBe('edo');
    expect(eraOfYear(1950)).toBe('early');
    expect(eraOfYear(1980)).toBe('showa');
    expect(eraOfYear(2005)).toBe('heisei');
    expect(eraOfYear(2022)).toBe('reiwa');
    expect(eraForAge(ERA_BASE_YEAR - 1980 + 20)).toBe('showa');
    expect(eraForAge(25)).toBe('reiwa');
    expect(eraForAge(null)).toBe('reiwa');
  });

  it('時代の表があれば、振り飛車の割合と戦法の重みを出し、乱数を使う回数は今までと同じ', () => {
    for (const era of Object.keys(PRO_OPENING_ERAS)) {
      const shares = eraOpeningShares(era);
      expect(shares).not.toBeNull();
      expect(shares.ranging).toBeGreaterThanOrEqual(0);
      expect(shares.ranging).toBeLessThanOrEqual(1);
      expect(Object.keys(shares.staticWeights).every((id) => !id.startsWith('other-'))).toBe(true);
    }
    expect(eraOpeningShares('none')).toBeNull();
    // eraがあってもなくても、乱数を同じ回数だけ使う(得意戦法のあとに作る名前・棋風が変わらない)。
    const a = createRng(7);
    const b = createRng(7);
    createRepertoire(a, 3);
    createRepertoire(b, 3, { era: 'showa' });
    expect(a.next()).toBe(b.next());
  });
});
