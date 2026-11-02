import { describe, expect, it } from 'vitest';
import {
  WAZA_FIRST_EXTRA_MS, WAZA_HOLD_MS, WAZA_MS, WAZA_TESUJI, WAZA_TESUJI_HINTS, WAZA_TESUJI_NAMES, detectWazaTesuji, formationWaza,
  pickWaza, wazaChime, wazaPresentation, wazaRepeatKey,
} from './move-waza.mjs';
import { TESUJI_NAMES } from './move-tesuji.mjs';

const ids = (move) => detectWazaTesuji(move).map((entry) => entry.id);

describe('技の目録(docs/move-waza-design.mdの4-1・4-3)', () => {
  it('はじめの9つは今までのコレクションの手筋(IDと名前が同じ)。全部で18、どれにも一言', () => {
    expect(WAZA_TESUJI.slice(0, 9).map(({ id }) => id)).toEqual(Object.keys(TESUJI_NAMES));
    for (const [id, name] of Object.entries(TESUJI_NAMES)) expect(WAZA_TESUJI_NAMES[id]).toBe(name);
    expect(WAZA_TESUJI).toHaveLength(18);
    expect(new Set(WAZA_TESUJI.map(({ id }) => id)).size).toBe(18);
    for (const { id } of WAZA_TESUJI) expect(WAZA_TESUJI_HINTS[id]).toMatch(/！$/);
    expect(WAZA_TESUJI_NAMES['tare-fu']).toBe('垂れ歩');
    expect(WAZA_TESUJI_NAMES.waruuchi).toBe('割り打ちの銀');
  });
});

describe('手筋の判定', () => {
  it('垂れ歩: 相手の陣の1つ手前に、ただで取られない歩を打つ(先手・後手)', () => {
    expect(ids({ sfenBefore: '4k4/9/9/9/9/9/9/9/4K4 b P 1', usi: 'P*2d' })).toEqual(['tare-fu']);
    expect(ids({ sfenBefore: '4k4/9/9/9/9/9/9/9/4K4 w p 1', usi: 'P*8f' })).toEqual(['tare-fu']);
    // 前に相手の駒があれば叩きの歩。5段目に打つのは垂れ歩ではない。
    expect(ids({ sfenBefore: '4k4/9/7s1/9/9/9/9/9/4K4 b P 1', usi: 'P*2d' })).toEqual(['tapping-pawn']);
    expect(ids({ sfenBefore: '4k4/9/9/9/9/9/9/9/4K4 b P 1', usi: 'P*2e' })).toEqual([]);
    // ただで取られる(相手の銀が利いていて、自分の利きがない)ときは数えない。
    expect(ids({ sfenBefore: '4k4/9/6s2/9/9/9/9/9/4K4 b P 1', usi: 'P*2d' })).not.toContain('tare-fu');
    // 自分の利きもあれば数える(取られても取り返せる)。
    expect(ids({ sfenBefore: '4k4/9/6s2/9/9/9/9/7R1/4K4 b P 1', usi: 'P*2d' })).toContain('tare-fu');
  });

  it('尻金: 相手の玉の真後ろに金を打つ', () => {
    const found = detectWazaTesuji({ sfenBefore: '9/4k4/9/9/9/9/9/9/4K4 b G 1', usi: 'G*5a' });
    expect(found.map((entry) => entry.id)).toContain('shiri-kin');
    expect(found.find((entry) => entry.id === 'shiri-kin')).toMatchObject({ tier: 'rare', to: '5a', targets: ['5b'] });
  });

  it('ふんどしの桂は★★で、ねらった2枚のマス。今の2つの判定で重なっても1つ', () => {
    const found = detectWazaTesuji({ sfenBefore: '3s1g2k/9/9/9/9/9/9/9/4K4 b N 1', usi: 'N*5c' });
    expect(found[0]).toMatchObject({ id: 'knight-fork', name: 'ふんどしの桂', tier: 'rare', to: '5c' });
    expect(found[0].targets.sort()).toEqual(['4a', '6a']);
    expect(found.filter((entry) => entry.id === 'knight-fork')).toHaveLength(1);
  });

  it('王手飛車は★★★で先頭', () => {
    const found = detectWazaTesuji({ sfenBefore: 'r7k/9/9/9/9/9/9/9/4K4 b B 1', usi: 'B*5e' });
    expect(found[0]).toMatchObject({ id: 'ote-bisha', tier: 'legend' });
  });

  it('頭金は詰ませた手だけ', () => {
    const sfenBefore = '4k4/9/4P4/9/9/9/9/9/4K4 b G 1';
    expect(ids({ sfenBefore, usi: 'G*5b' })).not.toContain('head-gold');
    expect(ids({ sfenBefore, usi: 'G*5b', checkmate: true })).toContain('head-gold');
  });

  it('ふつうの手は何もない', () => {
    expect(ids({ sfenBefore: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1', usi: '7g7f' })).toEqual([]);
  });
});

describe('囲い・戦法と選び方(4-1の2・3・5)', () => {
  const castles = new Set(['片美濃', '居飛車穴熊']);
  const strategies = new Set(['ノーマル四間飛車']);
  it('その手で新しく付いた名前だけ。堅い囲いは★★', () => {
    expect(formationWaza({ before: ['ノーマル四間飛車'], after: ['ノーマル四間飛車', '片美濃'], castles, strategies }))
      .toEqual([{ kind: 'castle', id: '片美濃', name: '片美濃', tier: 'normal', to: '', targets: [] }]);
    expect(formationWaza({ before: [], after: ['居飛車穴熊', '居飛車'], castles, strategies }).map((entry) => [entry.name, entry.tier]))
      .toEqual([['居飛車穴熊', 'rare']]);
    expect(formationWaza({ before: [], after: ['ノーマル四間飛車'], castles, strategies })[0].kind).toBe('strategy');
  });

  it('1つの手に1つ: 段階の高いもの → 手筋 → 囲い → 戦法', () => {
    const tesuji = { kind: 'tesuji', tier: 'normal', name: '叩きの歩' };
    const castle = { kind: 'castle', tier: 'normal', name: '片美濃' };
    const rareCastle = { kind: 'castle', tier: 'rare', name: '居飛車穴熊' };
    const strategy = { kind: 'strategy', tier: 'normal', name: 'ノーマル四間飛車' };
    expect(pickWaza([strategy, castle, tesuji])).toBe(tesuji);
    expect(pickWaza([strategy, castle])).toBe(castle);
    expect(pickWaza([tesuji, rareCastle])).toBe(rareCastle);
    expect(pickWaza([])).toBeNull();
  });
});

describe('見せ方と音(4-2・4-4)', () => {
  const fork = { kind: 'tesuji', name: 'ふんどしの桂', tier: 'rare' };
  it('自分の技は大きく止め付き、相手の技と2回目からは小さく止めなし。1.5秒以内', () => {
    expect(wazaPresentation(fork, { mine: true })).toMatchObject({ size: 'big', kindLabel: '手筋', stars: 2, ms: WAZA_MS.rare, holdMs: WAZA_HOLD_MS.rare, badge: '' });
    expect(wazaPresentation(fork, { mine: false })).toMatchObject({ size: 'small', kindLabel: '相手の手筋', ms: WAZA_MS.small, holdMs: 0, badge: '' });
    expect(wazaPresentation(fork, { mine: true, repeat: true })).toMatchObject({ size: 'small', holdMs: 0 });
    expect(wazaPresentation(fork, { mine: true, first: true })).toMatchObject({ badge: 'はじめて！', ms: Math.min(1500, WAZA_MS.rare + WAZA_FIRST_EXTRA_MS) });
    expect(wazaPresentation({ ...fork, tier: 'normal' }, { mine: true, first: true }).ms).toBe(WAZA_MS.normal + WAZA_FIRST_EXTRA_MS);
    expect(wazaPresentation({ ...fork, tier: 'legend' }, { mine: true, first: true }).ms).toBe(1500);
    expect(wazaPresentation(fork, { mine: true, tip: true }).badge).toBe('コツどおり！');
    expect(wazaPresentation({ kind: 'castle', name: '片美濃', tier: 'normal' }, { mine: true })).toMatchObject({ kindLabel: '囲い', suffix: '完成' });
    for (const tier of ['normal', 'rare', 'legend']) {
      expect(wazaPresentation({ ...fork, tier }, { mine: true, first: true }).ms).toBeLessThanOrEqual(1500);
    }
  });

  it('音は段階ごとに2〜4音の上がる音、0.4秒以内。相手は小さく低い2音', () => {
    expect(wazaChime('normal', { mine: true })).toHaveLength(2);
    expect(wazaChime('rare', { mine: true })).toHaveLength(3);
    expect(wazaChime('legend', { mine: true }).length).toBeGreaterThanOrEqual(4);
    for (const tier of ['normal', 'rare', 'legend']) {
      const plan = wazaChime(tier, { mine: true });
      expect(Math.max(...plan.map((note) => note.at + note.ms))).toBeLessThanOrEqual(400);
      const tones = plan.filter((note) => note.wave === 'triangle').map((note) => note.freq);
      expect(tones).toEqual([...tones].sort((x, y) => x - y));
    }
    const theirs = wazaChime('legend', { mine: false });
    expect(theirs).toHaveLength(2);
    expect(Math.max(...theirs.map((note) => note.gain))).toBeLessThan(Math.min(...wazaChime('normal', { mine: true }).map((note) => note.gain)));
  });

  it('2回目の印は側と技で分ける', () => {
    expect(wazaRepeatKey('player', { kind: 'tesuji', id: 'knight-fork' })).not.toBe(wazaRepeatKey('cpu', { kind: 'tesuji', id: 'knight-fork' }));
  });
});
