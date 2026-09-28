<template>
  <div class="shogi-dex shogi-tutorial" role="dialog" aria-modal="true" aria-labelledby="shogi-tutorial-title">
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" @click="goBack">
        <span aria-hidden="true">←</span> {{ backLabel }}
      </button>
      <h1 id="shogi-tutorial-title">{{ headerTitle }}</h1>
    </header>

    <!-- 本棚：巻を選ぶ -->
    <section v-if="view === 'shelf'" class="shogi-tutorial__shelf" aria-label="巻の一覧">
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ shelfMessage }}</p>
      </div>
      <button
        v-if="upcomingLesson"
        type="button"
        class="shogi-tutorial__continue"
        @click="startLesson(upcomingLesson.id)"
      >
        つづきから：第{{ upcomingLesson.volumeNumber }}巻「{{ upcomingLesson.title }}」
      </button>
      <ol class="shogi-tutorial__volumes">
        <li v-for="(volume, index) in volumes" :key="volume.id">
          <button type="button" class="shogi-tutorial__volume" @click="openVolume(volume.id)">
            <span class="shogi-tutorial__volume-number">第{{ index + 1 }}巻</span>
            <strong>{{ volume.title }}</strong>
            <small>{{ volume.description }}</small>
            <span class="shogi-tutorial__meter" aria-hidden="true">
              <span :style="{ width: `${volumeSummary(volume).percent}%` }"></span>
            </span>
            <span class="shogi-tutorial__volume-stats">
              {{ volumeSummary(volume).done }}/{{ volumeSummary(volume).total }} レッスン
              ・ ★{{ volumeSummary(volume).stars }}/{{ volumeSummary(volume).maxStars }}
            </span>
          </button>
        </li>
      </ol>
    </section>

    <!-- 巻の中：章とレッスンの道 -->
    <section v-else-if="view === 'volume' && currentVolume" class="shogi-tutorial__volume-view" aria-label="レッスンの一覧">
      <p class="shogi-tutorial__volume-lead">{{ currentVolume.description }}</p>
      <section v-for="chapter in currentVolume.chapters" :key="chapter.id" class="shogi-tutorial__chapter">
        <div class="shogi-tutorial__chapter-head">
          <h2>{{ chapter.title }}</h2>
          <button
            v-if="chapterSkippable(chapter)"
            type="button"
            class="shogi-tutorial__skip-chapter"
            @click="skipChapter(chapter)"
          >この章をスキップ</button>
        </div>
        <ol class="shogi-tutorial__path">
          <li v-for="lesson in chapter.lessons" :key="lesson.id">
            <button
              type="button"
              class="shogi-tutorial__lesson"
              :class="lessonClass(lesson)"
              :disabled="!lessonUnlocked(lesson) || lesson.comingSoon"
              @click="startLesson(lesson.id)"
            >
              <span class="shogi-tutorial__lesson-badge" aria-hidden="true">{{ lessonBadge(lesson) }}</span>
              <span class="shogi-tutorial__lesson-text">
                <strong>{{ lesson.title }}</strong>
                <small>{{ lessonStatusText(lesson) }}</small>
              </span>
            </button>
          </li>
        </ol>
      </section>
    </section>

    <!-- レッスン -->
    <section v-else-if="view === 'lesson' && currentLesson && currentStep" class="shogi-tutorial__lesson-view" aria-label="レッスン">
      <div class="shogi-tutorial__progress" aria-hidden="true">
        <span :style="{ width: `${(stepIndex / currentLesson.steps.length) * 100}%` }"></span>
      </div>
      <div class="shogi-dex__detail shogi-tutorial__stage">
        <div v-if="boardSfen" class="shogi-dex__main">
          <div class="shogi-dex__board">
            <ShogiMatchBoard
              :sfen="boardSfen"
              :last-move="lastMove"
              :allow-move="boardInteractive"
              :enable-drag-and-drop="true"
              :mobile="isNarrow"
              :layout="isNarrow ? 'portrait' : 'standard'"
              :asset-base-url="assetBaseUrl"
              :candidates="boardArrows"
              :mark-squares="boardMarks"
              @usi-move="onBoardMove"
            />
          </div>
        </div>
        <div class="shogi-dex__explanation-col shogi-tutorial__panel">
          <div class="shogi-dex__explanation">
            <div class="shogi-dex__speech">
              <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
              <p>{{ currentStep.question ?? currentStep.speech }}</p>
            </div>
            <p v-if="currentStep.type === 'choose' && currentStep.speech" class="shogi-tutorial__sub">{{ currentStep.speech }}</p>
            <!-- 対局の条件はレッスンで固定する。変更はさせず、内容だけ見せる。 -->
            <dl v-if="currentStep.type === 'play'" class="shogi-tutorial__conditions">
              <div v-for="condition in playConditions" :key="condition.label">
                <dt>{{ condition.label }}</dt>
                <dd>{{ condition.value }}</dd>
              </div>
            </dl>
            <div v-if="currentStep.type === 'choose'" class="shogi-tutorial__options">
              <button
                v-for="(option, index) in currentStep.options"
                :key="option"
                type="button"
                :class="{ 'shogi-tutorial__option--correct': stepSolved && index === currentStep.answer }"
                :disabled="stepSolved"
                @click="choose(Number(index))"
              >{{ option }}</button>
            </div>
            <p
              v-if="feedback"
              class="shogi-tutorial__feedback"
              :class="`shogi-tutorial__feedback--${feedbackTone}`"
              role="status"
            >{{ feedback }}</p>
            <div class="shogi-tutorial__actions">
              <button
                v-if="currentStep.type === 'open-dex'"
                type="button"
                @click="emit('open-dex', { kind: currentStep.kind, id: currentStep.id })"
              >図鑑をひらく</button>
              <button
                v-if="currentStep.type === 'play'"
                type="button"
                class="shogi-tutorial__primary"
                @click="startMatch"
              >対局をはじめる</button>
              <button
                v-if="stepInteractive && !stepSolved"
                type="button"
                @click="showHint"
              >ヒント</button>
              <button
                v-if="stepInteractive && !stepSolved && stepState.movesUsed + stepState.ply > 0"
                type="button"
                @click="resetStep"
              >やり直し</button>
              <button
                v-if="canAdvance"
                type="button"
                class="shogi-tutorial__primary"
                @click="advance"
              >{{ stepIndex >= currentLesson.steps.length - 1 ? "レッスン完了！" : "次へ" }}</button>
            </div>
            <button type="button" class="shogi-tutorial__skip" @click="skipCurrentLesson">このレッスンをスキップ</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 結果 -->
    <!-- やこび姫の一言のあとに、星を1つずつ付ける。画面を押すと演出を飛ばせる。 -->
    <section
      v-else-if="view === 'result' && currentLesson"
      class="shogi-tutorial__result"
      aria-label="レッスンの結果"
      @click="finishReveal"
    >
      <p v-if="matchOutcomeLabel" class="shogi-tutorial__outcome" :class="`shogi-tutorial__outcome--${matchOutcome}`">
        {{ matchOutcomeLabel }}
      </p>
      <div v-if="matchComment" class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ matchComment }}</p>
      </div>
      <div
        class="shogi-tutorial__stars"
        :class="{ 'shogi-tutorial__stars--hidden': revealStage < 1 }"
        role="img"
        :aria-label="`星${resultStars}つ`"
      >
        <span
          v-for="index in 3"
          :key="index"
          :class="{ 'shogi-tutorial__star--on': index <= revealedStars }"
        >★</span>
      </div>
      <template v-if="revealStage >= 2">
        <div v-if="!matchComment" class="shogi-dex__speech shogi-tutorial__intro">
          <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
          <p>{{ resultMessage }}</p>
        </div>
        <p v-else class="shogi-tutorial__star-note">{{ resultMessage }}</p>
        <div class="shogi-tutorial__result-actions">
          <button v-if="followingLesson" type="button" class="shogi-tutorial__primary" @click="startLesson(followingLesson.id)">
            次のレッスン：{{ followingLesson.title }}
          </button>
          <button v-if="matchComment" type="button" @click="startMatch">もう一度対局する</button>
          <button v-else type="button" @click="startLesson(currentLesson.id)">もう一度</button>
          <button type="button" @click="openVolume(currentLesson.volumeId)">レッスン一覧へ</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { formatHintMove } from "./core/match-assists.mjs";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./core/opening-guide.mjs";
import { CPU_STRENGTH_PRESETS } from "./core/strength-settings.mjs";
import { TUTORIAL_LESSONS, TUTORIAL_TITLE, TUTORIAL_VOLUMES, tutorialLesson } from "./core/tutorial-curriculum.mjs";
import {
  INTERACTIVE_STEP_TYPES,
  attemptTutorialChoice,
  attemptTutorialMove,
  createStepState,
  lessonStars,
  matchLessonComment,
  matchLessonStars,
  tutorialHint,
  tutorialMatchSettings,
  tutorialStepMarks,
} from "./core/tutorial-runner.mjs";
import {
  isLessonUnlocked,
  lessonRecord,
  lessonsProgress,
  loadTutorialProgress,
  nextLesson,
  recordLessonCleared,
  recordLessonSkipped,
  saveTutorialProgress,
} from "./core/tutorial-progress.mjs";

type Lesson = (typeof TUTORIAL_LESSONS)[number] & { steps?: any[]; comingSoon?: boolean; summary?: string };
type Volume = (typeof TUTORIAL_VOLUMES)[number];

export type TutorialMatchReport = {
  lessonId: string;
  outcome: "win" | "lose" | "draw";
  reason: string;
  assistsUsed: number;
};

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  // 教室の対局を終えて戻ってきたときの結果。あれば結果画面から始める。
  matchReport: { type: Object as PropType<TutorialMatchReport | null>, default: null },
});
const emit = defineEmits(["close", "open-dex", "start-match"]);

const storage = typeof localStorage === "undefined" ? null : localStorage;
const progress = ref(loadTutorialProgress(storage));
function updateProgress(next: typeof progress.value) {
  progress.value = next;
  saveTutorialProgress(storage, next);
}

const volumes = TUTORIAL_VOLUMES as unknown as Volume[];
const lessons = TUTORIAL_LESSONS as unknown as Lesson[];
const view = ref<"shelf" | "volume" | "lesson" | "result">("shelf");
const volumeId = ref("");
const lessonId = ref("");
const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);

// 狭い画面では縦長レイアウトの盤に切り替える。
const narrowMediaQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(max-width: 56rem)")
  : null;
const isNarrow = ref(Boolean(narrowMediaQuery?.matches));
function onNarrowChange(event: MediaQueryListEvent) { isNarrow.value = event.matches; }
onMounted(() => narrowMediaQuery?.addEventListener("change", onNarrowChange));
onBeforeUnmount(() => narrowMediaQuery?.removeEventListener("change", onNarrowChange));

const currentVolume = computed(() => volumes.find(({ id }) => id === volumeId.value) ?? null);
const currentLesson = computed(() => (lessonId.value ? tutorialLesson(lessonId.value) as Lesson | null : null));
const headerTitle = computed(() => {
  if (view.value === "volume" && currentVolume.value) return `第${volumes.indexOf(currentVolume.value) + 1}巻 ${currentVolume.value.title}`;
  if ((view.value === "lesson" || view.value === "result") && currentLesson.value) return currentLesson.value.title;
  return TUTORIAL_TITLE;
});
const backLabel = computed(() => (
  view.value === "shelf" ? "タイトルへ戻る" : view.value === "volume" ? "本棚へ戻る" : "レッスン一覧へ"
));
function goBack() {
  if (view.value === "shelf") emit("close");
  else if (view.value === "volume") view.value = "shelf";
  else if (currentLesson.value) openVolume(currentLesson.value.volumeId);
}

// ===== 本棚と一覧 =====
const upcomingLesson = computed(() => nextLesson(lessons, progress.value) as Lesson | null);
const shelfMessage = computed(() => (
  Object.keys(progress.value.lessons).length
    ? "おかえり！ 今日もいっしょに将棋を学ぼうね。"
    : "ようこそ、やこび姫の将棋教室へ！ 駒の動かし方から、いっしょに少しずつ覚えていこうね。"
));
function volumeLessons(volume: Volume) {
  return lessons.filter((lesson) => lesson.volumeId === volume.id);
}
function volumeSummary(volume: Volume) {
  const summary = lessonsProgress(volumeLessons(volume), progress.value);
  return { ...summary, percent: summary.total ? Math.round((summary.done / summary.total) * 100) : 0 };
}
function openVolume(id: string) {
  volumeId.value = id;
  view.value = "volume";
}
function lessonUnlocked(lesson: Lesson) {
  return isLessonUnlocked(lessons, progress.value, lesson.id);
}
function lessonBadge(lesson: Lesson) {
  if (lesson.comingSoon) return "…";
  const record = lessonRecord(progress.value, lesson.id);
  if (record.status === "cleared") return "★".repeat(record.stars);
  if (record.status === "skipped") return "»";
  return lessonUnlocked(lesson) ? "▶" : "🔒";
}
function lessonStatusText(lesson: Lesson) {
  if (lesson.comingSoon) return "準備中";
  const record = lessonRecord(progress.value, lesson.id);
  if (record.status === "cleared") return `クリア（★${record.stars}）`;
  if (record.status === "skipped") return "スキップ済み";
  return lessonUnlocked(lesson) ? (lesson.summary ?? "") : "前のレッスンを終えると解放";
}
function lessonClass(lesson: Lesson) {
  const record = lessonRecord(progress.value, lesson.id);
  return {
    "shogi-tutorial__lesson--cleared": record.status === "cleared",
    "shogi-tutorial__lesson--skipped": record.status === "skipped",
    "shogi-tutorial__lesson--next": upcomingLesson.value?.id === lesson.id,
  };
}
function chapterSkippable(chapter: Volume["chapters"][number]) {
  const pending = chapter.lessons.filter((lesson: any) => !lesson.comingSoon && lessonRecord(progress.value, lesson.id).status === "new");
  return pending.length > 0 && lessonUnlocked(pending[0] as Lesson);
}
function skipChapter(chapter: Volume["chapters"][number]) {
  let next = progress.value;
  for (const lesson of chapter.lessons as Lesson[]) {
    if (!lesson.comingSoon) next = recordLessonSkipped(next, lesson.id);
  }
  updateProgress(next);
}

// ===== レッスン =====
const stepIndex = ref(0);
const stepState = ref<any>({ sfen: "", square: "", movesUsed: 0, ply: 0, solved: false });
const stepSolved = ref(false);
const mistakes = ref(0);
const hints = ref(0);
const hintLevel = ref(0);
const feedback = ref("");
const feedbackTone = ref<"good" | "bad" | "info">("info");
const lastMove = ref("");
const resultStars = ref(0);

const currentStep = computed(() => currentLesson.value?.steps?.[stepIndex.value] ?? null);
const stepInteractive = computed(() => INTERACTIVE_STEP_TYPES.includes(currentStep.value?.type));
const boardSfen = computed(() => stepState.value.sfen);
const boardInteractive = computed(() => stepInteractive.value && !stepSolved.value);
const hintView = computed(() => (
  hintLevel.value && currentStep.value
    ? tutorialHint(currentStep.value, stepState.value, hintLevel.value)
    : { marks: [], arrows: [] }
));
const boardMarks = computed(() => {
  if (!currentStep.value || !boardSfen.value) return [];
  const marks = currentStep.value.type === "move-piece"
    ? tutorialStepMarks({ ...currentStep.value, pieceSquare: stepState.value.square }, boardSfen.value)
    : tutorialStepMarks(currentStep.value, boardSfen.value);
  const merged = new Map(marks.map((mark: any) => [`${mark.file}${mark.rank}`, mark]));
  for (const mark of hintView.value.marks) merged.set(`${mark.file}${mark.rank}`, mark);
  return [...merged.values()];
});
const boardArrows = computed(() => (
  [...(currentStep.value?.type === "explain" ? currentStep.value.arrows ?? [] : []), ...hintView.value.arrows]
    .map((usi: string) => ({ usi, guideKind: "plan" as const }))
));
const canAdvance = computed(() => {
  const type = currentStep.value?.type;
  if (type === "explain" || type === "open-dex") return true;
  if (type === "play") return false;
  return stepSolved.value;
});

function loadStep(index: number) {
  stepIndex.value = index;
  const step = currentLesson.value?.steps?.[index];
  stepState.value = createStepState(step);
  stepSolved.value = false;
  hintLevel.value = 0;
  feedback.value = "";
  lastMove.value = "";
}
function startLesson(id: string) {
  lessonId.value = id;
  mistakes.value = 0;
  hints.value = 0;
  view.value = "lesson";
  loadStep(0);
}
function resetStep() {
  loadStep(stepIndex.value);
}
function setFeedback(text: string, tone: "good" | "bad" | "info") {
  feedback.value = text;
  feedbackTone.value = tone;
}
function onBoardMove(usi: string) {
  const step = currentStep.value;
  if (!step || stepSolved.value) return;
  const before = stepState.value.sfen;
  const result = attemptTutorialMove(step, stepState.value, usi);
  if (result.outcome === "wrong") {
    mistakes.value += 1;
    // 間違えるたびにヒントを1段階ずつ出す。
    hintLevel.value = Math.min(2, hintLevel.value + 1);
    const reason = ({
      illegal: "その手は指せないよ。駒の動きをもう一度確かめてみよう！",
      "other-piece": "動かす駒がちがうよ。光っている駒を動かしてね。",
      "too-many-moves": "手数を使い切っちゃった。最初からもう一度やってみよう！",
    } as Record<string, string>)[result.reason ?? ""] ?? "おしい！ もう一度考えてみよう。";
    setFeedback(reason, "bad");
    stepState.value = result.state;
    return;
  }
  stepState.value = result.state;
  lastMove.value = usi;
  if (result.outcome === "continue") {
    if (result.reply) {
      lastMove.value = result.reply;
      setFeedback(`相手は${formatHintMove(result.reply, applyBefore(before, usi))}と逃げたよ。続けて詰ませよう！`, "info");
    } else {
      setFeedback("その調子！ 続けて動かそう。", "info");
    }
    hintLevel.value = 0;
    return;
  }
  stepSolved.value = true;
  hintLevel.value = 0;
  setFeedback(step.type === "mate" ? "詰み！ おみごと！" : "正解！ すごいね！", "good");
}
// 相手の応手を表示するため、自分の手を指した直後の局面を作る。
function applyBefore(sfen: string, usi: string) {
  const state = attemptTutorialMove({ type: "find-move", answers: [usi] }, { ...stepState.value, sfen }, usi);
  return state.state.sfen;
}
function choose(index: number) {
  const step = currentStep.value;
  if (!step || stepSolved.value) return;
  if (attemptTutorialChoice(step, index) === "correct") {
    stepSolved.value = true;
    setFeedback(`正解！ ${step.explanation ?? ""}`, "good");
  } else {
    mistakes.value += 1;
    setFeedback("ちがうみたい。もう一度考えてみよう！", "bad");
  }
}
function showHint() {
  hints.value += 1;
  hintLevel.value = Math.min(2, hintLevel.value + 1);
  setFeedback(hintLevel.value >= 2 ? "矢印のとおりに指してみよう！" : "緑のマスに注目してみてね。", "info");
}
function finishLesson() {
  const lesson = currentLesson.value;
  if (!lesson) return;
  showResult(lessonStars({ mistakes: mistakes.value, hints: hints.value }), null);
}
function advance() {
  const lesson = currentLesson.value;
  if (!lesson?.steps) return;
  if (stepIndex.value >= lesson.steps.length - 1) finishLesson();
  else loadStep(stepIndex.value + 1);
}
function skipCurrentLesson() {
  const lesson = currentLesson.value;
  if (!lesson) return;
  updateProgress(recordLessonSkipped(progress.value, lesson.id));
  const following = nextLesson(lessons, progress.value) as Lesson | null;
  if (following) startLesson(following.id);
  else openVolume(lesson.volumeId);
}
// 対局ステップ。条件はレッスンで固定し、クリアと★は終局後に決める。
const playStep = computed(() => currentLesson.value?.steps?.find(({ type }: { type: string }) => type === "play") ?? null);
function openingLabel(strategyId?: string, castleId?: string) {
  const strategy = OPENING_STRATEGIES.find(({ id }: { id: string }) => id === strategyId)?.label;
  const castle = OPENING_CASTLES.find(({ id }: { id: string }) => id === castleId)?.label;
  return [strategy, castle].filter(Boolean).join("＋") || "おまかせ";
}
function assistLimitLabel(limit: number) {
  return limit < 0 ? "無制限" : `${limit}回`;
}
const playConditions = computed(() => {
  const step = currentStep.value;
  if (step?.type !== "play") return [];
  const settings = tutorialMatchSettings(step.preset);
  const cpu = CPU_STRENGTH_PRESETS.find(({ level }) => level === settings.cpuLevel);
  return [
    { label: "手番", value: settings.playerColor === "white" ? "後手（あなた）" : "先手（あなた）" },
    ...(settings.startType === "formation"
      ? [
        { label: "あなたの形", value: openingLabel(settings.playerStrategy, settings.playerCastle) },
        { label: "相手の形", value: openingLabel(settings.opponentStrategy, settings.opponentCastle) },
      ]
      : []),
    { label: "相手", value: cpu ? `CPU Lv${cpu.level}（${cpu.label}）` : "CPU" },
    { label: "閃き・待った", value: `閃き${assistLimitLabel(settings.hintLimit)}・待った${assistLimitLabel(settings.undoLimit)}` },
  ];
});
function startMatch() {
  const lesson = currentLesson.value;
  const step = playStep.value;
  if (!lesson || !step) return;
  emit("start-match", { lessonId: lesson.id, preset: tutorialMatchSettings(step.preset) });
}

// ===== 結果 =====
const matchResult = ref<TutorialMatchReport | null>(null);
const matchOutcome = computed(() => matchResult.value?.outcome ?? "");
const matchOutcomeLabel = computed(() => (
  matchResult.value ? ({ win: "勝ち！", lose: "負け", draw: "引き分け" })[matchResult.value.outcome] : ""
));
const matchComment = computed(() => (
  matchResult.value ? matchLessonComment(matchResult.value, playStep.value?.comments) : ""
));
// 0: 一言だけ / 1: 星を1つずつ付けている / 2: 付け終わり（ボタンを出す）
const revealStage = ref(2);
const revealedStars = ref(0);
let revealTimers: ReturnType<typeof setTimeout>[] = [];
function clearRevealTimers() {
  for (const timer of revealTimers) clearTimeout(timer);
  revealTimers = [];
}
function finishReveal() {
  if (revealStage.value >= 2) return;
  clearRevealTimers();
  revealedStars.value = resultStars.value;
  revealStage.value = 2;
}
function showResult(stars: number, report: TutorialMatchReport | null) {
  const lesson = currentLesson.value;
  if (!lesson) return;
  clearRevealTimers();
  resultStars.value = stars;
  matchResult.value = report;
  updateProgress(recordLessonCleared(progress.value, lesson.id, stars));
  view.value = "result";
  revealedStars.value = 0;
  revealStage.value = 0;
  // 対局のあとは、やこび姫の一言を読む時間を取ってから星を付ける。
  const start = report ? 1400 : 300;
  revealTimers.push(setTimeout(() => { revealStage.value = 1; }, start));
  for (let index = 1; index <= stars; index += 1) {
    revealTimers.push(setTimeout(() => { revealedStars.value = index; }, start + index * 450));
  }
  revealTimers.push(setTimeout(() => { revealStage.value = 2; }, start + stars * 450 + 500));
}
onBeforeUnmount(clearRevealTimers);
onMounted(() => {
  const report = props.matchReport;
  if (!report || !tutorialLesson(report.lessonId)) return;
  lessonId.value = report.lessonId;
  volumeId.value = currentLesson.value?.volumeId ?? "";
  showResult(matchLessonStars(report), report);
});
const followingLesson = computed(() => {
  const index = lessons.findIndex(({ id }) => id === lessonId.value);
  return lessons.slice(index + 1).find((lesson) => !lesson.comingSoon) ?? null;
});
const resultMessage = computed(() => {
  if (matchResult.value) {
    if (matchResult.value.outcome !== "win") return "最後まで指したから★1つ！ 勝つと★2つ、閃きも待ったも使わずに勝つと★3つだよ。";
    return resultStars.value >= 3
      ? "閃きも待ったも使わずに勝ったから★3つ！ 完ぺきだね！"
      : "勝ったから★2つ！ 次は閃きも待ったも使わずに★3つを目指そう。";
  }
  return ([
    "",
    "クリアおめでとう！ まちがえたところは、もう一度やってみると覚えられるよ。",
    "よくできました！ あと少しで満点だったね。",
    "満点！ 完ぺきだね、すごい！",
  ])[resultStars.value];
});
</script>

<style>
/* 教室の「大事なマス」は、対局中に駒が動いた升と同じ緑にする（図鑑の黄色はそのまま）。 */
.shogi-game .shogi-tutorial .square-mark--key {
  background: rgba(68, 204, 68, 0.45);
  box-shadow: inset 0 0 0 2px rgba(34, 153, 34, 0.9);
}
.shogi-game .shogi-tutorial__shelf,
.shogi-game .shogi-tutorial__volume-view,
.shogi-game .shogi-tutorial__result {
  flex: 1;
  overflow-y: auto;
  padding: 0.8rem clamp(0.8rem, 3vw, 2rem) 1.5rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-tutorial__intro {
  max-width: 48rem;
  margin: 0 auto 0.8rem;
}
.shogi-game .shogi-tutorial__continue {
  display: block;
  width: min(100%, 40rem);
  margin: 0 auto 1rem;
  padding: 0.75rem 1rem;
  border: 2px solid #f1a54c;
  border-radius: 0.6rem;
  color: #172632;
  background: #f1a54c;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__volumes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.8rem;
  max-width: 72rem;
  margin: 0 auto;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tutorial__volume {
  display: grid;
  gap: 0.35rem;
  width: 100%;
  height: 100%;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(255, 252, 244, 0.35);
  border-left: 6px solid #f1a54c;
  border-radius: 0.5rem;
  color: #fffcf4;
  background: rgba(29, 48, 63, 0.8);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__volume:hover {
  border-color: #f1a54c;
}
.shogi-game .shogi-tutorial__volume-number {
  color: #f1a54c;
  font-size: 0.85em;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__volume strong {
  font-size: 1.15em;
}
.shogi-game .shogi-tutorial__volume small,
.shogi-game .shogi-tutorial__volume-stats {
  font-size: 0.82em;
  opacity: 0.85;
}
.shogi-game .shogi-tutorial__meter,
.shogi-game .shogi-tutorial__progress {
  display: block;
  height: 0.45rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 252, 244, 0.18);
}
.shogi-game .shogi-tutorial__meter > span,
.shogi-game .shogi-tutorial__progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #f1a54c;
  transition: width 200ms ease;
}
.shogi-game .shogi-tutorial__progress {
  flex: none;
  margin: 0.5rem 1rem 0;
}
.shogi-game .shogi-tutorial__volume-lead {
  max-width: 48rem;
  margin: 0 auto 0.6rem;
  opacity: 0.85;
}
.shogi-game .shogi-tutorial__chapter {
  max-width: 48rem;
  margin: 0 auto 1.2rem;
}
.shogi-game .shogi-tutorial__chapter-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.shogi-game .shogi-tutorial__chapter-head h2 {
  margin: 0;
  color: #f1a54c;
  font-size: 1.05em;
}
.shogi-game .shogi-tutorial__skip-chapter,
.shogi-game .shogi-tutorial__skip {
  padding: 0.25rem 0.7rem;
  border: 1px solid rgba(255, 252, 244, 0.45);
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-size: 0.8em;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__path {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0 0 0 1.2rem;
  border-left: 3px dashed rgba(241, 165, 76, 0.5);
  list-style: none;
}
.shogi-game .shogi-tutorial__lesson {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  width: 100%;
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.3);
  border-radius: 0.5rem;
  color: #fffcf4;
  background: rgba(29, 48, 63, 0.75);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__lesson:disabled {
  cursor: default;
  opacity: 0.55;
}
.shogi-game .shogi-tutorial__lesson--next {
  border-color: #f1a54c;
  box-shadow: 0 0 0 2px rgba(241, 165, 76, 0.45);
}
.shogi-game .shogi-tutorial__lesson--cleared .shogi-tutorial__lesson-badge {
  color: #f6d365;
}
.shogi-game .shogi-tutorial__lesson--skipped {
  opacity: 0.8;
}
.shogi-game .shogi-tutorial__lesson-badge {
  flex: none;
  min-width: 3.2em;
  color: #f1a54c;
  font-weight: 800;
  text-align: center;
}
.shogi-game .shogi-tutorial__lesson-text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}
.shogi-game .shogi-tutorial__lesson-text small {
  font-size: 0.8em;
  opacity: 0.8;
}
.shogi-game .shogi-tutorial__lesson-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
.shogi-game .shogi-tutorial__stage {
  flex: 1;
  min-height: 0;
}
.shogi-game .shogi-tutorial__panel .shogi-dex__explanation {
  display: grid;
  gap: 0.6rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-tutorial__sub {
  margin: 0;
  opacity: 0.85;
}
.shogi-game .shogi-tutorial__options {
  display: grid;
  gap: 0.45rem;
}
.shogi-game .shogi-tutorial__options button,
.shogi-game .shogi-tutorial__actions button,
.shogi-game .shogi-tutorial__result-actions button {
  min-height: 2.6em;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.45rem;
  color: #fffcf4;
  background: rgba(29, 48, 63, 0.9);
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__options button:disabled {
  cursor: default;
  opacity: 0.6;
}
.shogi-game .shogi-tutorial .shogi-tutorial__options button.shogi-tutorial__option--correct:disabled {
  border-color: #6ee7b7;
  opacity: 1;
  background: rgba(16, 185, 129, 0.35);
}
.shogi-game .shogi-tutorial__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.shogi-game .shogi-tutorial__actions button {
  flex: 1 1 6em;
}
.shogi-game .shogi-tutorial .shogi-tutorial__primary {
  border-color: #f1a54c;
  color: #172632;
  background: #f1a54c;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__feedback {
  margin: 0;
  padding: 0.45rem 0.7rem;
  border-radius: 0.4rem;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__feedback--good { background: rgba(16, 185, 129, 0.28); }
.shogi-game .shogi-tutorial__feedback--bad { background: rgba(239, 68, 68, 0.28); }
.shogi-game .shogi-tutorial__feedback--info { background: rgba(96, 165, 250, 0.22); }
.shogi-game .shogi-tutorial__skip {
  justify-self: end;
  opacity: 0.75;
}
.shogi-game .shogi-tutorial__result {
  display: grid;
  align-content: start;
  justify-items: center;
  gap: 1rem;
}
.shogi-game .shogi-tutorial__stars {
  display: flex;
  gap: 0.4rem;
  font-size: clamp(2.5rem, 8vw, 4rem);
  color: rgba(255, 252, 244, 0.25);
  transition: opacity 300ms ease;
}
.shogi-game .shogi-tutorial__stars--hidden {
  opacity: 0;
}
.shogi-game .shogi-tutorial__star--on {
  color: #f6d365;
  text-shadow: 0 0 0.6rem rgba(246, 211, 101, 0.6);
  animation: shogi-tutorial-star-pop 450ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes shogi-tutorial-star-pop {
  0% { transform: scale(0.2) rotate(-30deg); opacity: 0; }
  70% { transform: scale(1.3) rotate(8deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__star--on { animation: none; }
}
.shogi-game .shogi-tutorial__outcome {
  margin: 0;
  font-size: clamp(1.8rem, 6vw, 2.8rem);
  font-weight: 900;
  letter-spacing: 0.1em;
}
.shogi-game .shogi-tutorial__outcome--win { color: #f6d365; }
.shogi-game .shogi-tutorial__outcome--lose { color: #93c5fd; }
.shogi-game .shogi-tutorial__outcome--draw { color: #fffcf4; }
.shogi-game .shogi-tutorial__star-note {
  max-width: 40rem;
  margin: 0;
  text-align: center;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__conditions {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0.6rem 0.8rem;
  border: 1px solid rgba(241, 165, 76, 0.55);
  border-radius: 0.5rem;
  background: rgba(29, 48, 63, 0.7);
}
.shogi-game .shogi-tutorial__conditions div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.8rem;
}
.shogi-game .shogi-tutorial__conditions dt {
  min-width: 6.5em;
  color: #f1a54c;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__conditions dd {
  margin: 0;
}
.shogi-game .shogi-tutorial__result-actions {
  display: grid;
  gap: 0.5rem;
  width: min(100%, 26rem);
}
</style>
