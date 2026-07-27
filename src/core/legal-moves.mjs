/**
 * shogi.js が返す疑似合法手を、着手後に自玉が王手されていない手へ絞り込む。
 * 判定中はSFENから複製した盤面を使い、表示中の盤面を変更しない。
 */

function clonePosition(shogi, Shogi) {
  const clone = new Shogi();
  clone.initializeFromSFENString(shogi.toSFENString(1));
  return clone;
}

function hasLegalBoardMove(shogi, Shogi, color) {
  for (let x = 1; x <= 9; x++) {
    for (let y = 1; y <= 9; y++) {
      const piece = shogi.get(x, y);
      if (!piece || piece.color !== color) continue;

      for (const move of shogi.getMovesFrom(x, y)) {
        if (isLegalMove(shogi, Shogi, x, y, move.to.x, move.to.y, false, color)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function isLegalMove(shogi, Shogi, fromX, fromY, toX, toY, promote, color) {
  try {
    const clone = clonePosition(shogi, Shogi);
    clone.move(fromX, fromY, toX, toY, promote);
    return !clone.isCheck(color);
  } catch {
    return false;
  }
}

export function isLegalDrop(shogi, Shogi, x, y, kind, color) {
  try {
    const clone = clonePosition(shogi, Shogi);
    clone.drop(x, y, kind, color);
    if (clone.isCheck(color)) return false;

    // 歩打ちで王手した場合、相手に盤上の合法手がなければ打ち歩詰めとなる。
    // 歩の王手は玉に隣接するため合駒では解消できず、持ち駒打ちの応手は調べなくてよい。
    const defenderColor = clone.turn;
    const isPawnDropMate =
      kind === 'FU' &&
      clone.isCheck(defenderColor) &&
      !hasLegalBoardMove(clone, Shogi, defenderColor);
    return !isPawnDropMate;
  } catch {
    return false;
  }
}
