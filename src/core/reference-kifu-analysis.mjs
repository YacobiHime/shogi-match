import { appendUsiMove, createGameRecord } from "../game-state";
import { formatHintMove } from "./match-assists.mjs";
import {
  classifyAnalyzedMove,
  formatAnalysisScore,
  scoreForBlack,
  scoreToGraphValue,
} from "./kifu-analysis.mjs";
import { capGodMoves, judgeGodMove, moveContext } from "./god-move.mjs";

/**
 * 図鑑の代表局を、将棋AIで1局面ずつ解析する。
 * searchは局面のSFENと読みの深さ（"shallow"・"deep"）を受け取り、エンジンの候補手（rank・move・pv・score）を返す。
 * 浅い読みは、神の一手（先を読まないと気付けない手）を対局中の褒め言葉と同じ基準で判定するために使う。
 * 解析できた局面が増えるたびに、神の一手を上位3手に絞った点の列をonPointsへ渡す。isCancelledが真になったら止める。
 * @param {{
 *   steps: { sfen: string, label: string, lastMove: string }[],
 *   search: (sfen: string, depth: "shallow" | "deep") => Promise<{ candidates?: any[] }>,
 *   isCancelled?: () => boolean,
 *   onPoints?: (points: any[]) => void,
 *   onPly?: (ply: number) => void,
 * }} options
 * onPlyは、各局面を読み始めるときに局面の手数を渡す。
 */
export async function analyzeKifuSteps({
  steps,
  search,
  isCancelled = () => false,
  onPoints = () => {},
  onPly = () => {},
}) {
  let points = [];
  let before = null;
  for (let ply = 0; ply < steps.length; ply += 1) {
    if (isCancelled()) break;
    const { sfen } = steps[ply];
    const sideToMove = sfen.split(" ")[1] === "w" ? "white" : "black";
    onPly(ply);
    const { candidates: shallow = [] } = await search(sfen, "shallow");
    if (isCancelled()) break;
    const { candidates = [] } = await search(sfen, "deep");
    if (isCancelled()) break;
    const searched = { deep: candidates, shallow };
    const previousSearch = before;
    before = searched;
    const best = candidates.find(({ rank }) => rank === 1);
    const second = candidates.find(({ rank }) => rank === 2);
    const score = scoreForBlack(best?.score, sideToMove);
    const graphValue = scoreToGraphValue(score);
    if (!score || graphValue === undefined) continue;
    const previous = points.at(-1);
    // 1つ前の局面も解析できたときだけ、指した手の良し悪しを判定する。
    const judged = ply > 0 && previous?.ply === ply - 1 && previousSearch;
    const context = judged ? moveContext(steps[ply - 1].sfen, steps[ply].lastMove, steps[ply - 1].lastMove) : null;
    const point = {
      ply,
      graphValue,
      label: ply === 0 ? "開始局面" : `${ply}手目 ${steps[ply].label}`,
      scoreLabel: formatAnalysisScore(score),
      bestMove: best?.move,
      pv: best?.pv ?? [],
      score,
      secondScore: scoreForBlack(second?.score, sideToMove),
      annotation: judged
        ? classifyAnalyzedMove({
          ply,
          playedMove: steps[ply].lastMove,
          bestMove: previous.bestMove,
          beforeBestScore: previous.score,
          beforeSecondScore: previous.secondScore,
          afterScore: score,
          godMove: judgeGodMove({
            move: steps[ply].lastMove,
            deepCandidates: previousSearch.deep,
            shallowCandidates: previousSearch.shallow,
            trivial: context.trivial,
            sacrifice: context.sacrifice,
          }),
        })
        : null,
    };
    points = capGodMoves([...points, point]);
    onPoints(points);
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
 * AIの解析から選んだ見せ場。形勢の分かれ目と神の一手（上位3手に絞り済み）を出し、
 * 神の一手がlimit本に満たなければ、次善手との差が大きい好手で補う。
 */
export function analysisHighlights(points, winner, limit = 3) {
  const highlights = [];
  const turning = findTurningPoint(points, winner);
  if (turning !== null) highlights.push({ ply: turning, label: "形勢の分かれ目" });
  const god = points.filter(({ annotation }) => annotation?.kind === "brilliant");
  // 神の一手の上位3手から外れた候補を先に、残りの好手は次善手との差が大きい順に並べる。
  const good = points
    .filter(({ annotation }) => annotation?.kind === "good")
    .sort((left, right) => (
      Number(Boolean(right.annotation.godCandidate)) - Number(Boolean(left.annotation.godCandidate))
      || (right.annotation.strength ?? 0) - (left.annotation.strength ?? 0)
      || (right.annotation.bestGap ?? 0) - (left.annotation.bestGap ?? 0)
    ));
  for (const { ply, annotation } of [...god, ...good].slice(0, Math.max(limit, god.length))) {
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

/**
 * 図鑑の棋譜解析の深さは3段階。「将棋AIで解析」は標準で読み、「深く解析」を押すたびに1段ずつ深く読み直す。
 * nodesは1局面あたりの探索量。maxTimeMsは遅い端末で止まらないための上限で、スマホではmobileの値を使う。
 * 「藤井聡太並み」はCPUの最高難易度と同じ探索量（docs/fujii-sota-strength-calibration.md）。
 */
export const KIFU_ANALYSIS_LEVELS = Object.freeze([
  { label: "標準", nodes: 12000, mobileNodes: 6000, maxTimeMs: 1200, mobileMaxTimeMs: 800 },
  { label: "深い", nodes: 120000, mobileNodes: 120000, maxTimeMs: 4000, mobileMaxTimeMs: 8000 },
  { label: "藤井聡太並み", nodes: 480000, mobileNodes: 480000, maxTimeMs: 10000, mobileMaxTimeMs: 20000 },
]);

/** 解析の深さの、探索量と時間の上限。範囲外の段は最も近い段にする。 */
export function kifuAnalysisBudget(level, mobile = false) {
  const entry = KIFU_ANALYSIS_LEVELS[Math.max(0, Math.min(KIFU_ANALYSIS_LEVELS.length - 1, level))];
  return {
    nodes: mobile ? entry.mobileNodes : entry.nodes,
    maxTimeMs: mobile ? entry.mobileMaxTimeMs : entry.maxTimeMs,
  };
}

/** 「1.2万」「48万」のような、探索量の短い表記。 */
export function formatNodeCount(nodes) {
  if (nodes >= 10000) return `${Number((nodes / 10000).toFixed(1))}万`;
  return String(nodes);
}

/**
 * 深く読み直している途中の点を、前の解析の点に重ねる。読み直した局面は新しい点、まだの局面は前の点を使う。
 * 神の一手は、重ねた後の点の列で上位3手に絞り直す。
 */
export function mergeAnalysisPoints(newer, older) {
  const byPly = new Map(older.map((point) => [point.ply, point]));
  for (const point of newer) byPly.set(point.ply, point);
  return capGodMoves([...byPly.values()].sort((left, right) => left.ply - right.ply));
}
