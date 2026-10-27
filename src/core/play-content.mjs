// 対局の場面採点(docs/skill-assessment-design.mdの5章)。1手ごとの損の平均ではなく、局面で起きた場面ごとに
// 「できたか」を数え、棋力テストと同じ式(skill-test.mjsのposteriorLevel)で1局の中身の強さ(Lv)と幅を出す。
// 場面: 取れる駒(見る)・守る駒(見る)・駒損をしない(見る)・詰み(読む)。画面とエンジンに依存しない(解析の点を使う)。

import { material, playLight, replyLoss, stateFromSfen } from './logic-position.mjs';
import { posteriorLevel } from './skill-test.mjs';

/** 大差(この評価値より差が付いた局面)では、詰み以外の場面を数えない。 */
const DECIDED_STANDING = 1500;
/** 「できなかった」とする損(評価値)と、取り合いの読みで見る駒の損得。 */
const MISS_LOSS = 300;
const MATERIAL_SWING = 300;
const HANG_SWING = 400;
/** 数える詰みの長さの上限(手数)。 */
const MAX_MATE_PLIES = 7;
/**
 * 場面の難しさ(Lv)。取れる駒・守るは、棋力テストの同じ種類の問題の難しさ(skill-test-bank.mjsのb)の平均
 * (2026-10-27の生成で14.3・20.7)に合わせた初めの値。駒損をしないは、それよりやさしい場面として置く。
 * 詰みは手数で決める(詰将棋の手数の目安。docs/skill-assessment-design.mdの4-3)。集めた答えで直す。
 */
export const CONTENT_DIFFICULTY = Object.freeze({
  take: 14,
  save: 20,
  safe: 4,
  mate: Object.freeze({ 1: 8, 3: 16, 5: 24, 7: 30 }),
});
export const CONTENT_KINDS = Object.freeze(['take', 'save', 'safe', 'mate']);
/** 1局の中身の強さを出すのに要る、場面の数。 */
export const MIN_CONTENT_EVENTS = 8;

/** 手を指したあと、相手の取りの読み(depth手)を受けた、自分の駒の損得。 */
function netAfter(state, usi, depth) {
  const child = usi ? playLight(state, usi) : null;
  return child ? material(child, state.turn) - replyLoss(child, depth) : null;
}

/** 詰みの評価が、その色の勝ち(詰ませる側)なら、詰みまでの手数。 */
function mateLengthFor(score, color) {
  if (score?.type !== 'mate' || !Number.isFinite(score.value) || score.value === 0) return 0;
  return (color === 'black' ? score.value > 0 : score.value < 0) ? Math.abs(score.value) : 0;
}

/**
 * 1局の場面。pointsは棋譜解析の点(kifu-analysis-pipeline.mjsのanalysisPointsFromResults。scoreは先手から見た値)、
 * sfensは0手目からの局面、movesは指した手(USI。moves[ply - 1]がply手目)、colorは採点する側。
 * @param {{ points: any[], sfens: string[], moves?: readonly string[], color: 'black' | 'white' }} game
 * @returns {{ kind: string, ply: number, b: number, correct: boolean }[]}
 */
export function contentEvents({ points, sfens, moves = [], color }) {
  const byPly = new Map((points ?? []).map((point) => [point.ply, point]));
  const events = [];
  for (const point of points ?? []) {
    const measure = point.moveMeasure;
    if (!measure || measure.mover !== color) continue;
    const before = byPly.get(point.ply - 1);
    const sfen = sfens?.[point.ply - 1];
    if (!before || !sfen) continue;
    // 詰み: 着手前の読みで自分に7手以内の詰みがあったら、逃さなかったか。
    const mate = mateLengthFor(before.score, color);
    if (mate) {
      if (mate <= MAX_MATE_PLIES) {
        const b = CONTENT_DIFFICULTY.mate[mate] ?? CONTENT_DIFFICULTY.mate[7];
        events.push({ kind: 'mate', ply: point.ply, b, correct: Boolean(mateLengthFor(point.score, color)) || point.score?.value === 0 });
      }
      continue;
    }
    if (Math.abs(measure.standing) >= DECIDED_STANDING) continue;
    const loss = Math.min(1000, measure.measureLoss ?? measure.loss ?? 0);
    const state = stateFromSfen(sfen);
    const now = material(state, state.turn);
    const best = before.bestMove;
    const bestNet = netAfter(state, best, 2);
    // 取れる駒: 最善手が、取り合いの2手の読みで300以上の駒得になる駒取り。
    if (best && !best.includes('*') && state.board.get(best.slice(2, 4))?.color && bestNet !== null && bestNet - now >= MATERIAL_SWING) {
      events.push({ kind: 'take', ply: point.ply, b: CONTENT_DIFFICULTY.take, correct: loss < MISS_LOSS });
    }
    // 守る駒: 手番を渡したら、相手の取りの読みで300以上の駒を取られる。
    const passed = { ...state, turn: state.turn === 'black' ? 'white' : 'black' };
    if (replyLoss(passed, 2) >= MATERIAL_SWING) {
      events.push({ kind: 'save', ply: point.ply, b: CONTENT_DIFFICULTY.save, correct: loss < MISS_LOSS });
    }
    // 駒損をしない: 指した手で、取り合いの2手の読みで今より400以上駒を失い(成り込まれるだけの300は数えない)、
    // 最善より300以上悪く、評価値でも300以上損をしたら、できなかった(取れる駒を逃しただけなら、取れる駒の場面で数える)。
    const played = moves[point.ply - 1];
    const playedNet = played ? netAfter(state, played, 2) : null;
    const hung = bestNet !== null && playedNet !== null && now - playedNet >= HANG_SWING
      && bestNet - playedNet >= MATERIAL_SWING && loss >= MISS_LOSS;
    events.push({ kind: 'safe', ply: point.ply, b: CONTENT_DIFFICULTY.safe, correct: !hung });
  }
  return events;
}

/**
 * 1局の場面から、中身の強さ(Lv)と幅、場面ごとの数。場面が少なければnull。
 * @param {{ kind: string, b: number, correct: boolean }[]} events
 */
export function contentEstimate(events) {
  if ((events?.length ?? 0) < MIN_CONTENT_EVENTS) return null;
  const { level, spread } = posteriorLevel(events.map(({ b, correct }) => ({ b, guess: 0, correct })), null);
  const counts = Object.fromEntries(CONTENT_KINDS.map((kind) => {
    const list = events.filter((event) => event.kind === kind);
    return [kind, { n: list.length, hit: list.filter(({ correct }) => correct).length }];
  }));
  return { level, spread, counts };
}
