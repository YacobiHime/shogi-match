/**
 * 取り合いの計算(チェスでいう静的交換評価、SEE)。教室の「駒の利き」の表示と同じ材料(マスに利いている駒)から、
 * そのマスの駒を取り合ったときに、取りに行く側が何点得をするかを出す。
 * 人間の級位者が駒を動かす前にする「利きを数える」「安い駒から取り合う」を、そのまま計算にしたもの。
 *
 * 見え方(mode)で、同じ局面でも判断が変わる。弱いレベルほど単純な見方しかしない(設計はdocs/logic-ai-design.mdの「取り合いの計算」)。
 * - presence: 相手の利きがあれば取られる、と見る(守っていても逃げる)
 * - count: 利きの数を比べる。攻め手が守り手より多ければ取られる(安い駒で取られる損は見えない)
 * - see: 安い駒から順に取り合う。どちらも損になる取り返しはやめられる。裏の利き・ピンは見えない
 * - full: seeに加えて、裏の利き(手前の駒が出ると通る飛・角・香)、ピン(取ると自玉が取られる駒)、成りまで見る
 *
 * 点数はlogic-position.mjsの駒の価値(歩100)で、駒の損得(material)と同じく、取った駒は持ち駒の分も数える。
 * 画面に依存しない。
 */
import { applyUsiToBoard, attackedSquares, attackersOf, isKingAttacked, opponentOf, parseUsiMove, relativeRank } from "./piece-movement.mjs";
import { value } from "./logic-position.mjs";

export const EXCHANGE_MODES = Object.freeze(["presence", "count", "see", "full"]);
const PROMOTABLE = new Set(["P", "L", "N", "S", "B", "R"]);
const UNPROMOTE = Object.freeze({ "+P": "P", "+L": "L", "+N": "N", "+S": "S", "+B": "B", "+R": "R" });

/** 取られたときの損得の振れ幅。盤の駒がなくなり、相手の持ち駒に(成り駒は元の駒で)入る。 */
export function captureSwing(kind) {
  return value(kind) + value(UNPROMOTE[kind] ?? kind);
}

/** fromからsquareへ取りに出るとき、成れるなら成る(成って得をする駒だけ)。 */
function capturingMove(from, square, kind, color) {
  const promote = PROMOTABLE.has(kind) && (relativeRank(from, color) <= 3 || relativeRank(square, color) <= 3);
  return { usi: `${from}${square}${promote ? "+" : ""}`, promoted: promote ? `+${kind}` : kind };
}

/** 安い駒から並べた利き。玉は最後(玉は、取り返されないときだけ取れる)。 */
function cheapestFirst(attackers) {
  return [...attackers].sort((a, b) => (a.kind === "K") - (b.kind === "K") || value(a.kind) - value(b.kind));
}

/**
 * squareの駒を、attackerの側が取り合ったときの、attackerの側の得(0以上)。取らないほうが得なら0。
 * @param {Map<string, {color: string, kind: string}>} board
 * @param {string} square
 * @param {"black" | "white"} attacker
 * @param {{ mode?: "presence" | "count" | "see" | "full" }} [options]
 * @returns {{ gain: number, attackers: number, defenders: number, line: string[] }}
 *   attackers・defendersは、いまのマスに直接利いている駒の数(利きの表示と同じ数)。lineは取り合いの手順(USI)。
 */
export function exchangeGain(board, square, attacker, { mode = "full" } = {}) {
  const target = board.get(square);
  const defender = opponentOf(attacker);
  const direct = attackersOf(board, square, attacker);
  const guards = attackersOf(board, square, defender);
  const result = (gain, line = []) => ({ gain: Math.max(0, gain), attackers: direct.length, defenders: guards.length, line });
  if (!target || target.color !== defender || target.kind === "K" || !direct.length) return result(0);
  const swing = captureSwing(target.kind);
  if (mode === "presence") return result(swing);
  if (mode === "count") return result(!guards.length || direct.length > guards.length ? swing : 0);

  // 取り合いを盤の上でまねる。gains[i]は、i手目まで取り合ったときの、i手目を指した側の得。
  const xray = mode === "full";
  const remaining = { [attacker]: cheapestFirst(direct), [defender]: cheapestFirst(guards) };
  const gains = [];
  const line = [];
  let current = board;
  let side = attacker;
  let onSquare = swing;
  for (let ply = 0; ply < 32; ply += 1) {
    // 裏の利きを見るときは、取り合うたびに利きを数え直す(手前の駒がいなくなると後ろの利きが通る)。
    const list = xray ? cheapestFirst(attackersOf(current, square, side)) : remaining[side];
    let picked = null;
    for (const candidate of list) {
      const piece = current.get(candidate.square);
      if (!piece || piece.color !== side) continue;
      const other = opponentOf(side);
      // 玉は、取り返されないときだけ取れる。
      if (piece.kind === "K") {
        const others = xray ? attackersOf(current, square, other) : remaining[other].filter(({ square: from }) => current.get(from)?.color === other);
        const afterKing = applyUsiToBoard(current, `${candidate.square}${square}`, side)?.board;
        if (others.length || (xray && afterKing && isKingAttacked(afterKing, side))) continue;
      }
      const move = capturingMove(candidate.square, square, piece.kind, side);
      const next = applyUsiToBoard(current, move.usi, side);
      // ピン: 取ると自分の玉が取られる駒は使えない(fullだけが見る)。
      if (!next || (xray && isKingAttacked(next.board, side))) continue;
      picked = { candidate, move, next, kind: piece.kind };
      break;
    }
    if (!picked) break;
    if (!xray) remaining[side] = remaining[side].filter(({ square: from }) => from !== picked.candidate.square);
    const promotion = value(picked.move.promoted) - value(picked.kind);
    gains.push(onSquare + promotion - (gains.length ? gains.at(-1) : 0));
    line.push(picked.move.usi);
    onSquare = captureSwing(picked.move.promoted);
    current = picked.next.board;
    side = opponentOf(side);
  }
  // どちらの側も、損になる取り返しはやめられる(後ろから決める)。
  for (let index = gains.length - 1; index > 0; index -= 1) {
    gains[index - 1] = -Math.max(-gains[index - 1], gains[index]);
  }
  return result(gains[0] ?? 0, line);
}

/**
 * 確かめる自分の駒の範囲(scope)。
 * - moved: 動かした駒と、すでに当たりになっていると気づいた駒
 * - defended: さらに、動かした駒が動く前に守っていた駒(守りが外れる)
 * - all: さらに、指したあと相手の利きがある自分の駒すべて(利きが通る線の上の駒を含む)
 */
export const EXCHANGE_SCOPES = Object.freeze(["moved", "defended", "all"]);
/** 2番目に大きい「取られる損」を数える割合。 */
export const SECOND_LOSS_SHARE = 0.5;

/**
 * 1手の駒の損得。指したあと、相手が取り合いで得をする自分の駒のうち、いちばん大きい得に、2番目の得の半分を足して
 * 「取られる損」とする(相手が取れるのは1つだが、残った1つも次に守る必要がある)。「次の狙い」は、もう一度自分が指せたら取り合いで得をする相手の駒の、いちばん大きい得。
 * 玉は狙いに数えない(王手した局面で玉を取れることを、狙いと数えない)。
 * @param {{ board: Map<string, any>, turn: "black" | "white" }} state 指す前の局面(手番の側が指す)
 * @param {string} usi
 * @param {{ mode?: string, scope?: string, watched?: string[] }} [options] watchedは、すでに当たりになっていると気づいている自分の駒のマス
 * @returns {{ risk: number, riskSquare: string, threat: number, threatSquare: string } | null}
 */
export function moveExchange(state, usi, { mode = "full", scope = "all", watched = [] } = {}) {
  const me = state.turn;
  const opp = opponentOf(me);
  const applied = applyUsiToBoard(state.board, usi, me);
  if (!applied) return null;
  const after = applied.board;
  const { from, to } = parseUsiMove(usi);
  const squares = new Set([to, ...watched]);
  if (scope !== "moved" && from) {
    for (const square of attackedSquares(state.board, from)) squares.add(square);
  }
  if (scope === "all") {
    for (const [square, piece] of after) {
      if (piece.color === me && piece.kind !== "K") squares.add(square);
    }
  }
  // 相手が取れるのは1つだが、取られそうな駒が2つあれば、次の手番でもう1つを守る手間が残る。2番目の損は半分だけ数える。
  const losses = [];
  for (const square of squares) {
    const piece = after.get(square);
    if (piece?.color !== me || piece.kind === "K") continue;
    const { gain } = exchangeGain(after, square, opp, { mode });
    if (gain > 0) losses.push({ gain, square });
  }
  losses.sort((a, b) => b.gain - a.gain);
  const risk = (losses[0]?.gain ?? 0) + SECOND_LOSS_SHARE * (losses[1]?.gain ?? 0);
  const riskSquare = losses[0]?.square ?? "";
  let threat = 0;
  let threatSquare = "";
  for (const [square, piece] of after) {
    if (piece.color !== opp || piece.kind === "K") continue;
    const { gain } = exchangeGain(after, square, me, { mode });
    if (gain > threat) {
      threat = gain;
      threatSquare = square;
    }
  }
  return { risk, riskSquare, threat, threatSquare };
}
