import { isLegalDrop, isLegalMove } from './legal-moves.mjs';

const BOARD_SIZE = 9;

/**
 * 持ち駒の選択状態を切り替える。
 * 同じ色・駒種を再選択した場合は解除し、それ以外は指定した持ち駒へ切り替える。
 */
export function toggleHandSelection(selected, color, kind) {
  if (selected?.hand?.color === color && selected.hand.kind === kind) {
    return null;
  }
  return { hand: { color, kind } };
}

/** 選択中の盤上駒または持ち駒について、合法な移動先を列挙する。 */
export function getLegalDestinations(shogi, Shogi, selected, color) {
  if (!selected) return [];

  if (selected.hand) {
    const destinations = [];
    for (let x = 1; x <= BOARD_SIZE; x++) {
      for (let y = 1; y <= BOARD_SIZE; y++) {
        if (isLegalDrop(shogi, Shogi, x, y, selected.hand.kind, color)) {
          destinations.push({ x, y });
        }
      }
    }
    return destinations;
  }

  return shogi.getMovesFrom(selected.x, selected.y)
    .filter(({ to }) =>
      isLegalMove(shogi, Shogi, selected.x, selected.y, to.x, to.y, false, color) ||
      isLegalMove(shogi, Shogi, selected.x, selected.y, to.x, to.y, true, color)
    )
    .map(({ to }) => ({ x: to.x, y: to.y }));
}
