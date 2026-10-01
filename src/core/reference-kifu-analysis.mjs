import { appendUsiMove, createGameRecord } from "../game-state";
import { formatHintMove } from "./match-assists.mjs";
import {
  classifyAnalyzedMove,
  formatAnalysisScore,
  scoreForBlack,
  scoreToGraphValue,
} from "./kifu-analysis.mjs";

/**
 * 図鑑の代表局を、将棋AIで1局面ずつ解析する。
 * searchは局面のSFENを受け取り、エンジンの候補手（rank・move・pv・score）を返す。
 * 解析できた局面ごとに、評価値グラフの点をonPointへ渡す。isCancelledが真になったら止める。
 * @param {{
 *   steps: { sfen: string, label: string, lastMove: string }[],
 *   search: (sfen: string) => Promise<{ candidates?: any[] }>,
 *   isCancelled?: () => boolean,
 *   onPoint?: (point: any) => void,
 * }} options
 */
export async function analyzeKifuSteps({ steps, search, isCancelled = () => false, onPoint = () => {} }) {
  const points = [];
  for (let ply = 0; ply < steps.length; ply += 1) {
    if (isCancelled()) break;
    const { sfen } = steps[ply];
    const sideToMove = sfen.split(" ")[1] === "w" ? "white" : "black";
    const { candidates = [] } = await search(sfen);
    if (isCancelled()) break;
    const best = candidates.find(({ rank }) => rank === 1);
    const second = candidates.find(({ rank }) => rank === 2);
    const score = scoreForBlack(best?.score, sideToMove);
    const graphValue = scoreToGraphValue(score);
    if (!score || graphValue === undefined) continue;
    const previous = points.at(-1);
    const point = {
      ply,
      graphValue,
      label: ply === 0 ? "開始局面" : `${ply}手目 ${steps[ply].label}`,
      scoreLabel: formatAnalysisScore(score),
      bestMove: best?.move,
      pv: best?.pv ?? [],
      score,
      secondScore: scoreForBlack(second?.score, sideToMove),
      // 1つ前の局面も解析できたときだけ、指した手の良し悪しを判定する。
      annotation: ply > 0 && previous?.ply === ply - 1
        ? classifyAnalyzedMove({
          ply,
          playedMove: steps[ply].lastMove,
          bestMove: previous.bestMove,
          beforeBestScore: previous.score,
          beforeSecondScore: previous.secondScore,
          afterScore: score,
        })
        : null,
    };
    points.push(point);
    onPoint(point);
  }
  return points;
}

/** 局面で指す手を、手番の印付きの「▲7六歩」のような表記にする。 */
export function formatAnalysisMove(usi, sfen) {
  return `${sfen.split(" ")[1] === "w" ? "△" : "▲"}${formatHintMove(usi, sfen)}`;
}

/** 読み筋を「▲7六歩 → △3四歩」のような表記にする。指せない手が出たらそこまで。 */
export function formatPrincipalVariation(pv, sfen, limit = 6) {
  const record = createGameRecord(sfen);
  const labels = [];
  for (const usi of (pv ?? []).slice(0, limit)) {
    const before = record.position.sfen;
    if (!appendUsiMove(record, usi)) break;
    labels.push(formatAnalysisMove(usi, before));
  }
  return labels.join(" → ");
}

const SIDE_LABELS = Object.freeze({ black: "先手", white: "後手" });

/**
 * 形勢の分かれ目。勝った側から見た評価値がthreshold以上になり、そのまま終局まで下回らなかった最初の局面。
 * 勝った側が分からないときや、AIが最後まで勝った側の優勢を認めないときはnull。
 */
export function findTurningPoint(points, winner, threshold = 500) {
  if (winner !== "black" && winner !== "white") return null;
  const sign = winner === "black" ? 1 : -1;
  let turning = null;
  for (const point of points) {
    if (point.graphValue * sign >= threshold) turning ??= point.ply;
    else turning = null;
  }
  return turning;
}

/**
 * AIの解析から選んだ見せ場。形勢の分かれ目と、次善手との差が大きい好手・神の一手を、差の大きい順にlimit本まで。
 */
export function analysisHighlights(points, winner, limit = 3) {
  const highlights = [];
  const turning = findTurningPoint(points, winner);
  if (turning !== null) highlights.push({ ply: turning, label: "形勢の分かれ目" });
  const brilliant = points
    .filter(({ annotation }) => annotation?.kind === "brilliant" || annotation?.kind === "good")
    .sort((left, right) => (right.annotation.bestGap ?? 0) - (left.annotation.bestGap ?? 0))
    .slice(0, limit);
  for (const { ply, annotation } of brilliant) {
    if (ply !== turning) highlights.push({ ply, label: annotation.label });
  }
  return highlights.sort((left, right) => left.ply - right.ply);
}

/**
 * AIの解析をもとに、やこび姫がその局面で話す一言。棋譜に解説がない局面で使う。話すことがなければ空文字。
 * moveLabelはその局面に至った手（例: ▲4五桂）、namesは先手・後手の名前。
 */
export function analysisComment(point, { moveLabel = "", names = {}, winner = "", turningPly = null } = {}) {
  if (!point || point.ply === 0) return "";
  if (point.ply === turningPly) {
    return `AIの見立てでは、この${moveLabel}から${names[winner] || SIDE_LABELS[winner]}がはっきり優勢になって、最後までリードを守ったよ。ここが勝負の分かれ目だね！`;
  }
  const annotation = point.annotation;
  if (!annotation) return "";
  const mover = names[annotation.mover] || SIDE_LABELS[annotation.mover];
  switch (annotation.kind) {
    case "brilliant":
      return `${mover}の${moveLabel}は、AIもうなる「神の一手」！ほかの手では、こうはいかないんだって。`;
    case "good":
      return `${mover}の${moveLabel}は「好手」！AIもこの手が一番だって言ってるよ。`;
    case "dubious":
      return `AIによると、${mover}の${moveLabel}は少し「疑問手」みたい。`;
    case "mistake":
      return `AIの見立てでは、${mover}の${moveLabel}は「悪手」。ここで形勢が大きく動いたよ。`;
    case "blunder":
      return `AIの見立てでは、${mover}の${moveLabel}は「大悪手」。ここで形勢が一気に傾いたよ。`;
    default:
      return "";
  }
}
