import { describe, expect, it } from 'vitest';
import { EVEN_SFEN, SIMUL_RESIGN_GAP, guestMove, legalMovesOf, partnerMove, pieceOn, proGain, rangingMoveLabel, sfenAfter, sideToMove, simulBoardOf, simulProAt, simulStartSfen, simulStatus, simulTally } from './festival-simul.mjs';

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

describe('ほかの棋士と回るぐるぐる指導(11章)', () => {
  const ranging = { logic: 10, party: 'ranging', rangeSquare: '4b' };
  const staticPro = { logic: 10, party: 'static', rangeSquare: '' };

  it('3人と3つの盤で、回るたびに1つずつずれる', () => {
    expect([0, 1, 2].map((round) => simulBoardOf(round, 0, 3))).toEqual([0, 1, 2]);
    expect([0, 1, 2].map((round) => simulBoardOf(round, 1, 3))).toEqual([1, 2, 0]);
    for (let round = 0; round < 6; round += 1) {
      for (let board = 0; board < 3; board += 1) expect(simulBoardOf(round, simulProAt(round, board, 3), 3)).toBe(board);
    }
  });

  it('振り飛車党の棋士は、平手の盤で飛車を振る(居飛車党のあなたも、その盤は振り飛車で指し継ぐ)', () => {
    let sfen = EVEN_SFEN;
    const moves = [];
    for (const usi of ['7g7f', '3c3d', '2g2f']) {
      sfen = sfenAfter(sfen, usi);
      moves.push(usi);
    }
    const usi = partnerMove({ sfen, partner: ranging, moveHistory: moves, random: () => 0.5 });
    expect(usi).toBe('8b4b');
    expect(rangingMoveLabel(sfen, usi)).toBe('四間飛車');
    expect(pieceOn(sfenAfter(sfen, usi), '4b')).toBe('r');
  });

  it('居飛車党の棋士は、序盤に飛車を横に動かさない', () => {
    let sfen = EVEN_SFEN;
    const moves = [];
    for (const usi of ['7g7f', '3c3d', '2g2f']) {
      sfen = sfenAfter(sfen, usi);
      moves.push(usi);
    }
    for (let seed = 0; seed < 8; seed += 1) {
      const usi = partnerMove({ sfen, partner: staticPro, moveHistory: moves, random: () => (seed + 0.5) / 8 });
      expect(rangingMoveLabel(sfen, usi)).toBe('');
    }
  });
});
