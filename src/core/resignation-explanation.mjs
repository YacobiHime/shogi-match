import { formatPrincipalVariation } from "./reference-kifu-analysis.mjs";

/**
 * 投了の理由の説明。対局後の振り返りと、将棋界図鑑の代表局で使う。
 * 投了した局面を深く読んだ結果から、投了した側に詰みがあるか、形勢の差がどれだけあるかを、やこび姫の一言にする。
 */

/** 投了するのも納得の差(投了した側から見た評価値)。これより小さい差なら「まだ大差ではない」と話す。 */
export const RESIGNATION_HOPELESS = -1500;
export const RESIGNATION_CLEAR = -500;
/** 読み筋を並べて見せる手数の上限。 */
export const RESIGNATION_PV_LIMIT = 12;

const SIDE_LABELS = Object.freeze({ black: "先手", white: "後手" });

/** 投了の理由を調べるときの探索量。投了図の詰みは長いことがあるので、通常の解析より深く読む。 */
export function resignationSearchSettings(mobile = false) {
  return mobile
    ? { nodes: 400000, maxTimeMs: 10000, multiPv: 1 }
    : { nodes: 1500000, maxTimeMs: 10000, multiPv: 1 };
}

/**
 * 投了した局面(sfen)を読んだ候補手から、投了の理由を作る。説明できなければnull。
 * 評価値は手番側から見た値(USIのscoreのまま)。loserは投了した側("black" | "white")。
 * 返り値のkindは、mate(どう指しても詰む)・hopeless(大差)・clear(はっきり不利)・early(まだ大差ではない)・
 * missed(投了した側に勝ち筋があった)のどれか。pvは並べて見せる手順(USI)、pvLabelはその表記。
 * @param {{
 *   sfen: string,
 *   candidates?: { rank: number, move: string, pv?: string[], score?: { type: "cp" | "mate", value: number } }[],
 *   loser: "black" | "white",
 *   names?: { black?: string, white?: string },
 * }} options
 */
export function explainResignation({ sfen, candidates = [], loser, names = {} }) {
  const best = candidates.find(({ rank }) => rank === 1);
  if (!best?.score || (loser !== "black" && loser !== "white")) return null;
  const sideToMove = sfen.split(" ")[1] === "w" ? "white" : "black";
  // 投了した側から見た値にそろえる。
  const sign = sideToMove === loser ? 1 : -1;
  const value = best.score.value * sign;
  const loserName = names[loser] || SIDE_LABELS[loser];
  const winner = loser === "black" ? "white" : "black";
  const winnerName = names[winner] || SIDE_LABELS[winner];
  const pv = (best.pv?.length ? best.pv : [best.move]).slice(0, RESIGNATION_PV_LIMIT);
  let pvLabel = "";
  try {
    pvLabel = formatPrincipalVariation(pv, sfen, RESIGNATION_PV_LIMIT);
  } catch {
    pvLabel = "";
  }
  const evaluation = `${value > 0 ? "+" : ""}${Math.trunc(value)}`;
  const result = (kind, text) => ({ kind, text, pv, pvLabel, value, scoreType: best.score.type });

  if (best.score.type === "mate") {
    const plies = Math.abs(value);
    if (value < 0) {
      return result("mate", `AIが読むと、${loserName}はどう受けても${plies}手で詰まされてしまうんだ。だから投了したんだね。`);
    }
    return result("missed", `実はAIが読むと、${loserName}に${plies}手で詰ませる筋があったよ！投了するのは早かったみたい。`);
  }
  if (value <= RESIGNATION_HOPELESS) {
    return result("hopeless", `AIの評価値は${loserName}から見て${evaluation}。駒の損や玉の危なさで、ここから逆転するのはとても難しい形だよ。`);
  }
  if (value <= RESIGNATION_CLEAR) {
    return result("clear", `AIの評価値は${loserName}から見て${evaluation}で、${winnerName}がはっきり優勢。この先の展開を読んで、勝ち目がないと判断したんだね。`);
  }
  if (value > 0) {
    return result("early", `AIから見ると、むしろ${loserName}のほうが指しやすい（${loserName}から見て${evaluation}）。投了するのは早かったかもしれないね。`);
  }
  return result("early", `AIから見ると、まだ大差ではない（${loserName}から見て${evaluation}）。人間には先の苦しい展開が見えていたのかもしれないね。`);
}
