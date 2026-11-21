// 「理由で指す」棋士の考え方の本体(docs/disciple-mode-design.mdの34-16)。
// 全部の手を読む論理の探索(logic-search.mjs)で最善を見つけ、駒の損得・成り・詰み・名前のある形の点から理由を言う。
// 学習した評価関数(エンジン)は使わない。考える順番は34-4のまま:
//   1. 自分の詰み  2. (読みの中で)相手の詰み・駒損を避ける  3. 定跡(最善より大きく劣らなければ)
//   4. 読みの最善が、手順表の手よりはっきり良ければ、その手(駒得・成る・両取り・攻め・囲い…)
//   5. 差が小さければ、何もない局面の手順表(囲いを固める・銀を繰り出す・飛車先・端歩・手待ち)
// 定跡のあとの研究の続き(戦法熟練度。34-10)は呼び出し側が先にchooseFollowMoveで決める。

import { findMateLine } from './problem-solver';
import { FastBoard } from './fast-board.mjs';
import { MATE, evaluateTerms, scoreMoves, searchBestMove } from './logic-search.mjs';
import { playLight, stateFromSfen } from './logic-position.mjs';
import { QUIET_ORDER, quietKind, situationalOrder } from './reason-move.mjs';
import { legalMoves } from './light-moves.mjs';

const LV_MIN = 12;
const LV_MAX = 49;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const unit = (lv) => clamp(((Number(lv) || LV_MIN) - LV_MIN) / (LV_MAX - LV_MIN), 0, 1);

/**
 * 能力値のLv(12〜49)から、考え方の深さ。
 * @param {{ reading?: number, plan?: number, steady?: number, mate?: number }} levels
 */
export function thinkProfile(levels = {}) {
  const r = unit(levels.reading);
  const p = unit(levels.plan);
  const s = unit(levels.steady);
  const m = unit(levels.mate);
  const depth = Math.round(lerp(1, 6, r));
  return {
    /** 全部の手を読む手数(1〜6)。 */
    depth,
    /** 1手に使う時間の上限(ミリ秒)。 */
    timeMs: Math.round(250 + depth * 300),
    /** 名前のある形の点(大局観)の重み(0.2〜1)。 */
    shapeScale: Math.round(lerp(0.2, 1, p) * 100) / 100,
    /** 手順表の手を選んでよい、最善との差(作戦が高いほど小さい)。 */
    quietMargin: Math.round(lerp(120, 30, p)),
    /** 何もない局面で、手順表を局面に合わせて選ぶ割合。 */
    situational: Math.round(p * 100) / 100,
    /** 読みを1手だけにしてしまう確率(うっかり)。 */
    skip: Math.round(lerp(0.2, 0.02, s) * 1000) / 1000,
    /** 自分の詰みを探す手数(1〜9)。 */
    mateDepth: 1 + 2 * Math.round(m * 4),
  };
}

/** 定跡の手を外れる、最善との差。 */
const BOOK_MARGIN = 120;

/** 最善の手の理由(駒得・成る・詰み・王手・囲い・攻め・駒の働き・読み)。 */
function bestReason(sfen, usi, score) {
  if (score >= MATE - 100) return 'mate-threat';
  const board = FastBoard.fromSfen(sfen);
  const move = board.fromUsi(usi);
  if (!move) return 'read';
  const before = evaluateTerms(board);
  const captured = board.sq[(move >> 7) & 127] !== 0;
  board.make(move);
  const after = evaluateTerms(board);
  const check = board.inCheck();
  const side = board.turn === 1 ? 1 : -1; // 指した側(先手なら+1)
  if (captured) return 'material';
  if ((move >> 14) & 1) return 'promote';
  if (check) return 'check';
  const d = (key) => side * (after[key] - before[key]);
  if (d('guard') > 0 || d('castle') > 0) return 'castle';
  if (d('attacker') > 0) return 'attack';
  if (d('mobility') > 0) return 'mobility';
  return 'read';
}

/**
 * 考えて1手を選ぶ。
 * @param {{ sfen: string, profile: ReturnType<typeof thinkProfile>, planMove?: string | null, random?: () => number }} options
 * @returns {{ move: string, stage: string, reason: string, score: number, line: string[], skipped: string[], mate?: number } | null}
 */
export function chooseThinkingMove({ sfen, profile, planMove = null, random = Math.random }) {
  const skipped = [];
  const done = (move, stage, reason, extra = {}) => ({ move, stage, reason, score: 0, line: [move], skipped, ...extra });
  // 1. 自分の詰み。
  const mateLine = findMateLine(sfen, profile.mateDepth, { nodeLimit: 4000 * profile.mateDepth, maxTimeMs: 250 });
  if (mateLine?.length) return done(mateLine[0], 'mate', 'mate', { mate: mateLine.length, line: mateLine });
  // うっかり: この手は読みを1手だけにする(相手の返し・駒取りを読まない)。
  const careless = random() < profile.skip;
  if (careless) skipped.push('hanging');
  const depth = careless ? 1 : profile.depth;
  const options = { depth, maxTimeMs: profile.timeMs, shapeScale: profile.shapeScale, maxNodes: 3e6 };
  const best = searchBestMove(sfen, options);
  if (!best) return null;
  // 3. 定跡: 最善より大きく劣らなければ定跡の手。
  const checkDepth = Math.max(1, depth - 1);
  const scoreOpts = { depth: checkDepth, maxTimeMs: Math.round(profile.timeMs / 2), shapeScale: profile.shapeScale };
  if (planMove && planMove !== best.move) {
    const planScore = scoreMoves(sfen, [planMove], scoreOpts).get(planMove);
    if (planScore && planScore.score >= best.score - BOOK_MARGIN) return done(planMove, 'book', 'book', { score: planScore.score, line: planScore.pv });
  } else if (planMove === best.move) {
    return done(planMove, 'book', 'book', { score: best.score, line: best.pv });
  }
  const reason = bestReason(sfen, best.move, best.score);
  // 4. 読みの最善が駒得・成る・詰み・王手の手なら、その手。
  const tactical = ['material', 'promote', 'mate-threat', 'check'].includes(reason);
  // 5. 手順表の手のうち、最善との差が小さいものを、決まった順(作戦が高いほど局面に合わせた順)で選ぶ。
  const state = stateFromSfen(sfen);
  const kinds = new Map();
  for (const usi of legalMoves(state)) {
    const child = playLight(state, usi);
    const kind = child ? quietKind(state, usi, child) : null;
    if (kind) kinds.set(kind, [...(kinds.get(kind) ?? []), usi]);
  }
  const order = random() < profile.situational ? situationalOrder(state) : QUIET_ORDER;
  if (!tactical || best.score < MATE - 100) {
    for (const kind of order) {
      const list = (kinds.get(kind) ?? []).slice(0, 3);
      if (!list.length) continue;
      if (list.includes(best.move)) return done(best.move, 'quiet', kind, { score: best.score, line: best.pv });
      if (tactical) continue;
      const scores = scoreMoves(sfen, list, scoreOpts);
      const good = list.filter((usi) => (scores.get(usi)?.score ?? -Infinity) >= best.score - profile.quietMargin);
      if (good.length) {
        const usi = good[Math.floor(random() * good.length)];
        return done(usi, 'quiet', kind, { score: scores.get(usi).score, line: scores.get(usi).pv });
      }
    }
  }
  return done(best.move, tactical ? 'read' : 'shape', reason, { score: best.score, line: best.pv });
}
