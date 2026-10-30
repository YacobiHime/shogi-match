<template>
  <!--
    盤面の記憶(docs/brain-training-design.mdの3-2)。局面を覚える → 隠れる → 駒箱から駒を選んで並べ直す → 答え合わせ。
    駒箱の駒を押してからマスを押すと置ける。置いた駒をもう一度押すと取り消す(UD:5-1の駒の操作と同じ流れ)。
  -->
  <section class="brain-game brain-memory" aria-label="盤面の記憶" data-brain-board-memory>
    <p class="brain-game__status" aria-live="polite">
      <span>{{ Math.min(trials.length + (phase === 'result' ? 0 : 1), count) }} / {{ count }}</span>
      <span>駒{{ problem?.pieces.length ?? 0 }}枚<template v-if="problem?.random">・でたらめな配置</template></span>
    </p>
    <p class="brain-game__prompt">{{ prompt }}</p>
    <div v-if="phase === 'memorize'" class="brain-memory__timer" aria-hidden="true">
      <span :style="{ animationDuration: `${problem?.memorizeMs ?? 0}ms` }"></span>
    </div>
    <BrainBoard
      :pieces="boardPieces"
      :ghosts="phase === 'result' ? missedPieces : []"
      :marks="phase === 'result' ? result?.marks ?? {} : {}"
      :interactive="phase === 'recall'"
      label="盤面"
      @square="onSquare"
    />

    <div v-if="phase === 'intro'" class="brain-game__actions">
      <button type="button" class="brain-game__primary" data-brain-start @click="startTrial">はじめる</button>
    </div>
    <div v-else-if="phase === 'memorize'" class="brain-game__actions">
      <button type="button" class="brain-game__secondary" data-brain-memorized @click="hide">覚えた</button>
    </div>
    <div v-else-if="phase === 'recall'" class="brain-memory__tools">
      <div v-if="problem?.bothSides" class="brain-memory__colors" role="group" aria-label="先手か後手か">
        <button type="button" class="brain-glance__choice" :aria-pressed="color === 'black'" data-memory-color="black" @click="color = 'black'">▲先手</button>
        <button type="button" class="brain-glance__choice" :aria-pressed="color === 'white'" data-memory-color="white" @click="color = 'white'">△後手</button>
      </div>
      <div class="brain-memory__palette" role="group" aria-label="駒箱">
        <button
          v-for="kind in palette"
          :key="kind"
          type="button"
          class="brain-glance__choice"
          :aria-pressed="selected === kind"
          :data-memory-kind="kind"
          @click="selected = selected === kind ? '' : kind"
        >{{ pieceName(kind) }}</button>
      </div>
      <button type="button" class="brain-game__primary" data-memory-done @click="judge">できた</button>
    </div>
    <div v-else-if="phase === 'result'" class="brain-game__actions">
      <button type="button" class="brain-game__primary" data-brain-next @click="advance">{{ trials.length >= count ? "結果を見る" : "つぎへ" }}</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import BrainBoard from "./BrainBoard.vue";
import {
  BOARD_MEMORY_MAX_LEVEL,
  RANDOM_TRIAL_INDEX,
  boardMemoryProblem,
  boardMemorySummary,
  nextBoardMemoryLevel,
  paletteKinds,
  scoreBoardMemory,
} from "../core/brain-board-memory.mjs";
import { pieceName } from "../core/brain-mental-board.mjs";

type Problem = ReturnType<typeof boardMemoryProblem>;
type Placed = Record<string, { kind: string; color: string }>;

const props = defineProps({
  startLevel: { type: Number, default: 0 },
  count: { type: Number, default: 5 },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number }): void;
  (event: "sound", kind: "correct" | "miss" | "place"): void;
}>();

const phase = ref<"intro" | "memorize" | "recall" | "result" | "done">("intro");
const level = ref(Math.max(0, Math.min(BOARD_MEMORY_MAX_LEVEL, props.startLevel)));
const problem = ref<Problem | null>(null);
const placed = ref<Placed>({});
const selected = ref("");
const color = ref<"black" | "white">("black");
const result = ref<ReturnType<typeof scoreBoardMemory> | null>(null);
const trials = ref<{ pieces: number; accuracy: number; random: boolean }[]>([]);
let timer: ReturnType<typeof setTimeout> | null = null;
const seedBase = Math.floor(Math.random() * 1e9);

const palette = computed(() => (problem.value ? paletteKinds(problem.value) : []));
const boardPieces = computed(() => {
  if (!problem.value) return [];
  if (phase.value === "memorize" || phase.value === "intro") return problem.value.pieces;
  if (phase.value === "recall" || phase.value === "result") {
    return Object.entries(placed.value).map(([square, piece]) => ({ square, ...piece }));
  }
  return [];
});
/** 答え合わせで、置かなかった駒を薄く見せる。 */
const missedPieces = computed(() => {
  if (!problem.value || !result.value) return [];
  return problem.value.pieces.filter(({ square }) => result.value!.marks[square] === "missed" || result.value!.marks[square] === "wrong");
});
const prompt = computed(() => {
  switch (phase.value) {
    case "intro": return "局面を覚えて、空の盤に並べ直そう。";
    case "memorize": return "駒の場所を覚えてね。";
    case "recall": return selected.value ? `${pieceName(selected.value)}を置くマスを押してね。` : "駒箱から駒を選んで、マスに置こう。";
    case "result": return resultMessage.value;
    default: return "";
  }
});
const resultMessage = computed(() => {
  const score = result.value;
  if (!score || !problem.value) return "";
  if (problem.value.random) {
    return `でたらめな配置は${score.correct}/${score.total}枚。形のまとまりがないと、覚えにくいよね。`;
  }
  if (score.castleWhole) return `${problem.value.castleLabel}を1つのまとまりで覚えたね。強い人の覚え方だよ！`;
  if (score.accuracy >= 0.9) return `${score.correct}/${score.total}枚、ぴったり！`;
  return `${score.correct}/${score.total}枚。赤いマスと薄い駒が答えだよ。`;
});

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}
onBeforeUnmount(clearTimer);

function startTrial() {
  clearTimer();
  // 5問の回だけ、3問目にでたらめな配置を出す(形のある局面と比べるため)。
  const random = props.count >= 5 && trials.value.length === RANDOM_TRIAL_INDEX;
  problem.value = boardMemoryProblem(seedBase + trials.value.length * 7919, level.value, { random });
  placed.value = {};
  selected.value = "";
  color.value = "black";
  result.value = null;
  phase.value = "memorize";
  timer = setTimeout(hide, problem.value.memorizeMs);
}
function hide() {
  clearTimer();
  phase.value = "recall";
}
function onSquare(square: string) {
  const current = placed.value[square];
  if (!selected.value) {
    if (current) {
      const next = { ...placed.value };
      delete next[square];
      placed.value = next;
    }
    return;
  }
  if (current && current.kind === selected.value && current.color === color.value) {
    const next = { ...placed.value };
    delete next[square];
    placed.value = next;
    return;
  }
  placed.value = { ...placed.value, [square]: { kind: selected.value, color: color.value } };
  emit("sound", "place");
}
function judge() {
  if (!problem.value) return;
  const score = scoreBoardMemory(problem.value, placed.value);
  result.value = score;
  trials.value = [...trials.value, { pieces: problem.value.pieces.length, accuracy: score.accuracy, random: problem.value.random }];
  level.value = nextBoardMemoryLevel(level.value, score.accuracy, problem.value.random);
  emit("sound", score.accuracy >= 0.9 ? "correct" : "miss");
  phase.value = "result";
}
function advance() {
  if (trials.value.length >= props.count) {
    phase.value = "done";
    const summary = boardMemorySummary(trials.value);
    emit("finish", { value: summary.value, level: level.value, correct: summary.correct, total: summary.total });
    return;
  }
  startTrial();
}
</script>
