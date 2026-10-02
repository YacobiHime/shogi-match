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
  // 分岐の途中へ戻ってから同じ手を指したときは、その先の手順を残したまま進める。
  if (state.line[state.cursor] === move) return { ...state, cursor: state.cursor + 1 };
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

/**
 * 今の局面から、読み筋などの手順を並べる。手順は今の局面より先を置き換え、1手目まで進める。
 * 並べた手順が本筋と同じなら、本筋のまま進める。
 */
export function previewReviewLine(state, moves) {
  if (!state || !Array.isArray(moves) || moves.some((move) => typeof move !== 'string' || move === '')) {
    throw new Error('棋譜解析の読み筋が不正です');
  }
  if (!moves.length) return state;
  const line = [...state.line.slice(0, state.cursor), ...moves];
  const onMainLine = line.length <= state.mainLine.length && line.every((move, index) => move === state.mainLine[index]);
  return onMainLine
    ? { ...state, line: [...state.mainLine], cursor: state.cursor + 1, branch: false }
    : { ...state, line, cursor: state.cursor + 1, branch: true };
}

/** 分岐が本筋から外れる手数(本筋と違う最初の手の位置)。分岐していなければnull。 */
export function reviewBranchStart(state) {
  if (!state?.branch) return null;
  const index = state.line.findIndex((move, ply) => move !== state.mainLine[ply]);
  return index < 0 ? state.line.length : index;
}

/** 今の局面が本筋の上か。分岐していても、本筋から外れる手より前なら本筋の局面。 */
export function isOnReviewMainLine(state) {
  const start = reviewBranchStart(state);
  return start === null || state.cursor <= start;
}
