<template>
  <div
    class="shogi-dex shogi-tutorial"
    :class="{ 'shogi-tutorial--lesson': view === 'lesson' }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="shogi-tutorial-title"
  >
    <!-- レッスン中は見出しを1行にまとめ、盤を広くとる。スキップは見出しの右端へ置き、操作の邪魔をしない。 -->
    <header class="shogi-dex__header">
      <button type="button" class="shogi-dex__back" :aria-label="backLabel" @click="goBack">
        <span aria-hidden="true">←</span> <span class="shogi-tutorial__back-label">{{ backLabel }}</span>
      </button>
      <h1 id="shogi-tutorial-title">{{ headerTitle }}</h1>
      <button
        v-if="view === 'lesson'"
        type="button"
        class="shogi-tutorial__header-skip"
        data-tutorial-skip
        @click="skipCurrentLesson"
      >スキップ</button>
    </header>

    <!--
      地図(すごろくの道)。巻・章・レッスンを学ぶ順に1本の道に並べ、いま進めるマスを1つだけ大きく見せる。
      マスを押せばすぐレッスンが始まる。開くと、いまのマスまで自動でスクロールする。
    -->
    <section v-if="view === 'map'" ref="mapEl" class="shogi-tutorial__map" aria-label="レッスンの地図" data-tutorial-map>
      <div class="shogi-tutorial__map-hero">
        <img class="shogi-tutorial__chara" :src="charaUrl" alt="" aria-hidden="true">
        <div class="shogi-tutorial__map-hero-body">
          <p class="shogi-tutorial__speech">{{ mapMessage || shelfMessage }}</p>
          <p class="shogi-tutorial__map-total" aria-label="集めた星">
            ★ {{ map.total.stars }} / {{ map.total.maxStars }}<small>・{{ map.total.done }} / {{ map.total.total }} レッスン</small>
          </p>
        </div>
        <button
          v-if="upcomingLesson"
          type="button"
          class="shogi-tutorial__continue"
          data-tutorial-continue
          @click="startLesson(upcomingLesson.id)"
        >
          <small>つづきから</small><span>▶ {{ upcomingLesson.title }}</span>
        </button>
      </div>
      <ol class="shogi-tutorial__road">
        <li
          v-for="row in map.rows"
          :key="`${row.type}-${row.id}`"
          :class="`shogi-tutorial__road-${row.type}`"
        >
          <!-- 巻の看板 -->
          <div v-if="row.type === 'volume'" class="shogi-tutorial__world">
            <span class="shogi-tutorial__world-number">第{{ row.number }}巻</span>
            <strong>{{ row.title }}</strong>
            <span class="shogi-tutorial__meter" aria-hidden="true">
              <span :style="{ width: `${row.summary.total ? Math.round((row.summary.done / row.summary.total) * 100) : 0}%` }"></span>
            </span>
            <small>★{{ row.summary.stars }}/{{ row.summary.maxStars }}</small>
          </div>
          <!-- 章の看板 -->
          <div v-else-if="row.type === 'chapter'" class="shogi-tutorial__signpost">
            <span>第{{ row.number }}章 {{ row.title }}</span>
            <button
              v-if="row.skippable"
              type="button"
              class="shogi-tutorial__skip-chapter"
              @click="skipChapterById(row.id)"
            >この章をとばす</button>
          </div>
          <!-- レッスンのマス -->
          <div v-else class="shogi-tutorial__stop" :style="{ '--lane': row.lane }">
            <button
              type="button"
              class="shogi-tutorial__node"
              :class="`shogi-tutorial__node--${row.state}`"
              :aria-label="`${row.title}（${nodeStateText(row)}）`"
              :data-map-current="row.state === 'next' ? '' : undefined"
              :data-lesson-node="row.id"
              :disabled="row.state === 'soon'"
              @click="onNodeClick(row)"
            >
              <span class="shogi-tutorial__node-icon" aria-hidden="true">{{ row.state === "locked" ? "🔒" : row.icon }}</span>
              <span v-if="row.state === 'next'" class="shogi-tutorial__node-start" aria-hidden="true">ここから！</span>
            </button>
            <span class="shogi-tutorial__node-title">{{ row.title }}</span>
            <span v-if="row.state === 'cleared'" class="shogi-tutorial__node-stars" aria-hidden="true">
              <i v-for="index in 3" :key="index" :class="{ on: index <= row.stars }">★</i>
            </span>
          </div>
        </li>
      </ol>
    </section>

    <!--
      レッスン。説明は画面のどこを押しても進む(「次へ」のボタンを探して押させない)。
      盤の課題と選択問題は、正解すると自動で次へ進む。困ったら、しばらくするとヒントがそっと出る。
    -->
    <section v-else-if="view === 'lesson' && currentLesson && currentStep" class="shogi-tutorial__lesson-view" aria-label="レッスン">
      <!--
        進み具合。章のレッスンを区切りで並べ、いまのレッスンは区切りの中をステップの進み具合で塗る。
        短いレッスンが続けて流れていくことを、1本の帯で見せる。
      -->
      <div class="shogi-tutorial__track" data-tutorial-steps :aria-label="`第${chapterNumber}章 ${chapterTrack.index + 1}/${chapterTrack.count}つ目のレッスン、${stepIndex + 1}/${currentLesson.steps.length}`">
        <span class="shogi-tutorial__track-label">{{ chapterTitle }}</span>
        <ol>
          <li v-for="(id, index) in chapterTrack.ids" :key="id">
            <span :style="{ width: `${trackFill(index)}%` }"></span>
          </li>
        </ol>
      </div>
      <!--
        盤のマスはクリックを止める(@click.stop)ので、画面全体はキャプチャ段階で受け取り、盤を押しても進めるようにする。
        課題の途中は進めない判定(tapToAdvance)なので、盤で指す操作は邪魔しない。
      -->
      <div ref="stageEl" class="shogi-dex__detail shogi-tutorial__stage" data-tutorial-stage @click.capture="onStageTap">
        <div v-if="boardSfen" class="shogi-dex__main">
          <div class="shogi-dex__board" :style="boardBoxStyle">
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
              @resize="onBoardResize"
            />
          </div>
        </div>
        <div ref="panelEl" class="shogi-tutorial__panel">
          <!--
            やこび姫の吹き出し。課題のときは「やってみよう」の目標として枠を琥珀色にし、
            正解・不正解の一言は同じ吹き出しの中に出す(見る場所を1つにする)。
          -->
          <div
            class="shogi-tutorial__bubble"
            :class="{
              'shogi-tutorial__bubble--task': isTaskStep && !stepSolved,
              'shogi-tutorial__bubble--good': feedback && feedbackTone === 'good',
              'shogi-tutorial__bubble--bad': feedback && feedbackTone === 'bad',
            }"
            aria-live="polite"
            data-tutorial-bubble
          >
            <img class="shogi-tutorial__chara" :src="charaUrl" alt="" aria-hidden="true">
            <div class="shogi-tutorial__bubble-body">
              <p v-if="taskLabel" class="shogi-tutorial__task-label">{{ taskLabel }}</p>
              <p class="shogi-tutorial__speech">{{ stepSpeech }}</p>
              <p
                v-if="feedback"
                class="shogi-tutorial__feedback"
                :class="`shogi-tutorial__feedback--${feedbackTone}`"
                role="status"
              >{{ feedback }}</p>
              <p v-if="tapToAdvance" class="shogi-tutorial__tap" aria-hidden="true">{{ tapLabel }} <span>▼</span></p>
            </div>
          </div>
          <!-- 観戦: 盤を押しても1手進む。最後の手まで見ると、押すと次のステップへ進む。 -->
          <div v-if="currentStep.type === 'replay'" class="shogi-tutorial__replay">
            <p class="shogi-tutorial__replay-move">
              {{ stepState.ply > 0 ? `${stepState.ply}手目 ${replayLabel}` : "開始局面" }}
              <small>（{{ stepState.ply }}/{{ currentStep.moves.length }}）</small>
            </p>
            <div class="shogi-tutorial__replay-controls">
              <button
                type="button"
                :disabled="stepState.ply <= (currentStep.from ?? 0)"
                @click="seekReplayBy(-1)"
              ><span aria-hidden="true">◀</span> 戻る</button>
              <button
                type="button"
                class="shogi-tutorial__primary"
                :disabled="stepState.ply >= currentStep.moves.length"
                @click="seekReplayBy(1)"
              >次の手 <span aria-hidden="true">▶</span></button>
            </div>
          </div>
          <!-- 評価値の説明: 盤の局面に合わせて、対局全体の評価値グラフに今の手数を示す。 -->
          <div v-if="graphPoints.length" class="shogi-tutorial__graph">
            <EvaluationGraph
              :points="graphPoints"
              :current-ply="graphPly"
              :total-ply="currentStep.graph.moves.length"
              hide-legend
              @select="onGraphSelect"
            />
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
              :class="{
                'shogi-tutorial__option--correct': stepSolved && index === currentStep.answer,
                'shogi-tutorial__option--wrong': wrongChoices.includes(Number(index)),
              }"
              :disabled="stepSolved || wrongChoices.includes(Number(index))"
              @click="choose(Number(index))"
            >{{ option }}</button>
          </div>
          <div v-if="hasActions" class="shogi-tutorial__actions">
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
              v-if="stepInteractive && !stepSolved && stepState.movesUsed + stepState.ply > 0"
              type="button"
              @click="resetStep"
            >やり直す</button>
          </div>
        </div>
      </div>
      <!--
        レッスンクリアの知らせ。結果の画面へ移らず、盤の上に短く出して、同じ章の次のレッスンへ自動で続ける。
        押せば待たずに進む。地図へ戻る道も残す。
      -->
      <Transition name="shogi-tutorial__clear">
        <div v-if="stageClear" class="shogi-tutorial__clear" role="status" data-stage-clear @click="continueChain">
          <p class="shogi-tutorial__clear-title">クリア！</p>
          <p class="shogi-tutorial__clear-stars" :aria-label="`星${stageClear.stars}つ`">
            <i v-for="index in 3" :key="index" :class="{ on: index <= stageClear.stars }">★</i>
          </p>
          <p class="shogi-tutorial__clear-next">つぎは「{{ stageClear.nextTitle }}」 <span aria-hidden="true">▶</span></p>
          <button type="button" class="shogi-tutorial__clear-map" @click.stop="openMap">地図へ</button>
        </div>
      </Transition>
    </section>

    <!--
      章クリア。短いレッスンのたびに結果を挟まず、章の終わりでまとめてほめる。
      できるようになったことを並べ、次の章へすぐ進めるようにする。
    -->
    <section v-else-if="view === 'chapter' && clearedChapter" class="shogi-tutorial__chapter-clear" aria-label="章クリア" data-chapter-clear>
      <p class="shogi-tutorial__chapter-clear-eyebrow">第{{ clearedChapter.volumeNumber }}巻 第{{ clearedChapter.number }}章</p>
      <h2>「{{ clearedChapter.title }}」クリア！</h2>
      <p class="shogi-tutorial__chapter-clear-stars">★ {{ clearedChapter.stars }} / {{ clearedChapter.maxStars }}</p>
      <div class="shogi-tutorial__bubble">
        <img class="shogi-tutorial__chara" :src="charaUrl" alt="" aria-hidden="true">
        <div class="shogi-tutorial__bubble-body">
          <p class="shogi-tutorial__speech">{{ chapterClearMessage }}</p>
        </div>
      </div>
      <ul class="shogi-tutorial__learned-list" aria-label="できるようになったこと">
        <li v-for="entry in clearedChapter.lessons" :key="entry.id">
          <span class="shogi-tutorial__learned-stars" aria-hidden="true">
            <i v-for="index in 3" :key="index" :class="{ on: index <= entry.stars }">★</i>
          </span>
          <span><b>{{ entry.title }}</b><small>{{ entry.summary }}</small></span>
          <button type="button" class="shogi-tutorial__learned-retry" @click="startLesson(entry.id)">もう一度</button>
        </li>
      </ul>
      <div class="shogi-tutorial__result-actions">
        <button v-if="nextChapterLesson" ref="nextChapterButton" type="button" class="shogi-tutorial__primary" data-next-chapter @click="startLesson(nextChapterLesson.id)">
          次の章へ：{{ nextChapterLesson.title }}
        </button>
        <button type="button" @click="openMap">地図へ</button>
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
      <!-- 星の数より先に、このレッスンでできるようになったことを見せる。 -->
      <p v-if="currentLesson.summary && !matchComment" class="shogi-tutorial__learned" data-tutorial-learned>
        <small>できるようになったこと</small>{{ currentLesson.summary }}
      </p>
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
          <button v-if="followingLesson" ref="nextLessonButton" type="button" class="shogi-tutorial__primary" @click="continueAfterResult">
            次へ進む
          </button>
          <button v-if="matchComment" type="button" @click="startMatch">もう一度対局する</button>
          <button v-else type="button" @click="startLesson(currentLesson.id)">もう一度</button>
          <button type="button" @click="openMap">地図へ</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import EvaluationGraph from "./EvaluationGraph.vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { formatHintMove } from "./core/match-assists.mjs";
import { createMoveSoundPlayer, moveSoundForUsi } from "./core/move-sound";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "./core/opening-guide.mjs";
import { CPU_STRENGTH_PRESETS } from "./core/strength-settings.mjs";
import { TUTORIAL_LESSONS, TUTORIAL_TITLE, TUTORIAL_VOLUMES, tutorialLesson } from "./core/tutorial-curriculum.mjs";
import { loadPlayStreak, recordPlay, savePlayStreak } from "./core/play-streak.mjs";
import {
  INTERACTIVE_STEP_TYPES,
  TUTORIAL_AUTO_ADVANCE_MS,
  TUTORIAL_IDLE_HINT_MS,
  TUTORIAL_TAP_GUARD_MS,
  attemptTutorialChoice,
  choiceAdvanceDelay,
  attemptTutorialMove,
  autoAdvancesOnSolve,
  createStepState,
  lessonStars,
  matchLessonComment,
  matchLessonStars,
  replayMoveLabel,
  replaySpeech,
  seekReplay,
  tutorialGraphPly,
  tutorialGraphPoints,
  tutorialHint,
  tutorialMatchSettings,
  tutorialStepMarks,
} from "./core/tutorial-runner.mjs";
import {
  loadTutorialProgress,
  nextLesson,
  recordLessonCleared,
  recordLessonSkipped,
  saveTutorialProgress,
} from "./core/tutorial-progress.mjs";
import {
  chapterPosition,
  chapterSummary,
  firstLessonOfNextChapter,
  nextLessonInChapter,
  tutorialMap,
} from "./core/tutorial-map.mjs";

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
  /** タイトル画面の「将棋教室のつづき」から開いたとき、本棚を通さずに次のレッスンを始める。 */
  autoStart: { type: Boolean, default: false },
});
const emit = defineEmits(["close", "open-dex", "start-match"]);

const storage = typeof localStorage === "undefined" ? null : localStorage;
const progress = ref(loadTutorialProgress(storage));
function updateProgress(next: typeof progress.value) {
  progress.value = next;
  saveTutorialProgress(storage, next);
}

// 駒音。対局画面と同じ音を、指した手と観戦で進めた手に鳴らす。
const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl);
onMounted(() => moveSounds.preload());
function playMoveSoundFor(sfen: string, usi: string) {
  const kind = moveSoundForUsi(sfen, usi);
  if (kind) moveSounds.play(kind);
}

const volumes = TUTORIAL_VOLUMES as unknown as Volume[];
const lessons = TUTORIAL_LESSONS as unknown as Lesson[];
const view = ref<"map" | "lesson" | "chapter" | "result">("map");
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

/*
 * 盤の枠を、描かれる盤と同じ大きさにする。枠が残りの高さいっぱいに伸びると、縦横比を保って
 * 縮んだ盤との間に隙間ができ、台詞が盤から離れる。台詞欄の高さを引いた残りに盤の縦横比で収める。
 */
const stageEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const boardBoxStyle = ref<Record<string, string>>({});
// 盤の縦横比は描画後に盤から受け取る。初期値は標準レイアウトの比。
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
  // 台詞が長くても盤が小さくなりすぎないようにする。収まらない分は画面ごとスクロールする。
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

const currentLesson = computed(() => (lessonId.value ? tutorialLesson(lessonId.value) as Lesson | null : null));
const headerTitle = computed(() => {
  if ((view.value === "lesson" || view.value === "result") && currentLesson.value) return currentLesson.value.title;
  if (view.value === "chapter") return "章クリア！";
  return TUTORIAL_TITLE;
});
const backLabel = computed(() => (view.value === "map" ? "タイトルへ戻る" : "地図へ"));
function goBack() {
  if (view.value === "map") emit("close");
  else openMap();
}
// ブラウザの戻るからも、ヘッダーの戻るボタンと同じ段だけ戻す。
defineExpose({ goBack });

// ===== 地図(すごろくの道) =====
const upcomingLesson = computed(() => nextLesson(lessons, progress.value) as Lesson | null);
const map = computed(() => tutorialMap(volumes, lessons, progress.value));
const shelfMessage = computed(() => {
  if (!Object.keys(progress.value.lessons).length) return "ようこそ、やこび姫の将棋教室へ！ 光っているマスから始めよう。";
  return upcomingLesson.value ? "おかえり！ 光っているマスから続けよう。" : "全部のレッスンを終えたね！ 好きなマスで、もう一度遊べるよ。";
});
/** 閉じたマスを押したときなど、やこび姫が一言だけかける。 */
const mapMessage = ref("");
const mapEl = ref<HTMLElement | null>(null);
function nodeStateText(row: { state: string; stars: number }) {
  return ({
    cleared: `クリア・★${row.stars}`, skipped: "とばした", next: "ここから", open: "遊べる", locked: "まだ閉じている", soon: "準備中",
  } as Record<string, string>)[row.state] ?? "";
}
function onNodeClick(row: { id: string; state: string }) {
  if (row.state === "locked") {
    mapMessage.value = "そのマスは、光っているマスを終えると遊べるよ。";
    return;
  }
  startLesson(row.id);
}
function openMap() {
  clearStepTimers();
  clearChain();
  mapMessage.value = "";
  view.value = "map";
  // いま進めるマスが見える位置まで、地図をスクロールする。
  void nextTick(() => {
    mapEl.value?.querySelector("[data-map-current]")?.scrollIntoView({ block: "center" });
  });
}
function skipChapterById(chapterId: string) {
  let next = progress.value;
  for (const lesson of lessons.filter((entry) => entry.chapterId === chapterId)) {
    if (!lesson.comingSoon) next = recordLessonSkipped(next, lesson.id);
  }
  updateProgress(next);
}

// ===== 続けて進める(同じ章のレッスンは結果の画面を挟まない) =====
/** レッスンクリアの知らせ。出ている間に押すか、少し待つと次のレッスンが始まる。 */
const STAGE_CLEAR_MS = 1700;
const stageClear = ref<{ stars: number; nextId: string; nextTitle: string } | null>(null);
let chainTimer: ReturnType<typeof setTimeout> | undefined;
function clearChain() {
  clearTimeout(chainTimer);
  chainTimer = undefined;
  stageClear.value = null;
}
onBeforeUnmount(clearChain);
function continueChain() {
  const next = stageClear.value;
  clearChain();
  if (next) startLesson(next.nextId);
}
/** 章クリアの画面に出す章。 */
const clearedChapterId = ref("");
const clearedChapter = computed(() => (clearedChapterId.value ? chapterSummary(volumes, lessons, progress.value, clearedChapterId.value) : null));
const nextChapterLesson = computed(() => {
  const last = clearedChapter.value?.lessons.at(-1);
  return last ? firstLessonOfNextChapter(lessons, last.id) as Lesson | null : null;
});
const chapterClearMessage = computed(() => {
  const chapter = clearedChapter.value;
  if (!chapter) return "";
  if (chapter.stars >= chapter.maxStars) return "全部★3つ！ 完ぺきだね。この章でできるようになったことを、見てみよう。";
  return "章クリア、おめでとう！ できるようになったことを並べたよ。★が足りないところは、「もう一度」で取り直せるよ。";
});
const nextChapterButton = ref<HTMLButtonElement | null>(null);
function showChapterClear(chapterId: string) {
  clearStepTimers();
  clearChain();
  clearedChapterId.value = chapterId;
  view.value = "chapter";
  void nextTick(() => nextChapterButton.value?.focus());
}
/**
 * レッスンを終えたあと。同じ章に次のレッスンがあれば、知らせを出して続けて始める。章の最後なら、章クリアの画面へ。
 * stars が null のとき(スキップ・対局の結果のあと)は、知らせを出さずにすぐ進む。
 */
function continueAfter(lesson: Lesson, stars: number | null) {
  const next = nextLessonInChapter(lessons, lesson.id) as Lesson | null;
  if (!next) {
    showChapterClear(lesson.chapterId);
    return;
  }
  if (stars === null) {
    startLesson(next.id);
    return;
  }
  stageClear.value = { stars, nextId: next.id, nextTitle: next.title };
  chainTimer = setTimeout(continueChain, STAGE_CLEAR_MS);
}

/** 見出しの進み具合: 章のレッスンの区切りと、いまのレッスンの中のステップ。 */
const chapterTrack = computed(() => chapterPosition(lessons, lessonId.value));
const chapterInfo = computed(() => {
  const lesson = currentLesson.value;
  if (!lesson) return null;
  return chapterSummary(volumes, lessons, progress.value, lesson.chapterId);
});
const chapterNumber = computed(() => chapterInfo.value?.number ?? 0);
const chapterTitle = computed(() => (chapterInfo.value ? `第${chapterInfo.value.number}章 ${chapterInfo.value.title}` : ""));
function trackFill(index: number) {
  if (index < chapterTrack.value.index) return 100;
  if (index > chapterTrack.value.index) return 0;
  if (stageClear.value) return 100;
  const steps = currentLesson.value?.steps?.length ?? 1;
  return Math.round((stepIndex.value / steps) * 100);
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
const boardInteractive = computed(() => stepInteractive.value && !stepSolved.value && !stageClear.value);
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
/** 課題のステップ(盤で指す・選択問題)。吹き出しを目標の見た目にする。 */
const isTaskStep = computed(() => stepInteractive.value || currentStep.value?.type === "choose");
/** 吹き出しの上に出す、課題の種類。 */
const taskLabel = computed(() => {
  if (!isTaskStep.value || stepSolved.value) return "";
  if (currentStep.value?.type === "mate") return "詰ませてみよう";
  return currentStep.value?.type === "choose" ? "クイズ" : "やってみよう";
});
/**
 * 画面を押すと進められるか。説明・図鑑の案内はいつでも、観戦は1手ずつ、課題は正解したあと(自動で進むのを待たずに進める)。
 * 対局のステップは「対局をはじめる」だけで進む。
 */
const tapToAdvance = computed(() => {
  const type = currentStep.value?.type;
  if (type === "explain" || type === "open-dex" || type === "replay") return true;
  return isTaskStep.value && stepSolved.value;
});
const tapLabel = computed(() => {
  const step = currentStep.value;
  if (step?.type === "replay" && stepState.value.ply < step.moves.length) return "タップで次の手";
  return stepIndex.value >= (currentLesson.value?.steps?.length ?? 0) - 1 ? "タップでレッスン完了" : "タップで次へ";
});
const hasActions = computed(() => {
  const type = currentStep.value?.type;
  return type === "open-dex" || type === "play"
    || (stepInteractive.value && !stepSolved.value && stepState.value.movesUsed + stepState.value.ply > 0);
});
/** 選択問題でまちがえた選択肢。押せなくして、残りから選べるようにする。 */
const wrongChoices = ref<number[]>([]);
// 正解した押下や、続けて押した誤操作で、次のステップまで飛ばないようにする。
let lastTapAt = 0;
let solvedAt = 0;
/** 画面を押したとき。ボタンは各自の動きにまかせ、それ以外の場所を押したら進める。 */
function onStageTap(event: MouseEvent) {
  if ((event.target as HTMLElement | null)?.closest("button, select, a, input, summary")) return;
  advanceByTap();
}
function advanceByTap() {
  if (stageClear.value) {
    continueChain();
    return;
  }
  const step = currentStep.value;
  if (!step || !tapToAdvance.value) return;
  const now = Date.now();
  if (now - lastTapAt < TUTORIAL_TAP_GUARD_MS || now - solvedAt < 400) return;
  lastTapAt = now;
  if (step.type === "replay" && stepState.value.ply < step.moves.length) seekReplayBy(1);
  else advance();
}
/** キーボードでも進められる(Enter・スペース・→)。ボタンにフォーカスがあるときは、ボタンを押す動きにまかせる。 */
function onTutorialKeydown(event: KeyboardEvent) {
  if (view.value !== "lesson" || !["Enter", " ", "ArrowRight"].includes(event.key)) return;
  if ((event.target as HTMLElement | null)?.closest("button, select, input, textarea")) return;
  event.preventDefault();
  advanceByTap();
}
onMounted(() => window.addEventListener("keydown", onTutorialKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onTutorialKeydown));
/** 盤の課題で、しばらく操作がなければ、そっとヒントを出す(★には数えない)。 */
let idleHintTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleIdleHint() {
  clearTimeout(idleHintTimer);
  if (!stepInteractive.value || stepSolved.value) return;
  const index = stepIndex.value;
  idleHintTimer = setTimeout(() => {
    if (view.value !== "lesson" || stepIndex.value !== index || stepSolved.value || hintLevel.value > 0) return;
    hintLevel.value = 1;
    setFeedback("光っているマスに注目してみてね。", "info");
  }, TUTORIAL_IDLE_HINT_MS);
}
onBeforeUnmount(() => clearTimeout(idleHintTimer));
const stepSpeech = computed(() => {
  const step = currentStep.value;
  if (step?.type === "replay") return replaySpeech(step, stepState.value.ply);
  return step?.question ?? step?.speech;
});
const replayLabel = computed(() => (
  currentStep.value?.type === "replay" ? replayMoveLabel(currentStep.value, stepState.value.ply) : ""
));
const graphPoints = computed(() => tutorialGraphPoints(currentStep.value));
const graphPly = computed(() => tutorialGraphPly(currentStep.value, stepState.value));
// 観戦中はグラフを押した手数へ盤を動かす（再生できる範囲の中だけ）。
function onGraphSelect(ply: number) {
  if (currentStep.value?.type === "replay") seekReplayTo(ply);
}
function seekReplayBy(delta: number) {
  seekReplayTo(stepState.value.ply + delta);
}
function seekReplayTo(ply: number) {
  const step = currentStep.value;
  if (step?.type !== "replay") return;
  const before = stepState.value;
  stepState.value = seekReplay(step, before, ply);
  // 1手進めたときだけ駒音を鳴らす。
  if (stepState.value.ply === before.ply + 1) playMoveSoundFor(before.sfen, step.moves[before.ply]);
  stepSolved.value = stepState.value.solved;
  lastMove.value = step.moves[stepState.value.ply - 1] ?? "";
}

// 正解のあとに自動で次へ進めるタイマーと、詰将棋で相手の応手の駒音を少し遅らせるタイマー。
let stepTimers: ReturnType<typeof setTimeout>[] = [];
function clearStepTimers() {
  for (const timer of stepTimers) clearTimeout(timer);
  stepTimers = [];
}
onBeforeUnmount(clearStepTimers);

function loadStep(index: number) {
  clearStepTimers();
  stepIndex.value = index;
  const step = currentLesson.value?.steps?.[index];
  stepState.value = createStepState(step);
  stepSolved.value = false;
  hintLevel.value = 0;
  feedback.value = "";
  wrongChoices.value = [];
  scheduleIdleHint();
  // 棋譜の途中から始めるステップは、直前の手を強調する。
  const played = step?.type === "replay" ? step.moves.slice(0, step.from ?? 0) : (step?.sfen ? [] : step?.moves ?? []);
  lastMove.value = played.at(-1) ?? "";
}
function startLesson(id: string) {
  clearChain();
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
  scheduleIdleHint();
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
  playMoveSoundFor(before, usi);
  if (result.outcome === "continue") {
    if (result.reply) {
      const reply = result.reply;
      const afterMine = applyBefore(before, usi);
      lastMove.value = reply;
      // 相手の応手の駒音は、自分の手の音と重ならないよう少し遅らせる。
      stepTimers.push(setTimeout(() => playMoveSoundFor(afterMine, reply), 350));
      setFeedback(`相手は${formatHintMove(reply, afterMine)}と応じたよ。続けて詰ませよう！`, "info");
    } else {
      setFeedback("その調子！ 続けて動かそう。", "info");
    }
    hintLevel.value = 0;
    return;
  }
  stepSolved.value = true;
  solvedAt = Date.now();
  clearTimeout(idleHintTimer);
  hintLevel.value = 0;
  setFeedback(step.type === "mate" ? "詰み！ おみごと！" : "正解！ すごいね！", "good");
  // 盤で指すステップは、正解を少し見せてから自動で次へ進める。
  if (autoAdvancesOnSolve(step)) {
    const index = stepIndex.value;
    stepTimers.push(setTimeout(() => {
      if (view.value === "lesson" && stepIndex.value === index) advance();
    }, TUTORIAL_AUTO_ADVANCE_MS));
  }
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
    solvedAt = Date.now();
    setFeedback(`正解！ ${step.explanation ?? ""}`, "good");
    // 解説を読む時間をとってから、自動で次へ進む。画面を押せば待たずに進める。
    const stepAt = stepIndex.value;
    stepTimers.push(setTimeout(() => {
      if (view.value === "lesson" && stepIndex.value === stepAt) advance();
    }, choiceAdvanceDelay(step.explanation ?? "")));
  } else {
    mistakes.value += 1;
    wrongChoices.value = [...wrongChoices.value, index];
    setFeedback("ちがうみたい。ほかのを選んでみよう！", "bad");
  }
}
function finishLesson() {
  const lesson = currentLesson.value;
  if (!lesson) return;
  const stars = lessonStars({ mistakes: mistakes.value, hints: hints.value });
  updateProgress(recordLessonCleared(progress.value, lesson.id, stars));
  // レッスンを終えたら、続けて遊んだ日に数える。
  savePlayStreak(storage, recordPlay(loadPlayStreak(storage)));
  continueAfter(lesson, stars);
}
function advance() {
  clearStepTimers();
  const lesson = currentLesson.value;
  if (!lesson?.steps) return;
  if (stepIndex.value >= lesson.steps.length - 1) finishLesson();
  else loadStep(stepIndex.value + 1);
}
function skipCurrentLesson() {
  const lesson = currentLesson.value;
  if (!lesson) return;
  updateProgress(recordLessonSkipped(progress.value, lesson.id));
  continueAfter(lesson, null);
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
  // レッスンを終えたら、続けて遊んだ日に数える。
  savePlayStreak(storage, recordPlay(loadPlayStreak(storage)));
  view.value = "result";
  revealedStars.value = 0;
  revealStage.value = 0;
  // 対局のあとは、やこび姫の一言を読む時間を取ってから星を付ける。待たせないよう、星は短い間隔で付ける。
  const start = report ? 1200 : 200;
  revealTimers.push(setTimeout(() => { revealStage.value = 1; }, start));
  for (let index = 1; index <= stars; index += 1) {
    revealTimers.push(setTimeout(() => { revealedStars.value = index; }, start + index * 280));
  }
  revealTimers.push(setTimeout(() => { revealStage.value = 2; }, start + stars * 280 + 250));
}
onBeforeUnmount(clearRevealTimers);
/** 結果のボタンが出たら「次のレッスン」にフォーカスし、Enterだけでも進めるようにする。 */
const nextLessonButton = ref<HTMLButtonElement | null>(null);
watch(revealStage, (stage) => {
  if (stage >= 2) void nextTick(() => nextLessonButton.value?.focus());
});
onMounted(() => {
  const report = props.matchReport;
  // タイトル画面の「将棋教室のつづき」からは、地図を通さずに次のレッスンを始める。
  if (!report && props.autoStart && upcomingLesson.value) {
    startLesson(upcomingLesson.value.id);
    return;
  }
  if (!report || !tutorialLesson(report.lessonId)) {
    // 地図を開いたら、いま進めるマスが見える位置までスクロールする。
    void nextTick(() => mapEl.value?.querySelector("[data-map-current]")?.scrollIntoView({ block: "center" }));
    return;
  }
  lessonId.value = report.lessonId;
  showResult(matchLessonStars(report), report);
});
/** 対局のレッスンの結果から、次へ進む(同じ章の次のレッスンか、章クリア)。 */
function continueAfterResult() {
  if (currentLesson.value) continueAfter(currentLesson.value, null);
}
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
.shogi-game .shogi-tutorial__shelf,
.shogi-game .shogi-tutorial__map,
.shogi-game .shogi-tutorial__chapter-clear,
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
/* 次に進む先を示す、画面でいちばん目立つボタン。押すと影の分だけ沈む。 */
.shogi-game .shogi-tutorial__continue {
  display: block;
  width: min(100%, 40rem);
  min-height: 3.2rem;
  margin: 0 auto 1.1rem;
  padding: 0.75rem 1rem;
  border: 2px solid #f1a54c;
  border-radius: 0.8rem;
  color: #172632;
  background: #f1a54c;
  box-shadow: 0 4px 0 #b57c39;
  font: inherit;
  font-size: 1.05em;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__continue::before {
  content: "▶";
  margin-right: 0.5em;
  font-size: 0.85em;
}
.shogi-game .shogi-tutorial__continue:active {
  box-shadow: 0 1px 0 #b57c39;
  transform: translateY(3px);
}
.shogi-game .shogi-tutorial__meter {
  display: block;
  height: 0.45rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 252, 244, 0.18);
}
.shogi-game .shogi-tutorial__meter > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #f1a54c;
  transition: width 200ms ease;
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
/*
 * レッスン画面。台詞を盤の横に置くと視線が左右に離れて読みにくいので、画面の幅によらず
 * 台詞と操作を盤の真下に付けて置く。盤の枠の大きさはスクリプトで盤に合わせ、余った高さは台詞の下に残す。
 */
.shogi-game .shogi-tutorial .shogi-tutorial__stage {
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.25rem;
  min-height: 0;
  padding: 0.4rem clamp(0.5rem, 2vw, 1.5rem) 0.6rem;
  overflow-y: auto;
}
.shogi-game .shogi-tutorial .shogi-tutorial__stage > .shogi-dex__main {
  flex: none;
  align-items: center;
  min-width: 0;
}
.shogi-game .shogi-tutorial .shogi-tutorial__stage .shogi-dex__board {
  flex: none;
  max-width: 100%;
  aspect-ratio: auto;
}
.shogi-game .shogi-tutorial .shogi-tutorial__panel {
  flex: none;
  width: min(100%, 44rem);
  min-width: 0;
  align-self: center;
}
.shogi-game .shogi-tutorial__panel .shogi-dex__explanation {
  display: grid;
  gap: 0.45rem;
  padding: 0.5rem 0.7rem;
  font-size: var(--dex-text);
}
.shogi-game .shogi-tutorial__panel .shogi-dex__speech {
  align-items: center;
  margin: 0;
}
.shogi-game .shogi-tutorial__panel .shogi-dex__chara {
  height: clamp(52px, 8vh, 80px);
}
.shogi-game .shogi-tutorial__sub {
  margin: 0;
  opacity: 0.85;
}
/* 選択肢は、収まるだけ横に並べる(縦に積むと盤が小さくなるため)。長い選択肢は自然に折り返す。 */
.shogi-game .shogi-tutorial__options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
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
.shogi-game .shogi-tutorial__graph .evaluation-graph__svg {
  height: 8.5rem;
}
/* グラフの下の手数と評価値は、暗いパネルの上で読める色にする。 */
.shogi-game .shogi-tutorial__graph .evaluation-graph__selection {
  color: #f8fafc;
  font-size: 0.85rem;
}
.shogi-game .shogi-tutorial__graph .evaluation-graph__selection span {
  color: #fde68a;
}
.shogi-game .shogi-tutorial__replay {
  display: grid;
  gap: 0.45rem;
}
.shogi-game .shogi-tutorial__replay-move {
  margin: 0;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__replay-move small {
  font-weight: 400;
  opacity: 0.75;
}
.shogi-game .shogi-tutorial__replay-controls {
  display: flex;
  gap: 0.45rem;
}
.shogi-game .shogi-tutorial__replay-controls button {
  flex: 1 1 0;
  min-height: 2.6em;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.45rem;
  color: #fffcf4;
  background: rgba(29, 48, 63, 0.9);
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-tutorial__replay-controls button:disabled {
  cursor: default;
  opacity: 0.45;
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
/* 正解は明るい緑の札で、出た瞬間に小さく弾ませる。 */
.shogi-game .shogi-tutorial__feedback--good {
  color: #10281b;
  background: #8fdcaa;
  box-shadow: 0 3px 0 #4e9d6c;
  animation: shogi-tutorial-feedback-pop 260ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__feedback--good::before {
  content: "◎ ";
}
/* 間違いは責める感じにならないよう、赤ではなく落ち着いた薄紫にする。 */
.shogi-game .shogi-tutorial__feedback--bad {
  border-left: 4px solid #d7d1fd;
  background: rgba(215, 209, 253, 0.16);
}
@keyframes shogi-tutorial-feedback-pop {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: none; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__feedback--good { animation: none; }
}
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
/* ===== レッスン画面(2026-10 作り直し) ===== */
/*
 * 見出し: レッスン中は1行にまとめる。狭い画面では戻るボタンを矢印だけにし、題名は1行で切る。
 * スキップは見出しの右端の小さなボタンにする(押し間違えにくく、操作の邪魔をしない)。
 */
.shogi-game .shogi-tutorial .shogi-dex__header {
  flex-wrap: nowrap;
  gap: 0.6rem;
  padding: 0.4rem 0.7rem;
}
.shogi-game .shogi-tutorial .shogi-dex__header h1 {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .shogi-tutorial .shogi-dex__back {
  min-height: 2.4rem;
  padding: 0.3rem 0.8rem;
}
.shogi-game .shogi-tutorial__header-skip {
  flex: none;
  min-height: 2.2rem;
  padding: 0.2rem 0.8rem;
  border: 1px solid rgba(255, 252, 244, 0.35);
  border-radius: 999px;
  color: rgba(255, 252, 244, 0.75);
  background: transparent;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}
@media (max-width: 40rem) {
  .shogi-game .shogi-tutorial .shogi-tutorial__back-label {
    display: none;
  }
}
/* 画面のどこを押しても進む説明では、押せることを指の形で示す。 */
.shogi-game .shogi-tutorial__stage {
  cursor: default;
}
.shogi-game .shogi-tutorial--lesson .shogi-tutorial__stage:has(.shogi-tutorial__tap) {
  cursor: pointer;
}
/* やこび姫の吹き出し。立ち絵を大きくし、文字も大きく読みやすくする。 */
.shogi-game .shogi-tutorial__bubble {
  display: flex;
  align-items: flex-end;
  gap: 0.7rem;
  padding: 0.65rem 0.9rem;
  border: 2px solid rgba(255, 252, 244, 0.3);
  border-radius: 1rem;
  background: rgba(23, 38, 50, 0.92);
  transition: border-color 160ms ease, background-color 160ms ease;
}
.shogi-game .shogi-tutorial__bubble--task {
  border-color: #f1a54c;
  box-shadow: 0 0 0 3px rgba(241, 165, 76, 0.18);
}
.shogi-game .shogi-tutorial__bubble--good {
  border-color: #6ee7b7;
  background: rgba(16, 64, 52, 0.92);
}
.shogi-game .shogi-tutorial__bubble--bad {
  border-color: rgba(215, 209, 253, 0.8);
  animation: shogi-tutorial-nudge 260ms ease;
}
@keyframes shogi-tutorial-nudge {
  0%, 100% { transform: translateX(0); }
  30% { transform: translateX(-4px); }
  60% { transform: translateX(3px); }
}
.shogi-game .shogi-tutorial__chara {
  flex: none;
  height: clamp(72px, 11vh, 108px);
  width: auto;
  pointer-events: none;
  image-rendering: pixelated;
}
.shogi-game .shogi-tutorial__bubble-body {
  display: grid;
  flex: 1;
  gap: 0.3rem;
  min-width: 0;
}
.shogi-game .shogi-tutorial__task-label {
  justify-self: start;
  margin: 0;
  padding: 0.05rem 0.6rem;
  border-radius: 999px;
  color: #172632;
  background: #f1a54c;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.shogi-game .shogi-tutorial__speech {
  margin: 0;
  font-size: clamp(1rem, 2.4vw, 1.15rem);
  font-weight: 700;
  line-height: 1.6;
}
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback--good { color: #6ee7b7; }
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback--bad { color: #d7d1fd; }
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback--info { color: #93c5fd; }
.shogi-game .shogi-tutorial__bubble .shogi-tutorial__feedback--good::before { content: none; }
.shogi-game .shogi-tutorial__tap {
  justify-self: end;
  margin: 0;
  color: rgba(255, 252, 244, 0.7);
  font-size: 0.8rem;
  font-weight: 700;
}
.shogi-game .shogi-tutorial__tap span {
  display: inline-block;
  color: #f1a54c;
  animation: shogi-tutorial-tap 1s ease-in-out infinite;
}
@keyframes shogi-tutorial-tap {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}
.shogi-game .shogi-tutorial .shogi-tutorial__options button.shogi-tutorial__option--wrong:disabled {
  opacity: 0.4;
  text-decoration: line-through;
}
.shogi-game .shogi-tutorial__panel {
  display: grid;
  gap: 0.5rem;
}
/* 結果: できるようになったこと。 */
.shogi-game .shogi-tutorial__learned {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0.6rem 1rem;
  border: 2px solid #f1a54c;
  border-radius: 0.8rem;
  font-size: 1.1rem;
  font-weight: 800;
  text-align: center;
}
.shogi-game .shogi-tutorial__learned small {
  color: #f1a54c;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__bubble--bad,
  .shogi-game .shogi-tutorial__tap span {
    animation: none;
  }
}
/* ===== 地図(すごろくの道) ===== */
.shogi-game .shogi-tutorial__map {
  scroll-behavior: smooth;
}
/* 上: やこび姫と、集めた星と、「つづきから」。 */
.shogi-game .shogi-tutorial__map-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: end;
  gap: 0.4rem 0.8rem;
  width: min(100%, 36rem);
  margin: 0 auto 1rem;
}
.shogi-game .shogi-tutorial__map-hero-body {
  display: grid;
  gap: 0.25rem;
  padding: 0.6rem 0.8rem;
  border: 2px solid rgba(255, 252, 244, 0.3);
  border-radius: 1rem;
  background: rgba(23, 38, 50, 0.92);
}
.shogi-game .shogi-tutorial__map-total {
  margin: 0;
  color: #f1a54c;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__map-total small {
  color: rgba(255, 252, 244, 0.7);
  font-weight: 600;
}
.shogi-game .shogi-tutorial__map-hero .shogi-tutorial__continue {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.1rem;
  width: 100%;
  margin: 0;
  text-align: center;
}
.shogi-game .shogi-tutorial__map-hero .shogi-tutorial__continue::before {
  content: none;
}
.shogi-game .shogi-tutorial__map-hero .shogi-tutorial__continue small {
  font-size: 0.75em;
  letter-spacing: 0.08em;
}
/* 道。巻の看板、章の看板、レッスンのマスを縦に並べ、マスは左右にくねらせる。 */
.shogi-game .shogi-tutorial__road {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  width: min(100%, 36rem);
  margin: 0 auto;
  padding: 0 0 3rem;
  list-style: none;
}
.shogi-game .shogi-tutorial__road > li {
  display: grid;
  justify-items: center;
  width: 100%;
}
.shogi-game .shogi-tutorial__road-volume {
  margin-top: 1.4rem;
}
.shogi-game .shogi-tutorial__road-volume:first-child {
  margin-top: 0;
}
.shogi-game .shogi-tutorial__world {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.25rem 0.7rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  color: #172632;
  background: linear-gradient(135deg, #f6bd70, #f1a54c);
  box-shadow: 0 4px 0 #b57c39;
}
.shogi-game .shogi-tutorial__world-number {
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  color: #fffcf4;
  background: #172632;
  font-size: 0.78rem;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__world strong {
  font-size: 1.1rem;
}
.shogi-game .shogi-tutorial__world small {
  font-weight: 800;
}
.shogi-game .shogi-tutorial__world .shogi-tutorial__meter {
  grid-column: 1 / -1;
  height: 0.45rem;
  margin: 0;
  background: rgba(23, 38, 50, 0.25);
}
.shogi-game .shogi-tutorial__world .shogi-tutorial__meter > span {
  background: #172632;
}
.shogi-game .shogi-tutorial__road-chapter {
  margin: 0.9rem 0 0.2rem;
}
.shogi-game .shogi-tutorial__signpost {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem 0.7rem;
  padding: 0.3rem 0.9rem;
  border: 2px solid rgba(241, 165, 76, 0.55);
  border-radius: 999px;
  color: #f1a54c;
  background: rgba(23, 38, 50, 0.85);
  font-size: 0.9rem;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__signpost .shogi-tutorial__skip-chapter {
  min-height: 1.8rem;
  padding: 0 0.6rem;
  font-size: 0.75rem;
}
/* レッスンのマス。--laneで左右にずらし、道をくねらせる。 */
.shogi-game .shogi-tutorial__stop {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  width: 7rem;
  padding: 0.35rem 0;
  transform: translateX(calc((var(--lane, 2) - 2) * min(11vw, 4.2rem)));
}
.shogi-game .shogi-tutorial__node {
  position: relative;
  display: grid;
  place-items: center;
  width: 3.9rem;
  height: 3.6rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #fffcf4;
  background: #2b465b;
  box-shadow: 0 5px 0 #172632;
  font: inherit;
  cursor: pointer;
  transition: transform 120ms ease;
}
.shogi-game .shogi-tutorial__node:active:not(:disabled) {
  box-shadow: 0 1px 0 #172632;
  transform: translateY(4px);
}
.shogi-game .shogi-tutorial__node-icon {
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1;
}
.shogi-game .shogi-tutorial__node--cleared {
  color: #172632;
  background: #f1a54c;
  box-shadow: 0 5px 0 #b57c39;
}
.shogi-game .shogi-tutorial__node--next {
  width: 4.6rem;
  height: 4.3rem;
  color: #172632;
  background: #fffcf4;
  box-shadow: 0 5px 0 #b57c39, 0 0 0 6px rgba(241, 165, 76, 0.35);
  animation: shogi-tutorial-node-pulse 1.6s ease-in-out infinite;
}
.shogi-game .shogi-tutorial__node--open {
  border: 3px solid #f1a54c;
}
.shogi-game .shogi-tutorial__node--skipped {
  border: 2px dashed rgba(255, 252, 244, 0.45);
  color: rgba(255, 252, 244, 0.75);
}
.shogi-game .shogi-tutorial__node--locked {
  color: rgba(255, 252, 244, 0.6);
  background: #1f3343;
  box-shadow: 0 5px 0 #121e29;
}
.shogi-game .shogi-tutorial__node--locked .shogi-tutorial__node-icon {
  font-size: 1.05rem;
  filter: grayscale(1);
  opacity: 0.7;
}
.shogi-game .shogi-tutorial__node--soon {
  opacity: 0.45;
  cursor: default;
}
@keyframes shogi-tutorial-node-pulse {
  0%, 100% { box-shadow: 0 5px 0 #b57c39, 0 0 0 4px rgba(241, 165, 76, 0.35); }
  50% { box-shadow: 0 5px 0 #b57c39, 0 0 0 10px rgba(241, 165, 76, 0.15); }
}
/* 「ここから！」の吹き出し。 */
.shogi-game .shogi-tutorial__node-start {
  position: absolute;
  bottom: calc(100% + 0.45rem);
  left: 50%;
  padding: 0.15rem 0.6rem;
  border-radius: 0.5rem;
  color: #172632;
  background: #f1a54c;
  font-size: 0.78rem;
  font-weight: 900;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: shogi-tutorial-tap 1s ease-in-out infinite;
}
.shogi-game .shogi-tutorial__node-start::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  border: 0.35rem solid transparent;
  border-top-color: #f1a54c;
  transform: translateX(-50%);
}
.shogi-game .shogi-tutorial__road-lesson:has(.shogi-tutorial__node--next) {
  margin-top: 1.6rem;
}
.shogi-game .shogi-tutorial__node-title {
  max-width: 7rem;
  color: rgba(255, 252, 244, 0.9);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
}
.shogi-game .shogi-tutorial__node--locked + .shogi-tutorial__node-title {
  color: rgba(255, 252, 244, 0.45);
}
.shogi-game .shogi-tutorial__node-stars,
.shogi-game .shogi-tutorial__clear-stars,
.shogi-game .shogi-tutorial__learned-stars {
  display: flex;
  gap: 0.05rem;
  margin: 0;
  font-style: normal;
}
.shogi-game .shogi-tutorial__node-stars i,
.shogi-game .shogi-tutorial__clear-stars i,
.shogi-game .shogi-tutorial__learned-stars i {
  color: rgba(255, 252, 244, 0.2);
  font-style: normal;
}
.shogi-game .shogi-tutorial__node-stars i.on,
.shogi-game .shogi-tutorial__clear-stars i.on,
.shogi-game .shogi-tutorial__learned-stars i.on {
  color: #f6d365;
}
.shogi-game .shogi-tutorial__node-stars {
  font-size: 0.75rem;
}

/* ===== レッスンの見出しの進み具合(章の帯) ===== */
.shogi-game .shogi-tutorial__track {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: min(100% - 1.4rem, 44rem);
  margin: 0.4rem auto 0.1rem;
}
.shogi-game .shogi-tutorial__track-label {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  color: rgba(255, 252, 244, 0.75);
  font-size: 0.78rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shogi-game .shogi-tutorial__track ol {
  display: flex;
  flex: 1;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tutorial__track li {
  flex: 1;
  height: 0.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 252, 244, 0.18);
}
.shogi-game .shogi-tutorial__track li span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #f1a54c;
  transition: width 240ms ease;
}

/* ===== レッスンクリアの知らせ ===== */
.shogi-game .shogi-tutorial__lesson-view {
  position: relative;
}
.shogi-game .shogi-tutorial__clear {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.4rem;
  background: rgba(10, 20, 28, 0.62);
  cursor: pointer;
}
.shogi-game .shogi-tutorial__clear-title {
  margin: 0;
  color: #f1a54c;
  font-size: clamp(2.4rem, 9vw, 3.6rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  text-shadow: 0 4px 0 #172632;
  animation: shogi-tutorial-clear-pop 360ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__clear-stars {
  font-size: 2rem;
}
.shogi-game .shogi-tutorial__clear-stars i.on {
  animation: shogi-tutorial-clear-pop 320ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__clear-stars i.on:nth-child(2) { animation-delay: 120ms; }
.shogi-game .shogi-tutorial__clear-stars i.on:nth-child(3) { animation-delay: 240ms; }
.shogi-game .shogi-tutorial__clear-next {
  margin: 0.3rem 0 0;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  color: #172632;
  background: #fffcf4;
  font-weight: 800;
}
.shogi-game .shogi-tutorial__clear-map {
  min-height: 2.2rem;
  margin-top: 0.4rem;
  padding: 0.2rem 0.9rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
@keyframes shogi-tutorial-clear-pop {
  0% { opacity: 0; transform: scale(0.5); }
  100% { opacity: 1; transform: scale(1); }
}
.shogi-game .shogi-tutorial__clear-enter-active { transition: opacity 160ms ease; }
.shogi-game .shogi-tutorial__clear-leave-active { transition: opacity 120ms ease; }
.shogi-game .shogi-tutorial__clear-enter-from,
.shogi-game .shogi-tutorial__clear-leave-to { opacity: 0; }

/* ===== 章クリア ===== */
.shogi-game .shogi-tutorial__chapter-clear {
  display: grid;
  align-content: start;
  justify-items: center;
  gap: 0.7rem;
}
.shogi-game .shogi-tutorial__chapter-clear > * {
  width: min(100%, 36rem);
}
.shogi-game .shogi-tutorial__chapter-clear-eyebrow {
  margin: 0.6rem 0 0;
  color: rgba(255, 252, 244, 0.7);
  font-weight: 700;
  text-align: center;
}
.shogi-game .shogi-tutorial__chapter-clear h2 {
  margin: 0;
  color: #f1a54c;
  font-size: clamp(1.4rem, 5vw, 2rem);
  text-align: center;
  animation: shogi-tutorial-clear-pop 360ms cubic-bezier(0.3, 1.5, 0.5, 1) both;
}
.shogi-game .shogi-tutorial__chapter-clear-stars {
  margin: 0;
  color: #f6d365;
  font-size: 1.4rem;
  font-weight: 900;
  text-align: center;
}
.shogi-game .shogi-tutorial__learned-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .shogi-tutorial__learned-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
  padding: 0.5rem 0.8rem;
  border-radius: 0.7rem;
  background: rgba(43, 70, 91, 0.6);
}
.shogi-game .shogi-tutorial__learned-list b {
  display: block;
}
.shogi-game .shogi-tutorial__learned-list small {
  display: block;
  color: rgba(255, 252, 244, 0.75);
}
.shogi-game .shogi-tutorial__learned-retry {
  min-height: 2rem;
  padding: 0.1rem 0.7rem;
  border: 1px solid rgba(255, 252, 244, 0.45);
  border-radius: 999px;
  color: #fffcf4;
  background: transparent;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-tutorial__node--next,
  .shogi-game .shogi-tutorial__node-start,
  .shogi-game .shogi-tutorial__clear-title,
  .shogi-game .shogi-tutorial__clear-stars i.on,
  .shogi-game .shogi-tutorial__chapter-clear h2 {
    animation: none;
  }
}
</style>
