import { appendUsiMove, createGameRecord } from "../game-state";
import { formatHintMove } from "./match-assists.mjs";
import { analyzeProblem } from "./problem-solver";

/**
 * やこび姫の将棋問題集。詰ませる問題と、王手から逃げる問題を出す。
 * 正解は問題に書かず、problem-solver.tsの詰み探索で合法手をすべて調べて決める。
 * 問題に書くのは、局面・種類・探索の深さと、やこび姫の出題・解説・ヒントの台詞だけ。
 * 局面には、詰将棋と同じく攻め方の玉を置かなくてよい。
 */

export const PROBLEM_SET_TITLE = "やこび姫の将棋問題集";

export const PROBLEMS = Object.freeze([
  {
    id: "head-gold-or-silver",
    kind: "mate",
    // 1手詰め。
    depth: 1,
    title: "金と銀、どっちで詰ます？",
    sfen: "4k4/9/4P4/9/9/9/9/9/9 b GS 1",
    question: "後手玉を詰ますには、金銀どちらを使うかな？ 1手で詰ませてみよう！",
    hint: "玉の真上（5二）に打つと、どうなるかな？ 金と銀の動ける方向を比べてみてね。",
    hintSquare: "5b",
    explanation: "金は真横にも動けるから、玉の逃げ道の4二と6二もふさげるんだ。5三の歩が金を守っているから、玉は金を取れないよ。玉の頭に金を打つこの形を「頭金」というよ！",
  },
  {
    id: "escape-from-gold",
    kind: "escape",
    // 逃げたあと、相手に3手以内の詰みがないか調べる。
    depth: 3,
    title: "どこへ逃げる？",
    sfen: "9/9/9/9/9/4s4/4g4/2G1K1S2/9 b g 1",
    question: "5七の金で王手をかけられちゃった！ 相手は持ち駒に金を持っているよ。どこへ逃げたら詰まないかな？",
    hint: "玉は6九・5九・4九のどこかへ逃げるしかないよ。逃げた先で金を打たれたとき、味方の駒が助けてくれるのはどこかな？",
    hintSquare: "7h",
    explanation: "6九なら、5八に金を打たれても7九へ逃げられるし、6八に打たれたら7八の金で取れるんだ。困ったときは、味方の駒がいる方へ逃げるのが基本だよ！",
  },
]);

export function problemById(id) {
  return PROBLEMS.find((problem) => problem.id === id) ?? null;
}

/** 問題の合法手をすべて判定する。結果は問題ごとに覚えておく（局面は変わらないため）。 */
const analysisCache = new Map();
export function problemAnalysis(problem) {
  if (!analysisCache.has(problem.id)) {
    analysisCache.set(problem.id, analyzeProblem({ sfen: problem.sfen, kind: problem.kind, depth: problem.depth }));
  }
  return analysisCache.get(problem.id);
}

/** 正解の手。 */
export function problemAnswers(problem) {
  return problemAnalysis(problem).verdicts.filter(({ correct }) => correct).map(({ usi }) => usi);
}

/** 手順を指し進めた局面の列。sfens[i]はline[i]を指す前の局面。 */
export function lineSfens(sfen, line) {
  const record = createGameRecord(sfen);
  const sfens = [record.position.sfen];
  for (const usi of line) {
    if (!appendUsiMove(record, usi)) break;
    sfens.push(record.position.sfen);
  }
  return sfens;
}

function moveLabels(sfen, line) {
  const sfens = lineSfens(sfen, line);
  return line.map((usi, index) => formatHintMove(usi, sfens[index]));
}

/**
 * 指した手の判定と、やこび姫の台詞。lineは盤に並べる手順（指した手と、相手の応手や詰み手順）。
 * @returns {{ correct: boolean, speech: string, line: string[] }}
 */
export function judgeProblemMove(problem, usi) {
  const verdict = problemAnalysis(problem).verdicts.find((entry) => entry.usi === usi);
  if (!verdict) return { correct: false, speech: "その手は指せないよ。駒の動きをもう一度確かめてみよう！", line: [] };
  const [played, ...rest] = moveLabels(problem.sfen, verdict.line);
  switch (verdict.reason) {
    case "mate":
      return {
        correct: true,
        speech: `正解！ ${played}で詰みだよ。${problem.explanation}`,
        line: verdict.line,
      };
    case "safe":
      return {
        correct: true,
        speech: `正解！ ${played}なら、もう詰まないよ。${problem.explanation}`,
        line: verdict.line,
      };
    case "not-check":
      return { correct: false, speech: `${played}は王手になっていないよ。相手の玉に王手をかけてみよう！`, line: verdict.line };
    case "escapes":
      return {
        correct: false,
        speech: rest.length
          ? `${played}だと、${rest[0]}と逃げられちゃう…。もう一度考えてみよう！`
          : `${played}では詰まないよ。もう一度考えてみよう！`,
        line: verdict.line,
      };
    case "mated":
      return {
        correct: false,
        speech: `${played}だと、${rest.join("、")}で詰んじゃう…。もう一度考えてみよう！`,
        line: verdict.line,
      };
    default:
      return { correct: false, speech: "ごめんね、この手は読み切れなかったよ。ほかの手を考えてみよう！", line: verdict.line };
  }
}

/** 出題の台詞。 */
export function problemQuestion(problem) {
  return `第${PROBLEMS.indexOf(problem) + 1}問 ${problem.question}`;
}

// ===== 進み具合（端末に保存） =====

export const PROBLEM_PROGRESS_KEY = "shogi-match:problem-set:v1";

export function loadProblemProgress(storage) {
  try {
    const value = JSON.parse(storage?.getItem(PROBLEM_PROGRESS_KEY) ?? "null");
    return value && typeof value.solved === "object" && value.solved ? { solved: { ...value.solved } } : { solved: {} };
  } catch {
    return { solved: {} };
  }
}

export function saveProblemProgress(storage, progress) {
  try {
    storage?.setItem(PROBLEM_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // 保存できない端末では、その場限りの記録にする。
  }
}

/** 解いた記録。一度でも一発で解けたら、その記録を残す。 */
export function recordProblemSolved(progress, id, { firstTry }) {
  const before = progress.solved[id];
  return { solved: { ...progress.solved, [id]: { firstTry: Boolean(before?.firstTry || firstTry) } } };
}
