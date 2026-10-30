/**
 * 棋力テストの手筋の問題で使う、名前の付いた手筋の形(docs/skill-assessment-design.mdの10-5)。
 * 盤の形だけで判定する(良い手かどうかは見ない。効き目は問題を作るときに読み筋で確かめる)。
 * IDは手筋図鑑(core/reference-dex.mjs)か用語辞典(data/shogi-glossary.mjs)の項目と同じにする。
 * 図鑑は重いので、名前と一言はここにも書く(テストで図鑑の一言と一致を確かめる)。
 * 対局画面のコレクションの印は move-tesuji.mjs の detectTesuji のまま。こちらは棋力テストの画面と問題作りと、
 * やこび姫の「なぜ？」で最善手の手筋の名前を言うところ(coach-insight.mjs)が読む(軽いので対局画面から読んでよい)。
 */
import {
  applyUsiToBoard,
  attackedSquares,
  attackersOf,
  findKing,
  opponentOf,
  parseSfenState,
  pieceValue,
  pieceVectors,
  relativeRank,
  squareXY,
  xySquare,
} from './piece-movement.mjs';

/**
 * 手筋の形。familyは、駒得の手筋(gain)か、玉に迫る寄せの手筋(yose)か。dexは一言を取る図鑑(tesuji: 手筋図鑑、glossary: 用語辞典)。
 * 並びは判定の順(先に当たった形の名前にする)。
 */
export const TESUJI_SHAPES = Object.freeze([
  Object.freeze({ id: 'knight-fork', name: 'ふんどしの桂', family: 'gain', dex: 'tesuji', hint: '桂馬で2枚の駒を同時にねらう、両取りの形だよ！' }),
  Object.freeze({ id: 'waruuchi', name: '割り打ちの銀', family: 'gain', dex: 'glossary', hint: '銀を斜め後ろの利きで、2枚の駒の両取りにする手筋だよ！' }),
  Object.freeze({ id: 'rook-cross-fork', name: '十字飛車', family: 'gain', dex: 'tesuji', hint: '飛車は縦と横の十字に利くから、両取りをかけやすいよ！' }),
  Object.freeze({ id: 'ote-bisha', name: '王手飛車', family: 'gain', dex: 'glossary', hint: '王手と飛車取りを同時にかける、強烈な両取りだよ！' }),
  Object.freeze({ id: 'ryodori', name: '両取り', family: 'gain', dex: 'glossary', hint: '1つの手で、相手の駒2枚を同時にねらうことだよ！' }),
  Object.freeze({ id: 'dengaku', name: '田楽刺し', family: 'gain', dex: 'tesuji', hint: 'まっすぐ並んだ2枚の駒を、香や飛車・角で串刺しにする手筋だよ！' }),
  Object.freeze({ id: 'focal-pawn', name: '焦点の歩', family: 'gain', dex: 'tesuji', hint: '相手の駒の利きが集まるマスに歩を打つと、好手になりやすいよ！' }),
  Object.freeze({ id: 'tapping-pawn', name: '叩きの歩', family: 'gain', dex: 'tesuji', hint: '相手の駒の頭に歩を打って、動かしたり取らせたりする手筋だよ！' }),
  Object.freeze({ id: 'edge-king-edge-pawn', name: '端玉には端歩', family: 'yose', dex: 'tesuji', hint: '端に逃げた玉には、端の歩を突いて攻めよう！' }),
  Object.freeze({ id: 'belly-silver', name: '腹銀', family: 'yose', dex: 'tesuji', hint: '玉の真横（腹）に銀を打って、逃げ道をふさぐ手筋だよ！' }),
  Object.freeze({ id: 'one-gap-dragon', name: '一間竜', family: 'yose', dex: 'tesuji', hint: '玉と竜の間を1マスあけた「一間竜」は、とっても強い形だよ！' }),
]);

/** idから形の情報。 */
export const tesujiShape = (id) => TESUJI_SHAPES.find((shape) => shape.id === id) ?? null;

/** 両取りでねらう価値のある駒(銀より上と、成り駒と、玉)。 */
const worthForking = (piece) => piece.kind === 'K' || pieceValue(piece.kind) >= pieceValue('S');
const SLIDERS = new Set(['L', 'R', 'B', '+R', '+B']);

/** 指した側から見て、そのマスのsteps歩前(負なら後ろ)。 */
function ahead(square, color, steps = 1) {
  const { x, y } = squareXY(square);
  return xySquare(x, y + (color === 'black' ? -steps : steps));
}

/** 銀の斜め後ろの2マス(指した側から見て)。 */
function backDiagonals(square, color) {
  const { x, y } = squareXY(square);
  const back = color === 'black' ? 1 : -1;
  return [xySquare(x - 1, y + back), xySquare(x + 1, y + back)].filter(Boolean);
}

/** 動かした駒の飛びの利きの筋で、手前の相手の駒と、その奥の相手の駒(田楽刺し)。 */
function skewer(board, to, piece, enemy) {
  const { x, y } = squareXY(to);
  for (const [dx, dy] of pieceVectors(piece.kind, piece.color).slides) {
    const hits = [];
    for (let cx = x + dx, cy = y + dy, square = xySquare(cx, cy); square; cx += dx, cy += dy, square = xySquare(cx, cy)) {
      const target = board.get(square);
      if (!target) continue;
      hits.push({ square, piece: target });
      if (hits.length === 2) break;
    }
    if (hits.length < 2) continue;
    const [front, back] = hits;
    if (front.piece.color !== enemy || back.piece.color !== enemy) continue;
    if (front.piece.kind === 'P' || front.piece.kind === 'K') continue;
    if (!worthForking(back.piece) || (back.piece.kind !== 'K' && pieceValue(back.piece.kind) < pieceValue(front.piece.kind))) continue;
    return [front.square, back.square];
  }
  return null;
}

/**
 * 指した手が当たる手筋の形。当たらなければnull。targetsは、ねらった駒のマス(両取り・田楽刺し)、たたいた駒のマス、歩を打ったマス、
 * 寄せの手筋では相手の玉のマス。
 * @param {{ sfenBefore: string, usi: string }} move
 * @returns {{ id: string, targets: string[] } | null}
 */
export function detectTesujiShape({ sfenBefore, usi }) {
  const { board, turn: mover } = parseSfenState(sfenBefore);
  const applied = applyUsiToBoard(board, usi, mover);
  if (!applied) return null;
  const { board: after, moved } = applied;
  const enemy = opponentOf(mover);
  const king = findKing(after, enemy);
  const piece = after.get(moved.to);
  const reach = attackedSquares(after, moved.to);
  const forks = reach.filter((square) => after.get(square)?.color === enemy && worthForking(after.get(square)));
  const checks = Boolean(king && reach.includes(king));
  const shape = (id, targets) => ({ id, targets });

  if (moved.kind === 'N' && forks.length >= 2) return shape('knight-fork', forks);
  if (moved.kind === 'S') {
    const split = backDiagonals(moved.to, mover).filter((square) => forks.includes(square));
    if (split.length === 2) return shape('waruuchi', split);
  }
  if ((moved.kind === 'R' || moved.kind === '+R') && forks.length >= 2) {
    const { x, y } = squareXY(moved.to);
    const file = forks.find((square) => squareXY(square).x === x);
    const rank = forks.find((square) => squareXY(square).y === y);
    if (file && rank) return shape('rook-cross-fork', [file, rank]);
  }
  if (checks) {
    const rook = forks.find((square) => ['R', '+R'].includes(after.get(square)?.kind ?? ''));
    if (rook) return shape('ote-bisha', [/** @type {string} */ (king), rook]);
  }
  if (forks.length >= 2) return shape('ryodori', forks);
  if (piece && SLIDERS.has(moved.kind)) {
    const pair = skewer(after, moved.to, piece, enemy);
    if (pair) return shape('dengaku', pair);
  }
  if (moved.kind === 'P') {
    // 焦点の歩: 相手の駒が2枚以上利いているマスへ歩を打つ・突く。
    if (attackersOf(after, moved.to, enemy).length >= 2) return shape('focal-pawn', [moved.to]);
    const front = ahead(moved.to, mover);
    const tapped = front ? after.get(front) : null;
    if (moved.drop && tapped && tapped.color === enemy && tapped.kind !== 'P' && tapped.kind !== 'K') return shape('tapping-pawn', [/** @type {string} */ (front)]);
  }
  if (!king) return null;
  const kingAt = squareXY(king);
  // 端玉には端歩: 相手の陣にいる玉が端から2筋以内にいて、その側の端の筋の歩を突く・打つ。
  if (moved.kind === 'P' && relativeRank(king, enemy) >= 7) {
    const edge = kingAt.x <= 2 ? 1 : kingAt.x >= 8 ? 9 : 0;
    if (edge && squareXY(moved.to).x === edge) return shape('edge-king-edge-pawn', [king]);
  }
  const at = squareXY(moved.to);
  if (moved.drop === 'S' && at.y === kingAt.y && Math.abs(at.x - kingAt.x) === 1) return shape('belly-silver', [king]);
  if (moved.kind === '+R') {
    const sameRank = at.y === kingAt.y && Math.abs(at.x - kingAt.x) === 2;
    const sameFile = at.x === kingAt.x && Math.abs(at.y - kingAt.y) === 2;
    const middle = xySquare((at.x + kingAt.x) / 2, (at.y + kingAt.y) / 2);
    if ((sameRank || sameFile) && middle && !after.has(middle)) return shape('one-gap-dragon', [king]);
  }
  return null;
}
