/**
 * 振り返りで見つけた局面を、問題集の問題にする(段階4の「間をあけた出し直し」の続き)。
 * 対局で見逃したn手詰めを「あなたの対局から」の詰ませる問題として残し、問題集の「あなたの対局」の棚と、
 * 復習の箱(日をあけて出す)から解けるようにする(docs/missed-mate-problems-design.md)。
 *
 * 解析の読み筋が詰みまで確かめられたら、その手順を答えにする(kind: 'line'、source: 'game')。読み筋と違う王手は、
 * 問題集の詰み探索で詰むかを確かめて、詰めば正解にする(別の正しい答えを不正解にしない)。
 * 読み筋がない・確かめられないときは、3手詰めまでなら、答えを書かずに詰み探索だけで判定する(kind: 'mate')。
 * 問題集の重いモジュールを読まずに保存できるよう、このモジュールは軽く保つ(対局画面からも使う)。
 */

import { isMatingLine } from './problem-solver';

export const REVIEW_PROBLEMS_KEY = 'yacobihime:shogi-match:review-problems:v1';
/** 詰み探索だけで判定する問題(読み筋のない問題)の手数の上限。実戦の局面は駒が多く、長い詰みは探索の上限にかかる。 */
export const REVIEW_PROBLEM_MAX_PLIES = 3;
/** 読み筋を答えにする問題の手数の上限。 */
export const REVIEW_LINE_MAX_PLIES = 15;
/** 覚えておく問題の数。古いものから消す。 */
const MAX_STORED = 40;
const ID_PREFIX = 'review:';

/** 局面から、問題のIDを作る(同じ局面は同じID)。 */
export function reviewProblemId(sfen) {
  const text = String(sfen).replace(/^sfen\s+/, '').split(' ').slice(0, 3).join(' ');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return `${ID_PREFIX}${hash.toString(36)}`;
}

export function isReviewProblemId(id) {
  return typeof id === 'string' && id.startsWith(ID_PREFIX);
}

/**
 * 見逃した詰みの局面から、詰ませる問題を作る。手数が長すぎる・手順を確かめられないときはnull。
 * @param {{ sfen: string, mateLength: number, line?: readonly string[] | null, at?: number }} found
 *   sfenは詰ませる側の手番の局面、lineは解析の読み筋(詰みまでの手順)
 */
export function buildReviewProblem({ sfen, mateLength, line = null, at = Date.now() }) {
  if (!sfen || !Number.isInteger(mateLength) || mateLength < 1) return null;
  const base = {
    id: reviewProblemId(sfen),
    depth: mateLength,
    title: `あなたの対局から（${mateLength}手詰め）`,
    sfen,
    question: `あなたの対局に出てきた局面だよ。${mateLength}手で詰ませてみよう！`,
    explanation: '対局では見逃しちゃった詰みだね。もう見つけられるようになったよ！ 本番の大会でも決めよう！',
    at,
  };
  const answer = Array.isArray(line) ? line.slice(0, mateLength) : [];
  if (mateLength <= REVIEW_LINE_MAX_PLIES && answer.length === mateLength && safeMatingLine(sfen, answer)) {
    return { ...base, kind: 'line', source: 'game', line: answer, plies: mateLength };
  }
  if (mateLength > REVIEW_PROBLEM_MAX_PLIES) return null;
  return { ...base, kind: 'mate' };
}

function safeMatingLine(sfen, line) {
  try {
    return isMatingLine(sfen, line);
  } catch {
    return false;
  }
}

/** 保存してある問題として使えるか(読み筋の問題と、詰み探索だけの短い問題)。 */
function validStoredProblem(problem) {
  if (!problem || !isReviewProblemId(problem.id) || typeof problem.sfen !== 'string' || !Number.isInteger(problem.depth)) return false;
  if (problem.kind === 'mate') return problem.depth <= REVIEW_PROBLEM_MAX_PLIES;
  return problem.kind === 'line' && problem.source === 'game' && Array.isArray(problem.line)
    && problem.line.length === problem.depth && problem.depth <= REVIEW_LINE_MAX_PLIES
    && problem.line.every((usi) => typeof usi === 'string');
}

/** 問題を足す。同じ局面は新しいほうで置き換え、古いものから消す。 */
export function addReviewProblems(list, problems) {
  const byId = new Map(list.map((problem) => [problem.id, problem]));
  for (const problem of problems) if (problem) byId.set(problem.id, problem);
  return [...byId.values()].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)).slice(-MAX_STORED);
}

export function reviewProblemById(list, id) {
  return list.find((problem) => problem.id === id) ?? null;
}

export function loadReviewProblems(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(REVIEW_PROBLEMS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(validStoredProblem) : [];
  } catch {
    return [];
  }
}

export function saveReviewProblems(storage, list) {
  try {
    storage?.setItem(REVIEW_PROBLEMS_KEY, JSON.stringify(list));
  } catch {
    // 保存できない環境では、問題にしない。
  }
}
