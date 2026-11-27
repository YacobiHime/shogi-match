// 「理由で指す」棋士の考え方の本体(docs/disciple-mode-design.mdの34-16)。
// 全部の手を読む論理の探索(logic-search.mjs)で最善を見つけ、駒の損得・成り・詰み・名前のある形の点から理由を言う。
// 学習した評価関数(エンジン)は使わない。考える順番は34-4のまま:
//   1. 自分の詰み  2. (読みの中で)相手の詰み・駒損を避ける  3. 定跡(最善より大きく劣らなければ)
//   4. 読みの最善が、手順表の手よりはっきり良ければ、その手(駒得・成る・両取り・攻め・囲い…)
//   5. 差が小さければ、何もない局面の手順表(囲いを固める・銀を繰り出す・飛車先・端歩・手待ち)
// 定跡のあとの研究の続き(戦法熟練度。34-10)は呼び出し側が先にchooseFollowMoveで決める。

import { findMateLine } from './problem-solver';
import { FastBoard } from './fast-board.mjs';
import { HAND_SHAPE_WEIGHTS, MATE, evaluateTerms, scoreMoves, searchBestMove } from './logic-search.mjs';
import { playLight, stateFromSfen } from './logic-position.mjs';
import { QUIET_ORDER, quietKind, situationalOrder } from './reason-move.mjs';
import { legalMoves } from './light-moves.mjs';
import { createRng } from './ryuo-random.mjs';
import { moveFeatures, priorPhase, priorScore } from './move-prior.mjs';
import { PRO_MOVE_PRIOR } from '../data/pro-move-prior.mjs';
import { pickBookMove } from './pro-book.mjs';

const LV_MIN = 12;
const LV_MAX = 49;
/** これより後の手数を終盤として、うっかりを詰みの力で決める(player-character.mjsのPHASE_LIMITS.middleと同じ)。 */
const PHASE_END_PLY = 80;
/** 持ち駒(両方)がこの枚数以上なら、手数によらず終盤とみる(駒がぶつかって玉の近くで詰む・詰まないの勝負になる。41-3)。 */
const ENDING_HAND_PIECES = 6;

/**
 * 終盤の局面か(うっかりを詰みの力で決める)。81手目からか、持ち駒が多い局面。
 * @param {string} sfen
 */
export function isEnding(sfen) {
  const [, , hand = '-', ply = '1'] = String(sfen).trim().split(/\s+/);
  if (Number(ply) > PHASE_END_PLY) return true;
  let count = 0;
  for (const match of hand.matchAll(/(\d*)[A-Za-z]/g)) count += Number(match[1] || 1);
  return count >= ENDING_HAND_PIECES;
}
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
  // 読みはLv18まで1手、そこからLv49で6手(34-17。Lvの低い側が強すぎたので、低い側を1手のまま弱くした)。
  const depth = 1 + Math.round(5 * clamp(((Number(levels.reading) || LV_MIN) - 18) / (LV_MAX - 18), 0, 1));
  return {
    /** 全部の手を読む手数(1〜6)。 */
    depth,
    /** 末端の取り合いを読む手数(1〜8)。 */
    qdepth: Math.round(lerp(1, 8, r)),
    /** 1手に使う時間の上限(ミリ秒)。 */
    timeMs: Math.round(250 + depth * 300),
    /** 名前のある形の点(大局観)の重み(0〜1)。 */
    shapeScale: Math.round(lerp(0, 1, p) * 100) / 100,
    /** 手順表の手を選んでよい、最善との差(作戦が高いほど小さい)。 */
    quietMargin: Math.round(lerp(150, 30, p)),
    /** 何もない局面で、手順表を局面に合わせて選ぶ割合。 */
    situational: Math.round(p * 100) / 100,
    /** 序盤・中盤で、読みを1手だけにし、取り合いも読まない確率(うっかり。安定で決まる。41-3で0.35から0.2へ)。 */
    skip: Math.round(lerp(0.2, 0.02, s) * 1000) / 1000,
    /** 終盤(81手目からか、持ち駒が多い局面。isEnding)のうっかりの確率。詰みを主に、安定も効く(41-3)。 */
    skipEnd: Math.round(lerp(0.25, 0.02, 0.35 * s + 0.65 * m) * 1000) / 1000,
    /** 自分の詰みを探す手数(1〜9)。 */
    mateDepth: 1 + 2 * Math.round(m * 4),
    /** 自分の詰みを探す時間の上限(ミリ秒。詰みが高いほど長い。41-3)。 */
    mateMs: Math.round(100 + 300 * m),
    /** 人が指しそうな手の好み(40章のL3)を使って、最善との差がこれ以内の手から選ぶ(点。作戦が高いほど小さい)。0なら使わない。 */
    humanMargin: Math.round(lerp(70, 25, p)),
  };
}

/** 人の好みで選び直すときに、点を確かめる手の数(好みの上位から)。 */
const HUMAN_CANDIDATES = 4;

/**
 * 局面の手数と、直前の相手の手の行き先(取り返しを見る)。
 * @param {string} sfen
 * @param {import('./fast-board.mjs').FastBoard} board
 * @param {string | null} lastMove
 */
function priorContext(sfen, board, lastMove) {
  const ply = Math.max(1, Number(String(sfen).trim().split(/\s+/)[3]) || 1);
  const lastTo = lastMove && /^[1-9][a-i]/.test(lastMove.slice(2, 4)) ? (lastMove.charCodeAt(3) - 97) * 9 + (Number(lastMove[2]) - 1) : -1;
  return { phase: priorPhase(ply), lastTo, board };
}

/** 手(USI)ごとの好みの点。 */
function priorsOf(context, usiList) {
  const out = new Map();
  for (const usi of usiList) {
    const move = context.board.fromUsi(usi);
    out.set(usi, move ? priorScore(moveFeatures(context.board, move, { lastTo: context.lastTo }), context.phase) : -Infinity);
  }
  return out;
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
 * lastMoveは直前の相手の手(人の好みの「取り返し」を見る。なくてもよい)。
 * @param {{ sfen: string, profile: ReturnType<typeof thinkProfile> & { classic?: boolean, handWeights?: boolean, noBook?: boolean, era?: string | null }, planMove?: string | null, random?: () => number, lastMove?: string | null }} options
 * @returns {{ move: string, stage: string, reason: string, score: number, line: string[], skipped: string[], mate?: number } | null}
 */
export function chooseThinkingMove({ sfen, profile, planMove = null, random = Math.random, lastMove = null }) {
  const skipped = [];
  // プロの序盤の手(40-9): 作戦の手がないときは、プロが何局も指した手を、育った時代の手を多めに選ぶ。駒の損得の確かめは作戦の手と同じ(下の3)。
  // 前の版(classic)と、比べ用の選手(noBook)では使わない。
  const proBook = !planMove && !profile.classic && !profile.noBook ? pickBookMove(sfen, { era: profile.era ?? null, random }) : null;
  if (proBook) planMove = proBook;
  const done = (move, stage, reason, extra = {}) => ({ move, stage, reason, score: 0, line: [move], skipped, depth: skipped.includes('hanging') ? 1 : profile.depth, ...extra });
  // 1. 自分の詰み。
  const mateLine = findMateLine(sfen, profile.mateDepth, { nodeLimit: 4000 * profile.mateDepth, maxTimeMs: profile.mateMs ?? 250 });
  if (mateLine?.length) return done(mateLine[0], 'mate', 'mate', { mate: mateLine.length, line: mateLine });
  // うっかり: この手は読みを1手だけにする(相手の返し・駒取りを読まない)。
  // 1手の時間の上限(読みの時間の1.6倍)。定跡・手順表の手の確かめは、残りの時間で行う。
  const deadline = Date.now() + profile.timeMs * (profile.deadlineScale ?? 1.6);
  const ending = isEnding(sfen);
  const careless = random() < (ending ? profile.skipEnd ?? profile.skip : profile.skip);
  if (careless) skipped.push('hanging');
  const depth = careless ? 1 : profile.depth;
  const qdepth = careless ? 0 : profile.qdepth ?? 6;
  // 形の点は段3(敵陣の利き・浮き駒・玉のまわりの利き。39章)。classicは前の版(段1と、成り駒を金と同じに数える価値)。
  const shape = profile.classic ? 1 : profile.shape ?? 3;
  const classic = Boolean(profile.classic);
  // 形の点の重みは、プロの棋譜に合わせた重み(40章のL2)。handWeightsは手で決めた重み(比べる用)。
  const weights = profile.handWeights ? HAND_SHAPE_WEIGHTS : null;
  // 読む順番に手の好みを使う(静かな手を、人がよく指す形から読む。40章)。前の版とhumanMargin=0の比べ用の選手では使わない。
  const prior = !profile.classic && (profile.humanMargin ?? 0) > 0 ? PRO_MOVE_PRIOR[priorPhase(Math.max(1, Number(String(sfen).trim().split(/\s+/)[3]) || 1))] ?? null : null;
  const options = { depth, qdepth, maxTimeMs: profile.timeMs, shapeScale: profile.shapeScale, maxNodes: 3e6, shape, classic, weights, prior };
  const best = searchBestMove(sfen, options);
  if (!best) return null;
  // 3. 定跡: 最善より大きく劣らなければ定跡の手。
  const checkDepth = Math.max(1, depth - 1);
  const scoreOpts = () => ({ depth: checkDepth, qdepth, maxTimeMs: Math.max(30, Math.min(Math.round(profile.timeMs / 3), deadline - Date.now())), shapeScale: profile.shapeScale, shape, classic, weights, prior });
  if (planMove && planMove !== best.move) {
    // 定跡の手は、駒の損得と詰みだけで比べる(形の点では外さない。docs/disciple-mode-design.mdの35-6)。
    // 前は形の点も入れて比べ、強い棋士ほど5手目あたりで定跡を外れていた。
    // 駒をただで取られる・取り合いで損をするかを見るだけなので、2手(自分の手と相手の返し)と末端の取り合いで足りる。
    // 深く読むと時間が足りず、点が出ないまま定跡を外れていた。
    const scores = scoreMoves(sfen, [planMove, best.move], { ...scoreOpts(), depth: Math.min(2, checkDepth), shapeScale: 0, maxTimeMs: 400 });
    const planScore = scores.get(planMove);
    const bestScore = scores.get(best.move);
    if (planScore && planScore.score >= (bestScore?.score ?? best.score) - BOOK_MARGIN) {
      return done(planMove, 'book', 'book', { score: planScore.score, line: planScore.pv, pro: Boolean(proBook) });
    }
  } else if (planMove === best.move) {
    return done(planMove, 'book', 'book', { score: best.score, line: best.pv, pro: Boolean(proBook) });
  }
  const reason = bestReason(sfen, best.move, best.score);
  // 人が指しそうな手の好み(40章のL3)。前の版(classic)と、うっかりの手では使わない。
  const useHuman = !profile.classic && !careless && (profile.humanMargin ?? 0) > 0;
  let humanContext = null;
  const human = () => (humanContext ??= priorContext(sfen, FastBoard.fromSfen(sfen), lastMove));
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
      if (Date.now() > deadline - 30) break;
      // 最善の手も同じ深さで読み直して比べる(浅く読んだ点と深く読んだ点を比べると、読みの深さによる点のずれで悪い手が近く見える。40-8)。
      const scores = scoreMoves(sfen, [best.move, ...list], scoreOpts());
      const reference = scores.get(best.move)?.score ?? best.score;
      const good = list.filter((usi) => (scores.get(usi)?.score ?? -Infinity) >= reference - profile.quietMargin);
      if (good.length) {
        // 差の小さい手の中からは、人が指しそうな手を選びやすくする(40章のL3。好みの点の大きい手ほど選ばれやすい)。
        const usi = useHuman ? weightedPick(good, priorsOf(human(), good), random) : good[Math.floor(random() * good.length)];
        return done(usi, 'quiet', kind, { score: scores.get(usi).score, line: scores.get(usi).pv });
      }
    }
  }
  // 人が指しそうな手(40章のL3): 好みの上位の手のうち、最善との差がhumanMargin以内なら、好みのいちばん大きい手を指す。
  // 詰み・詰めろの手と、取り合いで点が大きく動く局面では最善のまま(読みの結果を優先する)。
  if (useHuman && best.score < MATE - 100 && Date.now() < deadline - 30) {
    const context = human();
    const legal = legalMoves(state);
    const priors = priorsOf(context, legal);
    const top = legal.filter((usi) => usi !== best.move).sort((a, b) => priors.get(b) - priors.get(a)).slice(0, HUMAN_CANDIDATES);
    const bestPrior = priors.get(best.move) ?? -Infinity;
    const tried = top.filter((usi) => priors.get(usi) > bestPrior);
    if (tried.length) {
      const scores = scoreMoves(sfen, [best.move, ...tried], scoreOpts());
      const reference = scores.get(best.move)?.score ?? best.score;
      const near = tried.filter((usi) => (scores.get(usi)?.score ?? -Infinity) >= reference - profile.humanMargin);
      if (near.length) {
        const usi = near.sort((a, b) => priors.get(b) - priors.get(a))[0];
        const scored = scores.get(usi);
        return done(usi, tactical ? 'read' : 'shape', bestReason(sfen, usi, scored.score), { score: scored.score, line: scored.pv });
      }
    }
  }
  return done(best.move, tactical ? 'read' : 'shape', reason, { score: best.score, line: best.pv });
}

/** 好みの点で重みを付けて1つ選ぶ(点の差が1なら、選ばれやすさはe倍)。 */
function weightedPick(list, priors, random) {
  const top = Math.max(...list.map((usi) => priors.get(usi) ?? 0));
  const weights = list.map((usi) => Math.exp((priors.get(usi) ?? top) - top));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * total;
  for (let i = 0; i < list.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return list[i];
  }
  return list.at(-1);
}

/** 観戦の1手の時間の上限(ミリ秒。docs/disciple-mode-design.mdの38章)。読みの時間をこれまでにし、締め切りは読みの1.3倍。 */
export const WATCH_THINK_BUDGET_MS = 700;

/**
 * 1手の時間を上限までに縮めた考え方(38章)。上限が0なら、そのまま。
 * @template {{ timeMs: number }} P
 * @param {P} profile
 * @param {number} budgetMs
 * @returns {P & { deadlineScale?: number }}
 */
export function budgetProfile(profile, budgetMs) {
  if (!(budgetMs > 0)) return profile;
  return { ...profile, timeMs: Math.min(profile.timeMs, budgetMs), deadlineScale: 1.3 };
}

/**
 * 理由で指す棋士の1手を、種から決まる乱数で考える(本局から呼ぶ。ブラウザはWorkerで同じ関数を動かす)。
 * budgetMsは1手の時間の上限(観戦の本局。38章)。
 * @param {{ sfen: string, levels: Record<string, number>, planMove: string | null, seed: number, budgetMs?: number, lastMove?: string | null }} request
 */
export async function thinkHere({ sfen, levels, planMove, seed, budgetMs = 0, lastMove = null, era = null }) {
  const rng = createRng(seed >>> 0);
  return chooseThinkingMove({ sfen, profile: { ...budgetProfile(thinkProfile(levels), budgetMs), era }, planMove, random: () => rng.next(), lastMove });
}
