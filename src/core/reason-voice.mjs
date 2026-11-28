// 自由対局の将棋AI(論理)の心の声(docs/disciple-mode-design.mdの43章)。
// 将棋AI(論理)が1手を選んだ理由(reason-think.mjsの`reason`・読み筋`line`・点`score`)を、盤の上の吹き出しの2行にする。
// 1行目はこの手のねらい(手の表記つき)、2行目は相手の手への反応か、この先の読み、形勢の感じ。
// 新しく読まない(考えたときの記録を言葉にするだけ)。画面に依存しない。対局画面からは、将棋AI(論理)を読み込むときに import() で読む。

import { moveLabel, pvLabels } from "./research-record.mjs";

/** 詰みを読み切った点(logic-search.mjsのMATE - 100)。 */
const MATE_SCORE = 30000 - 100;
/** 形勢の感じを言う点(歩1枚が100)。 */
export const VOICE_MOOD_SCORES = Object.freeze({ winning: 2000, better: 800 });
/** 1行の長さの目安(盤の上の吹き出しに収める。超えたら2行目の後ろを省く)。 */
export const VOICE_LINE_CHARS = 26;

/**
 * 理由ごとの1行目。`{m}`はこの手の表記。
 * @type {Readonly<Record<string, string>>}
 */
export const VOICE_INTENTS = Object.freeze({
  book: "定跡どおり{m}",
  "book-pro": "プロがよく指す{m}でいこう",
  follow: "研究してきた{m}",
  memo: "前にも指した形。{m}でいく",
  mate: "詰みが見えた。{m}から{n}手詰め",
  "mate-threat": "読み切った。{m}で勝ちが見える",
  material: "{m}で駒を取る",
  recapture: "{m}と取り返す",
  promote: "{m}で成り込む",
  check: "{m}と王手をかけよう",
  attack: "{m}で攻め駒を玉に近づける",
  castle: "{m}で囲いを固めておこう",
  mobility: "{m}で駒を働かせたい",
  read: "よく読んで{m}にした",
  develop: "{m}で銀を前へ出そう",
  "rook-pawn": "{m}、飛車先の歩を伸ばす",
  "edge-pawn": "{m}、端歩で様子を見る",
  wait: "{m}で手待ち。出方を見たい",
  save: "{m}で取られそうな駒を逃がす",
  "defend-mate": "{m}で詰みを受けないと",
  connect: "{m}で駒どうしをつなぐ",
  natural: "{m}が自然な手だ",
});

/**
 * 形勢の感じ(将棋AI(論理)から見た点)。点がないとき・互角に近いときは空。
 * @param {number | null | undefined} score
 */
export function voiceMood(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "";
  if (score >= MATE_SCORE) return "";
  if (score >= VOICE_MOOD_SCORES.winning) return "勝ちが近い";
  if (score >= VOICE_MOOD_SCORES.better) return "指しやすくなってきた";
  if (score <= -VOICE_MOOD_SCORES.winning) return "苦しい…";
  if (score <= -VOICE_MOOD_SCORES.better) return "少し苦しいか";
  return "";
}

/**
 * 将棋AI(論理)の心の声の2行。
 * @param {{
 *   sfen: string,
 *   thought: { move: string, reason?: string, score?: number, line?: string[], mate?: number, pro?: boolean } | null | undefined,
 *   lastMove?: string | null,
 *   expected?: string | null,
 * }} input
 *   sfenは指す前の局面、thoughtはchooseThinkingMoveの結果、lastMoveは直前の相手(人)の手、
 *   expectedはこの前に将棋AI(論理)が読んでいた相手の手(前の心の声の`expects`)
 * @returns {{ lines: string[], text: string, expects: string } | null}
 *   linesは吹き出しの行、textは読み上げ用の1文、expectsはこの手のあとに読んでいる相手の手(次の反応に使う)
 */
export function reasonVoice({ sfen, thought, lastMove = null, expected = null }) {
  const move = thought?.move;
  if (!move) return null;
  const label = moveLabel(sfen, move, lastMove ?? "");
  if (!label) return null;
  const reason = String(thought.reason ?? "");
  let key = reason in VOICE_INTENTS ? reason : "natural";
  if (key === "book" && thought.pro) key = "book-pro";
  if (key === "material" && lastMove && lastMove.slice(2, 4) === move.slice(2, 4)) key = "recapture";
  const first = VOICE_INTENTS[key].replace("{m}", label).replace("{n}", String(thought.mate ?? thought.line?.length ?? 1));
  const line = Array.isArray(thought.line) && thought.line[0] === move ? thought.line : [move];
  const labels = pvLabels(sfen, line, { limit: 3, previousUsi: lastMove ?? "" });
  const expects = line[1] ?? "";
  // 2行目: 読んでいた手と違う手が来たら反応、同じなら「読みどおり」、そのあとにこの先の読み、最後に形勢の感じ。
  const parts = [];
  if (lastMove && expected) {
    const before = lastMoveLabel(sfen, lastMove);
    if (before) parts.push(expected === lastMove ? `${before}は読みどおり` : `${before}は読んでいなかった`);
  }
  if (key !== "mate" && labels.length >= 3) parts.push(`次は${labels[1]}${labels[2]}と読む`);
  else if (key === "mate" && labels.length >= 3) parts.push(`${labels[1]}なら${labels[2]}`);
  const mood = key === "mate" || key === "mate-threat" ? "" : voiceMood(thought.score);
  if (mood) parts.push(mood);
  const second = joinWithin(parts, VOICE_LINE_CHARS);
  const lines = second ? [first, second] : [first];
  return { lines, text: lines.join("。"), expects };
}

/** 直前の相手の手の短い表記(「△3四歩」)。 */
function lastMoveLabel(sfenAfter, usi) {
  // 指したあとの局面しかないので、行き先のマスで「△3四歩」のように書く(駒の種類は行き先の駒から)。
  const square = usi.slice(2, 4);
  if (!/^[1-9][a-i]$/.test(square)) return "";
  const file = square[0];
  const rank = "一二三四五六七八九"["abcdefghi".indexOf(square[1])];
  const piece = pieceAt(sfenAfter, square);
  if (!piece) return "";
  const side = String(sfenAfter).split(" ")[1] === "w" ? "▲" : "△"; // 手番の反対が直前に指した側
  return `${side}${file}${rank}${piece}`;
}

const PIECE_NAMES = Object.freeze({ p: "歩", l: "香", n: "桂", s: "銀", g: "金", b: "角", r: "飛", k: "玉", "+p": "と", "+l": "成香", "+n": "成桂", "+s": "成銀", "+b": "馬", "+r": "竜" });

/** 局面のマスの駒の名前。 */
function pieceAt(sfen, square) {
  const rows = String(sfen).split(" ")[0]?.split("/") ?? [];
  const rank = "abcdefghi".indexOf(square[1]);
  const file = Number(square[0]);
  const row = rows[rank];
  if (!row) return "";
  let column = 9;
  for (let i = 0; i < row.length; i += 1) {
    let token = row[i];
    if (/\d/.test(token)) {
      column -= Number(token);
      continue;
    }
    if (token === "+") token += row[++i];
    if (column === file) return PIECE_NAMES[token.toLowerCase()] ?? "";
    column -= 1;
  }
  return "";
}

/** 文の切れを「、」でつなぎ、長さの目安を超える切れは後ろから省く(最初の切れは残す)。 */
function joinWithin(parts, limit) {
  let text = "";
  for (const part of parts) {
    const next = text ? `${text}、${part}` : part;
    if (text && next.length > limit) break;
    text = next;
  }
  return text;
}
