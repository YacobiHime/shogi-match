import { appendUsiMove, createGameRecord, enumerateLegalMoves } from "../game-state";
import { pieceReachSquares } from "./reference-dex.mjs";

/**
 * やこび姫の将棋教室のステップを進める純粋な処理。
 * 画面から切り離し、正誤判定を単体テストで確かめられるようにする。
 */

export const STANDARD_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

/** 盤を操作するステップの種類。 */
export const INTERACTIVE_STEP_TYPES = Object.freeze(["move-piece", "find-move", "mate"]);

/** 手番を先手に戻したSFEN。教室では先手の駒だけを動かす。 */
export function withBlackToMove(sfen) {
  const fields = String(sfen).trim().split(/\s+/);
  fields[1] = "b";
  return fields.join(" ");
}

/** ステップの開始局面。手順で指定したステップは平手から指し進める。 */
export function tutorialStepSfen(step) {
  if (step?.sfen) return step.sfen;
  if (!step?.moves) return "";
  const record = createGameRecord(STANDARD_SFEN);
  for (const usi of step.moves) {
    if (!appendUsiMove(record, usi)) throw new Error(`${usi}を指せません`);
  }
  return record.position.sfen;
}

function toMark(usi, tone) {
  return { file: Number(usi[0]), rank: usi.charCodeAt(1) - 96, tone };
}

/** ステップの色付け。駒の動きは青い点、ねらう駒は赤、大事なマスは緑（対局中の駒の移動先と同じ色）。 */
export function tutorialStepMarks(step, sfen = tutorialStepSfen(step)) {
  const marks = new Map();
  if (step?.pieceSquare && sfen) {
    for (const usi of pieceReachSquares(sfen, step.pieceSquare)) marks.set(usi, "reach");
  }
  for (const [usi, tone] of step?.marks ?? []) marks.set(usi, tone);
  if (step?.type === "move-piece") marks.set(step.target, "key");
  return [...marks].map(([usi, tone]) => toMark(usi, tone));
}

export function createStepState(step) {
  const sfen = tutorialStepSfen(step);
  return {
    sfen,
    square: step?.type === "move-piece" ? step.from : "",
    movesUsed: 0,
    ply: 0,
    solved: false,
  };
}

function legalMoves(sfen) {
  return enumerateLegalMoves(createGameRecord(sfen).position).map(({ usi }) => usi);
}

function applyMove(sfen, usi) {
  const record = createGameRecord(sfen);
  if (!appendUsiMove(record, usi)) return null;
  return record.position.sfen;
}

/** 手番の側が詰んでいるか。 */
export function isCheckmate(sfen) {
  const position = createGameRecord(sfen).position;
  return position.checked && enumerateLegalMoves(position).length === 0;
}

function moveMatches(step, usi) {
  if (step.anyDropOf) return usi.startsWith(`${step.anyDropOf}*`);
  return (step.answers ?? []).includes(usi);
}

/**
 * 盤で指した手を判定する。
 * outcome: correct（正解）/ wrong（不正解。局面は元に戻す）/ continue（続きを指す）
 */
export function attemptTutorialMove(step, state, usi) {
  if (!legalMoves(state.sfen).includes(usi)) return { outcome: "wrong", state, reason: "illegal" };
  if (step.type === "find-move") {
    if (!moveMatches(step, usi)) return { outcome: "wrong", state, reason: "different" };
    return { outcome: "correct", state: { ...state, sfen: applyMove(state.sfen, usi), solved: true } };
  }
  if (step.type === "move-piece") {
    if (usi.slice(0, 2) !== state.square) return { outcome: "wrong", state, reason: "other-piece" };
    const destination = usi.slice(2, 4);
    const next = {
      ...state,
      sfen: withBlackToMove(applyMove(state.sfen, usi)),
      square: destination,
      movesUsed: state.movesUsed + 1,
    };
    if (destination === step.target) return { outcome: "correct", state: { ...next, solved: true } };
    if (step.maxMoves && next.movesUsed >= step.maxMoves) {
      // 手数を使い切ったら、最初の局面からやり直す。
      return { outcome: "wrong", state: createStepState(step), reason: "too-many-moves" };
    }
    return { outcome: "continue", state: next };
  }
  if (step.type === "mate") {
    const expected = step.solution[state.ply];
    const lastPlayerMove = state.ply >= step.solution.length - 1;
    const after = applyMove(state.sfen, usi);
    // 最後の一手は、詰みになる手ならどれでも正解にする。
    const accepted = lastPlayerMove ? isCheckmate(after) : usi === expected;
    if (!accepted) return { outcome: "wrong", state, reason: "different" };
    if (lastPlayerMove) return { outcome: "correct", state: { ...state, sfen: after, solved: true } };
    const reply = step.solution[state.ply + 1];
    return {
      outcome: "continue",
      reply,
      state: { ...state, sfen: applyMove(after, reply), ply: state.ply + 2 },
    };
  }
  return { outcome: "wrong", state, reason: "not-interactive" };
}

/** 選択肢のステップを判定する。 */
export function attemptTutorialChoice(step, index) {
  return index === step.answer ? "correct" : "wrong";
}

/** ヒント。1回目は大事なマス、2回目は正解の矢印を出す。 */
export function tutorialHint(step, state, level) {
  const answer = step.type === "mate"
    ? step.solution[state.ply]
    : step.type === "find-move"
      ? step.answers?.[0]
      : "";
  if (step.type === "move-piece") {
    return { marks: [toMark(step.target, "key"), toMark(state.square, "target")], arrows: [] };
  }
  if (!answer) return { marks: [], arrows: [] };
  const destination = answer.replace("+", "").slice(-2);
  return level >= 2
    ? { marks: [toMark(destination, "key")], arrows: [answer] }
    : { marks: [toMark(destination, "key")], arrows: [] };
}

/** 間違いとヒントの回数から★1〜3を決める。 */
export function lessonStars({ mistakes = 0, hints = 0 } = {}) {
  const misses = mistakes + hints;
  if (misses === 0) return 3;
  if (misses <= 2) return 2;
  return 1;
}

/**
 * 教室の対局ステップで使う固定の対局条件。プレイヤーには設定させず、レッスンごとに決める。
 * cpuLevelは強さのLv（CPU_STRENGTH_PRESETSのlevel）。閃き・待ったは-1で無制限。
 */
export const TUTORIAL_MATCH_DEFAULTS = Object.freeze({
  startType: "standard",
  playerColor: "black",
  cpuLevel: 1,
  hintLimit: 3,
  undoLimit: 3,
  attackGuide: false,
  coachLevel: "detailed",
});

/**
 * @typedef {{
 *   startType: string, playerColor: "black" | "white", cpuLevel: number,
 *   hintLimit: number, undoLimit: number, attackGuide: boolean, coachLevel: string,
 *   handicapId?: string, playerStrategy?: string, playerCastle?: string,
 *   opponentStrategy?: string, opponentCastle?: string,
 * }} TutorialMatchSettings
 * @param {Partial<TutorialMatchSettings>} [preset]
 * @returns {TutorialMatchSettings}
 */
export function tutorialMatchSettings(preset = {}) {
  return { ...TUTORIAL_MATCH_DEFAULTS, ...preset };
}

/** 終局結果をプレイヤーから見た勝ち・負け・引き分けにする。 */
export function tutorialMatchOutcome(result, playerColor = "black") {
  if (!result || result.outcome === "draw") return "draw";
  return result.outcome === `${playerColor}-win` ? "win" : "lose";
}

/** 対局ステップの★。勝てば★2、閃き・待ったを使わずに勝てば★3、負け・引き分けでも最後まで指せば★1。 */
export function matchLessonStars({ outcome, assistsUsed = 0 } = {}) {
  if (outcome === "win") return assistsUsed > 0 ? 2 : 3;
  return 1;
}

/** 対局を終えたあとのやこび姫の一言。レッスンのcommentsに勝敗ごとの一言があれば後ろに添える。 */
export function matchLessonComment({ outcome, reason } = {}, comments = {}) {
  const extra = comments?.[outcome] ?? "";
  return `${baseMatchComment(outcome, reason)}${extra}`;
}

function baseMatchComment(outcome, reason) {
  if (outcome === "win") {
    return reason === "checkmate"
      ? "相手の玉を詰ませたね、おみごと！"
      : "相手が投了したよ、勝ちだね！";
  }
  if (outcome === "draw") return "引き分けだったね。ねばり強く指せたよ！";
  return "今回は負けちゃったね。でも、負けた対局からがいちばん強くなれるんだよ。";
}
