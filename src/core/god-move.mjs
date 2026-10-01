import { Position } from "tsshogi";
import { enumerateLegalMoves } from "../game-state";

/**
 * 神の一手の判定。対局中のやこび姫の褒め言葉と、棋譜解析（対局後・図鑑）の両方で使う。
 *
 * 神の一手は「先を読まないと良さに気付けない最善手で、ほかの手より明らかに良い手」とする。
 * 逆転の一手である必要はない。すべてを満たす手を神の一手の候補にする。
 * 1. 取り返しや、合法手が2手以下の局面の手ではない（誰でも指す手を除く）。
 * 2. 深い読みの最善手で、次善手より勝率で10ポイント以上良い（捨て駒なら7ポイント以上）。
 * 3. 浅い読みでは最善に見えない（候補に入らないか、浅い読みの最善より150以上低い）。
 *    または、浅い読みでまだ詰みが見えていない局面での捨て駒。
 * 棋譜解析では、候補のうち強さ（勝率差と、見つけにくさ・捨て駒の加点の合計）の上位3手だけを神の一手と表示する。
 */

/** 次善手との勝率差（ポイント）の下限。 */
export const GOD_MOVE_MIN_WINRATE_GAP = 10;
/** 捨て駒のときの勝率差の下限。捨て駒は見つけにくいので緩める。 */
export const GOD_MOVE_SACRIFICE_MIN_WINRATE_GAP = 7;
/** 浅い読みで最善手より何点低く見えていれば「先まで読まないと気付けない」とするか。 */
export const GOD_MOVE_SHALLOW_DEFICIT = 150;
/** 浅い読みで見えない手と、捨て駒の強さへの加点（勝率ポイント）。 */
export const GOD_MOVE_HIDDEN_BONUS = 10;
export const GOD_MOVE_SACRIFICE_BONUS = 10;
/** 棋譜解析で神の一手と表示する1局あたりの上限。 */
export const GOD_MOVE_LIMIT = 3;

/** 駒の価値（歩=1）。駒得や捨て駒の判定に使う。 */
export const PIECE_VALUES = Object.freeze({
  pawn: 1,
  lance: 3,
  knight: 4,
  silver: 5,
  gold: 6,
  bishop: 8,
  rook: 10,
  king: 100,
  promPawn: 5,
  promLance: 5,
  promKnight: 5,
  promSilver: 5,
  horse: 10,
  dragon: 12,
});

function comparableScore(score) {
  if (score?.type === "cp" && Number.isFinite(score.value)) return score.value;
  if (score?.type === "mate" && Number.isFinite(score.value)) {
    if (score.value > 0) return 100000 - score.value;
    if (score.value < 0) return -100000 + Math.abs(score.value);
  }
  return undefined;
}

/** 評価値（手番側視点）を勝率（0〜100）にする。詰みは100か0。 */
export function winRate(score) {
  if (score?.type === "mate" && Number.isFinite(score.value) && score.value !== 0) {
    return score.value > 0 ? 100 : 0;
  }
  if (score?.type !== "cp" || !Number.isFinite(score.value)) return undefined;
  return 100 / (1 + Math.exp(-score.value / 600));
}

function rankedCandidates(candidates = []) {
  return [...candidates]
    .filter((candidate) => (
      Number.isInteger(candidate?.rank) && candidate.rank >= 1
      && typeof candidate.move === "string" && comparableScore(candidate.score) !== undefined
    ))
    .sort((left, right) => left.rank - right.rank);
}

/**
 * 指す前の局面と指し手から、その手が誰でも指す手（trivial）か、捨て駒（sacrifice）かを調べる。
 * 捨て駒は、相手がその駒を合法に取れて、取り合いを最後まで単純に数えると駒損になる手。
 * @param {string} beforeSfen
 * @param {string} usi
 * @param {string} [previousUsi] 直前の相手の手。取り返しの判定に使う。
 */
export function moveContext(beforeSfen, usi, previousUsi = "") {
  const none = { trivial: false, sacrifice: false };
  const position = Position.newBySFEN(beforeSfen);
  const move = position?.createMoveByUSI(usi);
  if (!position || !move) return none;
  const legalCount = enumerateLegalMoves(position.clone()).length;
  const captured = position.board.at(move.to);
  // USIの3・4文字目が移動先（駒打ちも同じ位置）。
  const recapture = Boolean(captured) && previousUsi.slice(2, 4) === usi.slice(2, 4);
  const trivial = recapture || (legalCount > 0 && legalCount <= 2);
  const mover = position.color;
  if (!position.doMove(move)) return { trivial, sacrifice: false };
  const moved = position.board.at(move.to);
  const takers = enumerateLegalMoves(position.clone()).filter(({ to }) => to.equals(move.to));
  if (!moved || !takers.length) return { trivial, sacrifice: false };
  const cheapestTaker = Math.min(...takers.map(({ pieceType }) => PIECE_VALUES[pieceType] ?? 0));
  const defended = position.listAttackers(move.to)
    .some((square) => position.board.at(square)?.color === mover);
  const net = (captured ? PIECE_VALUES[captured.type] ?? 0 : 0)
    - (PIECE_VALUES[moved.type] ?? 0)
    + (defended ? cheapestTaker : 0);
  return { trivial, sacrifice: net < 0 };
}

/**
 * 神の一手の候補か判定する。deepCandidates・shallowCandidatesは、どちらも指す前の局面の手番側視点。
 * 候補ならstrength（上位3手を選ぶための強さ）などを返し、そうでなければnull。
 * @param {{
 *   move?: string,
 *   deepCandidates?: { rank: number, move: string, score?: { type: string, value: number } }[],
 *   shallowCandidates?: { rank: number, move: string, score?: { type: string, value: number } }[],
 *   trivial?: boolean,
 *   sacrifice?: boolean,
 * }} [options]
 */
export function judgeGodMove({
  move,
  deepCandidates = [],
  shallowCandidates = [],
  trivial = false,
  sacrifice = false,
} = {}) {
  const deep = rankedCandidates(deepCandidates);
  const [best, second] = deep;
  if (trivial || !move || !best || best.move !== move || !second) return null;
  const gap = winRate(best.score) - winRate(second.score);
  if (!(gap >= (sacrifice ? GOD_MOVE_SACRIFICE_MIN_WINRATE_GAP : GOD_MOVE_MIN_WINRATE_GAP))) return null;

  const shallow = rankedCandidates(shallowCandidates);
  const shallowBest = shallow[0];
  const shallowMove = shallow.find((candidate) => candidate.move === move);
  const hidden = Boolean(shallowBest) && shallowBest.move !== move && (
    !shallowMove
    || comparableScore(shallowBest.score) - comparableScore(shallowMove.score) >= GOD_MOVE_SHALLOW_DEFICIT
  );
  // 浅い読みでもう詰みが見えている局面の捨て駒は、読まなくても分かる手とする。
  const obviousMate = shallowBest?.score?.type === "mate" && shallowBest.score.value > 0;
  if (!hidden && !(sacrifice && !obviousMate)) return null;
  return {
    strength: gap + (hidden ? GOD_MOVE_HIDDEN_BONUS : 0) + (sacrifice ? GOD_MOVE_SACRIFICE_BONUS : 0),
    gap,
    hidden,
    sacrifice,
    score: best.score,
  };
}

/**
 * 棋譜解析の点から、神の一手を強さの上位limit手に絞る。外れた手は好手として残す。
 * 点のannotationが{ kind: "brilliant", strength }の手を候補にする。外した手にもgodCandidateを残すので、
 * 解析の途中で何度掛けても、最後まで解析した時点の上位limit手になる。
 */
export function capGodMoves(points, limit = GOD_MOVE_LIMIT) {
  const isCandidate = ({ annotation }) => annotation?.kind === "brilliant" || annotation?.godCandidate;
  const kept = new Set(
    points
      .filter(isCandidate)
      .sort((left, right) => (right.annotation.strength ?? 0) - (left.annotation.strength ?? 0))
      .slice(0, limit)
      .map(({ ply }) => ply),
  );
  return points.map((point) => {
    if (!isCandidate(point)) return point;
    const god = kept.has(point.ply);
    return {
      ...point,
      annotation: {
        ...point.annotation,
        kind: god ? "brilliant" : "good",
        label: god ? "神の一手" : "好手",
        godCandidate: true,
      },
    };
  });
}
