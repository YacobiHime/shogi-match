/**
 * ShogiHome互換のWeb Componentを既存の対局ループへ接続するアダプター。
 * 盤面状態・合法手判定は従来のBoardViewを引き続き正とし、描画と入力だけを
 * @yacobihime/shogi-match（tsshogiベース）の盤面互換APIへ委譲する。
 */
export function canAcceptShogiMatchMove(board, element) {
  return element.allowMove && !board.locked && board.isHumanTurn();
}

export function syncLastMove(element, usiMove = '') {
  element.lastMove = typeof usiMove === 'string' ? usiMove : '';
}

export function normalizeShogiMatchScore(score) {
  if (Number.isFinite(score)) return score;
  if (score?.type === 'cp' && Number.isFinite(score.value)) return score.value;
  return undefined;
}

export function mountShogiMatchUiBoard(board, container, onMove) {
  const element = document.createElement('shogi-match-board');
  element.setAttribute('aria-label', '将棋盤');
  element.assetBaseUrl = '/assets/shogihome';
  element.allowMove = true;
  element.candidates = [];
  syncLastMove(element);
  let recommendedMovesKey = '[]';

  const render = () => {
    element.sfen = board.toSfen();
  };

  // BoardViewをルール状態の互換アダプターとして残し、以後の再描画を
  // Web ComponentへのSFEN同期へ置き換える。
  container.replaceChildren(element);
  board.render = render;
  render();

  const originalLock = board.lock.bind(board);
  board.lock = () => {
    originalLock();
    element.allowMove = false;
  };

  element.setRecommendedMoves = (candidates = []) => {
    const normalized = candidates
      .filter(({ usi }) => typeof usi === 'string' && usi.length > 0)
      .map(({ usi, score }) => ({ usi, score: normalizeShogiMatchScore(score) }));
    const nextKey = JSON.stringify(normalized);
    if (nextKey === recommendedMovesKey) return;
    recommendedMovesKey = nextKey;
    element.candidates = normalized;
  };
  element.setLastMove = (usiMove = '') => syncLastMove(element, usiMove);

  element.addEventListener('usi-move', (event) => {
    if (!canAcceptShogiMatchMove(board, element)) return;
    const usiMove = event.detail?.[0];
    if (typeof usiMove !== 'string') return;
    // tsshogiが検証した手を既存の盤面状態へも適用し、エンジン連携・待った・
    // 千日手履歴は従来実装のまま利用する。
    element.setRecommendedMoves();
    element.setLastMove();
    board.applyUsiMove(usiMove);
    onMove(usiMove);
  });

  return element;
}
