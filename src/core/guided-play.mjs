// 棋力測定の指導対局(docs/skill-measure-design.mdの13章)。囲碁の指導碁のように、強めに読んだ候補手の中から、
// 形勢を「あなたが少しリード」の帯へ少しずつ寄せる手を選び、同じくらい良い手の中では、あなたの駒に当てる手(守れるかの問い)を選ぶ。
// 画面とエンジンに依存しない(候補手の評価値と局面だけを使う)。駒の損得の読みは場面採点と同じ軽い読み(logic-position.mjs)。

import { comparableScore } from './move-selection.mjs';
import { material, playLight, replyLoss, stateFromSfen } from './logic-position.mjs';

/**
 * 寄せる帯(相手(AI)から見た評価値)。真ん中はAIが少し苦しい(あなたが少しリード)。
 * AIがこの上の端より良いときだけ加減する。下の端より悪いとき(あなたが大きくリード)は本気で指す。
 */
export const GUIDE_BAND = Object.freeze({ low: -300, center: -150, high: -50 });
/**
 * 1手で帯へ戻す評価値。帯の真ん中からの離れ具合のGUIDE_STEP_SHARE(半分)を、少なくともGUIDE_STEPだけ戻す
 * (悪手のあと、すぐに駒を返さず、何手かかけて戻す。13-2のB)。150点ずつでは、悪手が重なると追いつかなかった(13-3)。
 */
export const GUIDE_STEP = 150;
export const GUIDE_STEP_SHARE = 0.5;
/** 「同じくらい良い手」とみなす差。この中なら問い(あなたの駒に当てる手)を選ぶ。 */
export const GUIDE_QUESTION_MARGIN = 40;
/** 加減するのは、この手数から(序盤は定跡どおり指す)。 */
export const GUIDE_FROM_PLY = 16;
/** この手数を過ぎたら、加減をやめて最善で指す(いつまでも終わらない対局にしない)。 */
export const GUIDE_UNTIL_PLY = 150;
/** ただで取られる手・当たりの問いとみなす駒の損得(場面採点の「守る駒」と同じ)。 */
export const GUIDE_HANG = 300;
/** 詰みの点の境目(comparableScoreは詰みを10万近くにする)。 */
const MATE_EDGE = 30000;
/**
 * AIに詰みがあるとき、その点をこのくらいとして比べる。あなたが大きな悪手を続けても、すぐには詰ませず、
 * 1手ずつ帯へ戻す(加減の幅はGUIDE_STEPのまま。悪手が続けば、いずれは詰む)。
 */
export const GUIDE_MATE_AS = 2500;

/**
 * 候補手の点(AIから見た評価値の数値)。詰みは大きな数。点がない候補は除く。
 * @param {readonly { move: string, rank?: number, score?: any }[]} candidates エンジンのMultiPVの候補(scoreは手番(AI)から見た値)
 */
export function scoredCandidates(candidates) {
  return (candidates ?? [])
    .map((candidate) => ({ move: candidate.move, rank: candidate.rank ?? 99, cp: comparableScore(candidate.score) }))
    .filter((candidate) => typeof candidate.move === 'string' && candidate.move && Number.isFinite(candidate.cp))
    .sort((a, b) => b.cp - a.cp || a.rank - b.rank);
}

/**
 * 1手で目指す点。AIが帯より良いときは、帯の真ん中へ、離れ具合の半分(少なくともGUIDE_STEP)だけ下げる。帯の中・下はnull(最善で指す)。
 * @param {number} best 最善の候補の点
 */
export function guidedTarget(best) {
  if (!Number.isFinite(best) || best <= GUIDE_BAND.high || best <= -MATE_EDGE) return null;
  const step = Math.max(GUIDE_STEP, (best - GUIDE_BAND.center) * GUIDE_STEP_SHARE);
  return Math.max(best - step, GUIDE_BAND.center);
}

/**
 * 候補手を指したあとの局面の見立て(軽い読み)。hangはAIの駒がただで取られる(取り合いで300以上損)、
 * questionはあなたの駒に当てる手(手を渡すと300以上取られる形を新しく作る。場面採点の「守る駒」の場面)。
 * @param {string} sfen 指す前の局面(AIの手番)
 * @param {string} usi
 */
export function moveShape(sfen, usi) {
  try {
    const state = stateFromSfen(sfen);
    const child = playLight(state, usi);
    if (!child) return { hang: false, question: false };
    const mover = state.turn;
    const now = material(state, mover);
    const net = material(child, mover) - replyLoss(child, 2);
    // 問いは、この手で新しく作った当たり(手を渡されたときの取りの読みが、指す前より300以上増える)。もとからある取り・成りは数えない。
    const passed = { ...child, turn: mover };
    return { hang: net - now <= -GUIDE_HANG, question: replyLoss(passed, 2) - replyLoss(state, 2) >= GUIDE_HANG };
  } catch {
    return { hang: false, question: false };
  }
}

/**
 * 指導対局の1手。候補手から、帯へ寄せる手・問いの手を選ぶ。選べないときはnull(呼び出し側がふつうに指す)。
 * @param {{ sfen: string, candidates: readonly { move: string, rank?: number, score?: any }[], ply: number, legalMoves?: readonly string[] }} input
 *   plyは指す前の手数(moveHistory.length)
 * @returns {{ move: string, kind: 'best' | 'question' | 'ease', target: number | null, cp: number } | null}
 */
export function chooseGuidedMove({ sfen, candidates, ply, legalMoves = null }) {
  const legal = legalMoves ? new Set(legalMoves) : null;
  const scored = scoredCandidates(candidates).filter(({ move }) => !legal || legal.has(move));
  if (!scored.length) return null;
  const best = scored[0];
  // 序盤・長い対局・AIが詰まされる局面は、最善で指す(負けそうなときは本気で粘る)。
  if (ply < GUIDE_FROM_PLY || ply >= GUIDE_UNTIL_PLY || best.cp <= -MATE_EDGE) {
    return { move: best.move, kind: 'best', target: null, cp: best.cp };
  }
  const shapes = new Map();
  const shapeOf = (move) => {
    if (!shapes.has(move)) shapes.set(move, moveShape(sfen, move));
    return shapes.get(move);
  };
  // 詰まされる手・ただで取られる手(最善がそうでないとき)は選ばない。
  const safe = scored.filter((candidate) => candidate.cp > -MATE_EDGE && (candidate === best || !shapeOf(candidate.move).hang));
  // AIの詰みはGUIDE_MATE_ASとして比べる(詰ませる手と、少し劣る手を同じ物差しにする)。
  const capped = (cp) => Math.min(cp, GUIDE_MATE_AS);
  const target = guidedTarget(capped(best.cp));
  if (target === null) {
    // 帯の中か、AIが苦しいとき: 最善と同じくらい良い手の中で、問いの手があればそれを指す。
    const question = safe.find((candidate) => best.cp - candidate.cp <= GUIDE_QUESTION_MARGIN && shapeOf(candidate.move).question);
    return question && question !== best
      ? { move: question.move, kind: 'question', target: null, cp: question.cp }
      : { move: best.move, kind: 'best', target: null, cp: best.cp };
  }
  // AIが帯より良いとき: 目指す点を下回らない手のうち、いちばん目指す点に近い手(近い手が並べば問いの手)。
  const eligible = safe.filter((candidate) => capped(candidate.cp) >= target);
  if (!eligible.length) return { move: best.move, kind: 'best', target, cp: best.cp };
  const closest = Math.min(...eligible.map((candidate) => capped(candidate.cp) - target));
  const near = eligible.filter((candidate) => capped(candidate.cp) - target <= closest + GUIDE_QUESTION_MARGIN)
    // 詰ませる手と同じくらいなら、詰ませない手を先に(まだ指せる手を残す)。
    .sort((a, b) => Number(a.cp >= MATE_EDGE) - Number(b.cp >= MATE_EDGE));
  const pick = near.find((candidate) => shapeOf(candidate.move).question) ?? near[0];
  return { move: pick.move, kind: pick === best ? 'best' : shapeOf(pick.move).question ? 'question' : 'ease', target, cp: pick.cp };
}

/**
 * 指導対局で読む候補の数とノード数。候補を12本読む(8本では大きく劣る手がなく、加減しきれなかった。13-3)ので、1本あたりの読みが浅くならないよう、アマ六段(Lv40)と同じくらいのノードを読む
 * (読みが浅いと、加減した手の点がぶれて、帯から外れる)。
 */
export const GUIDE_SEARCH = Object.freeze({ multiPv: 12, nodes: 80000 });
