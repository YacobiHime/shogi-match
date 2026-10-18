import { appendUsiMove, createGameRecord } from "../game-state";
import {
  judgeProblemMove,
  loadProblemProgress,
  problemAnswers,
  problemById,
  problemHint,
  recordProblemSolved,
  saveProblemProgress,
} from "./problem-set.mjs";

/**
 * 将棋教室の「問題」ステップ(type: "problem")。問題集の練習問題・詰将棋を、問題集と同じ判定(judgeProblemMove)で解く。
 * 問題集のデータと詰み探索は重いので、対局画面が読む tutorial-runner.mjs には入れず、教室の画面からだけ読む。
 *
 * ステップには problemId だけを書く。台詞を省くと、問題集の出題の台詞を使う。
 * 相手の応手や、まちがえたときの台詞も問題集と同じ。解くと、問題集の記録にも付く(1つで2つの課題を解く)。
 */

/** ステップの問題。見つからなければnull。 */
export function tutorialProblem(step) {
  return step?.type === "problem" ? problemById(step.problemId) : null;
}

/**
 * ステップの出題の台詞。問題集の出題文には「第1問」などの番号が付くので、教室では番号のない文にする。
 * 練習問題は問題の台詞、詰将棋は手数を伝える。
 */
export function tutorialProblemSpeech(step) {
  const problem = tutorialProblem(step);
  if (!problem) return step?.speech ?? "";
  if (step.speech) return step.speech;
  if (problem.kind === "line") return `後手玉を${problem.plies}手で詰ませてみよう！`;
  return problem.question;
}

/** 問題ステップの最初の状態。stepは問題集の「正解した回数」(相手の応手ごとに1つ進む)。 */
export function createProblemState(step) {
  const problem = tutorialProblem(step);
  return { sfen: problem?.sfen ?? "", square: "", movesUsed: 0, ply: 0, step: 0, solved: false };
}

function sfenAfter(sfen, line) {
  const record = createGameRecord(sfen);
  for (const usi of line) {
    if (!appendUsiMove(record, usi)) break;
  }
  return record.position.sfen;
}

/**
 * 盤で指した手を判定する。outcomeは tutorial-runner.mjs の attemptTutorialMove と同じ
 * (correct: 解けた / continue: 相手が応じて続きを指す / wrong: まちがい。局面は元に戻す)。
 * speech は問題集の台詞(なぜ詰むか、なぜ逃げられるか)。reply は相手の応手。
 * @returns {{ outcome: "correct" | "continue" | "wrong", state: any, speech: string, reply?: string, line: string[] }}
 */
export function attemptProblemMove(step, state, usi) {
  const problem = tutorialProblem(step);
  if (!problem) return { outcome: "wrong", state, speech: "", line: [] };
  const verdict = judgeProblemMove(problem, usi, state.sfen, state.step);
  if (!verdict.correct) return { outcome: "wrong", state, speech: verdict.speech, line: verdict.line };
  const movesUsed = state.movesUsed + 1;
  if (verdict.next) {
    // 相手が応じて、続きを指す。逃げる問題は、答えが決まったあとも、なぜ詰まないかを見せる続きの1手まで指す(問題集と同じ)。
    const reply = verdict.line[1];
    const next = { ...state, sfen: verdict.next.sfen, step: verdict.next.step, movesUsed, ply: state.ply + 2 };
    return { outcome: "continue", state: next, speech: verdict.speech, reply, line: verdict.line };
  }
  return {
    outcome: "correct",
    state: { ...state, sfen: sfenAfter(state.sfen, [usi]), movesUsed, solved: true },
    speech: verdict.speech,
    line: verdict.line,
  };
}

/**
 * ヒント。1回目は問題集のヒントの台詞とマス、2回目は正解の1手の矢印。
 * 正解の1手は、問題集の判定で正解になる手の1つを探す(手順で判定する問題は作意の手)。
 * @returns {{ text: string, square: string, arrow: string }}
 */
export function problemStepHint(step, state, level) {
  const problem = tutorialProblem(step);
  if (!problem) return { text: "", square: "", arrow: "" };
  const hint = problemHint(problem, state.sfen, state.step);
  const arrow = level >= 2 ? problemAnswerMove(problem, state) : "";
  return { text: hint?.text ?? "", square: hint?.square ?? "", arrow };
}

function problemAnswerMove(problem, state) {
  if (problem.kind === "line") return problem.line[2 * state.step] ?? "";
  return problemAnswers(problem, state.sfen, state.step)[0] ?? "";
}

/** 教室で解いた問題を、問題集の記録にも付ける。一発で解けたか(まちがい・ヒントなし)も渡す。 */
export function recordTutorialProblem(storage, step, { firstTry }) {
  const problem = tutorialProblem(step);
  if (!problem) return false;
  saveProblemProgress(storage, recordProblemSolved(loadProblemProgress(storage), problem.id, { firstTry }));
  return true;
}
