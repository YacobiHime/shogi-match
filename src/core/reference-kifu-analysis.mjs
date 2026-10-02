import { appendUsiMove, createGameRecord } from "../game-state";
import { formatHintMove } from "./match-assists.mjs";
import { STAGED_ANALYSIS_PLANS } from "./kifu-analysis-pipeline.mjs";
import { CPU_STRENGTH_PRESETS, getStrengthSearchSettings } from "./strength-settings.mjs";

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
 * 棋譜解析のレベルは5段階。解析を始める前に選ぶ(対局後の振り返り・図鑑で共通)。
 * どの段も、全局面を読む(scan)→怪しい手を読み直す(review)→大事な局面を深く読む(focus)の段階解析
 * (kifu-analysis-pipeline.mjs)で読む。nodesは全局面を読むときの1局面あたりの探索量で、
 * reviewNodes・focusNodesは読み直し・深読みの探索量。「速い」は段階解析の既定の設定をそのまま使う。
 * 中くらいの「藤井聡太並み」は、全局面をCPUの最高難易度(Lv40)と同じ探索量で読む
 * (docs/fujii-sota-strength-calibration.md)。「深い」はその2倍、「最強」は4倍を読む。
 * maxTimeMsは遅い端末で止まらないための上限で、スマホではmobileの値を使う。
 */
const FUJII_NODES = getStrengthSearchSettings(CPU_STRENGTH_PRESETS.at(-1).value).nodes;
export const KIFU_ANALYSIS_LEVELS = Object.freeze([
  {
    label: "速い",
    nodes: STAGED_ANALYSIS_PLANS.desktop.scan.nodes,
    mobileNodes: STAGED_ANALYSIS_PLANS.mobile.scan.nodes,
    maxTimeMs: STAGED_ANALYSIS_PLANS.desktop.scan.maxTimeMs,
    mobileMaxTimeMs: STAGED_ANALYSIS_PLANS.mobile.scan.maxTimeMs,
  },
  { label: "詳しい", nodes: 120000, mobileNodes: 120000, maxTimeMs: 4000, mobileMaxTimeMs: 8000, reviewNodes: 480000, focusNodes: 1500000 },
  {
    label: "藤井聡太並み", nodes: FUJII_NODES, mobileNodes: FUJII_NODES,
    maxTimeMs: 10000, mobileMaxTimeMs: 20000, reviewNodes: 1500000, focusNodes: 3000000,
  },
  {
    label: "深い", nodes: FUJII_NODES * 2, mobileNodes: FUJII_NODES * 2,
    maxTimeMs: 15000, mobileMaxTimeMs: 30000, reviewNodes: 3000000, focusNodes: 6000000,
  },
  {
    label: "最強", nodes: FUJII_NODES * 4, mobileNodes: FUJII_NODES * 4,
    maxTimeMs: 25000, mobileMaxTimeMs: 50000, reviewNodes: 6000000, focusNodes: 12000000,
  },
]);
/** 藤井聡太並みの段の番号。5段階の真ん中。 */
export const FUJII_ANALYSIS_LEVEL = KIFU_ANALYSIS_LEVELS.findIndex(({ label }) => label === "藤井聡太並み");

const ANALYSIS_LEVEL_STORAGE_KEY = "shogi-match-analysis-level";
/** 前回選んだ解析レベル。保存がなければ「速い」。 */
export function loadAnalysisLevel(storage = globalThis.localStorage) {
  try {
    const level = Number(storage?.getItem(ANALYSIS_LEVEL_STORAGE_KEY));
    return Number.isInteger(level) && level >= 0 && level < KIFU_ANALYSIS_LEVELS.length ? level : 0;
  } catch {
    return 0;
  }
}
export function saveAnalysisLevel(level, storage = globalThis.localStorage) {
  try {
    storage?.setItem(ANALYSIS_LEVEL_STORAGE_KEY, String(level));
  } catch { /* 保存できない環境では覚えない */ }
}

const clampLevel = (level) => Math.max(0, Math.min(KIFU_ANALYSIS_LEVELS.length - 1, level));

/** 解析の深さの、全局面を読むときの探索量と時間の上限。範囲外の段は最も近い段にする。 */
export function kifuAnalysisBudget(level, mobile = false) {
  const entry = KIFU_ANALYSIS_LEVELS[clampLevel(level)];
  return {
    nodes: mobile ? entry.mobileNodes : entry.nodes,
    maxTimeMs: mobile ? entry.mobileMaxTimeMs : entry.maxTimeMs,
  };
}

/** 解析の深さに応じた段階解析の設定。読み直しの選び方と浅い読みは、対局後の解析と同じにする。 */
export function kifuAnalysisPlan(level, mobile = false) {
  const base = STAGED_ANALYSIS_PLANS[mobile ? "mobile" : "desktop"];
  const entry = KIFU_ANALYSIS_LEVELS[clampLevel(level)];
  if (!entry.reviewNodes) return base;
  const { nodes, maxTimeMs } = kifuAnalysisBudget(level, mobile);
  return {
    ...base,
    scan: { ...base.scan, nodes, maxTimeMs },
    review: { ...base.review, nodes: entry.reviewNodes, maxTimeMs: maxTimeMs * 2 },
    focus: { ...base.focus, nodes: entry.focusNodes, maxTimeMs: maxTimeMs * 3 },
  };
}

/**
 * 棋譜から分岐させた局面を、その場で読むときの探索量。候補手を3つまで出す。
 * 指すたびに読み直すので、全局面の解析の深読みより軽くする。
 */
export function positionAnalysisBudget(mobile = false) {
  return mobile
    ? { nodes: 100000, maxTimeMs: 3000, multiPv: 3 }
    : { nodes: 300000, maxTimeMs: 3000, multiPv: 3 };
}

/** 「1.2万」「48万」のような、探索量の短い表記。 */
export function formatNodeCount(nodes) {
  if (nodes >= 10000) return `${Number((nodes / 10000).toFixed(1))}万`;
  return String(nodes);
}
