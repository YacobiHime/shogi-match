import { describe, expect, test } from 'vitest';

import {
  appendReviewMove,
  createReviewNavigation,
  isOnReviewMainLine,
  moveReviewCursor,
  previewReviewLine,
  reviewBranchStart,
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

  test('本筋へ戻ると分岐した局面に戻る', () => {
    let state = moveReviewCursor(createReviewNavigation(main), -2);
    state = appendReviewMove(state, '5g5f');
    state = appendReviewMove(state, '5c5d');
    state = returnReviewToMainLine(state);
    expect(state.branch).toBe(false);
    expect(visibleReviewMoves(state)).toEqual(main.slice(0, 2));
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

  test('分岐の途中へ戻って同じ手を指すと、その先の手順を残す', () => {
    let state = moveReviewCursor(createReviewNavigation(main), -2);
    state = appendReviewMove(state, '5g5f');
    state = appendReviewMove(state, '5c5d');
    state = moveReviewCursor(state, -2);
    state = appendReviewMove(state, '5g5f');
    expect(state.line).toEqual([...main.slice(0, 2), '5g5f', '5c5d']);
    expect(state.cursor).toBe(3);
  });

  test('読み筋を並べると分岐にして1手目まで進め、本筋と同じなら本筋のまま進める', () => {
    const start = moveReviewCursor(createReviewNavigation(main), -3);
    const preview = previewReviewLine(start, ['5g5f', '5c5d', '4i5h']);
    expect(preview).toMatchObject({ cursor: 2, branch: true });
    expect(preview.line).toEqual([main[0], '5g5f', '5c5d', '4i5h']);
    expect(reviewBranchStart(preview)).toBe(1);
    expect(isOnReviewMainLine(preview)).toBe(false);
    expect(isOnReviewMainLine(moveReviewCursor(preview, -1))).toBe(true);

    const same = previewReviewLine(start, main.slice(1, 3));
    expect(same).toMatchObject({ line: main, cursor: 2, branch: false });
    expect(reviewBranchStart(same)).toBeNull();
  });
});
