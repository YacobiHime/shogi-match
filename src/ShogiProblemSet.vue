<template>
  <!-- 見た目は将棋教室と同じ枠（shogi-dex・shogi-tutorial）を使う。 -->
  <div class="shogi-dex shogi-tutorial shogi-problems" role="dialog" aria-modal="true" aria-labelledby="shogi-problems-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="goBack">
        <span aria-hidden="true">←</span> {{ view === "list" ? "タイトルへ戻る" : "問題一覧へ" }}
      </button>
      <h1 id="shogi-problems-title">{{ view === "problem" && currentProblem ? problemHeading(currentProblem) : PROBLEM_SET_TITLE }}</h1>
    </header>

    <!-- 問題の一覧 -->
    <section v-if="view === 'list'" class="shogi-tutorial__shelf" aria-label="問題の一覧">
      <!-- 見た目は定跡図鑑のタブ（shogi-dex__modes）を使う。 -->
      <div class="shogi-dex__modes" role="tablist" aria-label="問題の種類">
        <button
          v-for="item in PROBLEM_SECTIONS"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="section === item.id"
          :class="{ 'shogi-dex__mode--active': section === item.id }"
          @click="section = item.id"
        >
          <span class="shogi-dex__mode-label">{{ item.label }}</span>
        </button>
      </div>
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ listMessage }}</p>
      </div>
      <template v-for="group in currentSection.groups" :key="group.label">
        <h2 v-if="group.label" class="shogi-problems__group-title">{{ group.label }}</h2>
        <ol class="shogi-problems__list">
          <li v-for="problem in group.problems" :key="problem.id">
            <button type="button" class="shogi-tutorial__lesson" :class="{ 'shogi-tutorial__lesson--cleared': solvedRecord(problem) }" @click="openProblem(problem.id)">
              <span class="shogi-tutorial__lesson-badge" aria-hidden="true">{{ problemBadge(problem) }}</span>
              <span class="shogi-tutorial__lesson-text">
                <strong>{{ problemHeading(problem) }}</strong>
                <small>{{ problemStatus(problem) }}</small>
              </span>
            </button>
          </li>
        </ol>
      </template>
      <p v-if="section === 'tsume'" class="shogi-problems__credit">
        出典: {{ TSUME_PROBLEM_SOURCE.author }}「<a :href="TSUME_PROBLEM_SOURCE.url" target="_blank" rel="noopener">{{ TSUME_PROBLEM_SOURCE.title }}</a>」（{{ TSUME_PROBLEM_SOURCE.license }}）。機械で作られ、詰みを確かめた問題から選んでいます。
      </p>
      <p v-if="section === 'zukou'" class="shogi-problems__credit">
        出典: {{ ZUKOU_SOURCE.author }}『{{ ZUKOU_SOURCE.title }}』（1755年）。データは<a :href="ZUKOU_SOURCE.dataUrl" target="_blank" rel="noopener">Open Tsume</a>（{{ ZUKOU_SOURCE.license }}）。作者の手順で判定するため、別の手でも詰む場合があります。
      </p>
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
            <p v-if="phase !== 'answer' && (phase === 'wrong' || answered)" class="shogi-tutorial__feedback" :class="`shogi-tutorial__feedback--${phase === 'wrong' ? 'bad' : 'good'}`" role="status">
              {{ phase === "wrong" ? (answered ? "おしい！" : "ざんねん…") : "正解！" }}
            </p>
            <!-- 答えを見る: 手順を1手ずつ盤に並べる（詰め将棋・図巧）。 -->
            <div v-if="phase === 'answer'" class="shogi-tutorial__actions shogi-problems__answer-controls">
              <div class="shogi-problems__answer-steps">
                <button type="button" :disabled="answerIndex === 0" aria-label="最初へ" @click="showAnswerAt(0)">⏮</button>
                <button type="button" :disabled="answerIndex === 0" aria-label="1手戻る" @click="showAnswerAt(answerIndex - 1)">◀</button>
                <button type="button" :disabled="answerIndex === answerSfens.length - 1" aria-label="1手進む" @click="showAnswerAt(answerIndex + 1)">▶</button>
                <button type="button" :disabled="answerIndex === answerSfens.length - 1" aria-label="最後へ" @click="showAnswerAt(answerSfens.length - 1)">⏭</button>
              </div>
              <button type="button" class="shogi-tutorial__primary" @click="retry">解き直す</button>
            </div>
            <div v-else class="shogi-tutorial__actions">
              <button v-if="phase === 'question' && currentHint && hintStep !== step" type="button" @click="showHint">ヒント</button>
              <button v-if="currentProblem.kind === 'line' && phase !== 'waiting'" type="button" @click="openAnswer">答えを見る</button>
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
  PROBLEM_SECTIONS,
  PROBLEM_SET_TITLE,
  judgeProblemMove,
  lineSfens,
  loadProblemProgress,
  problemById,
  problemHint,
  problemQuestion,
  problemSectionId,
  recordProblemSolved,
  saveProblemProgress,
  sectionProblems,
} from "./core/problem-set.mjs";
import { formatHintMove } from "./core/match-assists.mjs";
import { TSUME_PROBLEM_SOURCE } from "./data/tsume-problems.mjs";
import { ZUKOU_SOURCE } from "./data/zukou-problems.mjs";

/** 練習問題（探索で判定）と、詰め将棋・図巧（手順で判定、kind: "line"）の共通の形。 */
type Problem = {
  id: string;
  kind: string;
  title: string;
  sfen: string;
  source?: string;
  plies?: number;
  number?: number;
  line?: readonly string[];
};
type SectionId = (typeof PROBLEM_SECTIONS)[number]["id"];

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
});
const emit = defineEmits(["close"]);

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
const section = ref<SectionId>("practice");
const currentSection = computed(() => PROBLEM_SECTIONS.find(({ id }) => id === section.value) ?? PROBLEM_SECTIONS[0]);
const problemId = ref("");
const currentProblem = computed(() => (problemId.value ? problemById(problemId.value) as Problem | null : null));
// 「次の問題」は、同じ区分の一覧で次に並ぶ問題。
const nextProblem = computed(() => {
  const problem = currentProblem.value;
  if (!problem) return null;
  const list = sectionProblems(problemSectionId(problem)) as Problem[];
  return list[list.findIndex(({ id }) => id === problem.id) + 1] ?? null;
});

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
/** 一覧と見出しの問題名。練習問題だけ通し番号を付ける（詰め将棋・図巧は名前に番号を含む）。 */
function problemHeading(problem: Problem) {
  return problem.kind === "line" ? problem.title : `第${PROBLEMS.indexOf(problem as never) + 1}問 ${problem.title}`;
}
function problemStatus(problem: Problem) {
  const record = solvedRecord(problem);
  if (record) return record.firstTry ? "一発で正解！" : "正解ずみ";
  if (problem.kind === "line") return problem.source === "zukou" ? "作者の手順に沿って解く" : "詰ませる問題";
  return problem.kind === "mate" ? "詰ませる問題" : "逃げる問題";
}
const SECTION_INTROS: Record<SectionId, string> = {
  practice: "やこび姫の将棋問題集へようこそ！ 詰ませ方や逃げ方の問題を出すから、盤で指して答えてね。",
  tsume: "実戦でよく出る形の詰め将棋だよ。1手詰めから7手詰めまで、手数ごとに30問あるよ。",
  zukou: "江戸時代の名作、伊藤看寿の『将棋図巧』全100問だよ。とっても難しいから、「答えを見る」で手順を眺めるだけでも楽しいよ。",
};
const listMessage = computed(() => {
  const list = sectionProblems(section.value) as Problem[];
  const solved = list.filter((problem) => solvedRecord(problem)).length;
  if (solved === list.length) return "全問正解！ すごいね！ 何度でも挑戦してみてね。";
  if (solved > 0) return `${list.length}問中${solved}問クリアだよ。この調子でいこう！`;
  return SECTION_INTROS[section.value];
});

// ===== 問題 =====
const boardSfen = ref("");
const lastMove = ref("");
// 自分の手が2回以上ある問題で、何回正解したかと、次の手を指す局面。
const step = ref(0);
const stepSfen = ref("");
const stepLastMove = ref("");
const phase = ref<"question" | "waiting" | "wrong" | "solved" | "answer">("question");
const speech = ref("");
const mistakes = ref(0);
// ヒントを使ったか（一発正解の記録に使う）と、ヒントを出している手番。
const hintShown = ref(false);
const hintStep = ref<number | null>(null);
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
  hintStep.value = null;
  phase.value = "question";
  speech.value = problemQuestion(problem);
}
function openProblem(id: string) {
  problemId.value = id;
  const problem = problemById(id) as Problem | null;
  if (problem) section.value = problemSectionId(problem) as SectionId;
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
// 練習問題のヒントは1手目だけ。詰め将棋・図巧は、どの手番でも次に動かす駒を教える。
const currentHint = computed(() => (currentProblem.value ? problemHint(currentProblem.value, stepSfen.value, step.value) : null));
function showHint() {
  const hint = currentHint.value;
  if (!hint) return;
  hintShown.value = true;
  hintStep.value = step.value;
  speech.value = hint.text;
}

const boardMarks = computed(() => {
  const square = hintStep.value === step.value && phase.value === "question" ? currentHint.value?.square : "";
  return square ? [{ file: Number(square[0]), rank: square.charCodeAt(1) - 96, tone: "key" as const }] : [];
});

// ===== 答えを見る（詰め将棋・図巧） =====
const answerIndex = ref(0);
const answerSfens = computed(() => {
  const problem = currentProblem.value;
  return problem?.line ? lineSfens(problem.sfen, [...problem.line]) : [];
});
function showAnswerAt(index: number) {
  const problem = currentProblem.value;
  if (!problem?.line) return;
  const bounded = Math.max(0, Math.min(index, answerSfens.value.length - 1));
  answerIndex.value = bounded;
  boardSfen.value = answerSfens.value[bounded];
  const usi = bounded > 0 ? problem.line[bounded - 1] : "";
  lastMove.value = usi;
  const owner = problem.source === "zukou" ? "作者の手順" : "正解の手順";
  speech.value = bounded === 0
    ? `${owner}を1手ずつ見ていこう。全部で${problem.plies}手だよ。`
    : `${owner} ${bounded}/${problem.plies}手目: ${formatHintMove(usi, answerSfens.value[bounded - 1])}${bounded === problem.plies ? "で詰み！" : ""}`;
  if (usi) playMoveSound(answerSfens.value[bounded - 1], usi);
}
function openAnswer() {
  clearTimers();
  // 答えを見たら、一発正解の記録にはしない。
  hintShown.value = true;
  phase.value = "answer";
  showAnswerAt(0);
}

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
.shogi-game .shogi-problems__group-title {
  margin: 0.4rem 0 0;
  color: #f1a54c;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
}
.shogi-game .shogi-problems__credit {
  margin: 0.4rem 0 0;
  color: #cfd8de;
  font-size: 0.75rem;
  line-height: 1.6;
}
.shogi-game .shogi-problems__credit a {
  color: #f1c68a;
}
/* 答えの手順を送る4つのボタンは、狭い画面でも1行に並べ、その下に「解き直す」を置く。 */
.shogi-game .shogi-problems__answer-controls {
  flex-direction: column;
  align-items: stretch;
}
/* 共通の flex: 1 1 6em が縦並びでは高さに効くため、打ち消す。 */
.shogi-game .shogi-problems .shogi-problems__answer-controls > button {
  flex: none;
}
.shogi-game .shogi-problems__answer-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}
/* 「詰将棋図巧」のタブがスマホ幅で折り返さないようにする。 */
.shogi-game .shogi-problems .shogi-dex__modes button {
  white-space: nowrap;
  letter-spacing: 0;
}
</style>
