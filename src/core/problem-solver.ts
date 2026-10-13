import { Position, reverseColor } from "tsshogi";
import { enumerateLegalMoves } from "../game-state";

/**
 * 将棋問題集の正誤判定。正解を手で書かず、合法手をすべて詰み探索で調べて決める。
 * - 詰ませる問題（mate）: depth手以内の連続王手で詰む手が正解。
 * - 逃げる問題（escape）: 指したあと、相手にdepth手以内の連続王手の詰みがない手が正解。
 * 問題の局面には攻め方の玉がないことがある（詰将棋と同じ）ため、エンジンではなくJavaScriptで探索する。
 */

export type MateLine = { plies: number; line: string[] };
export type ProblemKind = "mate" | "escape";
export type MoveVerdict = {
  usi: string;
  correct: boolean;
  /**
   * mate: 詰む / not-check: 王手でない / escapes: 逃げられる（lineに逃げ方）
   * safe: 詰まない / mated: 詰まされる（lineに詰み手順） / unknown: 探索の上限で判定できない
   */
  reason: "mate" | "not-check" | "escapes" | "safe" | "mated" | "unknown";
  /** 指した手から始まる手順。詰み手順か、逃げられる応手。 */
  line: string[];
};

type Budget = { nodes: number; limit: number; deadline: number };
type SearchResult = MateLine | null | undefined;

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());

function consume(budget: Budget): boolean {
  budget.nodes += 1;
  return budget.nodes > budget.limit || now() >= budget.deadline;
}

function play(position: Position, usi: string): Position | null {
  const next = position.clone();
  const move = next.createMoveByUSI(usi);
  return move && next.doMove(move) ? next : null;
}

/**
 * attackerが連続王手で詰ませる最短手順を探す。受け方は最も長く逃れる手を選ぶ。
 * 詰みがなければnull、予算を使い切ったらundefined。
 */
function mateSearch(position: Position, attacker: Position["color"], remaining: number, budget: Budget): SearchResult {
  if (consume(budget)) return undefined;
  const moves = enumerateLegalMoves(position);
  if (moves.length === 0) {
    return position.color !== attacker && position.checked ? { plies: 0, line: [] } : null;
  }
  if (remaining === 0) return null;
  if (position.color === attacker) {
    let best: MateLine | null = null;
    for (const { usi } of moves) {
      const next = play(position, usi);
      // 攻め方は王手だけを読む。
      if (!next?.checked) continue;
      const result = mateSearch(next, attacker, remaining - 1, budget);
      if (result === undefined) return undefined;
      if (result && (!best || result.plies + 1 < best.plies)) best = { plies: result.plies + 1, line: [usi, ...result.line] };
    }
    return best;
  }
  let longest: MateLine | null = null;
  for (const { usi } of moves) {
    const next = play(position, usi);
    if (!next) continue;
    const result = mateSearch(next, attacker, remaining - 1, budget);
    if (result === undefined) return undefined;
    if (result === null) return null;
    if (!longest || result.plies + 1 > longest.plies) longest = { plies: result.plies + 1, line: [usi, ...result.line] };
  }
  return longest;
}

/** 詰ませ損ねた手に対し、詰みを逃れる受け方の応手を1つ返す。玉が逃げる手を優先する。 */
function escapeReply(position: Position, attacker: Position["color"], remaining: number, budget: Budget): string | undefined {
  const moves = enumerateLegalMoves(position);
  const ordered = [...moves.filter(({ pieceType }) => pieceType === "king"), ...moves.filter(({ pieceType }) => pieceType !== "king")];
  for (const { usi } of ordered) {
    const next = play(position, usi);
    if (next && mateSearch(next, attacker, remaining, budget) === null) return usi;
  }
  return undefined;
}

/**
 * 受け方の手番の局面で、remaining手以内の連続王手で詰まされない応手を1つ返す。
 * 見つからない、または探索の上限に達したらundefined（詰め将棋で、手順と違う王手の逃げ方を見せるのに使う）。
 */
export function findEscapeReply(
  sfen: string,
  remaining: number,
  { nodeLimit = 60000, maxTimeMs = 600 } = {},
): string | undefined {
  const position = Position.newBySFEN(sfen);
  if (!position) return undefined;
  const budget: Budget = { nodes: 0, limit: nodeLimit, deadline: now() + maxTimeMs };
  return escapeReply(position, reverseColor(position.color), Math.max(0, remaining), budget);
}

/**
 * 問題の局面の合法手をすべて判定する。depthは、詰ませる問題では詰みまでの手数（奇数）、
 * 逃げる問題では相手に許す詰みの手数。
 */
export function analyzeProblem(
  { sfen, kind, depth }: { sfen: string; kind: ProblemKind; depth: number },
  { nodeLimit = 300000, maxTimeMs = 2000 } = {},
): { verdicts: MoveVerdict[]; exhausted: boolean } {
  const position = Position.newBySFEN(sfen);
  if (!position) throw new Error(`問題の局面を読めません: ${sfen}`);
  const budget: Budget = { nodes: 0, limit: nodeLimit, deadline: now() + maxTimeMs };
  const mover = position.color;
  let exhausted = false;
  const verdicts = enumerateLegalMoves(position).map(({ usi }): MoveVerdict => {
    const next = play(position, usi)!;
    if (kind === "mate") {
      if (!next.checked) return { usi, correct: false, reason: "not-check", line: [usi] };
      const result = mateSearch(next, mover, depth - 1, budget);
      if (result === undefined) {
        exhausted = true;
        return { usi, correct: false, reason: "unknown", line: [usi] };
      }
      if (result) return { usi, correct: true, reason: "mate", line: [usi, ...result.line] };
      const reply = escapeReply(next, mover, Math.max(0, depth - 2), budget);
      return { usi, correct: false, reason: "escapes", line: reply ? [usi, reply] : [usi] };
    }
    const result = mateSearch(next, next.color, depth, budget);
    if (result === undefined) {
      exhausted = true;
      return { usi, correct: false, reason: "unknown", line: [usi] };
    }
    return result
      ? { usi, correct: false, reason: "mated", line: [usi, ...result.line] }
      : { usi, correct: true, reason: "safe", line: [usi] };
  });
  return { verdicts, exhausted };
}

export type MateStepVerdict =
  /** 指した手で詰んだ。 */
  | { status: "mated" }
  /** まだ詰みが続く。replyは受け方の最も長く逃れる応手、pliesは応手から詰みまでの手数。 */
  | { status: "continue"; reply: string; plies: number }
  /** 王手でない・逃げられる・指せない。 */
  | { status: "not-check" | "escapes" | "illegal" }
  /** 探索の上限で判定できない。 */
  | { status: "unknown" };

/**
 * 実戦の詰み（対局の振り返りなど）で、攻め方が指した1手を判定する。
 * remainingは、指す前の局面での詰みまでの手数。少し遠回りの詰みも認めるため、slack手だけ長く読む。
 * @param {string} sfen 攻め方の手番の局面
 * @param {string} usi 攻め方が指した手
 * @param {number} remaining 指す前の局面での詰みまでの手数
 */
export function judgeMateStep(
  sfen: string,
  usi: string,
  remaining: number,
  { slack = 2, nodeLimit = 200000, maxTimeMs = 1500 } = {},
): MateStepVerdict {
  const position = Position.newBySFEN(sfen);
  if (!position) return { status: "illegal" };
  const attacker = position.color;
  const next = play(position, usi);
  if (!next) return { status: "illegal" };
  if (!next.checked) return { status: "not-check" };
  if (enumerateLegalMoves(next).length === 0) return { status: "mated" };
  const budget: Budget = { nodes: 0, limit: nodeLimit, deadline: now() + maxTimeMs };
  const result = mateSearch(next, attacker, Math.max(0, remaining - 1) + slack, budget);
  if (result === undefined) return { status: "unknown" };
  if (!result || !result.line.length) return { status: "escapes" };
  return { status: "continue", reply: result.line[0], plies: result.plies };
}

/**
 * 手番側が、plies手以内の連続王手で詰ませる手順を返す。詰みがなければnull、探索の上限に達したらundefined。
 * 対局のCPU(ロジックAI)が、詰みに気づくか・相手の詰みを防ぐかを調べるのに使う。
 */
export function findMateLine(
  sfen: string,
  plies: number,
  { nodeLimit = 20000, maxTimeMs = 150 } = {},
): string[] | null | undefined {
  const position = Position.newBySFEN(sfen);
  if (!position) return null;
  const budget: Budget = { nodes: 0, limit: nodeLimit, deadline: now() + maxTimeMs };
  const result = mateSearch(position, position.color, Math.max(1, plies), budget);
  if (result === undefined) return undefined;
  return result && result.line.length ? result.line : null;
}
