import { describe, expect, it } from 'vitest';
import { TESUJI_HINTS, TESUJI_NAMES, detectTesuji } from './move-tesuji.mjs';
import { referenceDexEntries } from './reference-dex.mjs';

describe('手筋の見分け', () => {
  it('手筋図鑑にある項目のIDだけを使う', () => {
    const ids = new Set(referenceDexEntries('tesuji').map(({ id }) => id));
    for (const id of Object.keys(TESUJI_NAMES)) expect(ids.has(id)).toBe(true);
    // 初めて指したときの一言が、どの手筋にもある。
    expect(Object.keys(TESUJI_HINTS).sort()).toEqual(Object.keys(TESUJI_NAMES).sort());
  });

  it('頭金は、金を玉の頭に置いて詰ませた手', () => {
    expect(detectTesuji({ sfenBefore: '4k4/9/4P4/9/9/9/9/9/4K4 b G 1', usi: 'G*5b', checkmate: true })).toContain('head-gold');
    // 詰みでなければ頭金とは言わない。
    expect(detectTesuji({ sfenBefore: '4k4/9/4P4/9/9/9/9/9/4K4 b G 1', usi: 'G*5b', checkmate: false })).not.toContain('head-gold');
  });

  it('両王手と桂の王手', () => {
    // 桂が跳ねて王手をかけ、後ろの香の利きも玉に通る。
    expect(detectTesuji({ sfenBefore: '9/9/4k4/9/9/9/4N4/9/K3L4 b - 1', usi: '5g4e' })).toEqual(['double-check', 'knight-check']);
  });

  it('桂と飛車の両取り', () => {
    expect(detectTesuji({ sfenBefore: '8k/9/3s1g3/9/9/9/9/9/K8 b N 1', usi: 'N*5e' })).toContain('knight-fork');
    expect(detectTesuji({ sfenBefore: '8k/4g4/9/9/7s1/9/9/9/K8 b R 1', usi: 'R*5e' })).toContain('rook-cross-fork');
    // 歩しかねらっていなければ両取りではない。
    expect(detectTesuji({ sfenBefore: '8k/9/3p1p3/9/9/9/9/9/K8 b N 1', usi: 'N*5e' })).not.toContain('knight-fork');
  });

  it('腹銀・叩きの歩・金底の歩', () => {
    expect(detectTesuji({ sfenBefore: '4k4/9/9/9/9/9/9/9/K8 b S 1', usi: 'S*4a' })).toContain('belly-silver');
    expect(detectTesuji({ sfenBefore: '8k/9/4s4/9/9/9/9/9/K8 b P 1', usi: 'P*5d' })).toContain('tapping-pawn');
    expect(detectTesuji({ sfenBefore: '8k/9/9/9/9/9/9/4G4/K8 b P 1', usi: 'P*5i' })).toContain('gold-bottom-pawn');
  });

  it('5三のと金は、先手でも後手でも自分から見た5三', () => {
    expect(detectTesuji({ sfenBefore: '8k/9/9/4P4/9/9/9/9/K8 b - 1', usi: '5d5c+' })).toContain('tokin-on-53');
    expect(detectTesuji({ sfenBefore: '4k4/9/9/9/9/4p4/9/9/K8 w - 1', usi: '5f5g+' })).toContain('tokin-on-53');
  });

  it('ふつうの手には何も付けない', () => {
    expect(detectTesuji({ sfenBefore: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1', usi: '7g7f' })).toEqual([]);
    expect(detectTesuji({ sfenBefore: 'bad', usi: '7g7f' })).toEqual([]);
  });
});
