// 全部の手を読む探索(docs/disciple-mode-design.mdの34-15。段階E2.5)。
// 速い局面(fast-board.mjs)の上で、1手ずつ深くするアルファベータ探索。王手されたら1手延ばし、末端は取る手と成る手の静止探索。
// 末端の点は、駒の損得(将棋AIで使われる駒の価値)と、名前のある形の点(玉の守り・玉に迫る駒・大駒の働き・持ち駒)だけ。
// 形の点は1つずつ名前を持ち、思考の記録で「玉の守りが2枚減る」のように言えるようにする(evaluateTerms)。

import { AI_PIECE_POINTS } from './piece-points.mjs';
import { LOGIC_VALUES } from './logic-values.mjs';
import { FastBoard, BISHOP, GOLD, KING, PAWN, ROOK, SILVER, fileOf, rankOf, slidesOf, stepsOf } from './fast-board.mjs';
import { PRO_SHAPE_WEIGHTS } from '../data/pro-shape-weights.mjs';
import { quietPrior } from './move-prior.mjs';

const KIND_NAMES = [null, 'P', 'L', 'N', 'S', 'G', 'B', 'R', 'K', '+P', '+L', '+N', '+S', null, '+B', '+R'];
const tableOf = (values) => {
  const table = KIND_NAMES.map((name) => (name ? (values[name] ?? 0) : 0));
  table[KING] = 0;
  return table;
};
/** 駒の種類ごとの価値(盤上)。成り駒は元の駒＋成った分(logic-values.mjs。39章)。 */
const VALUE = tableOf(LOGIC_VALUES);
/** 前の版の価値(成り駒は金と同じ。自己対局で比べる用)。 */
const CLASSIC_VALUE = tableOf(AI_PIECE_POINTS);
/** 持ち駒の価値は、元の駒の価値(どちらの表でも同じ)。 */
const valuesOf = (classic) => (classic ? CLASSIC_VALUE : VALUE);
export const MATE = 30000;
const INF = 100000;
/** 読む順番で、手の好みの点1つをhistoryのいくつに数えるか。 */
const PRIOR_ORDER = 40;

/** 名前のある形の点の重み(手で決めた初期値。39章)。前の版(classic)と、棋譜で学んだ重みがないときに使う。 */
export const HAND_SHAPE_WEIGHTS = Object.freeze({
  /** 持ち駒は盤上より少し働く(打てる)。価値に掛ける割合。 */
  hand: 0.08,
  /** 玉のまわり8升の金銀(成り駒を含む)1枚。 */
  guard: 45,
  /** 玉が中央(5筋・4筋・6筋)に残っている。 */
  kingCenter: -40,
  /** 相手の玉から2升以内にいる、自分の歩以外の駒1枚(攻め駒)。大駒は倍。 */
  attacker: 28,
  /** 飛車・角(竜・馬)の利く升1つ。 */
  mobility: 3,
  /** 玉のまわり8升のうち、相手の駒が利いている升1つ(形の点の段2)。 */
  kingZone: -16,
  /** 玉が囲いの位置(自陣の下2段で、端から3筋以内)にいる(形の点の段2)。 */
  castle: 50,
  /** 相手の陣地(3段)の升のうち、自分の駒が利いている升1つ(形の点の段3。39章)。成り込み・攻めの足場。 */
  camp: 6,
  /** 自分の駒(玉・歩以外)で、どの駒も利いていない浮き駒1枚(形の点の段3)。 */
  loose: -15,
  /** 浮き駒が、相手の駒に当たっている(形の点の段3。読みの末端で、取られそうな形を嫌う)。 */
  hanging: -30,
  /** 持ち駒に歩がない(歩切れ。40章のL2で足した。手で決めた重みでは数えない)。 */
  pawnless: 0,
  /** 自分の歩が、相手の陣地のすぐ手前(4段目)より先にいる(位・垂れ歩。40章のL2で足した)。 */
  pawnFront: 0,
});

/** 形の点の名前(evaluateTermsの項目のうち、駒の損得以外)。 */
export const SHAPE_TERMS = Object.freeze(Object.keys(HAND_SHAPE_WEIGHTS));

/**
 * いま使う形の点の重み。プロの棋譜に合わせた重み(src/data/pro-shape-weights.mjs。40章のL2)があればそれ、なければ手で決めた重み。
 * 学んだ重みにない名前は、手で決めた重みで埋める。
 */
export const SHAPE_WEIGHTS = Object.freeze({ ...HAND_SHAPE_WEIGHTS, ...(PRO_SHAPE_WEIGHTS ?? {}) });

const isGuard = (abs) => abs === GOLD || abs === SILVER || (abs >= 9 && abs <= 12);

/**
 * 局面の点を、名前ごとに分けて出す(先手から見た値)。
 * shapeの段3は、駒の利きの地図から、相手の陣地の利き・浮き駒も数え、玉のまわりの利きと囲いの位置(段2)も入れる(39章)。
 * @param {FastBoard} board
 * @param {{ shape?: boolean | number, classic?: boolean, weights?: Record<string, number> | null }} [options] shapeが偽なら駒の損得だけ。classicは前の版の駒の価値と手で決めた重み。weightsは形の点の重み(省くといま使う重み)
 */
export function evaluateTerms(board, { shape = true, classic = false, weights = null } = {}) {
  const level = shape === true ? 1 : Number(shape) || 0;
  shape = level > 0;
  const VALUE = valuesOf(classic);
  const W = weights ?? (classic ? HAND_SHAPE_WEIGHTS : SHAPE_WEIGHTS);
  const terms = { material: 0, hand: 0, guard: 0, kingCenter: 0, attacker: 0, mobility: 0, kingZone: 0, castle: 0, camp: 0, loose: 0, hanging: 0, pawnless: 0, pawnFront: 0 };
  const kings = board.king;
  const att = level >= 3 ? attackMap(board) : null;
  for (let s = 0; s < 81; s += 1) {
    const p = board.sq[s];
    if (!p) continue;
    const abs = p > 0 ? p : -p;
    const sign = p > 0 ? 1 : -1;
    terms.material += sign * VALUE[abs];
    if (!shape || abs === KING) continue;
    if (level >= 3 && abs === PAWN && (p > 0 ? rankOf(s) <= 3 : rankOf(s) >= 5)) terms.pawnFront += sign * W.pawnFront;
    const own = p > 0 ? 0 : 1;
    const ownKing = kings[own];
    const enemyKing = kings[own ^ 1];
    if (ownKing >= 0 && isGuard(abs) && Math.max(Math.abs(fileOf(s) - fileOf(ownKing)), Math.abs(rankOf(s) - rankOf(ownKing))) === 1) terms.guard += sign * W.guard;
    if (enemyKing >= 0 && abs !== PAWN && Math.max(Math.abs(fileOf(s) - fileOf(enemyKing)), Math.abs(rankOf(s) - rankOf(enemyKing))) <= 2) {
      const big = abs === ROOK || abs === BISHOP || abs === ROOK + 8 || abs === BISHOP + 8;
      terms.attacker += sign * W.attacker * (big ? 2 : 1);
    }
    if (abs === ROOK || abs === BISHOP || abs === ROOK + 8 || abs === BISHOP + 8) {
      let reach = 0;
      for (const ray of slidesOf(own, abs, s)) {
        for (const t of ray) {
          reach += 1;
          if (board.sq[t]) break;
        }
      }
      terms.mobility += sign * W.mobility * reach;
    }
    if (att && abs !== PAWN && !att[own * 81 + s]) {
      terms.loose += sign * W.loose;
      if (att[(own ^ 1) * 81 + s]) terms.hanging += sign * W.hanging;
    }
  }
  if (att) {
    for (let s = 0; s < 81; s += 1) {
      const y = rankOf(s);
      if (y <= 2 && att[s]) terms.camp += W.camp;
      if (y >= 6 && att[81 + s]) terms.camp -= W.camp;
    }
  }
  for (let color = 0; color < 2; color += 1) {
    const sign = color === 0 ? 1 : -1;
    for (let kind = 1; kind <= 7; kind += 1) {
      const n = board.hand[color * 8 + kind];
      if (!n) continue;
      terms.material += sign * n * VALUE[kind];
      if (shape) terms.hand += sign * n * VALUE[kind] * W.hand;
    }
    if (level >= 3 && !board.hand[color * 8 + PAWN]) terms.pawnless += sign * W.pawnless;
    if (shape && kings[color] >= 0 && [4, 5, 6].includes(fileOf(kings[color]))) terms.kingCenter += sign * W.kingCenter;
    if (level >= 2 && kings[color] >= 0) {
      const k = kings[color];
      let hit = 0;
      for (const t of stepsOf(color, KING, k)) if (att ? att[(color ^ 1) * 81 + t] : board.attacked(t, color ^ 1)) hit += 1;
      terms.kingZone += sign * W.kingZone * hit;
      const relRank = color === 0 ? rankOf(k) : 8 - rankOf(k);
      const relFile = color === 0 ? fileOf(k) : 10 - fileOf(k);
      if (relRank >= 7 && (relFile <= 3 || relFile >= 7)) terms.castle += sign * W.castle;
    }
  }
  return terms;
}

/**
 * 駒の利きの地図。att[color * 81 + 升]は、colorの駒がその升に利いている数(玉の利きも数える)。
 * @param {FastBoard} board
 */
export function attackMap(board) {
  const att = new Uint8Array(162);
  for (let s = 0; s < 81; s += 1) {
    const p = board.sq[s];
    if (!p) continue;
    const abs = p > 0 ? p : -p;
    const own = p > 0 ? 0 : 1;
    const base = own * 81;
    for (const t of stepsOf(own, abs, s)) att[base + t] += 1;
    for (const ray of slidesOf(own, abs, s)) {
      for (const t of ray) {
        att[base + t] += 1;
        if (board.sq[t]) break;
      }
    }
  }
  return att;
}

/** 局面の点(手番の側から見た値)。 */
function evaluate(board, shape, scale = 1, classic = false, weights = null) {
  const t = evaluateTerms(board, { shape, classic, weights });
  let sum = 0;
  for (const name of SHAPE_TERMS) sum += t[name];
  const total = t.material + scale * sum;
  return board.turn === 0 ? total : -total;
}

const victimValue = (board, move) => {
  const to = (move >> 7) & 127;
  const q = board.sq[to];
  return q ? VALUE[q > 0 ? q : -q] : 0;
};
const moverValue = (board, move) => {
  const from = move & 127;
  if (from >= 81) return VALUE[from - 81];
  const p = board.sq[from];
  return VALUE[p > 0 ? p : -p];
};

/** 王手放置と打ち歩詰めを除いて指す。指せたら真(盤は指したまま)。 */
function tryMake(board, move) {
  const color = board.turn;
  board.make(move);
  if (board.inCheck(color)) {
    board.unmake(move);
    return false;
  }
  if ((move & 127) === 81 + PAWN && board.inCheck() && !board.hasLegal()) {
    board.unmake(move);
    return false;
  }
  return true;
}

/**
 * 1手を読んで選ぶ。
 * @param {string} sfen
 * @param {{ depth?: number, maxNodes?: number, maxTimeMs?: number, shape?: boolean | number, qdepth?: number, shapeScale?: number, classic?: boolean, weights?: Record<string, number> | null, prior?: Record<string, number> | null }} [options] priorは手の好みの1つの段(静かな手を読む順番に使う) shapeScaleは形の点に掛ける重み(大局観)。shapeは形の点の段(偽=駒の損得だけ・1=基本・2=玉のまわりの利きと囲いの位置も)
 * @returns {{ move: string, score: number, depth: number, nodes: number, pv: string[] } | null}
 */
export function searchBestMove(sfen, { depth = 4, maxNodes = 400000, maxTimeMs = 1000, shape = true, qdepth = 6, shapeScale = 1, classic = false, weights = null, prior = null } = {}) {
  const board = FastBoard.fromSfen(sfen);
  const ctx = {
    board, shape, qdepth, shapeScale, classic, weights, prior, nodes: 0, maxNodes, deadline: Date.now() + maxTimeMs, stopped: false,
    tt: new Map(), killers: [], history: new Int32Array(1 << 15),
  };
  let rootMoves = board.legal();
  if (!rootMoves.length) return null;
  // 手の好みがあれば、根の手も、取る手・成る手のあとに人がよく指す形の手から読む(1手目の深さを読み終える前に時間が来ても、よい手が残る)。
  if (prior) rootMoves = orderMoves(ctx, rootMoves, 0, 0);
  let best = { move: rootMoves[0], score: -INF, depth: 0, pv: [rootMoves[0]] };
  for (let d = 1; d <= depth; d += 1) {
    const result = rootSearch(ctx, rootMoves, d, best.move);
    if (ctx.stopped && d > 1) break;
    best = { ...result, depth: d };
    if (Math.abs(best.score) >= MATE - 100) break;
  }
  return { move: board.toUsi(best.move), score: best.score, depth: best.depth, nodes: ctx.nodes, pv: best.pv.map((m) => board.toUsi(m)) };
}

function rootSearch(ctx, rootMoves, depth, firstMove) {
  const { board } = ctx;
  const ordered = [firstMove, ...rootMoves.filter((m) => m !== firstMove)];
  let alpha = -INF;
  let bestMove = ordered[0];
  let bestPv = [bestMove];
  for (const move of ordered) {
    board.make(move);
    const child = search(ctx, depth - 1, -INF, -alpha, 1, true);
    board.unmake(move);
    if (ctx.stopped && depth > 1) break;
    const score = -child.score;
    if (score > alpha) {
      alpha = score;
      bestMove = move;
      bestPv = [move, ...child.pv];
    }
  }
  return { move: bestMove, score: alpha, pv: bestPv };
}

function timeUp(ctx) {
  if ((ctx.nodes & 1023) === 0 && (Date.now() > ctx.deadline || ctx.nodes > ctx.maxNodes)) ctx.stopped = true;
  return ctx.stopped;
}

function orderMoves(ctx, moves, ttMove, ply) {
  const { board } = ctx;
  const killers = ctx.killers[ply] ?? [];
  const scored = moves.map((m) => {
    let s = 0;
    if (m === ttMove) s = 1e9;
    else {
      const v = victimValue(board, m);
      if (v) s = 1e6 + v * 16 - moverValue(board, m);
      else if ((m >> 14) & 1) s = 9e5;
      else if (killers.includes(m)) s = 8e5;
      // 静かな手は、よく効いた手(history)の順。根(ply 0)だけは、人がよく指す形の手(手の好み。40章)から読む。
      // 途中の局面でも使うと、読む局面の数はほとんど減らず(−3%)、数える手間で約2割遅くなった(40-8)。
      else s = ctx.history[m & 0x7fff] + (ctx.prior && ply === 0 ? Math.round(quietPrior(board, m, ctx.prior) * PRIOR_ORDER) : 0);
    }
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map((e) => e.m);
}

function search(ctx, depth, alpha, beta, ply, allowNull) {
  const { board } = ctx;
  ctx.nodes += 1;
  if (timeUp(ctx)) return { score: 0, pv: [] };
  const inCheck = board.inCheck();
  if (inCheck && ply < 24) depth += 1;
  if (depth <= 0) return { score: quiesce(ctx, alpha, beta, ctx.qdepth, ply), pv: [] };
  const key = board.key();
  const entry = ctx.tt.get(key);
  let ttMove = 0;
  if (entry) {
    ttMove = entry.move;
    if (entry.depth >= depth) {
      if (entry.flag === 0) return { score: entry.score, pv: entry.move ? [entry.move] : [] };
      if (entry.flag === 1 && entry.score >= beta) return { score: entry.score, pv: [] };
      if (entry.flag === -1 && entry.score <= alpha) return { score: entry.score, pv: [] };
    }
  }
  // 何もしなくても相手を上回るなら、ここで打ち切る(1手パスしても読み負けない局面)。
  if (allowNull && !inCheck && depth >= 3) {
    board.pass();
    const nullScore = -search(ctx, depth - 3, -beta, -beta + 1, ply + 1, false).score;
    board.pass();
    if (!ctx.stopped && nullScore >= beta) return { score: beta, pv: [] };
  }
  const moves = orderMoves(ctx, board.pseudo([]), ttMove, ply);
  const alphaStart = alpha;
  let best = -INF;
  let bestMove = 0;
  let bestPv = [];
  let legal = 0;
  for (const move of moves) {
    const quiet = !victimValue(board, move) && !((move >> 14) & 1);
    if (!tryMake(board, move)) continue;
    legal += 1;
    let child;
    if (legal === 1) {
      child = search(ctx, depth - 1, -beta, -alpha, ply + 1, true);
    } else {
      // 2手目からは、まず「最善を超えるか」だけを狭い窓で読む。後ろの静かな手は1手浅く読む(超えたら読み直す)。
      const reduce = quiet && !inCheck && depth >= 3 && legal > 3 && !board.inCheck() ? 1 : 0;
      child = search(ctx, depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
      if (!ctx.stopped && -child.score > alpha && (reduce || -child.score < beta)) {
        child = search(ctx, depth - 1, -beta, -alpha, ply + 1, true);
      }
    }
    board.unmake(move);
    if (ctx.stopped) return { score: 0, pv: [] };
    const score = -child.score;
    if (score > best) {
      best = score;
      bestMove = move;
      bestPv = [move, ...child.pv];
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (!victimValue(board, move)) {
        const k = (ctx.killers[ply] ??= []);
        if (!k.includes(move)) { k.unshift(move); k.length = Math.min(2, k.length); }
        ctx.history[move & 0x7fff] += depth * depth;
      }
      break;
    }
  }
  if (!legal) return { score: -MATE + ply, pv: [] };
  if (ctx.tt.size > 300000) ctx.tt.clear();
  ctx.tt.set(key, { depth, score: best, flag: best <= alphaStart ? -1 : best >= beta ? 1 : 0, move: bestMove });
  return { score: best, pv: bestPv };
}

function quiesce(ctx, alpha, beta, qdepth, ply) {
  const { board } = ctx;
  ctx.nodes += 1;
  if (timeUp(ctx)) return 0;
  if (board.inCheck()) {
    // 王手されたら、逃げ方をすべて読む(詰みを見落とさない)。深さは静止探索の残りで止める。
    if (qdepth <= 0) return evaluate(board, ctx.shape, ctx.shapeScale, ctx.classic, ctx.weights);
    let best = -INF;
    let legal = 0;
    for (const move of board.pseudo([])) {
      if (!tryMake(board, move)) continue;
      legal += 1;
      const score = -quiesce(ctx, -beta, -alpha, qdepth - 1, ply + 1);
      board.unmake(move);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return legal ? best : -MATE + ply;
  }
  const stand = evaluate(board, ctx.shape, ctx.shapeScale, ctx.classic, ctx.weights);
  if (qdepth <= 0 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const moves = board.pseudo([], { captures: true })
    .map((m) => ({ m, s: victimValue(board, m) * 16 - moverValue(board, m) + ((m >> 14) & 1 ? 400 : 0) }))
    .sort((a, b) => b.s - a.s);
  let best = stand;
  for (const { m } of moves) {
    if (!tryMake(board, m)) continue;
    const score = -quiesce(ctx, -beta, -alpha, qdepth - 1, ply + 1);
    board.unmake(m);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * 決めた根の手だけを読み、それぞれの点(手番の側から見た値)と読み筋を出す。定跡の手や手順表の手が、最善より大きく劣らないかを確かめるのに使う。
 * @param {string} sfen
 * @param {string[]} usiMoves
 * @param {{ depth?: number, maxNodes?: number, maxTimeMs?: number, shape?: boolean | number, qdepth?: number, shapeScale?: number, classic?: boolean, weights?: Record<string, number> | null, prior?: Record<string, number> | null }} [options] priorは手の好みの1つの段(静かな手を読む順番に使う)
 * @returns {Map<string, { score: number, pv: string[] }>}
 */
export function scoreMoves(sfen, usiMoves, { depth = 3, maxNodes = 200000, maxTimeMs = 600, shape = true, qdepth = 6, shapeScale = 1, classic = false, weights = null, prior = null } = {}) {
  const board = FastBoard.fromSfen(sfen);
  const ctx = {
    board, shape, qdepth, shapeScale, classic, weights, prior, nodes: 0, maxNodes, deadline: Date.now() + maxTimeMs, stopped: false,
    tt: new Map(), killers: [], history: new Int32Array(1 << 15),
  };
  const result = new Map();
  const legal = board.legal();
  for (const usi of usiMoves) {
    const move = legal.find((m) => board.toUsi(m) === usi);
    if (!move) continue;
    board.make(move);
    const child = search(ctx, depth - 1, -INF, INF, 1, true);
    board.unmake(move);
    if (ctx.stopped) break;
    result.set(usi, { score: -child.score, pv: [usi, ...child.pv.map((m) => board.toUsi(m))] });
  }
  return result;
}
