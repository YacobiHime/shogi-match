import { computed, ref, watch, type Ref } from "vue";
import {
  buildGuidedReview,
  guidedReviewSummary,
  GUIDED_REVIEW_SPEEDS,
  guidedReviewDelay,
  nextGuidedReviewSpeed,
  normalizeGuidedReviewSpeed,
} from "../../core/guided-review.mjs";
import { formatHintMove } from "../../core/match-assists.mjs";
import { judgeMateStep } from "../../core/problem-solver";
import { formatPrincipalVariation } from "../../core/reference-kifu-analysis.mjs";
import {
  appendReviewMove,
  moveReviewCursor,
  previewReviewLine,
  visibleReviewMoves,
} from "../../core/review-navigation.mjs";
import type { AnalysisPoint } from "./analysisEngines";

export type GuidedReviewQuiz = {
  type: string;
  ply: number;
  question: string;
  bestMove?: string;
  bestLine: string[];
  playedMove?: string;
  mateLength: number;
  /** タダの駒を取る問題で、取る駒の升。この升の駒をタダで取る手は、最善手でなくても正解にする。 */
  targetSquare?: string;
  /** targetSquareの駒をタダで取れる駒の位置。ここから取る手だけを正解にする。 */
  targetFrom?: string[];
};
export type GuidedReviewScript = {
  steps: Map<number, { comment?: string; pause?: boolean; quiz?: GuidedReviewQuiz }>;
  lastPly: number;
  quizCount: number;
};
/**
 * 詰みの問題の途中経過。詰むまで盤で指させ、相手の応手はやこび姫が指す。
 * sfenは次にプレイヤーが指す局面、remainingはそこからの詰みまでの手数、onLineは解析の詰み手順どおりに進んでいるか。
 */
export type GuidedMateProgress = {
  sfen: string;
  remaining: number;
  played: string[];
  onLine: boolean;
};
export type GuidedReviewState = {
  phase: "waiting" | "playing" | "paused" | "quiz" | "answer" | "done";
  cursor: number;
  text: string;
  moveLabel: string;
  quiz: GuidedReviewQuiz | null;
  mate?: GuidedMateProgress | null;
  solved: number;
};

type GuidedReviewDeps = {
  storage: () => Storage | null;
  reviewMode: Ref<boolean>;
  reviewNavigation: Ref<any>;
  analysisPoints: Ref<AnalysisPoint[]>;
  analysisOpen: Ref<boolean>;
  analysisMenuOpen: Ref<boolean>;
  analysisRunning: Ref<boolean>;
  analyzedLevel: Ref<number>;
  matchInitialSfen: Ref<string>;
  currentSfen: Ref<string>;
  hintCandidates: Ref<{ usi: string; score?: number }[]>;
  hintText: Ref<string>;
  guideText: Ref<string>;
  /** 詰みの問題で、相手の応手を待っている間は盤を動かせない。対局画面のcanMoveが見る。 */
  guidedMateReplyPending: Ref<boolean>;
  playerColor: () => "black" | "white";
  winnerColor: () => "black" | "white" | null;
  enterAnalysisMode: (message: string) => void;
  initializeEngine: () => Promise<void>;
  runKifuAnalysis: () => Promise<void>;
  rebuildRecord: (moves: string[]) => void;
  applyMove: (usi: string, actor: "player" | "cpu") => unknown;
  /** 振り返りで局面を動かしたとき、走っている検討の助言を捨てる。 */
  invalidateReviewCoach: () => void;
};

/*
 * 終局後の「対局を振り返る」。棋譜解析の結果から、開始局面から1手ずつ自動で並べ、
 * 敗着や見逃した詰みの前で止まって考えさせる。台本はcore/guided-review.mjsが作る。
 */
export function useGuidedReview(deps: GuidedReviewDeps) {
  const {
    storage,
    reviewMode,
    reviewNavigation,
    analysisPoints,
    analysisOpen,
    analysisMenuOpen,
    analysisRunning,
    analyzedLevel,
    matchInitialSfen,
    currentSfen,
    hintCandidates,
    hintText,
    guideText,
    guidedMateReplyPending,
    playerColor,
    winnerColor,
    enterAnalysisMode,
    initializeEngine,
    runKifuAnalysis,
    rebuildRecord,
    applyMove,
    invalidateReviewCoach,
  } = deps;

  const guidedReview = ref<GuidedReviewState | null>(null);
  let guidedReviewScript: GuidedReviewScript | null = null;
  let guidedReviewTimer: ReturnType<typeof setTimeout> | undefined;
  /** 振り返りの速さ。端末ごとの好みとして保存する。 */
  const GUIDED_REVIEW_SPEED_KEY = "shogi-match-guided-review-speed";
  function loadGuidedReviewSpeed() {
    try {
      return normalizeGuidedReviewSpeed(storage()?.getItem(GUIDED_REVIEW_SPEED_KEY));
    } catch {
      return normalizeGuidedReviewSpeed(null);
    }
  }
  const guidedReviewSpeed = ref(loadGuidedReviewSpeed());
  const guidedReviewSpeedLabel = computed(() => (
    GUIDED_REVIEW_SPEEDS.find((speed) => speed.id === guidedReviewSpeed.value)?.label ?? ""
  ));
  /** 速さを次の段階に切り替える。進んでいる途中なら、新しい速さで次の手を待ち直す。 */
  function cycleGuidedReviewSpeed() {
    guidedReviewSpeed.value = nextGuidedReviewSpeed(guidedReviewSpeed.value);
    try {
      storage()?.setItem(GUIDED_REVIEW_SPEED_KEY, guidedReviewSpeed.value);
    } catch {
      // 保存できない環境では、この画面の間だけ使う。
    }
    const state = guidedReview.value;
    if (state?.phase === "playing" && guidedReviewTimer) {
      scheduleGuidedStep(guidedReviewDelay(Boolean(state.text), guidedReviewSpeed.value));
    }
  }
  const guidedAnsweredQuizzes = new Set<number>();

  function clearGuidedReviewTimer() {
    if (guidedReviewTimer) clearTimeout(guidedReviewTimer);
    guidedReviewTimer = undefined;
    guidedMateReplyPending.value = false;
  }

  /** 振り返りで本筋の局面へ移る。助言の探索は走らせない。 */
  function guidedGoTo(ply: number) {
    invalidateReviewCoach();
    const mainLine = reviewNavigation.value.mainLine;
    const cursor = Math.max(0, Math.min(mainLine.length, Math.trunc(ply)));
    reviewNavigation.value = { ...reviewNavigation.value, line: [...mainLine], cursor, branch: false };
    rebuildRecord(mainLine.slice(0, cursor));
    hintCandidates.value = [];
    hintText.value = "";
    // 振り返りの一言は振り返り欄で話すので、対局中の助言は残さない。
    guideText.value = "";
  }

  function guidedMoveLabel(ply: number) {
    if (ply < 1) return "";
    return analysisPoints.value.find((point) => point.ply === ply)?.label ?? `${ply}手目`;
  }

  function guidedFirstMover(): "black" | "white" {
    const fields = matchInitialSfen.value.replace(/^sfen\s+/, "").trim().split(/\s+/);
    return fields[1] === "w" ? "white" : "black";
  }

  async function startGuidedReview() {
    clearGuidedReviewTimer();
    guidedAnsweredQuizzes.clear();
    guidedReviewScript = null;
    analysisMenuOpen.value = false;
    if (!reviewMode.value) enterAnalysisMode("対局を一緒に振り返ろう！");
    analysisOpen.value = true;
    guidedReview.value = {
      phase: "waiting",
      cursor: 0,
      text: "棋譜を解析しているよ。終わったら振り返りを始めるね！",
      moveLabel: "",
      quiz: null,
      solved: 0,
    };
    await initializeEngine();
    if (!guidedReview.value) return;
    if (analyzedLevel.value >= 0 && !analysisRunning.value) beginGuidedReview();
    else if (!analysisRunning.value) await runKifuAnalysis();
  }

  // 解析が終わるのを待っていた振り返りを始める。
  watch(analysisRunning, (running) => {
    const state = guidedReview.value;
    if (running || state?.phase !== "waiting") return;
    if (analyzedLevel.value >= 0) beginGuidedReview();
    else guidedReview.value = { ...state, phase: "done", text: "解析が終わらなかったから、振り返りを始められなかったよ。" };
  });

  function beginGuidedReview() {
    const state = guidedReview.value;
    if (!state) return;
    const firstMover = guidedFirstMover();
    guidedReviewScript = buildGuidedReview(analysisPoints.value, {
      playerColor: playerColor(),
      winner: winnerColor(),
      moves: [...reviewNavigation.value.mainLine],
      moverForPly: (ply: number) => ((ply % 2 === 1) === (firstMover === "black") ? "black" : "white"),
      initialSfen: matchInitialSfen.value,
    }) as GuidedReviewScript;
    guidedGoTo(0);
    guidedReview.value = {
      ...state,
      phase: "playing",
      cursor: 0,
      moveLabel: "",
      quiz: null,
      text: "対局を最初から振り返るよ！大事な場面では止まるから、一緒に考えよう。",
    };
    scheduleGuidedStep(guidedReviewDelay(true, guidedReviewSpeed.value));
  }

  function scheduleGuidedStep(delay = guidedReviewDelay(false, guidedReviewSpeed.value)) {
    clearGuidedReviewTimer();
    guidedReviewTimer = setTimeout(advanceGuidedReview, delay);
  }

  /** 今の局面に問題があれば出す。なければ1手進める。 */
  function advanceGuidedReview() {
    clearGuidedReviewTimer();
    const state = guidedReview.value;
    const script = guidedReviewScript;
    if (!state || !script || !["playing", "answer"].includes(state.phase)) return;
    const quiz = script.steps.get(state.cursor)?.quiz;
    if (quiz && !guidedAnsweredQuizzes.has(quiz.ply)) {
      const mate = quiz.type === "mate" && quiz.mateLength > 0
        ? { sfen: currentSfen.value, remaining: quiz.mateLength, played: [], onLine: true }
        : null;
      const prompt = mate ? "盤で指してね。相手の手はわたしが指すよ。" : "盤で指してみてね。";
      guidedReview.value = { ...state, phase: "quiz", quiz, mate, text: `${quiz.question}${prompt}` };
      return;
    }
    const next = state.cursor + 1;
    if (next > reviewNavigation.value.mainLine.length) {
      guidedReview.value = {
        ...state,
        phase: "done",
        quiz: null,
        text: guidedReviewSummary({ quizCount: script.quizCount, solved: state.solved }),
      };
      return;
    }
    guidedGoTo(next);
    const step = script.steps.get(next);
    guidedReview.value = {
      ...state,
      phase: step?.pause ? "paused" : "playing",
      cursor: next,
      moveLabel: guidedMoveLabel(next),
      quiz: null,
      text: step?.comment ?? "",
    };
    if (!step?.pause) scheduleGuidedStep(guidedReviewDelay(Boolean(step?.comment), guidedReviewSpeed.value));
  }

  function toggleGuidedReviewPause() {
    const state = guidedReview.value;
    if (!state) return;
    if (state.phase === "playing") {
      clearGuidedReviewTimer();
      guidedReview.value = { ...state, phase: "paused" };
    } else if (state.phase === "paused") {
      // 一時停止中に盤を動かしていたら、本筋の局面へ戻してから続ける。
      guidedGoTo(state.cursor);
      guidedReview.value = { ...state, phase: "playing" };
      advanceGuidedReview();
    }
  }

  /** 次へ。止まっている局面や問題を飛ばして進める。 */
  function nextGuidedReviewStep() {
    const state = guidedReview.value;
    if (!state) return;
    if (state.quiz) guidedAnsweredQuizzes.add(state.quiz.ply);
    guidedGoTo(state.cursor);
    guidedReview.value = { ...state, phase: "playing", quiz: null };
    advanceGuidedReview();
  }

  function revealGuidedReviewAnswer(prefix = "") {
    const state = guidedReview.value;
    const quiz = state?.quiz;
    if (!state || !quiz) return;
    clearGuidedReviewTimer();
    guidedAnsweredQuizzes.add(quiz.ply);
    guidedGoTo(state.cursor);
    if (quiz.type === "mate" && quiz.bestLine.length > 1) {
      showGuidedMateLine(state, quiz, prefix);
      return;
    }
    const best = quiz.bestMove;
    const bestLabel = best ? formatHintMove(best, currentSfen.value) : "";
    const playedLabel = quiz.playedMove ? formatHintMove(quiz.playedMove, currentSfen.value) : "";
    if (best) hintCandidates.value = [{ usi: best }];
    const answer = !bestLabel
      ? "この局面の最善手は分からなかったよ。"
      : quiz.type === "mate"
        ? `${bestLabel}から詰ませられたよ。`
        : `一番いい手は${bestLabel}だよ。`;
    const played = playedLabel && quiz.playedMove !== best ? `実戦は${playedLabel}だったね。` : "";
    guidedReview.value = { ...state, phase: "answer", text: `${prefix}${answer}${played}` };
  }

  /** 詰みの答え。解析の詰み手順を問題の局面から盤に並べ、1手ずつ自動で進める。 */
  function showGuidedMateLine(state: GuidedReviewState, quiz: GuidedReviewQuiz, prefix: string) {
    const sfen = currentSfen.value;
    let labels = "";
    try {
      labels = formatPrincipalVariation(quiz.bestLine, sfen, quiz.bestLine.length);
    } catch { /* 表記できない手順は並べるだけにする */ }
    const played = quiz.playedMove ? formatHintMove(quiz.playedMove, sfen) : "";
    const playedText = played && quiz.playedMove !== quiz.bestMove ? `実戦は${played}だったね。` : "";
    guidedReview.value = {
      ...state,
      phase: "answer",
      mate: null,
      text: `${prefix}詰み手順は${labels || "盤のとおり"}だよ。盤に並べるね。${playedText}`,
    };
    const start = reviewNavigation.value.cursor;
    const placed = previewReviewLine(reviewNavigation.value, quiz.bestLine);
    reviewNavigation.value = { ...placed, cursor: start };
    const end = start + quiz.bestLine.length;
    const stepLine = () => {
      guidedReviewTimer = undefined;
      const current = guidedReview.value;
      if (current?.phase !== "answer" || current.quiz !== quiz || reviewNavigation.value.cursor >= end) return;
      reviewNavigation.value = moveReviewCursor(reviewNavigation.value, 1);
      rebuildRecord(visibleReviewMoves(reviewNavigation.value));
      if (reviewNavigation.value.cursor < end) {
        guidedReviewTimer = setTimeout(stepLine, guidedReviewDelay(false, guidedReviewSpeed.value));
      }
    };
    guidedReviewTimer = setTimeout(stepLine, guidedReviewDelay(false, guidedReviewSpeed.value));
  }

  /**
   * 詰みの問題で指した手を判定する。詰みが続くなら相手の応手を指して続けさせ、詰んだら正解にする。
   * 解析の詰み手順どおりの手は、JavaScriptの探索で読み切れなくても（王手でない手を含む詰みなど）正解として進める。
   */
  function checkGuidedMateMove(state: GuidedReviewState, quiz: GuidedReviewQuiz, mate: GuidedMateProgress, usi: string) {
    const index = mate.played.length;
    const onLine = mate.onLine && quiz.bestLine[index] === usi;
    const verdict = judgeMateStep(mate.sfen, usi, mate.remaining);
    if (verdict.status === "mated") {
      guidedAnsweredQuizzes.add(quiz.ply);
      guidedReview.value = {
        ...state,
        phase: "answer",
        mate: null,
        solved: state.solved + 1,
        text: index === 0 ? "正解！詰んだね！" : "正解！最後まで詰ませたね！",
      };
      return;
    }
    const lineReply = onLine ? quiz.bestLine[index + 1] : undefined;
    const reply = lineReply ?? (verdict.status === "continue" ? verdict.reply : undefined);
    if (!reply) {
      const reason = verdict.status === "unknown"
        ? "その手で詰むかは、読み切れなかったよ。"
        : verdict.status === "not-check"
          ? "王手をかけないと、逃げる時間を与えちゃうね。"
          : "その手だと逃げられちゃうね。";
      revealGuidedReviewAnswer(`おしい！${reason}`);
      return;
    }
    const remaining = verdict.status === "continue" && !lineReply
      ? verdict.plies - 1
      : Math.max(1, mate.remaining - 2);
    guidedReview.value = { ...state, text: "いいね！相手はどう逃げるかな…" };
    guidedMateReplyPending.value = true;
    guidedReviewTimer = setTimeout(() => {
      guidedReviewTimer = undefined;
      guidedMateReplyPending.value = false;
      const current = guidedReview.value;
      if (current?.phase !== "quiz" || current.quiz !== quiz) return;
      const replySfen = currentSfen.value;
      if (!applyMove(reply, "cpu")) {
        revealGuidedReviewAnswer();
        return;
      }
      reviewNavigation.value = appendReviewMove(reviewNavigation.value, reply);
      guidedReview.value = {
        ...current,
        mate: { sfen: currentSfen.value, remaining, played: [...mate.played, usi, reply], onLine: Boolean(lineReply) },
        text: `相手は${formatHintMove(reply, replySfen)}。続けて詰ませよう！`,
      };
    }, guidedReviewDelay(false, guidedReviewSpeed.value));
  }

  /** 問題の局面で盤に指した手を答え合わせする。 */
  function checkGuidedReviewMove(usi: string) {
    const state = guidedReview.value;
    const quiz = state?.quiz;
    if (!state || !quiz || state.phase !== "quiz" || guidedMateReplyPending.value) return;
    if (state.mate) {
      // 詰み探索は少し時間がかかるので、指した手を盤に描いてから判定する。
      const mate = state.mate;
      guidedMateReplyPending.value = true;
      guidedReviewTimer = setTimeout(() => {
        guidedReviewTimer = undefined;
        guidedMateReplyPending.value = false;
        if (guidedReview.value !== state) return;
        checkGuidedMateMove(state, quiz, mate, usi);
      }, 30);
      return;
    }
    const tookTarget = Boolean(quiz.targetSquare) && usi[1] !== "*" && usi.slice(2, 4) === quiz.targetSquare
      && Boolean(quiz.targetFrom?.includes(usi.slice(0, 2)));
    if (usi === quiz.bestMove || tookTarget) {
      guidedReview.value = { ...state, solved: state.solved + 1 };
      revealGuidedReviewAnswer("正解！");
    } else {
      revealGuidedReviewAnswer("おしい！");
    }
  }

  function stopGuidedReview() {
    clearGuidedReviewTimer();
    guidedReview.value = null;
    guidedReviewScript = null;
    hintCandidates.value = [];
  }

  return {
    guidedReview,
    guidedReviewSpeedLabel,
    cycleGuidedReviewSpeed,
    clearGuidedReviewTimer,
    startGuidedReview,
    toggleGuidedReviewPause,
    nextGuidedReviewStep,
    revealGuidedReviewAnswer,
    checkGuidedReviewMove,
    stopGuidedReview,
  };
}
