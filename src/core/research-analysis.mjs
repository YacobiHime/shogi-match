/**
 * 研究モードの検討の見せ方(docs/research-mode-design.mdの3-3)。エンジンの候補を、読み筋の表・矢印・勝率のバー・
 * やこび姫の一言の形にする。画面に依存しない。
 */

import { winRate } from "./move-selection.mjs";
import { rateVerdict } from "./relay-game.mjs";
import { moveLabel, pvLabels, sideOf } from "./research-record.mjs";

/** 矢印を出す上限(候補の数が多くても、盤が見えなくならないように)。 */
export const ARROW_LIMIT = 5;

/**
 * エンジンの評価値(手番側から見た値)を、先手から見た値にする。
 * @param {{ type: string, value: number } | undefined} score
 * @param {string} sfen
 */
export function blackScoreOf(score, sfen) {
  if (!score || !["cp", "mate"].includes(score.type) || !Number.isFinite(score.value)) return null;
  const sign = sideOf(sfen) === "black" ? 1 : -1;
  return { type: score.type, value: sign * score.value };
}

/** 先手の勝率(0〜100)。読めなければnull。 */
export function blackRateOf(blackScore) {
  if (!blackScore) return null;
  const rate = winRate(blackScore);
  return Number.isFinite(rate) ? rate : null;
}

/** 評価値の文字(「+86」「-120」「▲5手詰」「△詰み」)。 */
export function scoreText(blackScore) {
  if (!blackScore) return "—";
  if (blackScore.type === "mate") {
    const moves = Math.abs(blackScore.value);
    const side = blackScore.value >= 0 ? "▲" : "△";
    return moves === 0 ? `${side}詰み` : `${side}${moves}手詰`;
  }
  const value = Math.trunc(blackScore.value);
  return `${value > 0 ? "+" : ""}${value}`;
}

/** 勝率の文字(「54%」)。先手から見た値。 */
export function rateText(blackScore) {
  const rate = blackRateOf(blackScore);
  return rate === null ? "—" : `${Math.round(rate)}%`;
}

/** 勝率のバーの一言(「先手やや有利」「互角」)。 */
export function verdictText(blackScore) {
  const rate = blackRateOf(blackScore);
  if (rate === null) return "";
  if (blackScore.type === "mate") return blackScore.value >= 0 ? "先手勝ち" : "後手勝ち";
  const { side, word } = rateVerdict(rate);
  return side ? `${side === "black" ? "先手" : "後手"}${word}` : word;
}

/**
 * 読み筋の表の行。順位の順に並べ、同じ順位の古い値は出さない。
 * @param {string} sfen 読んでいる局面
 * @param {{ rank: number, move: string, pv?: string[], depth?: number, score?: { type: string, value: number } }[]} candidates
 * @param {{ limit?: number, previousUsi?: string }} [options]
 */
export function candidateRows(sfen, candidates, { limit = 10, previousUsi = "" } = {}) {
  const byRank = new Map();
  for (const candidate of candidates ?? []) {
    if (!candidate?.move || !Number.isInteger(candidate.rank) || candidate.rank < 1 || candidate.rank > limit) continue;
    byRank.set(candidate.rank, candidate);
  }
  const rows = [];
  const seen = new Set();
  for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
    const candidate = byRank.get(rank);
    if (seen.has(candidate.move)) continue;
    const label = moveLabel(sfen, candidate.move, previousUsi);
    if (!label) continue;
    seen.add(candidate.move);
    const pv = Array.isArray(candidate.pv) && candidate.pv[0] === candidate.move ? candidate.pv : [candidate.move];
    const black = blackScoreOf(candidate.score, sfen);
    rows.push({
      rank: rows.length + 1,
      usi: candidate.move,
      label,
      pv,
      line: pvLabels(sfen, pv, { limit: 14, previousUsi }).slice(1).join(" "),
      depth: candidate.depth ?? null,
      score: black,
      scoreText: scoreText(black),
      rateText: rateText(black),
    });
  }
  return rows;
}

/** 盤の矢印(候補の数だけ。最大ARROW_LIMIT本)。rankは1から。 */
export function candidateArrows(rows, { limit = ARROW_LIMIT } = {}) {
  return rows.slice(0, limit).map(({ usi, rank }) => ({ usi, rank }));
}

/** 「1,234万」「8,500」「1.2億」のような局面数の文字。 */
export function nodeText(nodes) {
  if (!Number.isFinite(nodes) || nodes < 0) return "0";
  if (nodes >= 1e8) return `${Number((nodes / 1e8).toFixed(1))}億`;
  if (nodes >= 1e4) return `${Math.floor(nodes / 1e4).toLocaleString("ja-JP")}万`;
  return Math.floor(nodes).toLocaleString("ja-JP");
}

/**
 * 読みの情報の行(「深さ 24 ・ 1,234万局面」と「1秒に 85万局面 ・ 14秒」)。
 * @param {{ depth?: number, nodes?: number, nps?: number, elapsedMs?: number }} stats
 */
export function statsText(stats) {
  const depth = Number.isFinite(stats?.depth) ? `深さ ${stats.depth}` : "深さ —";
  const nodes = `${nodeText(stats?.nodes ?? 0)}局面`;
  const speed = Number.isFinite(stats?.nps) ? `1秒に ${nodeText(stats.nps)}局面` : "";
  const seconds = Number.isFinite(stats?.elapsedMs) ? `${Math.floor(stats.elapsedMs / 1000)}秒` : "";
  return { main: `${depth} ・ ${nodes}`, sub: [speed, seconds].filter(Boolean).join(" ・ ") };
}

/**
 * やこび姫の一言(3-3)。1位の候補を言葉にする。読みが落ち着く前(深さが浅い)は「読んでいるよ」。
 * @param {ReturnType<typeof candidateRows>} rows
 * @param {{ settled?: boolean, mateSearch?: boolean }} [options]
 */
export function himeLine(rows, { settled = true } = {}) {
  const best = rows?.[0];
  if (!best) return { text: "いまの局面を読んでいるよ。", tone: "normal" };
  if (!settled) return { text: `いまは${best.label}が候補の1番。まだ読んでいるよ。`, tone: "normal" };
  if (best.score?.type === "mate") {
    const moves = Math.abs(best.score.value);
    const mover = best.label.startsWith("▲") ? "black" : "white";
    const winner = best.score.value >= 0 ? "black" : "white";
    if (mover === winner) return { text: `${moves}手詰めがあるよ！ ${best.label}から詰ませられる。`, tone: "notice" };
    return { text: `${best.label}がいちばんだけど、${moves}手で詰まされちゃう形だよ。`, tone: "notice" };
  }
  const verdict = verdictText(best.score);
  return { text: `${best.label}がいちばんだって。${verdict ? `${verdict}だよ。` : ""}`, tone: "normal" };
}

/**
 * 研究の棋譜の一覧の評価値の列(先手から見た値の短い文字)。
 */
export function lineScoreText(score) {
  return score ? scoreText(score) : "";
}
