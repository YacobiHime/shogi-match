// 囲いの見くらべ(docs/nyumon-mode-design.mdの21-3)。居玉と囲いを、同じ攻め駒に対して3つのめがねでくらべる。
// - 逃げ道: 相手のいちばん厳しい王手のあと、玉が動けるマス(王手した駒を取るのも含む)
// - 打ち込みの隙: 取られずにかけられる王手の行き先(取り合いの計算で、守る側が取り返しても得をしない)
// - ひも: 玉のそばの金銀を、だれが守っているか(守っている駒→守られている駒)と、だれにも守られていない駒(浮き駒)
// 数はすべて局面から計算する(教室の台詞の数字も、ここで作る)。詰み探索は使わない。

import { appendUsiMove, createGameRecord, enumerateLegalMoves } from '../game-state';
import { kingEscapeMap } from './board-insight.mjs';
import { exchangeGain } from './exchange-eval.mjs';
import { formatHintMove } from './match-assists.mjs';
import { attackersOf, findKing, opponentOf, parseSfenState, squareXY } from './piece-movement.mjs';

// 教室の台詞と同じく、竜王の駒は「竜」と書く(formatHintMoveは「龍」)。

function legalUsis(sfen) {
  return enumerateLegalMoves(createGameRecord(sfen).position).map(({ usi }) => usi);
}

function sfenAfter(sfen, usi) {
  const record = createGameRecord(sfen);
  if (!appendUsiMove(record, usi)) throw new Error(`${usi}を指せません`);
  return record.position.sfen;
}

/** 指した手の行き先("7f+"・"G*7a"の"7a")。 */
function destination(usi) {
  return usi.includes('*') ? usi.slice(2, 4) : usi.slice(2, 4);
}

/**
 * 攻める側(手番の側)の王手をすべて調べる。
 * safeは、王手した駒が取られても守る側が得をしない(=取られずにかけられる)か。
 * kingMovesは、王手のあと玉が動けるマス(王手した駒を玉で取るのも含む)。
 * @param {string} sfen 攻める側の手番の局面
 */
export function castleChecks(sfen) {
  const { turn } = parseSfenState(sfen);
  const defender = opponentOf(turn);
  const { board } = parseSfenState(sfen);
  const king = findKing(board, defender);
  if (!king) return [];
  const checks = [];
  for (const usi of legalUsis(sfen)) {
    const after = sfenAfter(sfen, usi);
    const state = parseSfenState(after);
    if (!attackersOf(state.board, king, turn).length) continue;
    const square = destination(usi);
    const safe = exchangeGain(state.board, square, defender, { mode: 'full' }).gain <= 0;
    const kingSquares = legalUsis(after).filter((reply) => reply.slice(0, 2) === king).map((reply) => reply.slice(2, 4));
    checks.push({ usi, square, safe, kingMoves: kingSquares.length, kingSquares, sfen: after, label: `${turn === 'black' ? '▲' : '△'}${formatHintMove(usi, sfen).replace('龍', '竜')}` });
  }
  return checks;
}

/**
 * 玉のそばの守りの駒のつながり(ひも)。玉から2マス以内の金・銀と玉を「守りの駒」とし、
 * 守りの駒どうしで、守っている駒→守られている駒の組(links)と、だれにも守られていない金銀(loose)を返す。
 * @param {string} sfen
 * @param {'black' | 'white'} color 守る側
 */
export function guardLinks(sfen, color) {
  const { board } = parseSfenState(sfen);
  const king = findKing(board, color);
  if (!king) return { guards: [], links: [], loose: [] };
  const origin = squareXY(king);
  const guards = [...board]
    .filter(([square, piece]) => piece.color === color && ['K', 'G', 'S'].includes(piece.kind)
      && Math.max(Math.abs(squareXY(square).x - origin.x), Math.abs(squareXY(square).y - origin.y)) <= 2)
    .map(([square]) => square)
    .sort();
  const guardSet = new Set(guards);
  const links = [];
  const loose = [];
  for (const square of guards) {
    const protectors = attackersOf(board, square, color).map(({ square: from }) => from);
    for (const from of protectors) if (guardSet.has(from)) links.push([from, square]);
    if (board.get(square)?.kind !== 'K' && !protectors.length) loose.push(square);
  }
  return { guards, links, loose };
}

/**
 * 局面の守りの通信簿。sfenは攻める側の手番。
 * @param {string} sfen
 */
export function castleInsight(sfen) {
  const { turn } = parseSfenState(sfen);
  const defender = opponentOf(turn);
  const checks = castleChecks(sfen);
  // いちばん厳しい王手: 玉の動けるマスがいちばん少ない王手。同じなら、取られずにかけられる王手を先にする。
  const worst = [...checks].sort((a, b) => a.kingMoves - b.kingMoves || Number(b.safe) - Number(a.safe))[0] ?? null;
  const holes = [...new Set(checks.filter(({ safe }) => safe).map(({ square }) => square))];
  const blocked = worst ? (kingEscapeMap(worst.sfen, defender)?.squares ?? []).filter(({ state }) => state === 'blocked').length : 0;
  return {
    defender,
    checks,
    worst,
    escapes: worst ? worst.kingMoves : null,
    /** いちばん厳しい王手のあと、玉の味方の駒がふさいでいるマスの数。 */
    blocked,
    holes,
    ...guardLinks(sfen, defender),
  };
}
