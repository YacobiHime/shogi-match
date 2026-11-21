import { describe, expect, it } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves } from '../game-state';
import { FastBoard } from './fast-board.mjs';
import { createRng } from './ryuo.mjs';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

describe('速い局面(34-15 E2.5)', () => {
  it('平手の初形は30手', () => {
    const board = FastBoard.fromSfen(START);
    expect(board.legal().map((m) => board.toUsi(m)).sort()).toEqual(enumerateLegalMoves(Position.newBySFEN(START)).map((m) => m.usi).sort());
  });

  it('でたらめに指し進めた局面で、合法手がtsshogiと同じ。指して戻すと盤と鍵が元に戻る', () => {
    const rng = createRng(77);
    let checked = 0;
    for (let game = 0; game < 14; game += 1) {
      const position = Position.newBySFEN(START);
      const board = FastBoard.fromSfen(START);
      for (let ply = 0; ply < 110; ply += 1) {
        const theirs = enumerateLegalMoves(position).map((m) => m.usi).sort();
        const moves = board.legal();
        expect(moves.map((m) => board.toUsi(m)).sort(), position.sfen).toEqual(theirs);
        expect(board.inCheck()).toBe(Boolean(position.checked));
        checked += 1;
        if (!theirs.length) break;
        const key = board.key();
        const snapshot = [...board.sq].join(',') + [...board.hand].join(',');
        for (const m of moves) {
          board.make(m);
          board.unmake(m);
        }
        expect(board.key()).toBe(key);
        expect([...board.sq].join(',') + [...board.hand].join(',')).toBe(snapshot);
        const captures = moves.filter((m) => board.sq[(m >> 7) & 127] !== 0);
        const pool = captures.length && rng.next() < 0.6 ? captures : moves;
        const move = pool[Math.floor(rng.next() * pool.length)];
        position.doMove(position.createMoveByUSI(board.toUsi(move)));
        board.make(move);
        // 同じ局面は同じ鍵。
        expect(board.key()).toBe(FastBoard.fromSfen(position.sfen).key());
        expect(FastBoard.fromSfen(board.toSfen()).key()).toBe(board.key());
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it('打ち歩詰めは指せない', () => {
    const board = FastBoard.fromSfen('7nk/7p1/8G/9/9/9/9/9/K8 b P 1');
    expect(board.legal().map((m) => board.toUsi(m))).not.toContain('P*1b');
  });
});
