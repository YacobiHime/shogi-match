import { describe, expect, it } from 'vitest';
import { GIVEN_NAMES_BY_ERA, REAL_NAME_BLOCKLIST, SURNAME_WEIGHTS, newName } from './ryuo-names.mjs';
import { PARTY_SHARES, createRepertoire, pickGameStyle, repertoireText, styleEntry } from './ryuo-repertoire.mjs';
import { OPPONENT_STYLES } from './ryuo-data.mjs';
import { createRng } from './ryuo-random.mjs';

const surnames = SURNAME_WEIGHTS.map(([name]) => name).sort((a, b) => b.length - a.length);
const split = (name) => {
  const surname = surnames.find((candidate) => name.startsWith(candidate));
  return [surname, name.slice(surname.length)];
};

describe('names', () => {
  it('uses common surnames more often and never repeats a name', () => {
    const rng = createRng(1);
    const used = new Set();
    // 名簿と同じくらいの人数(約200名)で、年齢はばらばら。
    const names = Array.from({ length: 200 }, (_, index) => newName(rng, used, { age: 18 + (index % 55) }));
    expect(new Set(names).size).toBe(names.length);
    const count = (surname) => names.filter((name) => split(name)[0] === surname).length;
    const rare = SURNAME_WEIGHTS.filter(([, weight]) => weight === 1).map(([name]) => name);
    expect(count('佐藤')).toBeGreaterThanOrEqual(4);
    expect(count('佐藤') * rare.length).toBeGreaterThan(rare.reduce((sum, name) => sum + count(name), 0) * 5);
  });

  it('chooses given names from the generation of the player', () => {
    const rng = createRng(2);
    const used = new Set();
    const old = GIVEN_NAMES_BY_ERA[0].names;
    const young = GIVEN_NAMES_BY_ERA.at(-2).names;
    for (let index = 0; index < 100; index += 1) {
      expect(old).toContain(split(newName(rng, used, { age: 72 }))[1]);
      expect(young).toContain(split(newName(rng, used, { age: 19 }))[1]);
    }
  });

  it('avoids the names of real players', () => {
    const rng = createRng(3);
    const used = new Set();
    for (let index = 0; index < 3000; index += 1) {
      expect(REAL_NAME_BLOCKLIST.has(newName(rng, used, { age: 20 + (index % 55) }))).toBe(false);
    }
  });
});

describe('repertoire', () => {
  const sample = (group, count = 2000) => Array.from({ length: count }, (_, seed) => createRepertoire(createRng(seed + 1), group));

  it('makes ranging-rook players a minority, rarer in the upper groups', () => {
    const share = (group) => sample(group).filter(({ party }) => party === 'ranging').length / 2000;
    expect(share(1)).toBeCloseTo(PARTY_SHARES[1].ranging, 1);
    expect(share(6)).toBeCloseTo(PARTY_SHARES[6].ranging, 1);
    expect(share(1)).toBeLessThan(share(6));
  });

  it('gives two or three distinct styles that match the party', () => {
    const ids = new Set(OPPONENT_STYLES.map(({ id }) => id));
    for (const repertoire of sample(4, 500)) {
      expect(repertoire.styles.length).toBeGreaterThanOrEqual(2);
      expect(repertoire.styles.length).toBeLessThanOrEqual(3);
      expect(new Set(repertoire.styles).size).toBe(repertoire.styles.length);
      for (const id of repertoire.styles) expect(ids.has(id)).toBe(true);
      const rooks = new Set(repertoire.styles.map((id) => styleEntry(id).rook));
      if (repertoire.party === 'both') expect(rooks).toEqual(new Set(['static', 'ranging']));
      else expect(rooks).toEqual(new Set([repertoire.party]));
      expect(repertoireText(repertoire)).toMatch(/党|オールラウンダー/);
    }
  });

  it('plays the main style most often', () => {
    const repertoire = { party: 'static', styles: ['aigakari', 'yagura', 'gangi'] };
    const rng = createRng(9);
    const main = Array.from({ length: 2000 }, () => pickGameStyle(rng, repertoire).id).filter((id) => id === 'aigakari').length / 2000;
    expect(main).toBeCloseTo(0.6, 1);
  });
});
