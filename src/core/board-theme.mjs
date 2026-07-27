export const BOARD_THEME = Object.freeze({
  boardLight: '#e8bd72',
  boardDark: '#c98a3d',
  boardEdge: '#704018',
  grid: '#3f2817',
  pieceLight: '#f7d996',
  pieceDark: '#d79a45',
  pieceEdge: '#4a2a12',
  text: '#20130b',
  promotedText: '#a52218',
  selectedLight: '#93c5fd',
  selectedDark: '#3b82f6',
  selectedEdge: '#123f83',
  lastMoveFrom: '#facc15',
  lastMoveTo: '#f97316',
});

export const BOARD_PIECE_POINTS = '0,-25 17,-18 21,18 -21,18 -17,-18';
export const HAND_PIECE_POINTS = '0,-17 11,-12 14,12 -14,12 -11,-12';

const PROMOTED_KINDS = new Set(['TO', 'NY', 'NK', 'NG', 'UM', 'RY']);
const HAND_ORDER = ['HI', 'KA', 'KI', 'GI', 'KE', 'KY', 'FU'];

export function isPromotedKind(kind) {
  return PROMOTED_KINDS.has(kind);
}

/** 持ち駒を駒種別に集約し、一般的な価値順で表示できる形にする。 */
export function summarizeHand(hand) {
  const counts = new Map();
  for (const piece of hand || []) {
    counts.set(piece.kind, (counts.get(piece.kind) || 0) + 1);
  }
  return HAND_ORDER
    .filter((kind) => counts.has(kind))
    .map((kind) => ({ kind, count: counts.get(kind) }));
}
