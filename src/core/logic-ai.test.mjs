import { describe, expect, it } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves, STANDARD_SFEN } from '../game-state.ts';
import { chooseLogicMove, logicPerception, usesLogicAi } from './logic-ai.mjs';
import { createRng } from './ryuo-random.mjs';

const legal = (sfen) => enumerateLegalMoves(Position.newBySFEN(sfen)).map(({ usi }) => usi);
/** 種を変えて何度も選ばせ、条件に合う手の割合を返す。 */
function rate(sfen, level, predicate, { runs = 60, planMove = null } = {}) {
  const moves = legal(sfen);
  let hits = 0;
  for (let seed = 1; seed <= runs; seed += 1) {
    const choice = chooseLogicMove({ sfen, legalMoves: moves, level, planMove, random: createRng(seed).next });
    expect(moves).toContain(choice.move);
    if (predicate(choice)) hits += 1;
  }
  return hits / runs;
}

describe('logic AI levels', () => {
  it('covers Lv1 to Lv10 and notices more as the level rises', () => {
    expect(usesLogicAi(0)).toBe(false);
    expect(usesLogicAi(1)).toBe(true);
    expect(usesLogicAi(10)).toBe(true);
    expect(usesLogicAi(11)).toBe(false);
    for (let level = 2; level <= 10; level += 1) {
      const low = logicPerception(level - 1);
      const high = logicPerception(level);
      for (const key of ['freeCapture', 'hanging', 'exchange', 'threat', 'mate1', 'defendMate', 'followPlan']) {
        expect(high[key]).toBeGreaterThanOrEqual(low[key]);
      }
      expect(high.temperature).toBeLessThanOrEqual(low.temperature);
    }
  });
});

describe('logic AI moves', () => {
  it('takes a free rook more often at higher levels', () => {
    // 先手の銀(5f)の前に、後手の飛車(5e)がただで置いてある。
    // 目的のない玉移動は候補から外すため、見逃したときに指せる歩も置く。
    const sfen = '4k4/9/9/9/4r4/4S4/2P6/9/4K4 b - 1';
    const strong = rate(sfen, 10, ({ move }) => move === '5f5e' || move === '5f5e+');
    const weak = rate(sfen, 1, ({ move }) => move === '5f5e' || move === '5f5e+');
    expect(strong).toBeGreaterThan(0.8);
    expect(strong).toBeGreaterThan(weak);
  });

  it('saves an attacked bishop when it notices the danger', () => {
    // 先手の角(5e)に、後手の歩(5d)が当たっている。角に味方の利きはない。
    const sfen = '4k4/9/9/4p4/4B4/9/PPPPPPPPP/9/4K4 b - 1';
    const strong = rate(sfen, 10, ({ move }) => move.startsWith('5e'));
    const weak = rate(sfen, 1, ({ move }) => move.startsWith('5e'));
    expect(strong).toBeGreaterThan(0.7);
    expect(strong).toBeGreaterThan(weak);
  });

  it('mates in one at higher levels', () => {
    const sfen = '4k4/9/4P4/9/9/9/9/9/4K4 b G 1';
    expect(rate(sfen, 10, ({ move }) => move === 'G*5b')).toBeGreaterThan(0.8);
    expect(rate(sfen, 1, ({ move }) => move === 'G*5b')).toBeLessThan(0.8);
  });

  it('follows the opening plan in a quiet position', () => {
    const planned = rate(STANDARD_SFEN, 5, ({ move }) => move === '2g2f', { planMove: '2g2f' });
    expect(planned).toBeGreaterThan(0.6);
    const choice = chooseLogicMove({ sfen: STANDARD_SFEN, legalMoves: legal(STANDARD_SFEN), level: 5, planMove: '2g2f', random: createRng(3).next });
    expect(choice).toMatchObject({ kind: 'logic', phase: 'opening' });
  });

  it('answers quickly even with many pieces in hand', () => {
    const sfen = 'l6nl/5gk2/2n1psp2/p1pp2Bpp/1p7/P1PP1P1PP/1PS1P1N2/2G2K3/LN6L b RGS2Prbgs2p 61';
    const started = Date.now();
    const choice = chooseLogicMove({ sfen, legalMoves: legal(sfen), level: 10, random: createRng(5).next });
    expect(legal(sfen)).toContain(choice.move);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
