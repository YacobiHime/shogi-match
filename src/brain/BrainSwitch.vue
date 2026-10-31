<template>
  <!--
    色で切り替え(docs/brain-training-design.mdの11-5)。数字が色の枠で出る。青の枠なら偶数か奇数か、
    赤の枠なら5より小さいか大きいかを、2つのボタンで答える。2問続けて正解で段が上がる(色の変わる割合と、答える時間)。
    色だけに頼らないよう、枠の形(青は丸い角・赤は角ばった二重線)と、答えのボタンの言葉も変える(U:7-3)。
  -->
  <section class="brain-game brain-calc brain-switch" aria-label="色で切り替え" data-brain-switch>
    <div class="brain-paper">
      <div class="brain-paper__bar" aria-hidden="true"><span :style="{ transform: `scaleX(${trials.length / count})` }"></span></div>
      <p class="brain-paper__status">
        <span>{{ phase === 'intro' ? "色で切り替え" : `${Math.min(trials.length + 1, count)} / ${count}` }}</span>
        <span>{{ switchLevelText(stair.level) }}</span>
      </p>
      <template v-if="phase === 'intro'">
        <p class="brain-paper__lead">枠の色で、答え方が変わるよ。</p>
        <div class="brain-switch__rules">
          <p class="brain-switch__frame brain-switch__frame--parity"><strong>{{ SWITCH_RULES.parity.label }}の枠</strong>偶数？奇数？</p>
          <p class="brain-switch__frame brain-switch__frame--size"><strong>{{ SWITCH_RULES.size.label }}の枠</strong>5より小さい？大きい？</p>
        </div>
      </template>
      <template v-else-if="trial">
        <div class="brain-switch__frame brain-switch__frame--big" :class="`brain-switch__frame--${trial.rule}`" :data-switch-rule="trial.rule">
          <small>{{ SWITCH_RULES[trial.rule].label }}：{{ SWITCH_RULES[trial.rule].question }}</small>
          <strong class="brain-switch__number">{{ trial.number }}</strong>
          <span v-if="feedback" class="brain-switch__verdict" :class="feedback === 'ok' ? 'brain-switch__verdict--ok' : 'brain-switch__verdict--miss'">
            {{ feedback === 'ok' ? "○" : feedback === 'late' ? "時間だよ" : answerLabel }}
          </span>
        </div>
        <div v-if="trial.limitMs" class="brain-switch__timer" aria-hidden="true">
          <span :key="trials.length" :style="{ animationDuration: `${trial.limitMs}ms` }"></span>
        </div>
      </template>
    </div>
    <div class="brain-calc__controls">
      <div v-if="phase === 'intro'" class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-start @click="next">はじめる</button>
      </div>
      <div v-else-if="trial" class="brain-switch__answers">
        <button
          v-for="option in SWITCH_RULES[trial.rule].options"
          :key="option.id"
          type="button"
          class="brain-pad__key brain-switch__answer"
          :disabled="Boolean(feedback)"
          :data-switch-answer="option.id"
          @click="answer(option.id)"
        >{{ option.label }}</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  SWITCH_MAX_LEVEL,
  SWITCH_RULES,
  scoreSwitch,
  switchLevelText,
  switchResultText,
  switchSummary,
  switchTrial,
} from "../core/brain-calc.mjs";
import { nextStair } from "../core/brain-training.mjs";

type Trial = ReturnType<typeof switchTrial>;

const props = defineProps({
  startLevel: { type: Number, default: 0 },
  count: { type: Number, default: 24 },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number; text: string }): void;
  (event: "sound", kind: "correct" | "miss"): void;
}>();

const seedBase = Math.floor(Math.random() * 1e9);
const phase = ref<"intro" | "play" | "done">("intro");
const stair = ref({ level: Math.max(0, Math.min(SWITCH_MAX_LEVEL, props.startLevel)), streak: 0 });
const trial = ref<Trial | null>(null);
const trials = ref<{ level: number; correct: boolean; ms: number }[]>([]);
const feedback = ref<"" | "ok" | "miss" | "late">("");
let shownAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let limitTimer: ReturnType<typeof setTimeout> | null = null;

const answerLabel = computed(() => {
  if (!trial.value) return "";
  const option = SWITCH_RULES[trial.value.rule].options.find(({ id }) => id === trial.value!.answer);
  return `答えは「${option?.label ?? ""}」`;
});

function clearTimers() {
  if (timer) clearTimeout(timer);
  if (limitTimer) clearTimeout(limitTimer);
  timer = null;
  limitTimer = null;
}
onBeforeUnmount(clearTimers);

function next() {
  clearTimers();
  feedback.value = "";
  if (trials.value.length >= props.count) {
    finish();
    return;
  }
  phase.value = "play";
  trial.value = switchTrial(seedBase + trials.value.length * 7919, trial.value?.rule ?? null, stair.value.level);
  shownAt = performance.now();
  if (trial.value.limitMs) limitTimer = setTimeout(() => answer(""), trial.value.limitMs);
}

function answer(choice: string) {
  if (!trial.value || feedback.value) return;
  const ms = Math.round(performance.now() - shownAt);
  const { correct, inTime } = scoreSwitch(trial.value, choice, ms);
  trials.value = [...trials.value, { level: trial.value.level, correct, ms }];
  stair.value = nextStair(stair.value, correct, { max: SWITCH_MAX_LEVEL });
  feedback.value = correct ? "ok" : inTime ? "miss" : "late";
  emit("sound", correct ? "correct" : "miss");
  if (limitTimer) clearTimeout(limitTimer);
  limitTimer = null;
  timer = setTimeout(next, correct ? 300 : 1000);
}

function finish() {
  phase.value = "done";
  const summary = switchSummary(trials.value);
  emit("finish", { value: summary.value, level: stair.value.level, correct: summary.correct, total: summary.total, text: switchResultText(summary) });
}

function onKey(event: KeyboardEvent) {
  if (phase.value !== "play" || !trial.value || feedback.value) return;
  const options = SWITCH_RULES[trial.value.rule].options;
  if (event.key === "ArrowLeft") answer(options[0].id);
  else if (event.key === "ArrowRight") answer(options[1].id);
  else return;
  event.preventDefault();
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<style>
.shogi-game .brain-switch__rules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  width: 100%;
}
.shogi-game .brain-switch__frame {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  margin: 0;
  padding: 0.7rem;
  border: 5px solid;
  color: #172632;
  background: #ffffff;
  text-align: center;
}
.shogi-game .brain-switch__frame strong { font-size: 1.05rem; }
.shogi-game .brain-switch__frame--parity { border-color: #2f62c9; border-radius: 1.4rem; }
.shogi-game .brain-switch__frame--size { border-color: #cf3b30; border-style: double; border-width: 7px; border-radius: 0.2rem; }
.shogi-game .brain-switch__frame--parity strong,
.shogi-game .brain-switch__frame--parity small { color: #2f62c9; }
.shogi-game .brain-switch__frame--size strong,
.shogi-game .brain-switch__frame--size small { color: #b2281f; }
.shogi-game .brain-switch__frame--big {
  width: min(100%, 15rem);
  min-height: 11rem;
  align-content: center;
}
.shogi-game .brain-switch__frame--big small { font-size: 0.9rem; font-weight: 800; }
.shogi-game .brain-switch__frame--big .brain-switch__number {
  color: #172632;
  font-size: clamp(4rem, 18vw, 6rem);
  line-height: 1;
}
.shogi-game .brain-switch__verdict {
  position: absolute;
  inset: auto 0 0.3rem;
  font-weight: 900;
}
.shogi-game .brain-switch__verdict--ok { color: #2a8a4a; font-size: 1.6rem; }
.shogi-game .brain-switch__verdict--miss { color: #b2281f; font-size: 0.95rem; }
.shogi-game .brain-switch__timer {
  width: min(100%, 15rem);
  height: 6px;
  border-radius: 3px;
  background: #ece5d4;
  overflow: hidden;
}
.shogi-game .brain-switch__timer span {
  display: block;
  height: 100%;
  background: #d9822b;
  transform-origin: left;
  animation: brain-timer linear forwards;
}
.shogi-game .brain-switch__answers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  width: min(100%, 22rem);
}
.shogi-game .brain-switch__answer { min-height: 72px; font-size: 1.4rem; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-switch__timer span { animation: none; }
}
</style>
