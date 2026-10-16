/**
 * 指した手が、手筋図鑑のどの手筋・詰みの形に当たるかを見分ける(コレクションの印に使う)。
 * IDは手筋図鑑(core/reference-dex.mjs)の項目と同じにする。手筋図鑑は重いので、名前はここにも書く。
 *
 * 盤の形だけで確実に言えるものに絞る。良い手かどうか(評価値)は見ない。
 */
import {
  applyUsiToBoard,
  attackedSquares,
  attackersOf,
  findKing,
  opponentOf,
  parseSfenState,
  pieceValue,
  relativeFile,
  relativeRank,
  squareXY,
  xySquare,
} from './piece-movement.mjs';

/** 見分ける手筋と、コレクションに出す名前。 */
export const TESUJI_NAMES = Object.freeze({
  'head-gold': '頭金',
  'double-check': '両王手',
  'knight-fork': 'ふんどしの桂',
  'knight-check': '桂の王手',
  'rook-cross-fork': '十字飛車',
  'belly-silver': '腹銀',
  'tapping-pawn': '叩きの歩',
  'gold-bottom-pawn': '金底の歩',
  'tokin-on-53': '5三のと金',
});

/** 初めて指したとき、終局画面でやこび姫が添える一言。 */
export const TESUJI_HINTS = Object.freeze({
  'head-gold': '金を玉の頭に置く、いちばん基本の詰みの形だよ！',
  'double-check': '2つの駒で同時に王手。合駒でも、王手した駒を取っても防げないよ！',
  'knight-fork': '桂で2つの駒を同時にねらう両取りだよ！',
  'knight-check': '桂の王手は、間に駒を打って防げないよ！',
  'rook-cross-fork': '飛車の十字の利きで、2つの駒を同時にねらったね！',
  'belly-silver': '玉の横から銀を打つと、逃げ道をふさぎやすいよ！',
  'tapping-pawn': '歩を打って、相手の駒の頭をたたいたね！',
  'gold-bottom-pawn': '金の下に打つ歩は、守りをぐっと堅くするよ！',
  'tokin-on-53': '5三のと金は、相手の玉にぐいぐい迫る強い駒だよ！',
});

/** 両取りで狙う価値のある駒(銀より上と玉)。 */
const FORK_MIN_VALUE = pieceValue('S');

/** 1歩前(指した側から見て)。 */
const forward = (square, color, steps = 1) => {
  const { x, y } = squareXY(square);
  return xySquare(x, y + (color === 'black' ? -steps : steps));
};

/**
 * 指した手が当たる手筋のID。
 * @param {{ sfenBefore: string, usi: string, checkmate?: boolean }} move 手を指す前の局面と、指した手
 * @returns {string[]}
 */
export function detectTesuji({ sfenBefore, usi, checkmate = false }) {
  const { board, turn: mover } = parseSfenState(sfenBefore);
  const applied = applyUsiToBoard(board, usi, mover);
  if (!applied) return [];
  const { board: after, moved } = applied;
  const enemy = opponentOf(mover);
  const king = findKing(after, enemy);
  const found = [];
  const reach = attackedSquares(after, moved.to);
  const givesCheckByMoved = Boolean(king && reach.includes(king));
  const checkers = king ? attackersOf(after, king, mover) : [];
  // 両取り: 動かした駒が、銀より上の駒か玉を2つ以上ねらっている。
  const forkTargets = reach.filter((square) => {
    const piece = after.get(square);
    return piece && piece.color === enemy && (piece.kind === 'K' || pieceValue(piece.kind) >= FORK_MIN_VALUE);
  });

  if (checkers.length >= 2) found.push('double-check');
  if (checkmate && moved.kind === 'G' && king && forward(king, enemy) === moved.to) found.push('head-gold');
  if (moved.kind === 'N' && givesCheckByMoved) found.push('knight-check');
  if (moved.kind === 'N' && forkTargets.length >= 2) found.push('knight-fork');
  if ((moved.kind === 'R' || moved.kind === '+R') && forkTargets.length >= 2) found.push('rook-cross-fork');
  if (moved.drop === 'S' && king) {
    const a = squareXY(moved.to);
    const b = squareXY(king);
    if (a.y === b.y && Math.abs(a.x - b.x) === 1) found.push('belly-silver');
  }
  if (moved.drop === 'P') {
    const target = after.get(forward(moved.to, mover) ?? '');
    if (target && target.color === enemy && target.kind !== 'P' && target.kind !== 'K') found.push('tapping-pawn');
    const above = after.get(forward(moved.to, mover) ?? '');
    if (relativeRank(moved.to, mover) === 9 && above?.color === mover && above.kind === 'G') found.push('gold-bottom-pawn');
  }
  if (moved.kind === '+P' && relativeFile(moved.to, mover) === 5 && relativeRank(moved.to, mover) === 3) found.push('tokin-on-53');
  return found;
}
