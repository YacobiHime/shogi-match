<template>
  <!-- 棋力テスト(docs/skill-assessment-design.mdの4章)。16問の問題で、棋力と力ごとの見立てを出す。 -->
  <div class="shogi-skill-test" role="dialog" aria-modal="true" aria-labelledby="shogi-skill-test-title" data-skill-test>
    <header class="shogi-skill-test__header">
      <button type="button" class="shogi-skill-test__back" @click="emit('close')">
        <span aria-hidden="true">←</span> やめる
      </button>
      <h1 id="shogi-skill-test-title">棋力テスト</h1>
      <span class="shogi-skill-test__count" aria-label="進み具合">{{ Math.min(answered + (phase === "consent" ? 0 : 1), TEST_LENGTH) }}/{{ TEST_LENGTH }}</span>
    </header>
    <div class="shogi-skill-test__progress" aria-hidden="true">
      <span :style="{ width: `${(answered / TEST_LENGTH) * 100}%` }"></span>
    </div>

    <!-- 答えを送るかの同意(公式の公開先で、まだ聞いていないときだけ。docs/skill-assessment-design.mdの7-2)。 -->
    <section v-if="phase === 'consent'" class="shogi-skill-test__consent" data-skill-consent>
      <img class="shogi-skill-test__chara" :src="charaUrl" alt="" aria-hidden="true">
      <h2>答えを、名前なしで送ってもいい？</h2>
      <p>みんなの答えで、問題の難しさを正しくするのに使うよ。名前や棋譜は送らないよ。あとから、やこびノートの「設定」で変えられるよ。</p>
      <div class="shogi-skill-test__consent-actions">
        <button type="button" data-skill-consent-no @click="decideConsent('no')">送らない</button>
        <button type="button" class="shogi-skill-test__primary" data-skill-consent-yes @click="decideConsent('yes')">送る</button>
      </div>
    </section>

    <section v-else-if="item" ref="stageEl" class="shogi-skill-test__stage" aria-label="問題">
      <div class="shogi-skill-test__board" :style="boardBoxStyle">
        <ShogiMatchBoard
          :sfen="boardSfen"
          :last-move="lastMove"
          :allow-move="phase === 'question' && !item.choices"
          :enable-drag-and-drop="true"
          :mobile="isNarrow"
          :layout="isNarrow ? 'portrait' : 'standard'"
          :asset-base-url="assetBaseUrl"
          :flip="flipped"
          :candidates="arrows"
          @usi-move="onBoardMove"
          @resize="onBoardResize"
        />
      </div>
      <div ref="panelEl" class="shogi-skill-test__panel">
        <p class="shogi-skill-test__ability" :data-ability="item.ability">
          <span>{{ abilityLabel }}</span>
          <small>{{ sideLabel }}</small>
        </p>
        <p class="shogi-skill-test__question" data-skill-question>{{ question }}</p>
        <div class="shogi-skill-test__speech">
          <img class="shogi-skill-test__chara" :src="charaUrl" alt="" aria-hidden="true">
          <p aria-live="polite">{{ speech }}</p>
        </div>
        <!-- 判断の3択。盤の青い矢印と同じ手を並べる。 -->
        <div v-if="item.choices && phase === 'question'" class="shogi-skill-test__choices" role="group" aria-label="選ぶ手">
          <button
            v-for="(usi, index) in item.choices"
            :key="usi"
            type="button"
            :data-skill-choice="index"
            @click="answerChoice(usi)"
          >
            <strong>{{ "ABC"[index] }}</strong>
            <span>{{ moveLabel(usi, item.sfen) }}</span>
          </button>
        </div>
        <div class="shogi-skill-test__actions">
          <button v-if="phase === 'question'" type="button" data-skill-skip @click="skip">わからない</button>
          <button v-if="phase === 'feedback'" type="button" class="shogi-skill-test__primary" data-skill-next @click="advance">
            {{ answered >= TEST_LENGTH ? "結果を見る" : "次の問題" }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import { createMoveSoundPlayer, moveSoundForUsi } from "./core/move-sound";
import { formatHintMove } from "./core/match-assists.mjs";
import { judgeProblemMove, lineSfens } from "./core/problem-set.mjs";
import { ABILITIES, TEST_LENGTH, answerItem, createTestState, nextItem, testFinished, testResult } from "./core/skill-test.mjs";
import { SKILL_TEST_BANK } from "./core/skill-test-bank.mjs";
import { appendUsiMove, createGameRecord } from "./game-state";

type Item = (typeof SKILL_TEST_BANK)[number];
type Prior = { band?: number[] | null; level?: number; spread?: number } | null;

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  /** 最初の目安(札の幅か、今の棋力)。 */
  prior: { type: Object as PropType<Prior>, default: null },
  /** 答えの送信の同意を聞くか(公式の公開先で、まだ聞いていない)。 */
  askConsent: { type: Boolean, default: false },
});
const emit = defineEmits<{
  (event: "close"): void;
  (event: "consent", value: "yes" | "no"): void;
  (event: "finish", payload: { result: ReturnType<typeof testResult>; answers: ReturnType<typeof createTestState>["answers"] }): void;
}>();

/** 答えたあと、答えを見せてから次の問題へ進むまで(ms)。盤やボタンを押せば待たずに進む。 */
const FEEDBACK_MS = { correct: 900, wrong: 1800 } as const;
/** 詰将棋の続きで、相手の応手を並べる間(ms)。 */
const REPLY_MS = 650;

const QUESTIONS: Record<string, string> = {
  take: "得する駒取りがあるよ。見つけて指そう",
  save: "このままだと駒を取られちゃう！ いちばん良い手を指そう",
  tactic: "駒得できる手があるよ（手筋）。見つけて指そう",
  defend: "このままだと詰まされちゃう！ 詰まない手を指そう",
  judge: "いちばん良い手はどれ？ 3つから選ぼう",
};

const charaUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);
const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl);
onMounted(() => moveSounds.preload());

const state = ref(createTestState({ prior: props.prior }));
const answered = computed(() => state.value.answers.length);
const phase = ref<"consent" | "question" | "waiting" | "feedback">(props.askConsent ? "consent" : "question");
const item = ref<Item | null>(null);
/** 詰将棋の何手目か(正解して続いているとき)と、その局面。 */
const step = ref(0);
const stepSfen = ref("");
const boardSfen = ref("");
const lastMove = ref("");
const arrows = ref<{ usi: string; guideKind?: "move" }[]>([]);
const speech = ref("");
let startedAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const clearTimer = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};
onBeforeUnmount(clearTimer);

const sideToMove = (sfen: string) => (sfen.split(" ")[1] === "w" ? "white" : "black");
/** 盤の下側を、問題で指す側にする。 */
const flipped = computed(() => Boolean(item.value) && sideToMove(item.value?.sfen ?? "") === "white");
const sideLabel = computed(() => (flipped.value ? "あなたは△後手（盤の下側）" : "あなたは▲先手（盤の下側）"));
const abilityLabel = computed(() => ABILITIES.find(({ id }) => id === item.value?.ability)?.label ?? "");
const question = computed(() => {
  const current = item.value;
  if (!current) return "";
  if (current.type === "mate") return `${current.problem?.plies ?? ""}手で詰ませよう`;
  return QUESTIONS[current.type] ?? "";
});
function moveLabel(usi: string, sfen: string) {
  return formatHintMove(usi, sfen);
}

function decideConsent(value: "yes" | "no") {
  emit("consent", value);
  phase.value = "question";
  showNext();
}

function showNext() {
  clearTimer();
  if (testFinished(state.value)) {
    emit("finish", { result: testResult(state.value), answers: state.value.answers });
    return;
  }
  const next = nextItem(state.value, SKILL_TEST_BANK) as Item | null;
  if (!next) {
    emit("finish", { result: testResult(state.value), answers: state.value.answers });
    return;
  }
  item.value = next;
  step.value = 0;
  stepSfen.value = next.sfen;
  boardSfen.value = next.sfen;
  lastMove.value = "";
  arrows.value = next.choices ? next.choices.map((usi) => ({ usi, guideKind: "move" as const })) : [];
  speech.value = answered.value === 0 ? "ふだんどおり考えてね。わからなかったら「わからない」で次へ進めるよ。" : "落ち着いて、盤をよく見てね。";
  phase.value = "question";
  startedAt = performance.now();
}
onMounted(() => {
  if (phase.value === "question") showNext();
});

function playSound(sfen: string, usi: string) {
  const kind = moveSoundForUsi(sfen, usi);
  if (kind) moveSounds.play(kind);
}
function positionAfter(sfen: string, usi: string) {
  const record = createGameRecord(sfen);
  return appendUsiMove(record, usi) ? record.position.sfen : sfen;
}

/** 答えを記録して、答えを見せる。 */
function finishItem(correct: boolean, { skipped = false, shown = "" } = {}) {
  const current = item.value;
  if (!current) return;
  state.value = answerItem(state.value, current, { correct, skipped, ms: performance.now() - startedAt });
  const answer = current.type === "mate" ? current.problem?.line?.[step.value] : (current.accepted?.[0] ?? current.best);
  if (correct) {
    speech.value = "いいね！ そのとおり。";
  } else {
    // 責めずに、答えの手を盤に見せる(U:4-3)。
    boardSfen.value = stepSfen.value;
    lastMove.value = "";
    arrows.value = answer ? [{ usi: answer, guideKind: "move" }] : [];
    speech.value = answer ? `答えは${moveLabel(answer, stepSfen.value)}だったよ。${skipped ? "" : shown}` : "次の問題へ進もう。";
  }
  phase.value = "feedback";
  timer = setTimeout(advance, correct ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong);
}
function advance() {
  if (phase.value !== "feedback") return;
  showNext();
}
function skip() {
  if (phase.value !== "question") return;
  finishItem(false, { skipped: true });
}
function answerChoice(usi: string) {
  const current = item.value;
  if (!current || phase.value !== "question") return;
  playSound(current.sfen, usi);
  boardSfen.value = positionAfter(current.sfen, usi);
  lastMove.value = usi;
  arrows.value = [];
  finishItem(Boolean(current.accepted?.includes(usi)));
}

function onBoardMove(usi: string) {
  const current = item.value;
  if (!current) return;
  if (phase.value === "feedback") {
    advance();
    return;
  }
  if (phase.value !== "question" || current.choices) return;
  playSound(stepSfen.value, usi);
  if (current.type === "mate" && current.problem) {
    const result = judgeProblemMove(current.problem, usi, stepSfen.value, step.value);
    if (!result.line.length) {
      // 指せない手は、答えにしない(もう一度指せる)。
      speech.value = result.speech;
      return;
    }
    const sfens = lineSfens(stepSfen.value, result.line);
    boardSfen.value = sfens[1] ?? stepSfen.value;
    lastMove.value = usi;
    if (result.next) {
      // 正解でまだ続く: 相手の応手を並べてから、次の手を指してもらう。
      phase.value = "waiting";
      timer = setTimeout(() => {
        boardSfen.value = result.next!.sfen;
        lastMove.value = result.line[result.line.length - 1];
        stepSfen.value = result.next!.sfen;
        step.value = result.next!.step;
        speech.value = "いいね！ 続けて詰ませよう。";
        phase.value = "question";
      }, REPLY_MS);
      return;
    }
    finishItem(result.correct);
    return;
  }
  boardSfen.value = positionAfter(current.sfen, usi);
  lastMove.value = usi;
  finishItem(Boolean(current.accepted?.includes(usi)));
}

// 狭い縦長の画面では縦長の盤にする(問題集と同じ基準)。
const narrowMediaQuery = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(max-width: 56rem) and (orientation: portrait), (max-width: 30rem)")
  : null;
const isNarrow = ref(Boolean(narrowMediaQuery?.matches));
function onNarrowChange(event: MediaQueryListEvent) { isNarrow.value = event.matches; }
onMounted(() => narrowMediaQuery?.addEventListener("change", onNarrowChange));
onBeforeUnmount(() => narrowMediaQuery?.removeEventListener("change", onNarrowChange));

/* 盤の枠を、描かれる盤と同じ大きさにする(問題集と同じ方法)。 */
const stageEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const boardBoxStyle = ref<Record<string, string>>({});
// 盤の縦横比(標準1471/959・縦長878/1168)。描かれた大きさが届いたら、それに合わせる。
const boardAspect = ref(isNarrow.value ? 878 / 1168 : 1471 / 959);
watch(isNarrow, (narrow) => { boardAspect.value = narrow ? 878 / 1168 : 1471 / 959; });
function onBoardResize({ width, height }: { width: number; height: number }) {
  if (width > 0 && height > 0 && Math.abs(width / height - boardAspect.value) > 0.005) boardAspect.value = width / height;
}
function layoutBoardBox() {
  const stage = stageEl.value;
  if (!stage) return;
  const style = getComputedStyle(stage);
  const innerWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const innerHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const row = style.flexDirection === "row";
  const panelHeight = panelEl.value?.offsetHeight ?? 0;
  const panelWidth = panelEl.value?.offsetWidth ?? 0;
  const gap = parseFloat(row ? style.columnGap : style.rowGap) || 0;
  const minHeight = Math.min(320, window.innerHeight * 0.42);
  const availableHeight = row ? innerHeight : Math.max(minHeight, innerHeight - panelHeight - gap);
  const availableWidth = row ? Math.max(1, innerWidth - panelWidth - gap) : innerWidth;
  const width = Math.max(1, Math.floor(Math.min(availableWidth, availableHeight * boardAspect.value)));
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
.shogi-game .shogi-skill-test {
  --skill-accent: #f1a54c;
  --skill-panel: #2b465b;
  --skill-ink: #fffcf4;
  --skill-sub: #cfd8de;
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  background: #1d303f;
  color: var(--skill-ink);
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
  animation: shogi-skill-test-enter 180ms ease-out both;
}
@keyframes shogi-skill-test-enter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .shogi-skill-test { animation: none; }
}
.shogi-game .shogi-skill-test__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
}
.shogi-game .shogi-skill-test__header h1 {
  flex: 1;
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: 0.08em;
}
.shogi-game .shogi-skill-test__back {
  min-height: 44px;
  padding: 0.3rem 0.9rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 999px;
  color: var(--skill-ink);
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-skill-test__count {
  color: var(--skill-accent);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.shogi-game .shogi-skill-test__progress {
  height: 6px;
  margin: 0 1rem;
  border-radius: 999px;
  background: rgba(255, 252, 244, 0.15);
  overflow: hidden;
}
.shogi-game .shogi-skill-test__progress span {
  display: block;
  height: 100%;
  background: var(--skill-accent);
  transition: width 200ms ease-out;
}
.shogi-game .shogi-skill-test__stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.75rem 1rem 1rem;
}
.shogi-game .shogi-skill-test__board {
  flex: none;
  overflow: hidden;
}
/* 対局画面・図鑑と同じく、盤と駒の着せ替えは出さない。 */
.shogi-game .shogi-skill-test .shogi-match-theme-controls {
  display: none;
}
.shogi-game .shogi-skill-test__panel {
  flex: 0 1 22rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.8rem 1rem;
  border-radius: 0.8rem;
  background: var(--skill-panel);
}
.shogi-game .shogi-skill-test__ability {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.6rem;
  margin: 0;
}
.shogi-game .shogi-skill-test__ability span {
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  color: #172632;
  background: var(--skill-accent);
  font-size: 0.8rem;
  font-weight: 800;
}
.shogi-game .shogi-skill-test__ability small {
  color: var(--skill-sub);
  font-size: 0.78rem;
}
.shogi-game .shogi-skill-test__question {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.45;
}
.shogi-game .shogi-skill-test__speech {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.shogi-game .shogi-skill-test__speech p {
  margin: 0;
  color: var(--skill-sub);
  font-size: 0.88rem;
  line-height: 1.55;
}
.shogi-game .shogi-skill-test__chara {
  width: 40px;
  height: 40px;
  flex: none;
  image-rendering: pixelated;
}
.shogi-game .shogi-skill-test__choices {
  display: grid;
  gap: 0.45rem;
}
.shogi-game .shogi-skill-test__choices button {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 44px;
  padding: 0.4rem 0.8rem;
  border: 2px solid #1d6fe0;
  border-radius: 0.6rem;
  color: var(--skill-ink);
  background: rgba(29, 111, 224, 0.16);
  font: inherit;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
}
.shogi-game .shogi-skill-test__choices strong {
  color: #8db8f5;
}
.shogi-game .shogi-skill-test__actions {
  display: flex;
  gap: 0.5rem;
}
.shogi-game .shogi-skill-test__actions button,
.shogi-game .shogi-skill-test__consent-actions button {
  flex: 1;
  min-height: 44px;
  padding: 0.4rem 0.9rem;
  border: 1px solid rgba(255, 252, 244, 0.5);
  border-radius: 0.6rem;
  color: var(--skill-ink);
  background: rgba(255, 252, 244, 0.06);
  font: inherit;
  cursor: pointer;
}
.shogi-game .shogi-skill-test .shogi-skill-test__primary {
  border-color: var(--skill-accent);
  color: #172632;
  background: var(--skill-accent);
  font-weight: 800;
}
.shogi-game .shogi-skill-test__consent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  width: min(100% - 2rem, 30rem);
  margin: auto;
  padding: 1.2rem;
  border-radius: 0.9rem;
  background: var(--skill-panel);
  text-align: center;
}
.shogi-game .shogi-skill-test__consent h2 {
  margin: 0;
  font-size: 1.1rem;
}
.shogi-game .shogi-skill-test__consent p {
  margin: 0;
  color: var(--skill-sub);
  font-size: 0.9rem;
  line-height: 1.6;
}
.shogi-game .shogi-skill-test__consent-actions {
  display: flex;
  gap: 0.6rem;
  width: 100%;
}
/* 縦長の画面: 盤を上、問いとボタンを下に。 */
@media (max-width: 56rem) and (orientation: portrait), (max-width: 30rem) {
  .shogi-game .shogi-skill-test__stage {
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 0.5rem;
  }
  .shogi-game .shogi-skill-test__panel {
    flex: none;
    width: 100%;
    box-sizing: border-box;
  }
}
</style>
