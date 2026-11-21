import { describe, expect, it } from 'vitest';
import { Position } from 'tsshogi';
import { enumerateLegalMoves } from '../game-state';
import { stateFromSfen, playLight } from './logic-position.mjs';
import { isCheckmated, legalMoves } from './light-moves.mjs';
import { createRng } from './ryuo.mjs';

const sameMoves = (sfen) => {
  const mine = [...legalMoves(stateFromSfen(sfen))].sort();
  const theirs = enumerateLegalMoves(Position.newBySFEN(sfen)).map((move) => move.usi).sort();
  return { mine, theirs };
};

describe('軽い局面の合法手(34章 E1)', () => {
  it('平手の初形はtsshogiと同じ30手', () => {
    const { mine, theirs } = sameMoves('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
    expect(mine).toHaveLength(30);
    expect(mine).toEqual(theirs);
  });

  it('でたらめに指し進めた局面(打つ手・成る手・王手を含む)で、tsshogiと同じ手になる', () => {
    const rng = createRng(20261121);
    let checked = 0;
    for (let game = 0; game < 12; game += 1) {
      let position = Position.newBySFEN('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
      for (let ply = 0; ply < 90; ply += 1) {
        const sfen = position.sfen;
        const { mine, theirs } = sameMoves(sfen);
        expect(mine, sfen).toEqual(theirs);
        checked += 1;
        if (!theirs.length) break;
        // 駒を取る手を多めに選んで、持ち駒のある局面を作る。
        const captures = theirs.filter((usi) => !usi.includes('*') && position.board.at(Position.newBySFEN(sfen).createMoveByUSI(usi).to));
        const pool = captures.length && rng.next() < 0.6 ? captures : theirs;
        const usi = pool[Math.floor(rng.next() * pool.length)];
        position.doMove(position.createMoveByUSI(usi));
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('打ち歩詰めは指せない。詰みを見分ける', () => {
    // 後手玉1一、2一の桂と2二の歩が逃げ道をふさぎ、1三の金が1二を守る(1二への歩打ちは打ち歩詰め)。
    const sfen = '7nk/7p1/8G/9/9/9/9/9/K8 b P 1';
    expect(legalMoves(stateFromSfen(sfen))).not.toContain('P*1b');
    expect(sameMoves(sfen).mine).toEqual(sameMoves(sfen).theirs);
    const mated = playLight(stateFromSfen('8k/9/7G1/9/9/9/9/9/K8 b G 1'), 'G*1b');
    expect(isCheckmated(mated)).toBe(true);
  });
});
