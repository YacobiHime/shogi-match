// 「理由で指す」1手の選び方(docs/disciple-mode-design.mdの34章。段階E1)。
// 局面の良し悪しを1つの数で読む評価関数(エンジン)は使わず、手を指したら何が起きるかを名前のある事実
// (詰み・駒の損得・駒の働き・駒どうしのひも・玉の守り)で数え、考える順番の上から当てはまったところで決める。
//   1. 自分の詰み  2. 相手の詰み(1手詰め)を防ぐ  3. 定跡  4. 駒の損得の読み(取り合い)  5. 形をよくする手  6. 何もない局面の手順表
// 定跡のあとにエンジンで何手か指す戦法熟練度(34-10)は、呼び出し側がfollowUpTurnで決めてエンジンに読ませる(chooseReasonMoveのfollow)。
// どの段で決めたか・理由の名前・確かめを飛ばしたかを、思考の記録として返す(34-7)。画面に依存しない。

import { Position } from "tsshogi";
import { attackedSquares, attackersOf, findKing, isKingAttacked, opponentOf, relativeFile, relativeRank, squareXY } from "./piece-movement.mjs";
import { playLight, stateFromSfen } from "./logic-position.mjs";
import { REASON_VALUES, idleLossOf, readMoves } from "./reason-search.mjs";
import { hasLegalMove, isCheckmated, legalMoves } from "./light-moves.mjs";
import { findMateLine } from "./problem-solver";

/** 能力値のLvの幅(disciple-strength.mjsのSTAT_LEVEL_MIN〜MAX)。 */
const LV_MIN = 12;
const LV_MAX = 49;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const unit = (lv) => clamp(((Number(lv) || LV_MIN) - LV_MIN) / (LV_MAX - LV_MIN), 0, 1);

/** 理由の名前(観戦の一言・見立ての手がかり)。 */
export const REASON_TEXT = Object.freeze({
  mate: "詰ます",
  "defend-mate": "詰みを防ぐ",
  book: "定跡",
  follow: "研究の続き",
  material: "駒得",
  promote: "成る",
  attack: "両取り・当たり",
  save: "駒を逃がす",
  mobility: "駒の働き",
  connect: "駒をつなぐ",
  castle: "囲いを固める",
  develop: "銀を繰り出す",
  "rook-pawn": "飛車先を伸ばす",
  "edge-pawn": "端歩を突く",
  wait: "手待ち",
  natural: "自然な手",
});

/** 考える順番の段。 */
export const REASON_STAGES = Object.freeze(["mate", "defend", "book", "follow", "read", "shape", "quiet"]);

/** 判定の物差し(段階E1の初期値。測る道具 scripts/reason-ai-report.mjs で合わせる)。 */
export const REASON_RULES = Object.freeze({
  /** 定跡を外れるのは、ほかの手の駒の損得の読みが、定跡の手よりこれだけ良いとき。 */
  bookMargin: 200,
  /** 駒得の手として選ぶ、静かな手との差。 */
  materialEdge: 100,
  /** 安全な手(駒の損得の読みが最善からこれだけ以内)。 */
  safeSlack: 50,
  /** 形をよくする手として選ぶ点(利く升1つ1点、ひも1つ3点)。 */
  shapeMin: 7,
  /** 相手の1手詰めを確かめる候補の数。 */
  defendTop: 8,
});

/**
 * 能力値のLv(12〜49)から、考える順番のどこまで確かめられるか。
 * @param {{ reading?: number, plan?: number, steady?: number, mate?: number }} levels
 */
export function reasonProfile(levels = {}) {
  const r = unit(levels.reading);
  const p = unit(levels.plan);
  const s = unit(levels.steady);
  const m = unit(levels.mate);
  return {
    /** 自分の詰みを探す手数(1・3・5・7・9)。 */
    mateDepth: 1 + 2 * Math.round(m * 4),
    /** 末端の取り合いを読む手数(取る手・成る手だけ。2〜6)。 */
    captureDepth: 2 + Math.round(r * 4),
    /** 根の手のあとに読む強い手(取る・成る・王手・両取り・大駒への当たり)の手数(1〜4。段階E2)。 */
    readDepth: 1 + Math.round(r * 3),
    /** 1手で読む局面の数の上限。 */
    readNodes: Math.round(lerp(20000, 120000, r)),
    /** 取られる駒・相手の1手詰めの確かめを飛ばす確率(うっかり)。 */
    skip: Math.round(lerp(0.3, 0.02, s) * 1000) / 1000,
    /** 何もない局面で、手順表を局面に合わせて選ぶ割合(残りは上から順に)。 */
    situational: Math.round(p * 100) / 100,
    /** 形をよくする手の点の重み。 */
    shapeWeight: Math.round(lerp(0.6, 1.2, p) * 100) / 100,
  };
}

// ---- 盤の事実

const GUARDS = new Set(["G", "S", "+P", "+L", "+N", "+S"]);

/** 自分の駒が利いている升の数(玉を除く)。 */
function mobility(board, color) {
  const seen = new Set();
  for (const [from, piece] of board) {
    if (piece.color !== color || piece.kind === "K") continue;
    for (const square of attackedSquares(board, from, piece)) seen.add(square);
  }
  return seen.size;
}

/** 味方の駒に守られている自分の駒(玉を除く)の数。 */
function connections(board, color) {
  let count = 0;
  for (const [square, piece] of board) {
    if (piece.color !== color || piece.kind === "K") continue;
    if (attackersOf(board, square, color).length) count += 1;
  }
  return count;
}

/** 玉のまわり8升の金・銀(成り駒を含む)の数。 */
function kingGuards(board, color) {
  const king = findKing(board, color);
  if (!king) return 0;
  const { x, y } = squareXY(king);
  let count = 0;
  for (const [square, piece] of board) {
    if (piece.color !== color || !GUARDS.has(piece.kind)) continue;
    const at = squareXY(square);
    if (Math.max(Math.abs(at.x - x), Math.abs(at.y - y)) === 1) count += 1;
  }
  return count;
}

/** 相手に1手詰めがあるか(相手の手番の局面で)。 */
function opponentMatesInOne(state) {
  for (const usi of legalMoves(state)) {
    const child = playLight(state, usi);
    if (child && isKingAttacked(child.board, child.turn) && !hasLegalMove(child)) return usi;
  }
  return null;
}


// ---- 何もない局面の手順表(34-5)

/**
 * 手順表の手の種類。当てはまらなければnull。
 * @param {ReturnType<typeof stateFromSfen>} state 指す前
 * @param {string} usi
 * @param {ReturnType<typeof stateFromSfen>} child 指したあと
 */
function quietKind(state, usi, child) {
  const me = state.turn;
  if (usi.includes("*")) return null;
  const from = usi.slice(0, 2);
  const to = usi.slice(2, 4);
  const piece = state.board.get(from);
  if (!piece) return null;
  const opp = opponentOf(me);
  // 1. 囲いを固める: 玉のまわりの金銀が増える(玉を寄せる手も、金銀を寄せる手も)。
  if (kingGuards(child.board, me) > kingGuards(state.board, me)) return "castle";
  // 2. 銀・桂を繰り出す: 自陣から前へ(5段目まで)。
  if ((piece.kind === "S" || piece.kind === "N") && relativeRank(to, me) < relativeRank(from, me) && relativeRank(to, me) >= 5) return "develop";
  if (piece.kind === "P") {
    const rook = [...state.board].find(([, p]) => p.color === me && (p.kind === "R" || p.kind === "+R"));
    // 3. 飛車先の歩: 居飛車(飛車が2筋)で、2筋の歩を5段目まで。
    if (rook && relativeFile(rook[0], me) === 2 && relativeFile(from, me) === 2 && relativeRank(to, me) >= 5) return "rook-pawn";
    // 4. 端歩: 1筋・9筋の歩を、相手に取られない升まで。
    if ([1, 9].includes(relativeFile(from, me)) && !attackersOf(child.board, to, opp).length) return "edge-pawn";
  }
  // 5. 手待ち: 玉・金を、玉の守りを減らさずに動かす。
  if ((piece.kind === "K" || piece.kind === "G") && kingGuards(child.board, me) >= kingGuards(state.board, me)) return "wait";
  return null;
}

const QUIET_ORDER = Object.freeze(["castle", "develop", "rook-pawn", "edge-pawn", "wait"]);

/** 局面に合わせた手順表の並び。相手の駒が自陣に迫っていれば囲いを先に、そうでなければ攻めの準備を先に。 */
function situationalOrder(state) {
  const me = state.turn;
  const opp = opponentOf(me);
  let near = 0;
  for (const [square, piece] of state.board) {
    if (piece.color === opp && relativeRank(square, me) >= 6) near += 1;
  }
  return near > 0 ? QUIET_ORDER : ["develop", "rook-pawn", "castle", "edge-pawn", "wait"];
}

// ---- 1手を選ぶ

/**
 * 理由で1手を選ぶ。
 * @param {{
 *   sfen: string, profile: ReturnType<typeof reasonProfile>, planMove?: string | null, random?: () => number,
 *   maxTimeMs?: number,
 * }} options
 * @returns {{ move: string, stage: string, reason: string, delta: number, skipped: string[], mate?: number, line?: string[] } | null}
 */
export function chooseReasonMove({ sfen, profile, planMove = null, random = Math.random, maxTimeMs = 800 }) {
  const deadline = Date.now() + maxTimeMs;
  const state = stateFromSfen(sfen);
  const me = state.turn;
  const legal = legalMoves(state);
  if (!legal.length) return null;
  const skipped = [];
  const pick = (list) => list[Math.floor(random() * list.length)];
  const done = (move, stage, reason, extra = {}) => ({ move, stage, reason, delta: 0, skipped, ...extra });

  // 1. 自分の詰み。
  if (profile.mateDepth >= 1) {
    const position = Position.newBySFEN(sfen);
    if (position) {
      const line = findMateLine(sfen, profile.mateDepth, { nodeLimit: 4000 * profile.mateDepth, maxTimeMs: Math.min(250, Math.max(20, deadline - Date.now())) });
      if (line?.length && legal.includes(line[0])) return done(line[0], "mate", "mate", { mate: line.length });
    }
  }

  // 4の準備: 各手の駒の損得の読み。確かめを飛ばした局面は、自分が取る得だけを見る(取られることに気づかない)。
  const skipHanging = random() < profile.skip;
  if (skipHanging) skipped.push("hanging");
  const entries = [];
  const value = (kind) => REASON_VALUES[kind] ?? 0;
  const reads = skipHanging ? null : readMoves(state, legal, {
    depth: profile.readDepth, qdepth: profile.captureDepth, maxNodes: profile.readNodes, deadline: deadline - 150,
  });
  for (const usi of legal) {
    const child = playLight(state, usi);
    if (!child) continue;
    const captured = child.captured ? value(child.captured.kind) : 0;
    const promo = usi.endsWith("+") ? value(child.board.get(usi.slice(2, 4))?.kind) - value(state.board.get(usi.slice(0, 2))?.kind) : 0;
    const read = reads?.get(usi);
    const delta = read ? read.delta : captured + promo;
    entries.push({ usi, child, delta, line: read?.line ?? [usi], captured, promo, quiet: !captured && !promo });
  }
  // 2. 相手の1手詰めを防ぐ(駒の損得の良い順に、詰まされない手か確かめる)。
  const skipMate = random() < profile.skip;
  if (skipMate) skipped.push("mate-threat");
  entries.sort((a, b) => b.delta - a.delta);
  let defended = false;
  if (!skipMate) {
    const threatNow = opponentMatesInOne({ ...state, turn: opponentOf(me) });
    let checkedCount = 0;
    for (const entry of entries) {
      if (checkedCount >= REASON_RULES.defendTop || Date.now() > deadline) break;
      checkedCount += 1;
      entry.mated = Boolean(opponentMatesInOne(entry.child));
    }
    if (threatNow) {
      const safe = entries.find((entry) => entry.mated === false);
      if (safe) return done(safe.usi, "defend", "defend-mate", { delta: Math.round(safe.delta) });
      defended = true;
    }
  }
  const alive = entries.filter((entry) => !entry.mated);
  const pool0 = alive.length ? alive : entries;
  const best = pool0[0].delta;

  // 3. 定跡: 駒の損得の読みで大きく損をせず、ほかの手の得が大きすぎなければ、定跡の手。
  const planEntry = planMove ? pool0.find((entry) => entry.usi === planMove) : null;
  if (planEntry && best - planEntry.delta < REASON_RULES.bookMargin) return done(planEntry.usi, "book", "book", { delta: Math.round(planEntry.delta) });

  // 4. 数手先の駒得・成り・両取り: 何もしないときより、読みの駒の損得がはっきり良い手。
  //    何もしなければ取られる駒がある局面では、その損を減らす手が「駒を逃がす」。
  const idle = skipHanging ? 0 : idleLossOf(state, profile.captureDepth);
  // 同じ得なら、いま取る・いま成る手を先に(得を先に延ばさない)。
  const tied = pool0.filter((entry) => entry.delta >= best - 1);
  const nowGain = Math.max(...tied.map((entry) => entry.captured + entry.promo));
  const top = tied.filter((entry) => entry.captured + entry.promo >= nowGain);
  if (best >= -idle + REASON_RULES.materialEdge && best > 0) {
    const chosen = pick(top);
    const reason = chosen.captured ? "material" : chosen.promo > 0 ? "promote" : "attack";
    return done(chosen.usi, "read", reason, { delta: Math.round(best), line: chosen.line });
  }
  if (idle > 0 && best > -idle + REASON_RULES.safeSlack) {
    const chosen = pick(top);
    return done(chosen.usi, "read", "save", { delta: Math.round(best), line: chosen.line });
  }
  // 安全な手(数手先まで読んで、駒を損しない手)だけを残す。
  const pool = pool0.filter((entry) => entry.delta >= best - REASON_RULES.safeSlack);

  // 5. 形をよくする手: 利く升とひもの増え方。
  const mob0 = mobility(state.board, me);
  const con0 = connections(state.board, me);
  let shapeBest = null;
  for (const entry of pool) {
    if (Date.now() > deadline && shapeBest) break;
    const dm = mobility(entry.child.board, me) - mob0;
    const dc = connections(entry.child.board, me) - con0;
    const score = (dm + dc * 3) * profile.shapeWeight;
    if (!shapeBest || score > shapeBest.score) shapeBest = { entry, score, reason: dc * 3 >= dm ? "connect" : "mobility" };
  }

  // 6. 何もない局面の手順表。
  const kinds = new Map();
  for (const entry of pool) {
    const kind = quietKind(state, entry.usi, entry.child);
    if (kind) kinds.set(kind, [...(kinds.get(kind) ?? []), entry]);
  }
  if (shapeBest && shapeBest.score >= REASON_RULES.shapeMin) return done(shapeBest.entry.usi, "shape", shapeBest.reason, { delta: Math.round(shapeBest.entry.delta) });
  const order = random() < profile.situational ? situationalOrder(state) : QUIET_ORDER;
  for (const kind of order) {
    const list = kinds.get(kind);
    if (list?.length) return done(pick(list).usi, "quiet", kind, { delta: Math.round(list[0].delta) });
  }
  if (shapeBest) return done(shapeBest.entry.usi, "shape", shapeBest.reason, { delta: Math.round(shapeBest.entry.delta) });
  void defended;
  return done(pick(pool).usi, "quiet", "natural", { delta: Math.round(best) });
}

/**
 * 定跡のあとの研究の続き(戦法熟練度。34-10)をエンジンで1手。自分の詰みだけは理由で先に確かめる。
 * @param {{ sfen: string, moves: string[], profile: ReturnType<typeof reasonProfile>, nodes: number,
 *   search: (args: { moves: string[], nodes: number, multiPv: number }) => Promise<any>, legal?: string[],
 *   bestOf?: (read: any) => string | null }} options bestOfは読みの結果からいちばん良い手(既定は候補の先頭)
 */
export async function chooseFollowMove({ sfen, moves, profile, nodes, search, legal, bestOf }) {
  const line = findMateLine(sfen, profile.mateDepth, { nodeLimit: 4000 * profile.mateDepth, maxTimeMs: 200 });
  const allowed = legal ?? legalMoves(stateFromSfen(sfen));
  if (line?.length && allowed.includes(line[0])) return { move: line[0], stage: "mate", reason: "mate", delta: 0, skipped: [], mate: line.length };
  const read = await search({ moves, nodes, multiPv: 1 });
  const move = bestOf ? bestOf(read) : read?.candidates?.[0]?.move ?? read?.bestMove ?? null;
  return move && allowed.includes(move) ? { move, stage: "follow", reason: "follow", delta: 0, skipped: [] } : null;
}
