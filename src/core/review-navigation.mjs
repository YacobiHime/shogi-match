function validateMoves(moves) {
  if (!Array.isArray(moves) || moves.some((move) => typeof move !== 'string' || move === '')) {
    throw new Error('棋譜解析の棋譜が不正です');
  }
  return [...moves];
}

export function createReviewNavigation(mainLine = []) {
  const moves = validateMoves(mainLine);
  return { mainLine: moves, line: [...moves], cursor: moves.length, branch: false };
}

export function moveReviewCursor(state, delta) {
  if (!state || !Number.isInteger(state.cursor) || !Number.isInteger(delta)) {
    throw new Error('棋譜解析の移動位置が不正です');
  }
  const cursor = Math.max(0, Math.min(state.line.length, state.cursor + delta));
  return { ...state, cursor };
}

export function appendReviewMove(state, move) {
  if (!state || typeof move !== 'string' || move === '') {
    throw new Error('棋譜解析の指し手が不正です');
  }
  if (!state.branch && state.cursor < state.mainLine.length && state.mainLine[state.cursor] === move) {
    return { ...state, line: [...state.mainLine], cursor: state.cursor + 1 };
  }
  return {
    ...state,
    line: [...state.line.slice(0, state.cursor), move],
    cursor: state.cursor + 1,
    branch: true,
  };
}

/** 対CPU検討の開始局面より前へ戻らないよう、直近の指し手を巻き戻す。 */
export function rewindReviewMoves(state, count, minimumCursor = 0) {
  if (
    !state || !Number.isInteger(state.cursor) || !Number.isInteger(count) || count < 0
    || !Number.isInteger(minimumCursor) || minimumCursor < 0
  ) {
    throw new Error('棋譜解析の待った位置が不正です');
  }
  const floor = Math.min(state.line.length, minimumCursor);
  return { ...state, cursor: Math.max(floor, state.cursor - count) };
}

export function returnReviewToMainLine(state) {
  if (!state || !Array.isArray(state.mainLine) || !Number.isInteger(state.cursor)) {
    throw new Error('棋譜解析の本筋が不正です');
  }
  return {
    ...state,
    line: [...state.mainLine],
    cursor: Math.min(state.cursor, state.mainLine.length),
    branch: false,
  };
}

export function visibleReviewMoves(state) {
  return state.line.slice(0, state.cursor);
}
