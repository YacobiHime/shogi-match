import { kingEscapeMap } from "./board-insight.mjs";
import { parseSfenState } from "./piece-movement.mjs";
import { tutorialStepMarks, tutorialStepSfen, buildMissingTargets } from "./tutorial-runner.mjs";

/**
 * 将棋教室の「盤の上のひとこと」(docs/nyumon-mode-design.mdの16-3)。
 * 見るマスのそばに、しっぽ付きの小さな札を1つだけ出す。文とマスはステップのデータから自動で作り、
 * 札の位置は印のマスと駒を避けて選ぶ。画面から切り離した純粋な処理にして、全ステップをテストで確かめる。
 */

/** 盤の上のひとことの長さの上限(字)。 */
export const CALLOUT_MAX_CHARS = 14;

/** 札の大きさ(マスの幅・高さを1とした単位)。BoardView.vueは同じ値で札を描く。 */
export const CALLOUT_CHAR_WIDTH = 0.3;
export const CALLOUT_PADDING = 0.4;
export const CALLOUT_HEIGHT = 0.5;
/** 札としっぽの先までのすきま。 */
export const CALLOUT_GAP = 0.12;

const chars = (text) => [...String(text ?? "")].length;

/** 札の幅(マスの幅を1とする)。 */
export function calloutWidth(text) {
  return Math.min(8.6, chars(text) * CALLOUT_CHAR_WIDTH + CALLOUT_PADDING);
}

/**
 * 文の最初の一句(「両取り！」)と、残りの文。一句は「！」までで、14字までのときだけ切り出す。
 * 正解したとき、最初の一句を盤の上に出し、吹き出しには残りだけを出すのに使う。
 * @param {string} text
 * @returns {{ lead: string, rest: string }}
 */
export function splitLeadPhrase(text) {
  const source = String(text ?? "").trim();
  // 「。」で終わる一句は説明なので切らない(盤の上には「両取り！」のような短い一言だけを出す)。
  const match = /^[^！。!？?]+[！!]/.exec(source);
  if (!match) return { lead: "", rest: source };
  const lead = match[0];
  const rest = source.slice(match[0].length).trim();
  if (!rest || chars(lead) > CALLOUT_MAX_CHARS) return { lead: "", rest: source };
  return { lead, rest };
}

/** 見出しを14字までにする。長ければ「、」の前まで(「飛車先の歩交換三つの得あり」は「、」がないのでそのまま切らない)。 */
export function shortHeadline(text) {
  const source = String(text ?? "").trim();
  if (chars(source) <= CALLOUT_MAX_CHARS) return source;
  const head = source.split(/[、，,]/)[0];
  return chars(head) <= CALLOUT_MAX_CHARS ? head : "";
}

function squareName(mark) {
  return `${mark.file}${String.fromCharCode(96 + mark.rank)}`;
}

function quotedTerm(speech) {
  const match = /「([^」]+)」/.exec(String(speech ?? ""));
  return match && chars(match[1]) <= CALLOUT_MAX_CHARS ? match[1] : "";
}

/**
 * ステップの盤の上のひとこと(16-3のきまり。上から順に、最初に当てはまったもの1つ)。
 * @param {any} step
 * @param {{
 *   sfen?: string,
 *   marks?: { file: number, rank: number, tone: string }[],
 *   phase?: "task" | "solved" | "refute",
 *   moved?: string,
 *   lead?: string,
 *   refuteSquare?: string,
 *   refuteKind?: string,
 *   headline?: { at: string, text: string } | null,
 *   mateTask?: boolean,
 *   movesUsed?: number,
 *   speech?: string,
 * }} [context]
 * @returns {{ at: string, text: string, anchors?: string[] } | null}
 *   anchorsは、どのマスを指してもよいとき(駒の動けるマスのどれか)の候補。札の位置はその中から選ぶ。
 */
export function stepCallout(step, context = {}) {
  if (!step) return null;
  const sfen = context.sfen ?? tutorialStepSfen(step);
  const phase = context.phase ?? "task";
  const marks = context.marks ?? (sfen ? tutorialStepMarks(step, sfen) : []);
  if (phase === "refute" && context.refuteSquare) {
    const text = context.refuteKind === "drop" ? "打ち込まれる！" : context.refuteKind === "mate" ? "詰まされる！" : "取られる！";
    return { at: context.refuteSquare, text };
  }
  if (phase === "solved") {
    return context.moved && context.lead ? { at: context.moved, text: context.lead } : null;
  }
  if (step.note?.at && step.note?.text) return { at: step.note.at, text: step.note.text };
  if (context.headline?.at && context.headline.text) {
    const text = shortHeadline(context.headline.text);
    if (text) return { at: context.headline.at, text };
  }
  const speech = context.speech ?? step.speech ?? "";
  if (step.type === "explain") {
    const term = quotedTerm(speech);
    const ownMarks = (step.marks ?? []).map(([at, tone]) => ({ at, tone }));
    const anchor = ownMarks.find(({ tone }) => tone === "key") ?? ownMarks.find(({ tone }) => tone === "target");
    if (term && anchor) return { at: anchor.at, text: term };
    if (step.pieceSquare) {
      // 駒のまわりは動けるマスの点で埋まるので、札は点の1つを指す(点を隠さない位置を選ぶ)。
      const anchors = marks.filter(({ tone }) => tone === "reach").map(squareName);
      return { at: anchors[0] ?? step.pieceSquare, text: "動けるマス", ...(anchors.length ? { anchors } : {}) };
    }
    return null;
  }
  if (step.type === "capture" && !context.movesUsed) {
    return { at: step.from, text: "この駒だけで" };
  }
  const targets = marks.filter(({ tone }) => tone === "target");
  if (targets.length && step.type !== "build") {
    return { at: squareName(targets[0]), text: targets.length > 1 ? `ねらう駒×${targets.length}` : "ねらう駒" };
  }
  if (step.type === "move-piece" && !step.hideTarget) return { at: step.target, text: "ここまで" };
  // 行き先を緑で示した課題(「7六へ進めよう」)。
  const key = (step.marks ?? []).find(([, tone]) => tone === "key");
  if (key && step.type === "find-move") return { at: key[0], text: "ここへ" };
  if (context.mateTask && sfen) {
    const escape = kingEscapeMap(sfen, "white");
    if (escape) return { at: escape.king, text: `逃げ道 ${escape.squares.filter(({ state }) => state === "open").length}` };
  }
  if (step.type === "build" && !step.hideTarget && sfen) {
    const missing = buildMissingTargets(step, sfen);
    if (missing.length) return { at: missing[0][0], text: "ここへ組む" };
  }
  return null;
}

/**
 * 札の位置。マスの上(しっぽは下向き)を基本に、盤の上端なら下、印のマスや駒に重なるなら左右へずらす。
 * 座標は先手から見た盤(左上が9一)で、マスの幅・高さを1とする。
 * @typedef {{ side: "above" | "below" | "left" | "right", x: number, y: number, width: number, height: number, tail: number }} CalloutPlacement
 *   x・yは札の左上、tailは札の中でのしっぽの位置(上下に出すときは横の位置、左右なら縦の位置)。
 * @param {string | string[]} anchor 見るマス("5c")。候補が複数なら、いちばん重ならない位置のマスを選ぶ
 * @param {string} text
 * @param {{ marks?: { file: number, rank: number }[], sfen?: string, avoid?: { file: number, rank: number }[] }} [options]
 *   avoidは、なるべく隠したくないマス(利きの数字など。印ほどは強く避けない)。
 * @returns {(CalloutPlacement & { at: string }) | null}
 */
export function placeCallout(anchor, text, { marks = [], sfen = "", avoid = [] } = {}) {
  const pieces = sfen ? parseSfenState(sfen).board : new Map();
  const marked = new Set(marks.map(squareName));
  const avoided = new Set(avoid.map(squareName));
  /** @type {(CalloutPlacement & { at: string, cost: number })[]} */
  const candidates = (Array.isArray(anchor) ? anchor : [anchor])
    .flatMap((at, order) => placementCandidates(at, text, marked, pieces, avoided).map((candidate) => ({ ...candidate, cost: candidate.cost + order * 0.01 })));
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.cost - b.cost);
  const { cost: _cost, ...best } = candidates[0];
  return best;
}

/**
 * @param {string} at
 * @param {string} text
 * @param {Set<string>} marked
 * @param {Map<string, unknown>} pieces
 * @param {Set<string>} avoided
 */
function placementCandidates(at, text, marked, pieces, avoided) {
  if (!/^[1-9][a-i]$/.test(at ?? "")) return [];
  const col = 9 - Number(at[0]);
  const row = at.charCodeAt(1) - 97;
  const width = calloutWidth(text);
  const height = CALLOUT_HEIGHT;
  /** @type {(CalloutPlacement & { at: string, cost: number })[]} */
  const candidates = [];
  const consider = (side, x, y, preference) => {
    if (x < -1e-6 || y < -1e-6 || x + width > 9 + 1e-6 || y + height > 9 + 1e-6) return;
    let cost = preference;
    for (const square of coveredSquares(x, y, width, height)) {
      if (square === at) return;
      if (marked.has(square)) cost += 4;
      else if (pieces.has(square)) cost += 1;
      if (avoided.has(square)) cost += 1;
    }
    const tail = side === "above" || side === "below" ? col + 0.5 - x : row + 0.5 - y;
    candidates.push({ at, side, x, y, width, height, tail, cost });
  };
  const centered = col + 0.5 - width / 2;
  const clamp = (x) => Math.min(9 - width, Math.max(0, x));
  for (const shift of [0, -1, 1, -2, 2]) {
    const x = clamp(centered + shift);
    // しっぽがマスの上から外れないように、札がマスの真上を含む位置だけを選ぶ。
    if (x > col + 0.3 || x + width < col + 0.7) continue;
    const penalty = Math.abs(x - clamp(centered)) * 0.1;
    consider("above", x, row - CALLOUT_GAP - height, penalty);
    consider("below", x, row + 1 + CALLOUT_GAP, 0.2 + penalty);
  }
  consider("left", col - CALLOUT_GAP - width, row + 0.5 - height / 2, 0.5);
  consider("right", col + 1 + CALLOUT_GAP, row + 0.5 - height / 2, 0.5);
  return candidates;
}

/** 札が重なるマス("5c"の形)。マスの内側に少しでも入っていれば重なるとみなす。 */
export function coveredSquares(x, y, width, height) {
  const squares = [];
  const epsilon = 0.02;
  for (let col = Math.floor(x + epsilon); col < Math.ceil(x + width - epsilon); col += 1) {
    for (let row = Math.floor(y + epsilon); row < Math.ceil(y + height - epsilon); row += 1) {
      if (col < 0 || col > 8 || row < 0 || row > 8) continue;
      squares.push(`${9 - col}${String.fromCharCode(97 + row)}`);
    }
  }
  return squares;
}

/**
 * 吹き出しの文の色の言葉の前に、盤と同じ色の札(■)を付けるための区切り(16-3の色の札)。
 * toneは盤の印と同じ名前(key・target・reach・black・white・risk・danger・covered)。
 */
const COLOR_WORDS = [
  ["緑のマス", "key"],
  ["赤いマス", "target"],
  ["赤のマス", "target"],
  ["青い点", "reach"],
  ["青い数字", "black"],
  ["赤い数字", "white"],
  ["赤い輪", "risk"],
  ["赤い×", "danger"],
  ["青い×", "covered"],
];
const COLOR_PATTERN = new RegExp(COLOR_WORDS.map(([word]) => word).join("|"), "g");
const COLOR_TONES = new Map(COLOR_WORDS);

/**
 * @param {string} text
 * @returns {{ text: string, tone: string }[]} toneが空でない区切りの前に色の札を描く
 */
export function speechSegments(text) {
  const source = String(text ?? "");
  const segments = [];
  let index = 0;
  for (const match of source.matchAll(COLOR_PATTERN)) {
    const at = match.index ?? 0;
    if (at > index) segments.push({ text: source.slice(index, at), tone: "" });
    segments.push({ text: match[0], tone: COLOR_TONES.get(match[0]) ?? "" });
    index = at + match[0].length;
  }
  if (index < source.length || !segments.length) segments.push({ text: source.slice(index), tone: "" });
  return segments;
}
