import { describe, expect, it } from 'vitest';
import { MATE, evaluateTerms, searchBestMove } from './logic-search.mjs';
import { FastBoard } from './fast-board.mjs';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

describe('全部の手を読む論理の探索(34-15)', () => {
  it('1手詰めを見つける', () => {
    const got = searchBestMove('8k/9/7G1/9/9/9/9/9/K8 b G 1', { depth: 3 });
    expect(got.score).toBeGreaterThan(MATE - 100);
    const board = FastBoard.fromSfen('8k/9/7G1/9/9/9/9/9/K8 b G 1');
    board.make(board.fromUsi(got.move));
    expect(board.inCheck() && !board.hasLegal()).toBe(true);
  });
  it('ただの駒を取る', () => {
    expect(searchBestMove('k8/9/9/9/4s4/9/9/4R4/K8 b - 1', { depth: 3 }).move).toBe('5h5e');
  });
  it('王手飛車取りの桂打ちを見つける(両取りの得は、静かな手のあとの取り合いで見える)', () => {
    expect(searchBestMove('5r1k1/9/9/9/9/9/9/9/K8 b N 1', { depth: 3 }).move).toBe('N*3c');
  });
  it('取られる飛車を逃がす(何もしなければ取られる駒)', () => {
    // 先手の飛車5五に後手の銀4四が利き、銀は守られている。
    const got = searchBestMove('k8/9/3g5/3s5/4R4/9/9/9/K8 b - 1', { depth: 3 });
    const board = FastBoard.fromSfen('k8/9/3g5/3s5/4R4/9/9/9/K8 b - 1');
    board.make(board.fromUsi(got.move));
    // 指したあと、相手の最善の手でも駒を大きく損しない(相手から見た点が飛車1枚ぶんに届かない)。
    const sfen = board.toSfen();
    expect(searchBestMove(sfen, { depth: 3 }).score).toBeLessThan(300);
  });
  it('初形は互角に近く、形の点は名前ごとに分けて出せる', () => {
    const terms = evaluateTerms(FastBoard.fromSfen(START));
    expect(terms.material).toBe(0);
    expect(Object.keys(terms)).toEqual(['material', 'hand', 'guard', 'kingCenter', 'attacker', 'mobility']);
    expect(Math.abs(searchBestMove(START, { depth: 3 }).score)).toBeLessThan(200);
  });
});
