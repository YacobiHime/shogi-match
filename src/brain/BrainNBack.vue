<template>
  <!--
    N問前の答え(docs/brain-training-design.mdの11-5)。式が1枚ずつ出る。答えるのは「N枚前の式」の答え。
    初めのN枚は覚えるだけ。1回(10問)ごとに、9問以上でNを上げ、6問以下で下げる(回の途中では変えない)。
  -->
  <section class="brain-game brain-calc" aria-label="N問前の答え" data-brain-nback>
    <div class="brain-paper">
      <div class="brain-paper__bar" aria-hidden="true"><span :style="{ transform: `scaleX(${progress})` }"></span></div>
      <p class="brain-paper__status">
        <span>{{ phase === 'play' ? `${Math.max(0, index - n) + (answering ? 1 : 0)} / ${NBACK_ANSWERS}` : modeLabel }}</span>
        <span>{{ n }}つ前<template v-if="rounds > 1">・{{ roundIndex + 1 }}回目</template></span>
      </p>
      <template v-if="phase === 'intro'">
        <p class="brain-paper__lead">式の答えを覚えておいて、<strong>{{ n }}つ前</strong>の式の答えを押してね。はじめの{{ n }}枚は覚えるだけだよ。</p>
        <p class="brain-paper__sample"><span>見本</span>2+1 → 4−3 → <strong>（1つ前の答え）3</strong></p>
      </template>
      <template v-else-if="phase === 'play'">
        <ol class="brain-nback__trail" aria-hidden="true">
          <li v-for="slot in trail" :key="slot.key" :class="{ 'brain-nback__slot--target': slot.target, 'brain-nback__slot--now': slot.now }">{{ slot.now ? "今" : slot.target ? "これ" : "" }}</li>
        </ol>
        <p class="brain-paper__problem">{{ round.items[index].text }}</p>
        <p class="brain-paper__lead brain-nback__ask">{{ answering ? `${n}つ前の式の答えは？` : "この答えを覚えてね" }}</p>
        <p class="brain-paper__answer" :class="{ 'brain-paper__answer--miss': feedback === 'miss', 'brain-paper__answer--ok': feedback === 'ok' }" aria-live="polite">
          {{ feedback === 'miss' ? `答えは ${round.expected[index]}` : input || "　" }}
        </p>
      </template>
      <template v-else-if="phase === 'between'">
        <p class="brain-paper__lead">{{ betweenText }}</p>
      </template>
      <template v-else>
        <p class="brain-paper__problem brain-paper__problem--done">{{ resultText }}</p>
      </template>
    </div>
    <div class="brain-calc__controls">
      <div v-if="phase === 'intro' || phase === 'between'" class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-start @click="startRound">{{ phase === 'intro' ? "はじめる" : "つぎの回へ" }}</button>
      </div>
      <div v-else-if="phase === 'play' && !answering" class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-next @click="advance">覚えた</button>
      </div>
      <BrainNumberPad v-else-if="phase === 'play'" :disabled="Boolean(feedback)" :show-submit="false" @digit="answer" @erase="() => {}" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type PropType } from "vue";
import BrainNumberPad from "./BrainNumberPad.vue";
import {
  NBACK_ANSWERS,
  NBACK_MEASURE_MAX,
  NBACK_MIN,
  nbackPassed,
  nbackRound,
  nbackText,
  nextNback,
} from "../core/brain-calc.mjs";

const props = defineProps({
  mode: { type: String as PropType<"train" | "measure">, default: "train" },
  /** 保存したN(次に遊ぶN)。 */
  savedLevel: { type: Number, default: NBACK_MIN },
  /** 1回の練習の回数(測定は合格するかぎり続ける)。 */
  rounds: { type: Number, default: 3 },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number; text: string }): void;
  (event: "sound", kind: "correct" | "miss"): void;
}>();

const seedBase = Math.floor(Math.random() * 1e9);
// 練習は前のNより1つ易しく始める(D:4-1)。測定はいつもN=1から。
const n = ref(props.mode === "measure" ? NBACK_MIN : Math.max(NBACK_MIN, Math.floor(props.savedLevel) - 1));
const roundIndex = ref(0);
const round = ref(nbackRound(seedBase, n.value));
const phase = ref<"intro" | "play" | "between" | "done">("intro");
const index = ref(0);
const input = ref("");
const feedback = ref<"" | "ok" | "miss">("");
const betweenText = ref("");
const resultText = ref("");
let roundCorrect = 0;
let correctTotal = 0;
let answeredTotal = 0;
let bestPassed = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

const answering = computed(() => index.value >= n.value);
const modeLabel = computed(() => (props.mode === "measure" ? "測定" : "N問前の答え"));
const totalRounds = computed(() => (props.mode === "measure" ? NBACK_MEASURE_MAX : props.rounds));
const progress = computed(() => {
  const inRound = phase.value === "play" ? index.value / round.value.items.length : phase.value === "intro" ? 0 : 1;
  return Math.min(1, (roundIndex.value + inRound) / totalRounds.value);
});
/** 今の式と、そこまでの裏返しの札(N枚)。いちばん左が答える札。 */
const trail = computed(() => {
  const slots = [];
  for (let back = Math.min(n.value, index.value); back >= 1; back -= 1) slots.push({ key: `b${back}`, target: back === n.value, now: false });
  slots.push({ key: "now", target: false, now: true });
  return slots;
});

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});

function startRound() {
  if (phase.value === "between") {
    roundIndex.value += 1;
    round.value = nbackRound(seedBase + roundIndex.value * 7919, n.value);
  }
  index.value = 0;
  roundCorrect = 0;
  input.value = "";
  feedback.value = "";
  phase.value = "play";
}

function answer(digit: string) {
  if (phase.value !== "play" || !answering.value || feedback.value) return;
  const ok = Number(digit) === round.value.expected[index.value];
  input.value = digit;
  feedback.value = ok ? "ok" : "miss";
  answeredTotal += 1;
  if (ok) {
    roundCorrect += 1;
    correctTotal += 1;
  }
  emit("sound", ok ? "correct" : "miss");
  timer = setTimeout(advance, ok ? 350 : 1000);
}

function advance() {
  if (timer) clearTimeout(timer);
  timer = null;
  input.value = "";
  feedback.value = "";
  if (index.value + 1 < round.value.items.length) {
    index.value += 1;
    return;
  }
  endRound();
}

function endRound() {
  const passed = nbackPassed(roundCorrect);
  if (passed) bestPassed = Math.max(bestPassed, n.value);
  const before = n.value;
  const next = nextNback(before, roundCorrect);
  const last = props.mode === "measure"
    ? !passed || before >= NBACK_MEASURE_MAX
    : roundIndex.value + 1 >= props.rounds;
  if (!last) {
    n.value = props.mode === "measure" ? before + 1 : next;
    betweenText.value = `${NBACK_ANSWERS}問中${roundCorrect}問。${next > before ? `つぎは${n.value}つ前にちょうせん！` : next < before ? `つぎは${n.value}つ前で、ていねいに。` : `つぎも${n.value}つ前だよ。`}`;
    phase.value = "between";
    return;
  }
  phase.value = "done";
  resultText.value = bestPassed ? nbackText(bestPassed) : `${NBACK_ANSWERS}問中${roundCorrect}問`;
  // 測定で合格したNは、練習を始めるNの目安にもする(1から少しずつ上がるのを待たせない)。
  const level = props.mode === "measure" ? Math.max(NBACK_MIN, props.savedLevel, bestPassed) : next;
  timer = setTimeout(() => {
    emit("finish", { value: bestPassed, level, correct: correctTotal, total: answeredTotal, text: bestPassed ? nbackText(bestPassed) : "" });
  }, 700);
}
</script>

<style>
.shogi-game .brain-nback__trail {
  display: flex;
  justify-content: center;
  gap: 0.3rem;
  min-height: 2.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-nback__trail li {
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 2.2rem;
  border: 2px solid #c9c2b0;
  border-radius: 0.35rem;
  color: #5d6f7c;
  background: repeating-linear-gradient(45deg, #ece5d4 0 4px, #f6f1e5 4px 8px);
  font-size: 0.7rem;
  font-weight: 800;
}
.shogi-game .brain-nback__trail .brain-nback__slot--target { border-color: #d9822b; color: #8a4b0f; background: #fbe3c4; }
.shogi-game .brain-nback__trail .brain-nback__slot--now { border-color: #2b465b; color: #fffcf4; background: #2b465b; }
.shogi-game .brain-nback__ask { min-height: 1.6em; }
</style>
