import { describe, expect, it } from 'vitest';
import { judgeTsumeMove, resignTsume, shortestMate, tsumeHint } from './relay-tsume.mjs';

// 後手玉が5一、先手の金が5三(5四の歩がひも)、先手は金を持っている。後手の手番(投了図)。
const RESIGN = '4k4/9/4G4/4P4/9/9/9/9/4K4 w G 1';

describe('中継の投了図から詰将棋(47章)', () => {
  it('読み筋の受けを指した局面から、勝った側のいちばん短い詰みを問題にする', () => {
    const tsume = resignTsume({ sfen: RESIGN, reply: '5a4a' });
    expect(tsume).toMatchObject({ defense: '5a4a', attacker: 'black', plies: 1, line: ['G*4b'] });
    expect(tsume.sfen.split(' ')[1]).toBe('b');
    expect(shortestMate(tsume.sfen)).toEqual(['G*4b']);
  });

  it('読み筋の応手がなく、王手でもない投了図は問題にしない', () => {
    expect(resignTsume({ sfen: RESIGN, reply: '' })).toBeNull();
    expect(resignTsume({ sfen: '' })).toBeNull();
  });

  it('1手を判定する: 読み筋どおり・王手でない・逃げられる', () => {
    const tsume = resignTsume({ sfen: RESIGN, reply: '5a4a' });
    const state = { sfen: tsume.sfen, line: tsume.line, remaining: tsume.plies };
    expect(judgeTsumeMove({ ...state, usi: 'G*4b' })).toEqual({ status: 'mated' });
    expect(judgeTsumeMove({ ...state, usi: '5i5h' }).status).toBe('not-check');
    expect(judgeTsumeMove({ ...state, usi: 'G*3b' }).status).toBe('escapes');
    expect(judgeTsumeMove({ ...state, usi: '1a1b' }).status).toBe('illegal');
    expect(tsumeHint(state)).toBe('G*4b');
    expect(tsumeHint({ ...state, line: [] })).toBe('G*4b');
  });
});

describe('読み筋が詰みまで残っているとき(47章)', () => {
  it('王手の連続で詰む読み筋なら、探索せずにそれを答えにする。詰まない読み筋は使わない', () => {
    const tsume = resignTsume({ sfen: RESIGN, pv: '5a4a G*4b' });
    expect(tsume).toMatchObject({ defense: '5a4a', line: ['G*4b'], plies: 1 });
    // 読み筋の続きが詰まない(王手でない)ときは、探索で探す。
    expect(resignTsume({ sfen: RESIGN, pv: '5a4a 5i5h' })).toMatchObject({ line: ['G*4b'] });
  });
});
