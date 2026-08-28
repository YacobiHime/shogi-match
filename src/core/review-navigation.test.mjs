import { describe, expect, test } from 'vitest';

import {
  appendReviewMove,
  createReviewNavigation,
  moveReviewCursor,
  rewindReviewMoves,
  returnReviewToMainLine,
  visibleReviewMoves,
} from './review-navigation.mjs';

describe('棋譜解析の棋譜ナビゲーション', () => {
  const main = ['7g7f', '3c3d', '2g2f', '8c8d'];

  test('左右移動で本筋を戻ったり進んだりできる', () => {
    let state = createReviewNavigation(main);
    state = moveReviewCursor(state, -2);
    expect(visibleReviewMoves(state)).toEqual(main.slice(0, 2));
    state = moveReviewCursor(state, 1);
    expect(visibleReviewMoves(state)).toEqual(main.slice(0, 3));
  });

  test('戻った局面で別の手を指すと分岐を作る', () => {
    let state = moveReviewCursor(createReviewNavigation(main), -2);
    state = appendReviewMove(state, '5g5f');
    expect(state.branch).toBe(true);
    expect(visibleReviewMoves(state)).toEqual(['7g7f', '3c3d', '5g5f']);
  });

  test('本筋へ戻ると同じ手数の本筋局面を復元する', () => {
    let state = moveReviewCursor(createReviewNavigation(main), -2);
    state = appendReviewMove(state, '5g5f');
    state = returnReviewToMainLine(state);
    expect(state.branch).toBe(false);
    expect(visibleReviewMoves(state)).toEqual(main.slice(0, 3));
  });

  test('対CPU検討の待ったは一往復戻し、開始局面より前へ戻らない', () => {
    let state = moveReviewCursor(createReviewNavigation(main), -2);
    const startedAt = state.cursor;
    state = appendReviewMove(state, '5g5f');
    state = appendReviewMove(state, '5c5d');
    state = rewindReviewMoves(state, 2, startedAt);
    expect(state.cursor).toBe(startedAt);
    expect(visibleReviewMoves(state)).toEqual(main.slice(0, startedAt));
    expect(rewindReviewMoves(state, 2, startedAt).cursor).toBe(startedAt);
  });
});
