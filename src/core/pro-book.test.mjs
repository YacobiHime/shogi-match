import { describe, expect, it } from 'vitest';
import { BOOK_GROUPS, ERA_BOOK_WEIGHT, bookKey, bookMoves, pickBookMove } from './pro-book.mjs';
import { PRO_OPENING_BOOK } from '../data/pro-opening-book.mjs';
import { FastBoard } from './fast-board.mjs';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

describe('プロの序盤の手(docs/disciple-mode-design.mdの40-9)', () => {
  it('鍵は手数を除いた局面で、表の手は数を持ち、初形には7六歩と2六歩がある', () => {
    expect(bookKey(START)).toBe(bookKey(START.replace(/ 1$/, ' 31')));
    const moves = bookMoves(START);
    expect(moves.map((m) => m.usi)).toEqual(expect.arrayContaining(['7g7f', '2g2f']));
    for (const m of moves) {
      expect(m.counts).toHaveLength(BOOK_GROUPS.length);
      expect(m.total).toBeGreaterThanOrEqual(2);
    }
  });

  it('表の手はどれもその局面で指せる', () => {
    for (const [key, row] of Object.entries(PRO_OPENING_BOOK).slice(0, 300)) {
      const board = FastBoard.fromSfen(`${key} 1`);
      const legal = new Set(board.legal().map((m) => board.toUsi(m)));
      for (const item of row.split(' ')) expect(legal.has(item.split(':')[0])).toBe(true);
    }
  });

  it('局の数に比例して選び、育った時代の局を多めに数える。表にない局面はnull', () => {
    const table = { [bookKey(START)]: '7g7f:0,0,0,0,1,0 2g2f:1,0,0,0,0,0' };
    // 江戸の棋士: 2六歩の重みはERA_BOOK_WEIGHT、7六歩は1。
    expect(pickBookMove(START, { era: 'edo', random: () => 1 / (ERA_BOOK_WEIGHT + 1) - 1e-9, table })).toBe('7g7f');
    expect(pickBookMove(START, { era: 'edo', random: () => 1 / (ERA_BOOK_WEIGHT + 1) + 1e-9, table })).toBe('2g2f');
    expect(pickBookMove(START, { random: () => 0.49, table })).toBe('7g7f');
    expect(pickBookMove('4k4/9/9/9/9/9/9/9/4K4 b - 1', { table })).toBeNull();
  });
});
