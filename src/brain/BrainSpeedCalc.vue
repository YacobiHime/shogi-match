<template>
  <!--
    スピード計算(docs/brain-training-design.mdの11-5)。簡単な計算20問を、数字キーでできるだけ速く答える。
    答えのけた数まで打つと採点し、合えば次へ、まちがえたら赤く揺れて打ち直す(合うまで次へ進まない)。
  -->
  <section class="brain-game brain-calc" aria-label="スピード計算" data-brain-speed>
    <div class="brain-paper">
      <div class="brain-paper__bar" aria-hidden="true"><span :style="{ transform: `scaleX(${progress})` }"></span></div>
      <p class="brain-paper__status">
        <span>{{ phase === 'play' ? `${index + 1} / ${problems.length}` : modeLabel }}</span>
        <span>段{{ level + 1 }} {{ SPEED_LEVELS[level].label }}</span>
      </p>
      <template v-if="phase === 'intro'">
        <p class="brain-paper__lead">計算の答えを、できるだけ速く押してね。まちがえたら、そのまま打ち直せばいいよ。</p>
        <p class="brain-paper__sample"><span>見本</span>3 + 4 = <strong>7</strong></p>
      </template>
      <template v-else>
        <p class="brain-paper__problem" :class="{ 'brain-paper__problem--done': phase === 'done' }" aria-live="off">
          {{ phase === 'done' ? resultText : current.text }}
        </p>
        <p
          class="brain-paper__answer"
          :class="{ 'brain-paper__answer--miss': missed, 'brain-paper__answer--ok': flashOk }"
          aria-live="polite"
        >{{ input || "　" }}</p>
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
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number; recordId: string; extraLevels: Record<string, number>; text: string }): void;
  (event: "sound", kind: "correct" | "miss"): void;
}>();

const level = props.mode === "measure" ? SPEED_MEASURE_LEVEL : Math.max(0, Math.min(SPEED_MAX_LEVEL, props.savedLevel));
const problems = speedProblems(Math.floor(Math.random() * 1e9), level, props.count);
const phase = ref<"intro" | "play" | "done">("intro");
const index = ref(0);
const input = ref("");
const missed = ref(false);
const flashOk = ref(false);
const resultText = ref("");
let shownAt = 0;
let totalMs = 0;
let firstTry = 0;
let triedWrong = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const current = computed(() => problems[index.value]);
const progress = computed(() => (phase.value === "intro" ? 0 : (index.value + (phase.value === "done" ? 1 : 0)) / problems.length));
const modeLabel = computed(() => (props.mode === "measure" ? "測定" : "スピード計算"));

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});

function start() {
  phase.value = "play";
  index.value = 0;
  shownAt = performance.now();
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
    emit("sound", "miss");
    input.value = "";
    return;
  }
  totalMs += performance.now() - shownAt;
  if (!triedWrong) firstTry += 1;
  triedWrong = false;
  flashOk.value = true;
  emit("sound", "correct");
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { flashOk.value = false; }, 160);
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
