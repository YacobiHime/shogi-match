<template>
  <!--
    頭の中の盤(docs/brain-training-design.mdの3-3)。駒を覚える → 駒が消え、指し手が文字で流れる → 問いに答える。
    答えのあとは、指したあとの盤を見せて、どこにいたかを確かめられる(失敗の理由が見える。D:7-2)。
  -->
  <section class="brain-game brain-mental" aria-label="頭の中の盤" data-brain-mental>
    <p class="brain-game__status" aria-live="polite">
      <span>{{ Math.min(trials.length + (phase === 'result' ? 0 : 1), count) }} / {{ count }}</span>
      <span>{{ problem ? `${problem.moves.length}手` : "" }}</span>
    </p>
    <p class="brain-game__prompt">{{ prompt }}</p>
    <BrainBoard
      :pieces="boardPieces"
      :marks="marks"
      :interactive="phase === 'question' && problem?.question.type === 'square'"
      coords
      label="頭の中の盤"
      @square="answerSquare"
    />
    <p v-if="phase === 'moves' && problem" class="brain-mental__move" aria-live="assertive" data-mental-move>
      <small>{{ moveIndex + 1 }}手目</small>{{ problem.labels[moveIndex] }}
    </p>

    <div v-if="phase === 'intro'" class="brain-game__actions">
      <button type="button" class="brain-game__primary" data-brain-start @click="startTrial">はじめる</button>
    </div>
    <div v-else-if="phase === 'memorize'" class="brain-game__actions">
      <button type="button" class="brain-game__primary" data-brain-memorized @click="startMoves">覚えた</button>
    </div>
    <div v-else-if="phase === 'moves'" class="brain-game__actions">
      <button type="button" class="brain-game__secondary" data-mental-next-move @click="nextMove">つぎの手</button>
    </div>
    <div v-else-if="phase === 'question' && problem?.question.type === 'piece'" class="brain-mental__choices" role="group" aria-label="駒の名前">
      <button
        v-for="choice in pieceChoices"
        :key="choice.id"
        type="button"
        class="brain-glance__choice"
        :data-mental-choice="choice.id"
        @click="answer(choice.id)"
      >{{ choice.label }}</button>
    </div>
    <div v-else-if="phase === 'result'" class="brain-game__actions">
      <button type="button" class="brain-game__primary" data-brain-next @click="advance">{{ trials.length >= count ? "結果を見る" : "つぎへ" }}</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import BrainBoard from "./BrainBoard.vue";
import { nextStair } from "../core/brain-training.mjs";
import {
  MENTAL_MAX_LEVEL,
  MENTAL_MOVE_MS,
  mentalPieceChoices,
  mentalProblem,
  mentalSummary,
  scoreMental,
} from "../core/brain-mental-board.mjs";

type Problem = ReturnType<typeof mentalProblem>;

const props = defineProps({
  startLevel: { type: Number, default: 0 },
  count: { type: Number, default: 8 },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number }): void;
  (event: "sound", kind: "correct" | "miss" | "place"): void;
}>();

const phase = ref<"intro" | "memorize" | "moves" | "question" | "result" | "done">("intro");
const stair = ref({ level: Math.max(0, Math.min(MENTAL_MAX_LEVEL, props.startLevel)), streak: 0 });
const problem = ref<Problem | null>(null);
const moveIndex = ref(0);
const lastAnswer = ref("");
const lastCorrect = ref(false);
const trials = ref<{ plies: number; correct: boolean }[]>([]);
let timer: ReturnType<typeof setTimeout> | null = null;
const seedBase = Math.floor(Math.random() * 1e9);

const pieceChoices = computed(() => (problem.value ? mentalPieceChoices(problem.value) : []));
const boardPieces = computed(() => {
  if (!problem.value) return [];
  if (phase.value === "memorize") return problem.value.start;
  if (phase.value === "result") return problem.value.finalPieces;
  return [];
});
const marks = computed(() => {
  if (phase.value !== "result" || !problem.value) return {};
  const { question } = problem.value;
  const target = question.type === "square" ? question.answer : question.square;
  const result: Record<string, string> = { [target]: lastCorrect.value ? "ok" : "answer" };
  if (question.type === "square" && !lastCorrect.value && lastAnswer.value) result[lastAnswer.value] = "wrong";
  return result;
});
const prompt = computed(() => {
  switch (phase.value) {
    case "intro": return "駒を覚えたら、消えた駒を頭の中で動かそう。";
    case "memorize": return "駒の場所を覚えてね。";
    case "moves": return "頭の中で動かしてね。";
    case "question": return problem.value?.question.text ?? "";
    case "result": return lastCorrect.value ? "正解！ 頭の中の盤がよく見えているね。" : "指したあとの盤はこうなっていたよ。";
    default: return "";
  }
});

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}
onBeforeUnmount(clearTimer);

function startTrial() {
  clearTimer();
  problem.value = mentalProblem(seedBase + trials.value.length * 7919, stair.value.level);
  moveIndex.value = 0;
  lastAnswer.value = "";
  phase.value = "memorize";
}
function startMoves() {
  phase.value = "moves";
  moveIndex.value = 0;
  timer = setTimeout(nextMove, MENTAL_MOVE_MS);
}
function nextMove() {
  clearTimer();
  if (!problem.value) return;
  if (moveIndex.value + 1 >= problem.value.labels.length) {
    phase.value = "question";
    return;
  }
  moveIndex.value += 1;
  emit("sound", "place");
  timer = setTimeout(nextMove, MENTAL_MOVE_MS);
}
function answerSquare(square: string) {
  answer(square);
}
function answer(value: string) {
  if (!problem.value || phase.value !== "question") return;
  const { correct } = scoreMental(problem.value, value);
  lastAnswer.value = value;
  lastCorrect.value = correct;
  trials.value = [...trials.value, { plies: problem.value.moves.length, correct }];
  stair.value = nextStair(stair.value, correct, { max: MENTAL_MAX_LEVEL });
  emit("sound", correct ? "correct" : "miss");
  phase.value = "result";
}
function advance() {
  if (trials.value.length >= props.count) {
    phase.value = "done";
    const summary = mentalSummary(trials.value);
    emit("finish", { value: summary.value, level: stair.value.level, correct: summary.correct, total: summary.total });
    return;
  }
  startTrial();
}
</script>
