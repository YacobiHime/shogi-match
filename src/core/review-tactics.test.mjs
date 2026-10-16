import { describe, expect, test } from 'vitest';

import { applyUsiToBoard, boardsAlongLine, freeCapture, freeCaptureOrigins, pieceName } from './review-tactics.mjs';
import { buildGuidedReview } from './guided-review.mjs';
import { parseSfenBoard } from './sfen-board.mjs';

const cp = (value) => ({ type: 'cp', value });
// 先手の飛車(2八)が、守りのない後手の金(2四)を取れる局面。
const FREE_GOLD = '4k4/9/9/7g1/9/9/9/7R1/4K4 b - 1';
// 同じ局面で、後手の銀(3三)が金を守っている。
const GUARDED_GOLD = '4k4/9/6s2/7g1/9/9/9/7R1/4K4 b - 1';
// 後手の飛車(2一)の筋に、先手の金を寄ると、タダで取られる局面。
const ROOK_FILE = '4k2r1/9/9/9/9/9/9/6G2/4K4 b - 1';
// 後手の金(2四)を、先手の飛車(2八)と銀(3五)が取れる。銀で取ると、後ろの後手の角(4六)の筋が開いて取り返される。
const SILVER_SCREEN = '4k4/9/9/7g1/6S2/5b3/9/7R1/4K4 b - 1';

describe('駒のタダ取りの判定', () => {
  test('守りのない駒を取る手は、タダで取る手', () => {
    const capture = freeCapture(parseSfenBoard(FREE_GOLD), '2h2d');
    expect(capture).toMatchObject({ square: '2d', kind: 'G', name: '金' });
  });

  test('取り返される駒は、タダではない', () => {
    expect(freeCapture(parseSfenBoard(GUARDED_GOLD), '2h2d')).toBeNull();
  });

  test('駒を取らない手・駒打ち・玉を取る手は、タダ取りではない', () => {
    const board = parseSfenBoard(FREE_GOLD);
    expect(freeCapture(board, '2h3h')).toBeNull();
    expect(freeCapture(board, 'P*2e')).toBeNull();
  });

  test('動いた後ろの筋が開いて取り返される駒からは、タダで取れない', () => {
    const board = parseSfenBoard(SILVER_SCREEN);
    expect(freeCapture(board, '3e2d')).toBeNull();
    expect(freeCapture(board, '2h2d')).not.toBeNull();
    expect(freeCaptureOrigins(board, '2d', 'black')).toEqual(['2h']);
  });

  test('成る手と駒打ちを盤に並べる', () => {
    let board = parseSfenBoard(ROOK_FILE);
    board = applyUsiToBoard(board, '3h2h', 'black');
    board = applyUsiToBoard(board, '2a2h+', 'white');
    expect(board.get('2h')).toEqual({ color: 'white', kind: '+R' });
    board = applyUsiToBoard(board, 'G*2g', 'black');
    expect(board.get('2g')).toEqual({ color: 'black', kind: 'G' });
    expect(pieceName('+R')).toBe('竜');
  });

  test('本筋の各局面の盤を作る', () => {
    const boards = boardsAlongLine(ROOK_FILE, ['3h2h', '2a2h+'], (ply) => (ply % 2 === 1 ? 'black' : 'white'));
    expect(boards).toHaveLength(3);
    expect(boards[1].get('2h')).toEqual({ color: 'black', kind: 'G' });
    expect(boards[2].get('2h')).toEqual({ color: 'white', kind: '+R' });
  });
});

describe('振り返りの駒のタダ取り', () => {
  test('タダで取れる駒を見逃した手の前で、取る手を考えさせる', () => {
    const points = [
      { ply: 0, score: cp(900), bestMove: '2h2d', pv: ['2h2d'] },
      { ply: 1, score: cp(0), bestMove: '2d2e', pv: ['2d2e'] },
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', moves: ['5i4h'], initialSfen: FREE_GOLD });
    const quiz = review.steps.get(0)?.quiz;
    expect(quiz?.type).toBe('free-capture');
    expect(quiz?.question).toContain('金がタダで取れた');
    expect(quiz?.targetSquare).toBe('2d');
    expect(quiz?.targetFrom).toEqual(['2h']);
  });

  test('タダで取る問題の正解は、タダで取れる駒からの手だけ', () => {
    const points = [
      { ply: 0, score: cp(900), bestMove: '2h2d', pv: ['2h2d'] },
      { ply: 1, score: cp(0), bestMove: '2d2e', pv: ['2d2e'] },
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', moves: ['5i4h'], initialSfen: SILVER_SCREEN });
    expect(review.steps.get(0)?.quiz?.targetFrom).toEqual(['2h']);
  });

  test('タダの駒を取った手には、一言を添える', () => {
    const points = [
      { ply: 0, score: cp(900), bestMove: '2h2d', pv: ['2h2d'] },
      { ply: 1, score: cp(900), bestMove: '5a4b', pv: ['5a4b'] },
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', moves: ['2h2d'], initialSfen: FREE_GOLD });
    expect(review.steps.get(1)?.comment).toContain('タダの金');
  });

  test('相手に詰みが生まれた悪手は、問題の文でそう言う', () => {
    const points = [
      { ply: 0, score: cp(0), bestMove: '5i4h', pv: ['5i4h'] },
      { ply: 1, score: { type: 'mate', value: -3 }, bestMove: '5a4b', pv: ['5a4b'], annotation: { kind: 'blunder', label: '大悪手', mover: 'black' } },
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', moves: ['5i5h'], initialSfen: FREE_GOLD });
    expect(review.steps.get(0)?.quiz?.question).toContain('相手に詰みが生まれちゃった');
  });

  test('取り返される駒は、見逃しても問題にしない', () => {
    const points = [
      { ply: 0, score: cp(300), bestMove: '2h2d', pv: ['2h2d'] },
      { ply: 1, score: cp(0), bestMove: '3c2d', pv: ['3c2d'] },
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', moves: ['5i4h'], initialSfen: GUARDED_GOLD });
    expect(review.steps.get(0)?.quiz).toBeUndefined();
  });

  test('駒をタダで取られる形にした悪手は、何を取られるかを問題の文で言う', () => {
    const points = [
      { ply: 0, score: cp(0), bestMove: '5i4h', pv: ['5i4h'] },
      { ply: 1, score: cp(-900), bestMove: '2a2h+', pv: ['2a2h+'], annotation: { kind: 'mistake', label: '悪手', mover: 'black' } },
      { ply: 2, score: cp(-1000), bestMove: '5i4h', pv: ['5i4h'] },
    ];
    const review = buildGuidedReview(points, {
      playerColor: 'black', moves: ['3h2h', '2a2h+'], initialSfen: ROOK_FILE,
    });
    expect(review.steps.get(0)?.quiz?.question).toContain('金をタダで取られる形');
    expect(review.steps.get(1)?.comment).toContain('金がタダで取られる形');
    // 取られたことは、直前に言ったので繰り返さない。
    expect(review.steps.get(2)?.comment ?? '').toBe('');
  });

  test('相手がタダの駒を見逃したら、そう言う', () => {
    const points = [
      { ply: 0, score: cp(0), bestMove: '5i4h', pv: ['5i4h'] },
      { ply: 1, score: cp(-900), bestMove: '2a2h+', pv: ['2a2h+'] },
      { ply: 2, score: cp(0), bestMove: '2h2g', pv: ['2h2g'] },
    ];
    const review = buildGuidedReview(points, {
      playerColor: 'black', moves: ['3h2h', '5a4b'], initialSfen: ROOK_FILE,
    });
    expect(review.steps.get(2)?.comment).toContain('タダの金を見逃してくれた');
  });

  test('開始局面がなければ、これまでどおり評価値だけで作る', () => {
    const points = [
      { ply: 0, score: cp(900), bestMove: '2h2d', pv: ['2h2d'] },
      { ply: 1, score: cp(0), bestMove: '2d2e', pv: ['2d2e'] },
    ];
    const review = buildGuidedReview(points, { playerColor: 'black', moves: ['5i4h'] });
    expect(review.steps.get(0)?.quiz).toBeUndefined();
  });
});
