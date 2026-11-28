import { describe, expect, it } from 'vitest';
import { GUIDE_BAND, GUIDE_FROM_PLY, GUIDE_STEP, GUIDE_UNTIL_PLY, chooseGuidedMove, guidedTarget, moveShape } from './guided-play.mjs';

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
const cp = (value) => ({ type: 'cp', value });

describe('棋力測定の指導対局', () => {
  it('目指す点: 帯より良いときだけ、1手でGUIDE_STEPまで帯の真ん中へ下げる', () => {
    expect(guidedTarget(GUIDE_BAND.high)).toBeNull();
    expect(guidedTarget(-400)).toBeNull();
    // 離れ具合の半分(少なくともGUIDE_STEP)だけ戻す。600点は真ん中(-150)から750離れているので375戻す。
    expect(guidedTarget(600)).toBe(600 - 375);
    expect(guidedTarget(100)).toBe(100 - GUIDE_STEP);
    expect(guidedTarget(0)).toBe(GUIDE_BAND.center);
  });

  it('AIが良いときは、目指す点を下回らない手のうちいちばん近い手を選ぶ', () => {
    const candidates = [
      { move: '2g2f', rank: 1, score: cp(500) },
      { move: '7g7f', rank: 2, score: cp(380) },
      { move: '5i5h', rank: 3, score: cp(200) },
    ];
    const pick = chooseGuidedMove({ sfen: START, candidates, ply: 40 });
    // 500点は真ん中から650離れているので、325戻して175を目指す。175以上でいちばん近いのは5八玉(200)。
    expect(pick?.move).toBe('5i5h');
    expect(pick?.kind).toBe('ease');
    expect(pick?.target).toBe(175);
  });

  it('帯の中・AIが苦しいときは最善(本気で指す)', () => {
    const candidates = [{ move: '2g2f', rank: 1, score: cp(-200) }, { move: '7g7f', rank: 2, score: cp(-260) }];
    expect(chooseGuidedMove({ sfen: START, candidates, ply: 40 })?.move).toBe('2g2f');
  });

  it('序盤・長い対局・詰みのある局面は最善で指す', () => {
    const candidates = [{ move: '2g2f', rank: 1, score: cp(800) }, { move: '7g7f', rank: 2, score: cp(600) }];
    expect(chooseGuidedMove({ sfen: START, candidates, ply: GUIDE_FROM_PLY - 1 })?.kind).toBe('best');
    expect(chooseGuidedMove({ sfen: START, candidates, ply: GUIDE_UNTIL_PLY })?.kind).toBe('best');
    // AIに詰みがあっても、すぐには詰ませず、帯へ少しずつ戻す(詰みは GUIDE_MATE_AS として比べる)。
    expect(chooseGuidedMove({ sfen: START, candidates: [{ move: '2g2f', score: { type: 'mate', value: 3 } }, { move: '7g7f', score: cp(2400) }], ply: 60 })?.move).toBe('7g7f');
    // 詰みのほかに目指す点を満たす手がなければ、詰ませる。
    expect(chooseGuidedMove({ sfen: START, candidates: [{ move: '2g2f', score: { type: 'mate', value: 3 } }, { move: '7g7f', score: cp(500) }], ply: 60 })?.move).toBe('2g2f');
    // AIが詰まされる局面は、最善で粘る。
    expect(chooseGuidedMove({ sfen: START, candidates: [{ move: '2g2f', score: { type: 'mate', value: -5 } }, { move: '7g7f', score: { type: 'mate', value: -3 } }], ply: 60 })?.move).toBe('2g2f');
  });

  it('ただで取られる手は加減に使わない', () => {
    // 先手の角が3三の歩を取ると、2二の角(と銀)に取り返されて角損(ただで取られる)。
    const sfen = 'lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 5';
    expect(moveShape(sfen, '8h3c+').hang).toBe(true);
    const candidates = [
      { move: '2g2f', rank: 1, score: cp(500) },
      { move: '8h3c+', rank: 2, score: cp(200) },
      { move: '9g9f', rank: 3, score: cp(190) },
    ];
    expect(chooseGuidedMove({ sfen, candidates, ply: 40 })?.move).toBe('9g9f');
  });

  it('同じくらい良い手の中では、相手の駒に当てる手(問い)を選ぶ', () => {
    // 先手の飛車が3八、後手の銀が2四(ひもなし)。3八→2八と回ると銀に当たる。
    const sfen = '4k4/9/9/7s1/9/9/9/6R2/4K4 b - 41';
    expect(moveShape(sfen, '3h2h').question).toBe(true);
    expect(moveShape(sfen, '5i4h').question).toBe(false);
    const candidates = [{ move: '5i4h', rank: 1, score: cp(-120) }, { move: '3h2h', rank: 2, score: cp(-140) }];
    expect(chooseGuidedMove({ sfen, candidates, ply: 40 })).toMatchObject({ move: '3h2h', kind: 'question' });
    // 差が大きい問いの手は選ばない。
    const far = [{ move: '5i4h', rank: 1, score: cp(-120) }, { move: '3h2h', rank: 2, score: cp(-260) }];
    expect(chooseGuidedMove({ sfen, candidates: far, ply: 40 })?.move).toBe('5i4h');
  });
});
