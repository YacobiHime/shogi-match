// 戦法熟練度(docs/disciple-mode-design.mdの34-10)。
// 「理由で指す」棋士は、定跡の手順が終わったあと(棒銀なら銀が出て相手の駒とぶつかる手前まで)の続きだけ、
// 評価関数(対局用のエンジン)で何手か指す。ふつうの対局で定跡補助が終わったあとに最善手の案内が出るのと同じ考え。
// 熟練度が大きいほど、エンジンで指す手の数と、その手の探索量が増える。画面と保存に依存しない。

/** 熟練度の上限。 */
export const MASTERY_MAX = 100;

/** 熟練度→定跡のあとにエンジンで指す手の数と探索量。熟練度0はエンジンを使わない。 */
export const MASTERY_FOLLOW = Object.freeze({
  /** 熟練度が上限のときに、定跡のあとにエンジンで指す自分の手の数。 */
  maxMoves: 10,
  /** 熟練度1あたりの探索量のいちばん小さい値(局面の数)。 */
  minNodes: 2000,
  /** 熟練度が上限のときの探索量。間は指数で補う(熟練度が20上がるごとにおよそ2倍)。 */
  maxNodes: 64000,
});

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/**
 * 熟練度から、定跡のあとにエンジンで指す手の数と、1手の探索量。
 * @param {number} mastery 0〜100
 * @returns {{ moves: number, nodes: number }}
 */
export function masteryFollowUp(mastery) {
  const m = clamp(Number(mastery) || 0, 0, MASTERY_MAX);
  if (m <= 0) return { moves: 0, nodes: 0 };
  const moves = Math.max(1, Math.round((m / MASTERY_MAX) * MASTERY_FOLLOW.maxMoves));
  const ratio = MASTERY_FOLLOW.maxNodes / MASTERY_FOLLOW.minNodes;
  const nodes = Math.round(MASTERY_FOLLOW.minNodes * ratio ** (m / MASTERY_MAX));
  return { moves, nodes };
}

/** 1局の定跡の歩み(手番の側ごと)。 */
export function createBookTracker() {
  return { black: { used: false, endedAt: null }, white: { used: false, endedAt: null } };
}

/**
 * 手番の側の定跡の歩みを1手ぶん進める。定跡の手があった側が、はじめて定跡の手を失った自分の手の数を覚える。
 * @param {ReturnType<typeof createBookTracker>} tracker
 * @param {'black' | 'white'} side
 * @param {{ planMove: string | null, ownMoves: number }} now ownMovesは、この手を指す前の、その側の手の数
 */
export function noteBook(tracker, side, { planMove, ownMoves }) {
  const entry = tracker[side];
  if (planMove) {
    if (entry.endedAt === null) return { ...tracker, [side]: { used: true, endedAt: null } };
    return tracker;
  }
  if (entry.used && entry.endedAt === null) return { ...tracker, [side]: { used: true, endedAt: ownMoves } };
  return tracker;
}

/**
 * この手をエンジンで指すか(定跡が終わってから、熟練度で決まる手の数のうちか)。
 * @param {ReturnType<typeof createBookTracker>} tracker
 * @param {'black' | 'white'} side
 * @param {number} ownMoves この手を指す前の、その側の手の数
 * @param {number} mastery
 * @returns {{ nodes: number, index: number, of: number } | null} indexは定跡が終わってから何手目か(0から)
 */
export function followUpTurn(tracker, side, ownMoves, mastery) {
  const entry = tracker[side];
  if (!entry.used || entry.endedAt === null) return null;
  const { moves, nodes } = masteryFollowUp(mastery);
  const index = ownMoves - entry.endedAt;
  return index >= 0 && index < moves ? { nodes, index, of: moves } : null;
}
