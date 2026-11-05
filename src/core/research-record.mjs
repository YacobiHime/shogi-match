/**
 * 研究モード(docs/research-mode-design.md)の棋譜と研究帳。画面に依存しない。
 *
 * 研究の棋譜は分岐を何本でも持てる木にする。JSONにそのまま保存できるよう、手の節を入れ子の配列で持つ。
 *   節: { usi, children: 節[], sel: 次に進むときに選ぶ子の番号, score?: 先手から見た評価値, depth?: その評価値の深さ }
 *   根: { usi: "", children, sel } (初期局面)
 * いまの局面は、根から選んだ子の番号の並び(path)で持つ。path.length が手数。
 * 「いま選んでいる道」は、pathのあと、各節の sel の子をたどった最後までの手順。
 */

import { Position, formatMove, importKIF, importKI2, importCSA, exportKIF, Record, detectRecordFormat, RecordFormatType } from "tsshogi";

export const STANDARD_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
export const RESEARCH_KEY = "yacobihime:shogi-match:research:v1";
export const RESEARCH_SETTINGS_KEY = "yacobihime:shogi-match:research-settings:v1";
/** 研究帳に残す数。古いものから消える(3-8)。 */
export const RESEARCH_LIMIT = 30;

const FULL_DIGITS = { "１": "1", "２": "2", "３": "3", "４": "4", "５": "5", "６": "6", "７": "7", "８": "8", "９": "9" };

/** @param {string} sfen */
export function positionOf(sfen) {
  const position = Position.newBySFEN(sfen);
  if (!position) throw new Error("局面のSFENが不正です。");
  return position;
}

/** 手番("black"・"white")。 */
export function sideOf(sfen) {
  return String(sfen).split(" ")[1] === "w" ? "white" : "black";
}

/**
 * 手の表記(「▲5八金右」「△同歩」)。指せない手なら空。
 * @param {string} sfen 指す前の局面
 * @param {string} usi
 * @param {string} [previousUsi] 直前の手(「同」にするため)
 */
export function moveLabel(sfen, usi, previousUsi = "") {
  try {
    const position = positionOf(sfen);
    const move = position.createMoveByUSI(usi);
    if (!move || !position.isValidMove(move)) return "";
    const last = previousUsi ? positionLastMove(previousUsi) : undefined;
    let text = formatMove(position, move, { compatible: true });
    text = text.replace(/[１-９]/g, (digit) => FULL_DIGITS[digit]);
    // 直前の手と同じマスなら「同」(tsshogiのlastMoveは局面が要るので、行き先だけで決める)。
    if (last && last === usi.slice(2, 4)) text = text.replace(/^([▲△])[1-9][一二三四五六七八九]/, "$1同");
    return text;
  } catch {
    return "";
  }
}

function positionLastMove(previousUsi) {
  return /^[1-9][a-i]|^[PLNSGBR]\*/.test(previousUsi) ? previousUsi.slice(2, 4) : "";
}

/**
 * 読み筋を手の表記の並びにする。指せない手が出たらそこまで。
 * @param {string} sfen
 * @param {string[]} pv
 * @param {{ limit?: number, previousUsi?: string }} [options]
 * @returns {string[]}
 */
export function pvLabels(sfen, pv, { limit = 12, previousUsi = "" } = {}) {
  const labels = [];
  let current = sfen;
  let previous = previousUsi;
  for (const usi of (pv ?? []).slice(0, limit)) {
    const label = moveLabel(current, usi, previous);
    if (!label) break;
    labels.push(label);
    current = applyUsi(current, usi);
    previous = usi;
  }
  return labels;
}

/** 手を指したあとの局面。指せなければnull。 */
export function applyUsi(sfen, usi) {
  try {
    const position = positionOf(sfen);
    const move = position.createMoveByUSI(usi);
    if (!move || !position.isValidMove(move)) return null;
    position.doMove(move);
    return position.sfen;
  } catch {
    return null;
  }
}

/**
 * 新しい研究。
 * @param {{ sfen?: string, moves?: string[], name?: string, now?: number, id?: string }} [options]
 */
export function createResearch({ sfen = STANDARD_SFEN, moves = [], name = "", now = Date.now(), id } = {}) {
  positionOf(sfen);
  const research = {
    id: id ?? `r${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name,
    createdAt: now,
    updatedAt: now,
    sfen,
    root: { usi: "", children: [], sel: 0 },
    path: [],
  };
  for (const usi of moves) {
    if (!playMove(research, usi)) break;
  }
  return research;
}

/** pathの節(なければnull)。 */
export function nodeAt(research, path = research.path) {
  let node = research.root;
  for (const index of path) {
    node = node.children[index];
    if (!node) return null;
  }
  return node;
}

/** pathの局面のSFEN。 */
export function sfenAt(research, path = research.path) {
  let sfen = research.sfen;
  let node = research.root;
  for (const index of path) {
    node = node.children[index];
    if (!node) break;
    sfen = applyUsi(sfen, node.usi) ?? sfen;
  }
  return sfen;
}

/** いまの手数。 */
export function currentPly(research) {
  return research.path.length;
}

/**
 * いま選んでいる道の手順。各手に、手の表記・その手の前の局面・分岐の数・何番目の分岐かを付ける。
 * @returns {{ ply: number, usi: string, label: string, sfenBefore: string, path: number[], branches: number, index: number, score?: object, depth?: number }[]}
 */
export function activeLine(research) {
  const line = [];
  let node = research.root;
  let sfen = research.sfen;
  const path = [];
  let previous = "";
  for (let depth = 0; ; depth += 1) {
    if (!node.children.length) break;
    const index = depth < research.path.length ? research.path[depth] : Math.min(node.sel ?? 0, node.children.length - 1);
    const child = node.children[index];
    if (!child) break;
    path.push(index);
    line.push({
      ply: depth + 1,
      usi: child.usi,
      label: moveLabel(sfen, child.usi, previous),
      sfenBefore: sfen,
      path: [...path],
      branches: node.children.length,
      index,
      score: child.score,
      depth: child.depth,
    });
    const next = applyUsi(sfen, child.usi);
    if (!next) break;
    sfen = next;
    previous = child.usi;
    node = child;
  }
  return line;
}

/**
 * いまの局面で手を指す。同じ手があればそこへ進むだけ、なければ新しい分岐にする。指せない手ならfalse。
 * @param {object} research
 * @param {string} usi
 */
export function playMove(research, usi) {
  const sfen = sfenAt(research);
  if (!applyUsi(sfen, usi)) return false;
  const node = nodeAt(research);
  let index = node.children.findIndex((child) => child.usi === usi);
  if (index < 0) {
    node.children.push({ usi, children: [], sel: 0 });
    index = node.children.length - 1;
  }
  node.sel = index;
  research.path = [...research.path, index];
  research.updatedAt = Date.now();
  return true;
}

/** いまの局面から手順を続けて指す。指せた手数を返す。 */
export function playLine(research, moves) {
  let count = 0;
  for (const usi of moves) {
    if (!playMove(research, usi)) break;
    count += 1;
  }
  return count;
}

/** いま選んでいる道の、ply手目の局面へ移る(0なら初期局面)。 */
export function goToPly(research, ply) {
  const line = activeLine(research);
  const target = Math.max(0, Math.min(line.length, Math.floor(ply)));
  // 道の上で戻るときも、選んでいた道(sel)を残す。
  let node = research.root;
  for (const entry of line) {
    node.sel = entry.index;
    node = node.children[entry.index];
  }
  research.path = target ? [...line[target - 1].path] : [];
  return target;
}

/** 1手進める・戻す。 */
export function stepPly(research, delta) {
  return goToPly(research, currentPly(research) + delta);
}

/**
 * ply手目の分岐を選ぶ(その手の局面へ移る)。
 * @param {object} research
 * @param {number} ply 1から
 * @param {number} index 分岐の番号
 */
export function chooseBranch(research, ply, index) {
  const line = activeLine(research);
  const parentPath = ply > 1 ? line[ply - 2]?.path : [];
  if (!parentPath) return false;
  const parent = nodeAt(research, parentPath);
  if (!parent?.children[index]) return false;
  parent.sel = index;
  research.path = [...parentPath, index];
  return true;
}

/** ply手目の分岐の一覧(その手の前の局面の次の手)。 */
export function branchesAt(research, ply) {
  const line = activeLine(research);
  const parentPath = ply > 1 ? line[ply - 2]?.path : [];
  if (!parentPath) return [];
  const parent = nodeAt(research, parentPath);
  const sfen = sfenAt(research, parentPath);
  const previous = ply > 1 ? line[ply - 2].usi : "";
  const selected = line[ply - 1]?.index;
  return parent.children.map((child, index) => ({
    index,
    usi: child.usi,
    label: moveLabel(sfen, child.usi, previous),
    main: index === 0,
    selected: index === selected,
    length: lineLength(child),
  }));
}

function lineLength(node) {
  let count = 1;
  let current = node;
  while (current.children.length) {
    current = current.children[Math.min(current.sel ?? 0, current.children.length - 1)];
    count += 1;
  }
  return count;
}

/** ply手目の分岐を本譜(いちばん上)にする。 */
export function promoteBranch(research, ply, index) {
  const line = activeLine(research);
  const parentPath = ply > 1 ? line[ply - 2]?.path : [];
  const parent = parentPath && nodeAt(research, parentPath);
  if (!parent?.children[index] || index === 0) return false;
  const [child] = parent.children.splice(index, 1);
  parent.children.unshift(child);
  remapIndex(research, parentPath, index, 0);
  parent.sel = 0;
  return true;
}

/** 子の並びを変えたとき、pathの番号を合わせる。 */
function remapIndex(research, parentPath, from, to) {
  const depth = parentPath.length;
  if (research.path.length <= depth || parentPath.some((value, i) => research.path[i] !== value)) return;
  const current = research.path[depth];
  let next = current;
  if (current === from) next = to;
  else if (from > current && to <= current) next = current + 1;
  research.path = [...research.path.slice(0, depth), next, ...research.path.slice(depth + 1)];
}

/**
 * ply手目の分岐を消す。もとに戻すための印を返す(消せなければnull)。
 * いまの局面が消える分岐の中なら、分岐の前の局面へ移る。
 */
export function removeBranch(research, ply, index) {
  const line = activeLine(research);
  const parentPath = ply > 1 ? line[ply - 2]?.path : [];
  const parent = parentPath && nodeAt(research, parentPath);
  if (!parent?.children[index]) return null;
  const [node] = parent.children.splice(index, 1);
  const depth = parentPath.length;
  const inside = research.path.length > depth && parentPath.every((value, i) => research.path[i] === value);
  const undo = { parentPath: [...parentPath], index, node, path: [...research.path], sel: parent.sel };
  if (inside) {
    const current = research.path[depth];
    if (current === index) research.path = [...parentPath];
    else if (current > index) research.path = [...research.path.slice(0, depth), current - 1, ...research.path.slice(depth + 1)];
  }
  parent.sel = Math.min(parent.sel > index ? parent.sel - 1 : parent.sel === index ? 0 : parent.sel, Math.max(0, parent.children.length - 1));
  return undo;
}

/** removeBranchの印で、消した分岐を戻す。 */
export function restoreBranch(research, undo) {
  const parent = undo && nodeAt(research, undo.parentPath);
  if (!parent) return false;
  parent.children.splice(undo.index, 0, undo.node);
  parent.sel = undo.sel;
  research.path = [...undo.path];
  return true;
}

/**
 * その局面の評価値を残す(検討で読んだ値。深いほうを残す)。先手から見た値。
 * @param {object} research
 * @param {number[]} path
 * @param {{ type: string, value: number }} score
 * @param {number} depth
 */
export function recordScore(research, path, score, depth = 0) {
  const node = nodeAt(research, path);
  if (!node || !score) return false;
  if (Number.isFinite(node.depth) && node.depth > depth) return false;
  node.score = { type: score.type, value: score.value };
  node.depth = depth;
  return true;
}

/** 研究帳の名前(「11月5日 ▲7六歩」)。名前を付けていればそれ。 */
export function researchTitle(research) {
  if (research.name) return research.name;
  const date = new Date(research.createdAt);
  const day = `${date.getMonth() + 1}月${date.getDate()}日`;
  const first = research.root.children[0];
  const start = research.sfen === STANDARD_SFEN ? "" : "編集した局面 ";
  const move = first ? moveLabel(research.sfen, first.usi) : "";
  return `${day} ${start}${move}`.trim();
}

// ---- 研究帳の保存

/** 研究帳を読む。壊れていれば空。 */
export function loadResearchBook(storage) {
  try {
    const raw = storage?.getItem(RESEARCH_KEY);
    const book = raw ? JSON.parse(raw) : null;
    if (!book || !Array.isArray(book.items)) return { current: "", items: [] };
    const items = book.items.filter((item) => item && typeof item.sfen === "string" && item.root && Array.isArray(item.path));
    return { current: typeof book.current === "string" ? book.current : "", items };
  } catch {
    return { current: "", items: [] };
  }
}

/** 研究帳に研究を入れる(同じidなら置き換え、新しいものを先頭に。多すぎたら古いものから消す)。 */
export function putResearch(book, research) {
  const items = [research, ...book.items.filter((item) => item.id !== research.id)]
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    .slice(0, RESEARCH_LIMIT);
  return { current: research.id, items };
}

/** 研究帳から消す。 */
export function dropResearch(book, id) {
  const items = book.items.filter((item) => item.id !== id);
  return { current: book.current === id ? (items[0]?.id ?? "") : book.current, items };
}

export function saveResearchBook(storage, book) {
  try {
    storage?.setItem(RESEARCH_KEY, JSON.stringify(book));
    return true;
  } catch {
    return false;
  }
}

// ---- 設定

export const MULTI_PV_MIN = 1;
export const MULTI_PV_MAX = 10;
/** 読む長さの選択肢(3-3)。 */
export const THINK_LIMITS = Object.freeze([
  Object.freeze({ id: "infinite", group: "ずっと", label: "ずっと", go: {} }),
  Object.freeze({ id: "time-1", group: "時間", label: "1秒", go: { movetime: 1000 } }),
  Object.freeze({ id: "time-3", group: "時間", label: "3秒", go: { movetime: 3000 } }),
  Object.freeze({ id: "time-5", group: "時間", label: "5秒", go: { movetime: 5000 } }),
  Object.freeze({ id: "time-10", group: "時間", label: "10秒", go: { movetime: 10000 } }),
  Object.freeze({ id: "time-30", group: "時間", label: "30秒", go: { movetime: 30000 } }),
  Object.freeze({ id: "depth-10", group: "深さ", label: "深さ10", go: { depth: 10 } }),
  Object.freeze({ id: "depth-15", group: "深さ", label: "深さ15", go: { depth: 15 } }),
  Object.freeze({ id: "depth-20", group: "深さ", label: "深さ20", go: { depth: 20 } }),
  Object.freeze({ id: "depth-25", group: "深さ", label: "深さ25", go: { depth: 25 } }),
  Object.freeze({ id: "nodes-100k", group: "局面数", label: "10万局面", go: { nodes: 100000 } }),
  Object.freeze({ id: "nodes-1m", group: "局面数", label: "100万局面", go: { nodes: 1000000 } }),
  Object.freeze({ id: "nodes-10m", group: "局面数", label: "1000万局面", go: { nodes: 10000000 } }),
]);

export const DEFAULT_RESEARCH_SETTINGS = Object.freeze({ multiPv: 3, limit: "infinite", arrows: true, display: "score", analysisLevel: 1 });

/** 設定を整える(範囲の外や知らない値ははじめの値)。 */
export function normalizeResearchSettings(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const multiPv = Number.isInteger(value.multiPv) ? Math.min(MULTI_PV_MAX, Math.max(MULTI_PV_MIN, value.multiPv)) : DEFAULT_RESEARCH_SETTINGS.multiPv;
  return {
    multiPv,
    limit: THINK_LIMITS.some(({ id }) => id === value.limit) ? value.limit : DEFAULT_RESEARCH_SETTINGS.limit,
    arrows: typeof value.arrows === "boolean" ? value.arrows : DEFAULT_RESEARCH_SETTINGS.arrows,
    display: value.display === "rate" ? "rate" : "score",
    analysisLevel: [0, 1, 2].includes(value.analysisLevel) ? value.analysisLevel : DEFAULT_RESEARCH_SETTINGS.analysisLevel,
  };
}

export function loadResearchSettings(storage) {
  try {
    return normalizeResearchSettings(JSON.parse(storage?.getItem(RESEARCH_SETTINGS_KEY) ?? "null"));
  } catch {
    return normalizeResearchSettings(null);
  }
}

export function saveResearchSettings(storage, settings) {
  try {
    storage?.setItem(RESEARCH_SETTINGS_KEY, JSON.stringify(normalizeResearchSettings(settings)));
  } catch {
    // 保存できなくても研究は続ける。
  }
}

// ---- 読み込みと書き出し(3-8)

/**
 * 棋譜や局面の文字を研究にする。KIF・KI2・CSA・SFEN(「sfen 」「position sfen」も)・USI(「startpos moves …」・手の並び)。
 * 分岐のある棋譜(KIF)は分岐も入れる。読めなければErrorを返す。
 * @param {string} text
 * @param {{ now?: number }} [options]
 */
export function importResearch(text, { now = Date.now() } = {}) {
  const source = String(text ?? "").trim();
  if (!source) return new Error("文字が空です。");
  const usi = parseUsiText(source);
  if (usi) {
    const research = createResearch({ sfen: usi.sfen, now });
    const played = playLine(research, usi.moves);
    if (played < usi.moves.length) return new Error(`${played + 1}手目が指せない手です。`);
    goToPly(research, 0);
    return research;
  }
  let record;
  try {
    const format = detectRecordFormat(source);
    record = format === RecordFormatType.CSA ? importCSA(source)
      : format === RecordFormatType.KI2 ? importKI2(source)
        : importKIF(source);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
  if (record instanceof Error) return new Error("棋譜を読めませんでした。");
  const research = createResearch({ sfen: record.initialPosition.sfen, now });
  copyBranches(record.first, research.root);
  return research;
}

function copyBranches(first, root) {
  // tsshogiの節: next(本譜)、branch(兄弟)。
  const walk = (node, target) => {
    for (let child = node.next; child; child = child.branch) {
      const move = child.move;
      if (!move || typeof move.usi !== "string") continue;
      const copy = { usi: move.usi, children: [], sel: 0 };
      target.children.push(copy);
      walk(child, copy);
    }
  };
  walk(first, root);
}

function parseUsiText(source) {
  const text = source.replace(/^position\s+/, "").trim();
  let match = text.match(/^startpos(?:\s+moves\s+(.*))?$/);
  if (match) return { sfen: STANDARD_SFEN, moves: splitMoves(match[1]) };
  match = text.match(/^(?:sfen\s+)?(\S+\s+[bw]\s+\S+(?:\s+\d+)?)(?:\s+moves\s+(.*))?$/);
  if (match && /^[1-9lnsgkrbpLNSGKRBP+/]+$/.test(match[1].split(/\s+/)[0]) && match[1].split(/\s+/)[0].split("/").length === 9) {
    const parts = match[1].split(/\s+/);
    const sfen = `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3] ?? "1"}`;
    try {
      positionOf(sfen);
    } catch {
      return null;
    }
    return { sfen, moves: splitMoves(match[2]) };
  }
  const moves = splitMoves(text);
  if (moves.length && moves.every((usi) => /^([1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/.test(usi))) {
    return { sfen: STANDARD_SFEN, moves };
  }
  return null;
}

function splitMoves(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean);
}

/** 研究をKIFの文字にする(分岐も入れる)。 */
export function exportResearchKif(research) {
  const record = new Record(positionOf(research.sfen));
  walkRecord(record, research.root);
  return exportKIF(record);
}

function walkRecord(record, node) {
  for (const child of node.children) {
    const move = record.position.createMoveByUSI(child.usi);
    if (!move || !record.append(move, { ignoreValidation: true })) continue;
    walkRecord(record, child);
    record.goBack();
  }
}

/** 局面をSFENの文字にする(「sfen …」なしの形)。 */
export function exportSfen(research, path = research.path) {
  return sfenAt(research, path);
}
