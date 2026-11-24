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
    expect(Object.keys(terms)).toEqual(['material', 'hand', 'guard', 'kingCenter', 'attacker', 'mobility', 'kingZone', 'castle', 'camp', 'loose', 'hanging']);
    expect(Math.abs(searchBestMove(START, { depth: 3 }).score)).toBeLessThan(200);
  });
});

describe('将棋AI(論理)の駒の価値と形の点(39章)', () => {
  it('と金は取る側に歩の価値で、守られたと金を飛車で取ると前の版より大きな損になる', async () => {
    const { LOGIC_VALUES, captureSwing } = await import('./logic-values.mjs');
    // と金を取った得は、盤から消えると金(歩＋成った分)と持ち駒の歩。飛車を渡す損(盤の飛車＋相手の持ち駒の飛車)よりずっと小さい。
    expect(captureSwing('+P')).toBe(LOGIC_VALUES['+P'] + LOGIC_VALUES.P);
    expect(captureSwing('+P')).toBeLessThan(captureSwing('S'));
    expect(captureSwing('+P') - captureSwing('R')).toBeLessThan(-1500);
    // 馬と角の交換は、馬−角の分だけ得。
    expect(captureSwing('+B') - captureSwing('B')).toBe(LOGIC_VALUES['+B'] - LOGIC_VALUES.B);
    expect(LOGIC_VALUES['+B'] - LOGIC_VALUES.B).toBeGreaterThan(0);
    const sfen = '4k4/9/6g2/7+p1/9/9/PPPPPPP1P/7R1/4K4 b - 1';
    const best = searchBestMove(sfen, { depth: 3, shape: false, maxTimeMs: 2000 });
    expect(best.move).not.toBe('2h2d');
  });

  it('形の点の段3は、敵陣の利き・浮き駒を数える', () => {
    const board = FastBoard.fromSfen('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
    const terms = evaluateTerms(board, { shape: 3 });
    expect(terms.camp).toBe(0);
    expect(terms.loose).toBe(0);
    // 先手の飛車を2四へ出すと、敵陣の利きが増える(歩を突いたあとの形)。
    const out = FastBoard.fromSfen('lnsgkgsnl/1r5b1/ppppppp1p/7R1/9/9/PPPPPPP1P/1B7/LNSGKGSNL w Pp 1');
    expect(evaluateTerms(out, { shape: 3 }).camp).toBeGreaterThan(0);
    // 浮いた金は形の点が下がる。
    const loose = FastBoard.fromSfen('4k4/9/9/9/4G4/9/9/9/4K4 b - 1');
    expect(evaluateTerms(loose, { shape: 3 }).loose).toBeLessThan(0);
  });
});
