import { describe, expect, test } from 'vitest';

import { castleChecks, castleInsight, guardLinks } from './castle-insight.mjs';

// 攻める側(先手)は、どれも5五の竜と持ち駒の金(教室の攻めくらべと同じ)。
const ATTACKER = '/4+R4/9/9/9/4K4 b G 1';
const IGYOKU = `ln1gkg1nl/2s3s2/pppppp1pp/6p2${ATTACKER}`;
const MINO = `ln1g3nl/1ks1g4/pppppp1pp/6p2${ATTACKER}`;
const FUNA = `lns2gsnl/4g1kb1/pppppp1pp/6p2${ATTACKER}`;
const SCATTERED = `ln3g1nl/4k4/ppsp1pspp/2p1g4${ATTACKER}`;

describe('囲いの見くらべ', () => {
  test('居玉は▲5三竜と取られずに王手でき、逃げ道が0になる', () => {
    const insight = castleInsight(IGYOKU);
    expect(insight.holes).toEqual(['5c']);
    expect(insight.escapes).toBe(0);
    expect(insight.worst.label).toBe('▲5三竜');
    // 逃げ道をふさいでいるのは、玉の両どなりの金。
    expect(insight.blocked).toBeGreaterThan(0);
  });

  test('美濃囲いと舟囲いは、取られずにかけられる王手がなく、王手されても逃げ道がある', () => {
    for (const sfen of [MINO, FUNA]) {
      const insight = castleInsight(sfen);
      expect(insight.holes).toEqual([]);
      expect(insight.checks.length).toBeGreaterThan(0);
      expect(insight.checks.every(({ safe }) => !safe)).toBe(true);
      expect(insight.escapes).toBeGreaterThan(0);
    }
  });

  test('ひも: 美濃囲いは金銀がすべて守られ、ばらばらの玉には浮き駒がある', () => {
    const mino = guardLinks(MINO, 'white');
    expect(mino.loose).toEqual([]);
    expect(mino.links.length).toBeGreaterThanOrEqual(3);
    expect(mino.links).toContainEqual(['6a', '7b']);
    const scattered = guardLinks(SCATTERED, 'white');
    expect(scattered.loose).toContain('5d');
  });

  test('王手の一覧は、王手になる手だけで、行き先と玉の動けるマスを持つ', () => {
    for (const check of castleChecks(IGYOKU)) {
      expect(check.usi.endsWith(check.square) || check.usi.slice(2, 4) === check.square).toBe(true);
      expect(check.kingSquares).toHaveLength(check.kingMoves);
    }
  });
});
