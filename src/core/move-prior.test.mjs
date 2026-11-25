import { describe, expect, it } from 'vitest';
import { FastBoard } from './fast-board.mjs';
import { moveFeatures, priorPhase, priorScore, quietPrior } from './move-prior.mjs';

describe('人が指しそうな手の好み(docs/disciple-mode-design.mdの40章のL3)', () => {
  it('手の特徴を出す(駒・向き・取る・取り返し・王手・取られる升)', () => {
    // 後手の歩が7六へ来て、先手の7七の銀で取り返せる局面。
    const board = FastBoard.fromSfen('4k4/9/9/9/9/2p6/2S6/9/4K4 b - 1');
    const take = board.fromUsi('7g7f');
    const features = moveFeatures(board, take, { lastTo: 5 * 9 + 6 });
    expect(features).toContain('piece:S');
    expect(features).toContain('cap:pawn');
    expect(features).toContain('recapture');
    expect(features).toContain('dir:forward');
    // 指して戻すので、局面は変わらない。
    expect(board.toUsi(board.fromUsi('7g7f'))).toBe('7g7f');
    const drop = FastBoard.fromSfen('4k4/9/9/9/9/9/9/9/4K4 b G 1');
    const check = drop.fromUsi('G*5b');
    expect(moveFeatures(drop, check)).toEqual(expect.arrayContaining(['drop:G', 'check', 'near:enemy-king']));
  });

  it('段は手数で分け、点は特徴の重みの和', () => {
    expect(priorPhase(10)).toBe('op');
    expect(priorPhase(50)).toBe('mid');
    expect(priorPhase(120)).toBe('end');
    const table = { mid: { 'cap:pawn': 1.5, recapture: 2 } };
    expect(priorScore(['cap:pawn', 'recapture', 'quiet'], 'mid', table)).toBe(3.5);
    expect(priorScore(['cap:pawn'], 'op', table)).toBe(0);
  });

  it('静かな手の軽い好みの点は、指して戻さずに数え、同じ特徴ならmoveFeaturesの点と同じ', () => {
    const board = FastBoard.fromSfen('4k4/9/9/9/9/9/2P6/9/4K4 b - 1');
    const move = board.fromUsi('7g7f');
    const table = { 'piece:P': 0.5, 'dir:forward': 0.25, quiet: -0.25, check: 9 };
    expect(quietPrior(board, move, table)).toBe(priorScore(moveFeatures(board, move), 'mid', { mid: table }));
  });
});
