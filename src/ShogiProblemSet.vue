<template>
  <!-- 見た目は将棋教室と同じ枠（shogi-dex・shogi-tutorial）を使う。 -->
  <div class="shogi-dex shogi-tutorial shogi-problems" role="dialog" aria-modal="true" aria-labelledby="shogi-problems-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="goBack">
        <span aria-hidden="true">←</span> {{ view === "list" ? "タイトルへ戻る" : "問題一覧へ" }}
      </button>
      <h1 id="shogi-problems-title">{{ view === "problem" && currentProblem ? `第${problemNumber}問 ${currentProblem.title}` : PROBLEM_SET_TITLE }}</h1>
    </header>

    <!-- 問題の一覧 -->
    <section v-if="view === 'list'" class="shogi-tutorial__shelf" aria-label="問題の一覧">
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ listMessage }}</p>
      </div>
      <ol class="shogi-problems__list">
        <li v-for="(problem, index) in problems" :key="problem.id">
          <button type="button" class="shogi-tutorial__lesson" :class="{ 'shogi-tutorial__lesson--cleared': solvedRecord(problem) }" @click="openProblem(problem.id)">
            <span class="shogi-tutorial__lesson-badge" aria-hidden="true">{{ problemBadge(problem) }}</span>
            <span class="shogi-tutorial__lesson-text">
              <strong>第{{ index + 1 }}問 {{ problem.title }}</strong>
              <small>{{ problemStatus(problem) }}</small>
            </span>
          </button>
        </li>
      </ol>
    </section>

    <!-- 問題 -->
    <section v-else-if="currentProblem" class="shogi-tutorial__lesson-view" aria-label="問題">
      <div ref="stageEl" class="shogi-dex__detail shogi-tutorial__stage">
        <div class="shogi-dex__main">
          <div class="shogi-dex__board" :style="boardBoxStyle">
            <ShogiMatchBoard
              :sfen="boardSfen"
              :last-move="lastMove"
              :allow-move="phase === 'question'"
              :enable-drag-and-drop="true"
              :mobile="isNarrow"
              :layout="isNarrow ? 'portrait' : 'standard'"
              :asset-base-url="assetBaseUrl"
              :candidates="[]"
              :mark-squares="boardMarks"
              @usi-move="onBoardMove"
              @resize="onBoardResize"
            />
          </div>
        </div>
        <div ref="panelEl" class="shogi-dex__explanation-col shogi-tutorial__panel">
          <div class="shogi-dex__explanation">
            <div class="shogi-dex__speech">
              <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
              <p aria-live="polite">{{ speech }}</p>
            </div>
            <!-- 正解のあとに続きを指しているあいだも、正解の表示は残す。 -->
            <p v-if="phase === 'wrong' || answered" class="shogi-tutorial__feedback" :class="`shogi-tutorial__feedback--${phase === 'wrong' ? 'bad' : 'good'}`" role="status">
              {{ phase === "wrong" ? (answered ? "おしい！" : "ざんねん…") : "正解！" }}
            </p>
            <div class="shogi-tutorial__actions">
              <button v-if="phase === 'question' && step === 0 && !hintShown" type="button" @click="showHint">ヒント</button>
              <button v-if="phase === 'wrong'" type="button" class="shogi-tutorial__primary" @click="retryStep">もう一度</button>
              <button v-if="answered && phase !== 'wrong' && nextProblem" type="button" class="shogi-tutorial__primary" @click="openProblem(nextProblem.id)">次の問題</button>
              <button v-if="phase === 'solved'" type="button" @click="retry">もう一度解く</button>
              <button v-if="phase === 'solved' && !nextProblem" type="button" class="shogi-tutorial__primary" @click="view = 'list'">問題一覧へ</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { createMoveSoundPlayer, moveSoundForUsi } from "./core/move-sound";
import {
  PROBLEMS,
  PROBLEM_SET_TITLE,
  judgeProblemMove,
  lineSfens,
  loadProblemProgress,
  problemById,
  problemQuestion,
  recordProblemSolved,
  saveProblemProgress,
} from "./core/problem-set.mjs";

type Problem = (typeof PROBLEMS)[number];

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits(["close"]);

const problems = PROBLEMS as unknown as Problem[];
const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);
const storage = typeof localStorage === "undefined" ? null : localStorage;
const progress = ref(loadProblemProgress(storage));

const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl);
onMounted(() => moveSounds.preload());
function playMoveSound(sfen: string, usi: string) {
  const kind = moveSoundForUsi(sfen, usi);
  if (kind) moveSounds.play(kind);
}

const view = ref<"list" | "problem">("list");
const problemId = ref("");
const currentProblem = computed(() => (problemId.value ? problemById(problemId.value) as Problem | null : null));
const problemNumber = computed(() => (currentProblem.value ? problems.indexOf(currentProblem.value) + 1 : 0));
const nextProblem = computed(() => problems[problemNumber.value] ?? null);

function goBack() {
  if (view.value === "problem") {
    clearTimers();
    view.value = "list";
  } else {
    emit("close");
  }
}
// ブラウザの戻るからも、ヘッダーの戻るボタンと同じ段だけ戻す。
defineExpose({ goBack });

// ===== 一覧 =====
function solvedRecord(problem: Problem) {
  return (progress.value.solved as Record<string, { firstTry: boolean }>)[problem.id] ?? null;
}
function problemBadge(problem: Problem) {
  const record = solvedRecord(problem);
  if (!record) return "▶";
  return record.firstTry ? "★" : "✓";
}
function problemStatus(problem: Problem) {
  const record = solvedRecord(problem);
  if (!record) return problem.kind === "mate" ? "詰ませる問題" : "逃げる問題";
  return record.firstTry ? "一発で正解！" : "正解ずみ";
}
const listMessage = computed(() => {
  const solved = problems.filter((problem) => solvedRecord(problem)).length;
  if (solved === problems.length) return "全問正解！ すごいね！ 何度でも挑戦してみてね。";
  if (solved > 0) return `${problems.length}問中${solved}問クリアだよ。この調子でいこう！`;
  return "やこび姫の将棋問題集へようこそ！ 詰ませ方や逃げ方の問題を出すから、盤で指して答えてね。";
});

// ===== 問題 =====
const boardSfen = ref("");
const lastMove = ref("");
// 自分の手が2回以上ある問題で、何回正解したかと、次の手を指す局面。
const step = ref(0);
const stepSfen = ref("");
const stepLastMove = ref("");
const phase = ref<"question" | "waiting" | "wrong" | "solved">("question");
const speech = ref("");
const mistakes = ref(0);
const hintShown = ref(false);
// 問題に正解したか。逃げる問題では、正解のあとも続きの1手を指す。
const answered = ref(false);

let timers: ReturnType<typeof setTimeout>[] = [];
function clearTimers() {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
}
onBeforeUnmount(clearTimers);

function resetBoard() {
  clearTimers();
  const problem = currentProblem.value;
  if (!problem) return;
  boardSfen.value = problem.sfen;
  stepSfen.value = problem.sfen;
  step.value = 0;
  stepLastMove.value = "";
  lastMove.value = "";
  answered.value = false;
  phase.value = "question";
  speech.value = problemQuestion(problem);
}
function openProblem(id: string) {
  problemId.value = id;
  mistakes.value = 0;
  hintShown.value = false;
  view.value = "problem";
  resetBoard();
}
function retry() {
  resetBoard();
}
/** まちがえたあとは、まちがえた手を指す前の局面からやり直す。 */
function retryStep() {
  const problem = currentProblem.value;
  if (!problem) return;
  if (step.value === 0) {
    resetBoard();
    return;
  }
  clearTimers();
  boardSfen.value = stepSfen.value;
  lastMove.value = stepLastMove.value;
  phase.value = "question";
  speech.value = answered.value
    ? "相手の王手のあとから、もう一度逃げ方を考えてみよう！"
    : "相手の応手のあとから、もう一度考えてみよう！";
}
function showHint() {
  const problem = currentProblem.value;
  if (!problem) return;
  hintShown.value = true;
  speech.value = problem.hint;
}

const boardMarks = computed(() => {
  // ヒントのマスは1手目のためのものなので、2手目からは出さない。
  const square = hintShown.value && phase.value === "question" && step.value === 0 ? currentProblem.value?.hintSquare : "";
  return square ? [{ file: Number(square[0]), rank: square.charCodeAt(1) - 96, tone: "key" as const }] : [];
});

/** 指した手と、相手の応手（逃げ方や詰み手順）を、少しずつ盤に並べる。 */
function showLine(line: string[]) {
  const sfens = lineSfens(stepSfen.value, line);
  line.forEach((usi, index) => {
    const show = () => {
      boardSfen.value = sfens[index + 1] ?? boardSfen.value;
      lastMove.value = usi;
      playMoveSound(sfens[index], usi);
    };
    if (index === 0) show();
    else timers.push(setTimeout(show, 700 * index));
  });
}

function onBoardMove(usi: string) {
  const problem = currentProblem.value;
  if (!problem || phase.value !== "question") return;
  const result = judgeProblemMove(problem, usi, stepSfen.value, step.value);
  if (!result.line.length) {
    speech.value = result.speech;
    return;
  }
  showLine(result.line);
  speech.value = result.speech;
  if (result.solved && !answered.value) {
    answered.value = true;
    progress.value = recordProblemSolved(progress.value, problem.id, { firstTry: mistakes.value === 0 && !hintShown.value });
    saveProblemProgress(storage, progress.value);
  }
  if (result.next) {
    // 正解でまだ続くときは、相手の応手を並べ終えてから次の手を指せるようにする。
    phase.value = "waiting";
    step.value = result.next.step;
    stepSfen.value = result.next.sfen;
    stepLastMove.value = result.line[result.line.length - 1];
    timers.push(setTimeout(() => { phase.value = "question"; }, 700 * (result.line.length - 1)));
  } else if (result.correct) {
    phase.value = "solved";
  } else {
    mistakes.value += 1;
    phase.value = "wrong";
  }
}

// 狭い画面では縦長レイアウトの盤に切り替える（将棋教室と同じ基準）。
const narrowMediaQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(max-width: 56rem)")
  : null;
const isNarrow = ref(Boolean(narrowMediaQuery?.matches));
function onNarrowChange(event: MediaQueryListEvent) { isNarrow.value = event.matches; }
onMounted(() => narrowMediaQuery?.addEventListener("change", onNarrowChange));
onBeforeUnmount(() => narrowMediaQuery?.removeEventListener("change", onNarrowChange));

/*
 * 盤の枠を、描かれる盤と同じ大きさにする（将棋教室と同じ方法）。
 * 台詞欄の高さを引いた残りに、盤の縦横比で収める。
 */
const stageEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const boardBoxStyle = ref<Record<string, string>>({});
const boardAspect = ref(1471 / 959);
function onBoardResize({ width, height }: { width: number; height: number }) {
  if (width > 0 && height > 0 && Math.abs(width / height - boardAspect.value) > 0.005) boardAspect.value = width / height;
}
function layoutBoardBox() {
  const stage = stageEl.value;
  if (!stage) return;
  const style = getComputedStyle(stage);
  const innerWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const innerHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const panelHeight = panelEl.value?.offsetHeight ?? 0;
  const gap = parseFloat(style.rowGap) || 0;
  const minHeight = Math.min(320, window.innerHeight * 0.42);
  const availableHeight = Math.max(minHeight, innerHeight - panelHeight - gap);
  const width = Math.max(1, Math.floor(Math.min(innerWidth, availableHeight * boardAspect.value)));
  const height = Math.max(1, Math.floor(width / boardAspect.value));
  boardBoxStyle.value = { width: `${width}px`, height: `${height}px` };
}
const boardBoxObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layoutBoardBox()) : null;
watch([stageEl, panelEl], ([stage, panel]) => {
  boardBoxObserver?.disconnect();
  if (stage) boardBoxObserver?.observe(stage);
  if (panel) boardBoxObserver?.observe(panel);
  layoutBoardBox();
});
watch(boardAspect, layoutBoardBox);
onBeforeUnmount(() => boardBoxObserver?.disconnect());
</script>

<style>
.shogi-game .shogi-problems__list {
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
