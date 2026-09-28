import { Position, reverseColor } from "tsshogi";
import { enumerateLegalMoves } from "../game-state";

type SearchResult = number | null | undefined;
type SearchBudget = {
  nodes: number;
  limit: number;
  deadline: number;
  now: () => number;
};

function consumeBudget(budget: SearchBudget): boolean {
  budget.nodes += 1;
  return budget.nodes > budget.limit || budget.now() >= budget.deadline;
}

/** 現在の手番側に合法な1手詰めがあれば、そのUSI指し手を返す。 */
export function findMateInOne(sfen: string): string | null {
  const position = Position.newBySFEN(sfen);
  if (!position) return null;
  for (const { usi } of enumerateLegalMoves(position)) {
    const next = position.clone();
    const move = next.createMoveByUSI(usi);
    if (!move || !next.doMove(move) || !next.checked) continue;
    if (enumerateLegalMoves(next).length === 0) return usi;
  }
  return null;
}

function forcedMatePly(
  position: Position,
  attacker: ReturnType<typeof reverseColor>,
  remainingPly: number,
  budget: SearchBudget,
): SearchResult {
  if (consumeBudget(budget)) return undefined;
  const moves = enumerateLegalMoves(position);
  if (moves.length === 0) return position.checked ? 0 : null;
  if (remainingPly === 0) return null;

  if (position.color === attacker) {
    let shortest: number | null = null;
    for (const move of moves) {
      // 攻め方の全合法手をcloneして王手か調べる処理も、時間・ノード予算へ含める。
      if (consumeBudget(budget)) return undefined;
      const next = position.clone();
      if (!next.doMove(next.createMoveByUSI(move.usi)!)) continue;
      // 詰み探索では攻め方が王手を連続させる手だけを読む。
      if (!next.checked) continue;
      const result = forcedMatePly(next, attacker, remainingPly - 1, budget);
      if (result === undefined) return undefined;
      if (result !== null) shortest = Math.min(shortest ?? Infinity, result + 1);
    }
    return shortest;
  }

  let longest = 0;
  for (const move of moves) {
    if (consumeBudget(budget)) return undefined;
    const next = position.clone();
    if (!next.doMove(next.createMoveByUSI(move.usi)!)) continue;
    const result = forcedMatePly(next, attacker, remainingPly - 1, budget);
    if (result === undefined) return undefined;
    if (result === null) return null;
    longest = Math.max(longest, result + 1);
  }
  return longest;
}

/** 現在の手番側に、連続王手による強制詰みがあるかを調べる。 */
export function findForcedMate(
  sfen: string,
  maxPly = 7,
  nodeLimit = 60000,
  maxTimeMs = 40,
) {
  const position = Position.newBySFEN(sfen);
  if (!position) return { isMate: false, matePly: 0, exhausted: false };
  const now = () => performance.now();
  const budget = { nodes: 0, limit: nodeLimit, deadline: now() + Math.max(0, maxTimeMs), now };
  const result = forcedMatePly(position, position.color, maxPly, budget);
  return {
    isMate: typeof result === "number" && result > 0,
    matePly: typeof result === "number" ? result : 0,
    exhausted: result === undefined,
  };
}

/**
 * 現在側がパスしたと仮定し、相手に連続王手による強制詰みがあるかを調べる。
 * 現在王手中の局面は詰めろではないため対象外とする。
 */
export function detectStrictMateThreat(
  sfen: string,
  maxPly = 7,
  nodeLimit = 60000,
  maxTimeMs = 40,
) {
  const position = Position.newBySFEN(sfen);
  if (!position || position.checked) return { isThreat: false, matePly: 0, exhausted: false };
  const attacker = reverseColor(position.color);
  position.setColor(attacker);
  const now = () => performance.now();
  const budget = { nodes: 0, limit: nodeLimit, deadline: now() + Math.max(0, maxTimeMs), now };
  const result = forcedMatePly(position, attacker, maxPly, budget);
  return {
    isThreat: typeof result === "number" && result > 0,
    matePly: typeof result === "number" ? result : 0,
    exhausted: result === undefined,
  };
}
