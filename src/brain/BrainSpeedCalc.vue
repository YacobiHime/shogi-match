<template>
  <!--
    スピード計算(docs/brain-training-design.mdの11-5)。簡単な計算20問を、数字キーでできるだけ速く答える。
    答えのけた数まで打つと採点し、合えば次へ、まちがえたら赤く揺れて打ち直す(合うまで次へ進まない)。
    「よーい…はじめ！」で始め、正解は○が跳ねて、続けて正解すると音が高くなる。帯の上の▼は前の自己ベストのペース(14-4の柱4)。
  -->
  <section class="brain-game brain-calc" aria-label="スピード計算" data-brain-speed>
    <div class="brain-paper" :class="{ 'brain-paper--ghost': ghostShown }">
      <div class="brain-paper__bar" aria-hidden="true">
        <span :style="{ transform: `scaleX(${progress})` }"></span>
        <i v-if="ghostShown" class="brain-ghost" :class="{ 'brain-ghost--passed': ghostPassed }" :style="{ left: `${ghostLeft * 100}%` }" data-brain-ghost>前のベスト</i>
      </div>
      <p class="brain-paper__status">
        <span>{{ phase === 'play' ? `${index + 1} / ${problems.length}` : modeLabel }}</span>
        <span v-if="phase === 'play' && combo >= COMBO_SHOWN" class="brain-combo" data-brain-combo>れんぞく <b>{{ combo }}</b></span>
        <span>段{{ level + 1 }} {{ SPEED_LEVELS[level].label }}</span>
      </p>
      <template v-if="phase === 'intro'">
        <p class="brain-paper__lead">計算の答えを、できるだけ速く押してね。まちがえたら、そのまま打ち直せばいいよ。</p>
        <p class="brain-paper__sample"><span>見本</span>3 + 4 = <strong>7</strong></p>
      </template>
      <BrainCountdown v-else-if="phase === 'ready'" @done="beginPlay" />
      <template v-else>
        <p v-if="phase === 'done'" class="brain-paper__finish" data-brain-finish>そこまで！</p>
        <p class="brain-paper__problem" :class="{ 'brain-paper__problem--done': phase === 'done' }" aria-live="off">
          {{ phase === 'done' ? resultText : current.text }}
        </p>
        <p
          v-if="phase === 'play'"
          class="brain-paper__answer"
          :class="{ 'brain-paper__answer--miss': missed, 'brain-paper__answer--ok': flashOk }"
          aria-live="polite"
        >{{ okText || input || "　" }}<i v-if="flashOk" :key="okKey" class="brain-ok" aria-hidden="true"></i></p>
      </template>
    </div>
    <div class="brain-calc__controls">
      <div v-if="phase === 'intro'" class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-start @click="start">はじめる</button>
      </div>
      <BrainNumberPad v-else :disabled="phase !== 'play'" @digit="type" @erase="input = input.slice(0, -1)" @submit="check(true)" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type PropType } from "vue";
import BrainCountdown from "./BrainCountdown.vue";
import BrainNumberPad from "./BrainNumberPad.vue";
import {
  SPEED_LEVELS,
  SPEED_MAX_LEVEL,
  SPEED_MEASURE_LEVEL,
  nextSpeedLevel,
  perProblemText,
  speedProblems,
} from "../core/brain-calc.mjs";

const props = defineProps({
  /** train(コース・自由練習)か、measure(前と後をくらべる測定。いつも段1)。 */
  mode: { type: String as PropType<"train" | "measure">, default: "train" },
  /** 保存した段(次に遊ぶ段)と、遅い回が続いた数。 */
  savedLevel: { type: Number, default: 0 },
  savedSlow: { type: Number, default: 0 },
  count: { type: Number, default: 20 },
  /** 段ごとの自己ベスト(1問の平均ms。0は記録なし)。前の自分の影(▼)に使う。添え字は段-1。 */
  bests: { type: Array as PropType<number[]>, default: () => [] },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number; recordId: string; extraLevels: Record<string, number>; text: string }): void;
  (event: "sound", kind: "correct" | "miss" | "finish"): void;
}>();

/** 連続の札を出す数(3問から。D:5-2)。 */
const COMBO_SHOWN = 3;
const level = props.mode === "measure" ? SPEED_MEASURE_LEVEL : Math.max(0, Math.min(SPEED_MAX_LEVEL, props.savedLevel));
const problems = speedProblems(Math.floor(Math.random() * 1e9), level, props.count);
const phase = ref<"intro" | "ready" | "play" | "done">("intro");
const index = ref(0);
const input = ref("");
const missed = ref(false);
const flashOk = ref(false);
const resultText = ref("");
const combo = ref(0);
const okText = ref("");
const okKey = ref(0);
/** 始めてからの時間(ms)。前の自分の影を動かすために100msごとに進める。 */
const elapsed = ref(0);
let startedAt = 0;
let clock: ReturnType<typeof setInterval> | null = null;
let shownAt = 0;
let totalMs = 0;
let firstTry = 0;
let triedWrong = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const current = computed(() => problems[index.value]);
const progress = computed(() => (phase.value === "intro" ? 0 : (index.value + (phase.value === "done" ? 1 : 0)) / problems.length));
const modeLabel = computed(() => (props.mode === "measure" ? "測定" : "スピード計算"));
/** この段の前の自己ベスト(1問のms)。測定のときは出さない(前と後を同じ条件でくらべるため)。 */
const ghostBest = computed(() => {
  const best = Number(props.bests[level] ?? 0);
  return props.mode === "measure" || !Number.isFinite(best) || best <= 0 ? 0 : best;
});
const ghostShown = computed(() => ghostBest.value > 0 && (phase.value === "play" || phase.value === "done"));
/** 前のベストのペースなら、いま何問目まで進んでいるか(帯の割合)。 */
const ghostAt = computed(() => Math.min(1, elapsed.value / (ghostBest.value * problems.length)));
const ghostPassed = computed(() => progress.value > ghostAt.value);
/** 印の置き場所。札の字が紙の端で切れないよう、両端を少し内側に寄せる。 */
const ghostLeft = computed(() => Math.min(0.92, Math.max(0.08, ghostAt.value)));

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  if (clock) clearInterval(clock);
});

function start() {
  phase.value = "ready";
}

/** 「はじめ！」のあと。ここから時間を数える。 */
function beginPlay() {
  phase.value = "play";
  index.value = 0;
  combo.value = 0;
  shownAt = performance.now();
  startedAt = shownAt;
  elapsed.value = 0;
  if (clock) clearInterval(clock);
  clock = setInterval(() => { elapsed.value = performance.now() - startedAt; }, 100);
}

function type(digit: string) {
  if (phase.value !== "play") return;
  missed.value = false;
  input.value = (input.value + digit).slice(0, 4);
  // 答えのけた数まで打ったら、すぐ採点する(決定を押さなくてよい)。
  if (input.value.length >= String(current.value.answer).length) check(false);
}

function check(forced: boolean) {
  if (phase.value !== "play" || !input.value) return;
  const answer = current.value.answer;
  if (Number(input.value) !== answer) {
    if (!forced && input.value.length < String(answer).length) return;
    triedWrong = true;
    missed.value = true;
    combo.value = 0;
    emit("sound", "miss");
    input.value = "";
    return;
  }
  totalMs += performance.now() - shownAt;
  if (!triedWrong) firstTry += 1;
  if (!triedWrong) combo.value += 1;
  triedWrong = false;
  flashOk.value = true;
  okText.value = input.value;
  okKey.value += 1;
  emit("sound", "correct");
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { flashOk.value = false; okText.value = ""; }, 220);
  input.value = "";
  if (index.value + 1 >= problems.length) {
    finish();
    return;
  }
  index.value += 1;
  shownAt = performance.now();
}

function finish() {
  phase.value = "done";
  if (clock) clearInterval(clock);
  clock = null;
  emit("sound", "finish");
  const average = Math.round(totalMs / problems.length);
  resultText.value = perProblemText(average);
  const next = props.mode === "measure"
    ? { level: props.savedLevel, slow: props.savedSlow }
    : nextSpeedLevel({ level, slow: props.savedSlow }, average);
  timer = setTimeout(() => {
    emit("finish", {
      value: average,
      level: next.level,
      correct: firstTry,
      total: problems.length,
      recordId: `speed-${level + 1}`,
      extraLevels: { "speed-slow": next.slow },
      text: `${resultText.value}（段${level + 1}）`,
    });
  }, 700);
}
</script>
