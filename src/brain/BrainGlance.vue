<template>
  <!--
    ちらっと盤(docs/brain-training-design.mdの3-1)。盤が一瞬だけ出て隠れる。真ん中の駒と、玉の方向を答える。
    答えは2回押すだけ(金か銀か・8方向)。両方押したらすぐ採点し、答えを盤で見せて次へ進む。
  -->
  <section class="brain-game brain-glance" aria-label="ちらっと盤" data-brain-glance>
    <p class="brain-game__status" aria-live="polite">
      <span>{{ Math.min(trials.length + (phase === 'feedback' || phase === 'done' ? 0 : 1), count) }} / {{ count }}</span>
      <span>見せる時間 {{ levelLabel }}</span>
    </p>
    <p class="brain-game__prompt">{{ prompt }}</p>
    <div class="brain-board" :class="{ 'brain-board--mask': phase === 'mask' }" aria-hidden="true">
      <span
        v-for="cell in cells"
        :key="cell.square"
        class="brain-board__cell"
        :class="cell.mark ? `brain-board__cell--${cell.mark}` : ''"
      >
        <span v-if="cell.piece" class="brain-piece" :class="{ 'brain-piece--king': cell.piece === '玉' }">{{ cell.piece }}</span>
        <span v-else-if="cell.square === GLANCE_CENTER && phase === 'ready'" class="brain-board__dot"></span>
      </span>
      <span v-if="phase === 'mask'" class="brain-board__noise"></span>
      <!-- 正解は盤に大きな○。まちがいは×で駒を隠さず、答えのマス(赤)だけで見せる(責めない。UD:5-3)。 -->
      <span v-if="phase === 'feedback' && lastCorrect" class="brain-board__verdict brain-board__verdict--ok">○</span>
    </div>

    <div v-if="phase === 'intro'" class="brain-game__actions">
      <button type="button" class="brain-game__primary" data-brain-start @click="startTrial">はじめる</button>
    </div>
    <div v-else-if="phase === 'answer'" class="brain-glance__answer">
      <div class="brain-glance__pieces" role="group" aria-label="真ん中の駒">
        <button
          v-for="piece in GLANCE_CENTER_PIECES"
          :key="piece.id"
          type="button"
          class="brain-glance__choice"
          :aria-pressed="answer.center === piece.id"
          :data-glance-center="piece.id"
          @click="chooseCenter(piece.id)"
        >{{ piece.label }}</button>
      </div>
      <div class="brain-glance__pad" role="group" aria-label="玉の方向">
        <template v-for="(cell, index) in PAD" :key="index">
          <button
            v-if="cell"
            type="button"
            class="brain-glance__choice brain-glance__arrow"
            :aria-pressed="answer.direction === cell.id"
            :aria-label="cell.label"
            :data-glance-direction="cell.id"
            @click="chooseDirection(cell.id)"
          ><span :style="{ transform: `rotate(${cell.angle}deg)` }" aria-hidden="true">↑</span></button>
          <span v-else class="brain-glance__pad-center" aria-hidden="true">玉は？</span>
        </template>
      </div>
    </div>
    <div v-else-if="phase === 'feedback'" class="brain-game__actions">
      <button type="button" class="brain-game__secondary" data-brain-next @click="advance">つぎへ</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  GLANCE_CENTER,
  GLANCE_CENTER_PIECES,
  GLANCE_DIRECTIONS,
  GLANCE_MASK_MS,
  GLANCE_MAX_LEVEL,
  GLANCE_READY_MS,
  glanceLevelLabel,
  glanceProblem,
  glanceSummary,
  glanceTimingValid,
  scoreGlance,
  squareOf,
} from "../core/brain-glance.mjs";
import { nextStair } from "../core/brain-training.mjs";

type Problem = ReturnType<typeof glanceProblem>;
type Trial = { level: number; correct: boolean; counted: boolean };

const props = defineProps({
  /** 始める段。 */
  startLevel: { type: Number, default: 0 },
  /** 問題の数。 */
  count: { type: Number, default: 16 },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number }): void;
  (event: "sound", kind: "correct" | "miss"): void;
}>();

/** 方向のボタンの3×3の並び(真ん中は空ける)。矢印の向きは上を0度にした角度。 */
const ANGLES: Record<string, number> = { "up-left": -45, up: 0, "up-right": 45, left: -90, right: 90, "down-left": -135, down: 180, "down-right": 135 };
const PAD = [
  "up-left", "up", "up-right",
  "left", null, "right",
  "down-left", "down", "down-right",
].map((id) => {
  if (!id) return null;
  const direction = GLANCE_DIRECTIONS.find((item) => item.id === id)!;
  return { id, label: direction.label, angle: ANGLES[id] };
});

const phase = ref<"intro" | "ready" | "show" | "mask" | "answer" | "feedback" | "done">("intro");
const stair = ref({ level: Math.max(0, Math.min(GLANCE_MAX_LEVEL, props.startLevel)), streak: 0 });
const problem = ref<Problem | null>(null);
const answer = ref<{ center: string; direction: string }>({ center: "", direction: "" });
const trials = ref<Trial[]>([]);
const lastCorrect = ref(false);
let shownMs = Number.NaN;
let timers: ReturnType<typeof setTimeout>[] = [];
let frame = 0;
const seedBase = Math.floor(Math.random() * 1e9);

const levelLabel = computed(() => glanceLevelLabel(problem.value?.level ?? stair.value.level));
const prompt = computed(() => {
  switch (phase.value) {
    case "intro": return "真ん中の駒と、玉の場所を覚えてね。盤は一瞬で消えるよ。";
    case "ready": return "見て！";
    case "show":
    case "mask": return "";
    case "answer": return "真ん中は金？銀？ 玉はどっちにあった？";
    case "feedback": return lastCorrect.value ? "正解！" : "答えはここだよ。";
    default: return "";
  }
});

/** 盤のマス。見せるとき・答え合わせのときだけ駒を置く。 */
const cells = computed(() => {
  const list: { square: string; piece: string; mark: string }[] = [];
  const visible = phase.value === "show" || phase.value === "feedback" || phase.value === "intro";
  const current = phase.value === "intro" ? glanceProblem(seedBase, 0) : problem.value;
  for (let rank = 1; rank <= 9; rank += 1) {
    for (let file = 9; file >= 1; file -= 1) {
      const square = squareOf(file, rank)!;
      let piece = "";
      let mark = "";
      if (visible && current) {
        if (square === GLANCE_CENTER) piece = current.center === "G" ? "金" : "銀";
        else if (square === current.king) piece = "玉";
        else if (current.distractors.includes(square)) piece = "歩";
        if (phase.value === "feedback") {
          if (square === current.king) mark = scoreGlance(current, answer.value).directionOk ? "ok" : "answer";
          if (square === GLANCE_CENTER) mark = scoreGlance(current, answer.value).centerOk ? "ok" : "answer";
        }
      }
      list.push({ square, piece, mark });
    }
  }
  return list;
});

function clearTimers() {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}
onBeforeUnmount(clearTimers);

function startTrial() {
  clearTimers();
  problem.value = glanceProblem(seedBase + trials.value.length * 7919, stair.value.level);
  answer.value = { center: "", direction: "" };
  phase.value = "ready";
  timers.push(setTimeout(showStimulus, GLANCE_READY_MS));
}

/** 盤を見せる。実際に画面に出ていた時間を、画面の更新(requestAnimationFrame)で数える。 */
function showStimulus() {
  const target = problem.value!.ms;
  phase.value = "show";
  let start = 0;
  const tick = (now: number) => {
    if (!start) start = now;
    // 次の更新で消すと、ちょうど約束の時間になるところで隠す。
    if (now - start + 8 >= target) {
      phase.value = "mask";
      frame = requestAnimationFrame((hidden) => {
        shownMs = hidden - start;
        frame = 0;
        timers.push(setTimeout(() => { phase.value = "answer"; }, GLANCE_MASK_MS));
      });
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

function chooseCenter(id: string) {
  answer.value = { ...answer.value, center: id };
  if (answer.value.direction) judge();
}
function chooseDirection(id: string) {
  answer.value = { ...answer.value, direction: id };
  if (answer.value.center) judge();
}

function judge() {
  const current = problem.value!;
  const { correct } = scoreGlance(current, answer.value);
  const counted = glanceTimingValid(current.ms, shownMs);
  trials.value = [...trials.value, { level: current.level, correct, counted }];
  lastCorrect.value = correct;
  emit("sound", correct ? "correct" : "miss");
  // 出ていた時間が約束と違った問題は、段の上げ下げにも使わない(数えない)。
  if (counted) stair.value = nextStair(stair.value, correct, { max: GLANCE_MAX_LEVEL });
  phase.value = "feedback";
  timers.push(setTimeout(advance, correct ? 900 : 1600));
}

function advance() {
  clearTimers();
  if (trials.value.length >= props.count) {
    phase.value = "done";
    const summary = glanceSummary(trials.value);
    emit("finish", { value: summary.value, level: stair.value.level, correct: summary.correct, total: summary.total });
    return;
  }
  startTrial();
}
</script>
