import { describe, expect, it } from 'vitest';
import { SIMUL_RESIGN_GAP, guestMove, legalMovesOf, proGain, sfenAfter, sideToMove, simulStartSfen, simulStatus, simulTally } from './festival-simul.mjs';

describe('ぐるぐる指導対局の盤(10-2の6)', () => {
  it('駒落ちの始めは上手(後手)の手番で、指すと下手の手番になる', () => {
    const start = simulStartSfen('6pieces');
    expect(sideToMove(start)).toBe('white');
    const moves = legalMovesOf(start);
    expect(moves.length).toBeGreaterThan(0);
    const next = sfenAfter(start, moves[0]);
    expect(sideToMove(next)).toBe('black');
    expect(sfenAfter(start, '1a1i')).toBeNull();
    expect(simulStatus(next, start)).toEqual({ over: false, winner: null, reason: '' });
  });

  it('アマチュアはロジックAIで合法手を指す', () => {
    const start = simulStartSfen('4pieces');
    const after = sfenAfter(start, legalMovesOf(start)[0]);
    let calls = 0;
    const move = guestMove({ sfen: after, logic: 2.4, random: () => ((calls += 1) * 0.37) % 1 });
    expect(legalMovesOf(after)).toContain(move);
  });

  it('駒を大きく損すると投了し、詰みは手番の側の負け', () => {
    // 下手の飛車・角・金銀がなく、上手が全部持っている局面(上手の駒得がとても大きい)。下手の手番。
    const lopsided = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/9/LN2K2NL b 2s2grb 1';
    const start = simulStartSfen('6pieces');
    expect(proGain(lopsided, start)).toBeGreaterThanOrEqual(SIMUL_RESIGN_GAP);
    expect(simulStatus(lopsided, start)).toMatchObject({ over: true, winner: 'pro', reason: 'resign' });
    // 頭金の詰み(下手の玉が詰んでいる。下手の手番)。
    expect(simulStatus('4k4/9/9/9/9/9/4s4/4g4/4K4 b - 1', start)).toMatchObject({ over: true, winner: 'pro', reason: 'mate' });
  });

  it('「ここまで」で区切った盤は引き分けに数える', () => {
    expect(simulTally([{ result: 'win' }, { result: 'loss' }, { result: null }])).toEqual({ wins: 1, losses: 1, draws: 1 });
  });
});
