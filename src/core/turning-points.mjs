// 棋譜解析で、勝負を決めた手(決め手)と、負けを決定づけた手(敗着)を見つける。
// 解析した局面の評価値(先手視点)の推移と、終局の勝者だけから決める。

/** 勝者視点の評価値がこの値以上のまま終局まで続く最初の局面を、勝負が決まった局面とする。 */
export const DECISIVE_SCORE = 500;

const BLACK = 'black';
const WHITE = 'white';

/**
 * @param {{ ply: number, graphValue: number, annotation?: { mover?: string, loss?: number } | null }[]} points
 *   解析した局面。plyは、その局面までの手数。
 * @param {'black' | 'white' | null | undefined} winner 終局の勝者。引き分け・不明はnull。
 * @returns {{ decisive: number | null, losing: number | null }} 決め手と敗着の手数。見つからなければnull。
 */
export function findTurningPoints(points, winner) {
  const none = { decisive: null, losing: null };
  if ((winner !== BLACK && winner !== WHITE) || !points?.length) return none;
  const sorted = [...points].sort((a, b) => a.ply - b.ply);
  const sign = winner === BLACK ? 1 : -1;
  // 終局まで勝者が優勢を保ち続ける、最初の局面。
  let settled = null;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (sorted[index].graphValue * sign < DECISIVE_SCORE) break;
    settled = sorted[index].ply;
  }
  if (settled === null || settled < 1) return none;

  const moverOf = (ply) => (ply % 2 === 1 ? BLACK : WHITE);
  const mover = (point) => point.annotation?.mover ?? moverOf(point.ply);
  const loser = winner === BLACK ? WHITE : BLACK;

  // 決め手は、勝負が決まった手、または決まったあとの勝者の最初の手。
  const decisivePoint = sorted.find((point) => point.ply >= settled && mover(point) === winner);

  // 敗着は、決まるまでの敗者の手で、評価値の損が最も大きいもの。損が測れなければ決まる直前の敗者の手。
  const losingCandidates = sorted.filter((point) => point.ply >= 1 && point.ply <= settled && mover(point) === loser);
  let losing = null;
  let worstLoss = 0;
  for (const point of losingCandidates) {
    const loss = point.annotation?.loss ?? 0;
    if (loss > worstLoss) {
      worstLoss = loss;
      losing = point.ply;
    }
  }
  if (losing === null) losing = losingCandidates.at(-1)?.ply ?? null;
  return { decisive: decisivePoint?.ply ?? null, losing };
}

/**
 * その手に添えるやこび姫の言葉。対CPU対局で、プレイヤー側の勝敗に合わせて言い回しを変える。
 * @param {'decisive' | 'losing'} kind
 * @param {{ playerWon?: boolean | null }} [options] playerWon: プレイヤーが勝ったか。対人・不明はnull。
 */
export function turningPointText(kind, { playerWon = null } = {}) {
  if (kind === 'decisive') return 'この手が勝負の決め手になったね！';
  if (playerWon === true) return 'この手が相手の敗着みたい。ここで差がついたね！';
  return 'この手が敗着みたい。悔しい～！';
}
