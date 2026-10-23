import { describe, expect, it } from 'vitest';
import { mistakeReason, pieceAt, threatAdvice, withMistakeReason } from './coach-reason.mjs';

// 先手が7六歩・3四歩のあと、2二の角が8八の角を取れる局面(後手の手番)。
const OPEN = 'lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 3';
// 先手の銀が5五に出て、後手の歩が5四にいる局面(後手の手番)。
const SILVER = 'lnsgkgsnl/1r5b1/pppp1pppp/4p4/4S4/9/PPPPPPPPP/1B5R1/LN1GKGSNL w - 4';
// 先手の飛車の前が空いて、後手の飛車が2筋に回っている局面(後手の手番)。
const ROOK = 'lnsgkgsnl/7b1/ppppppp1p/9/9/9/PPPPPPP1P/1B5r1/LNSGKGSNL w - 10';

describe('pieceAt', () => {
  it('reads pieces including promoted ones', () => {
    expect(pieceAt(OPEN, '8h')).toBe('B');
    expect(pieceAt(OPEN, '2b')).toBe('b');
    expect(pieceAt('9/9/9/9/4+R4/9/9/9/9 b - 1', '5e')).toBe('+R');
    expect(pieceAt(OPEN, '5e')).toBe('');
  });
});

describe('mistakeReason', () => {
  it('says the moved piece gets taken by the reply', () => {
    expect(mistakeReason({ sfenAfter: SILVER, playedUsi: '4f5e', pv: ['5d5e'], playerColor: 'black' }))
      .toBe('今動かした銀が、△5五歩で取られちゃう。');
  });
  it('says another piece gets taken', () => {
    expect(mistakeReason({ sfenAfter: OPEN, playedUsi: '7g7f', pv: ['2b8h+'], playerColor: 'black' }))
      .toBe('△8八角成で角を取られちゃう。');
  });
  it('does not call an even exchange a loss', () => {
    expect(mistakeReason({ sfenAfter: OPEN, playedUsi: '7g7f', pv: ['2b8h+', '7i8h'], playerColor: 'black' }))
      .toBe('相手の△8八角成が厳しいよ。');
  });
  it('names a rook or bishop promotion and falls back to the reply', () => {
    expect(mistakeReason({ sfenAfter: ROOK, playedUsi: '2g2f', pv: ['2h2g+'], playerColor: 'black' }))
      .toBe('△2七飛成で飛車に成り込まれちゃう。');
    expect(mistakeReason({ sfenAfter: ROOK, playedUsi: '2g2f', pv: ['2h2i+'], playerColor: 'black' }))
      .toBe('△2九飛成で桂を取られちゃう。');
    expect(mistakeReason({ sfenAfter: OPEN, playedUsi: '7g7f', pv: ['8c8d'], playerColor: 'black' }))
      .toBe('相手の△8四歩が厳しいよ。');
    expect(mistakeReason({ sfenAfter: OPEN, pv: [] })).toBeNull();
  });
});

describe('withMistakeReason', () => {
  it('rewrites only blunder and mistake lines and keeps the evaluation change', () => {
    const blunder = { key: 'move-blunder--1200', text: 'あちゃ～。今の私たちの手、やっちゃった…評価値変動-1200だよ。' };
    expect(withMistakeReason(blunder, '△8八角成で角を取られちゃう。').text)
      .toBe('あちゃ～、やっちゃった…△8八角成で角を取られちゃう。（評価値変動-1200）');
    const mistake = { key: 'move-mistake--600', text: '今の私たちの手は悪手だね…評価値変動-600だよ。' };
    expect(withMistakeReason(mistake, '相手の△8四歩が厳しいよ。').text).toBe('今の手は悪手だね…相手の△8四歩が厳しいよ。（評価値変動-600）');
    const other = { key: 'enter-enemy-camp', text: 'かち込むよ～！' };
    expect(withMistakeReason(other, 'x')).toBe(other);
    expect(withMistakeReason(blunder, null)).toBe(blunder);
  });
});

describe('threatAdvice', () => {
  const cp = (value) => ({ type: 'cp', value });
  it('names the opponent aim when it takes a big piece and gains enough', () => {
    expect(threatAdvice({ threatSfen: OPEN, threatMove: '2b8h+', threatScore: cp(900), playerScore: cp(0), playerColor: 'black' }))
      .toEqual({ key: 'threat-capture-2b8h+', text: '相手の狙いは△8八角成だよ。角が取られそう！' });
    expect(threatAdvice({ threatSfen: ROOK, threatMove: '2h2g+', threatScore: cp(500), playerScore: cp(0), playerColor: 'black' })?.text)
      .toBe('相手の狙いは△2七飛成だよ。飛車に成り込まれそう！');
  });
  it('calls a recapturable exchange an attack, not a loss', () => {
    expect(threatAdvice({ threatSfen: OPEN, threatMove: '2b8h+', threatPv: ['2b8h+', '7i8h'], threatScore: cp(600), playerScore: cp(0), playerColor: 'black' })?.text)
      .toBe('相手の狙いは△8八角成からの攻めだよ。先に備えよう！');
  });
  it('stays quiet for small gains, quiet moves and mate scores', () => {
    expect(threatAdvice({ threatSfen: OPEN, threatMove: '2b8h+', threatScore: cp(100), playerScore: cp(0), playerColor: 'black' })).toBeNull();
    expect(threatAdvice({ threatSfen: OPEN, threatMove: '2b8h+', threatScore: cp(-1000), playerScore: cp(2000), playerColor: 'black' })).toBeNull();
    expect(threatAdvice({ threatSfen: OPEN, threatMove: '2b8h+', threatScore: cp(4000), playerScore: cp(-3500), playerColor: 'black' })).toBeNull();
    expect(threatAdvice({ threatSfen: OPEN, threatMove: '8c8d', threatScore: cp(900), playerScore: cp(0), playerColor: 'black' })).toBeNull();
    expect(threatAdvice({ threatSfen: OPEN, threatMove: '2b8h+', threatScore: { type: 'mate', value: 5 }, playerScore: cp(0) })).toBeNull();
  });
});
