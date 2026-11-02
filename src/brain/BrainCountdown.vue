<template>
  <!--
    「よーい…はじめ！」(docs/brain-training-design.mdの14-4の柱4)。時間を測る種目の始めに0.9秒だけ出して、溜めを作る(D:2-2)。
    押せばすぐ始まる(待たせない。D:3-3)。字が跳ねるのは見た目だけで、prefers-reduced-motionでは跳ねない。
  -->
  <button type="button" class="brain-countdown" data-brain-countdown :aria-label="`${word}（押すとすぐ始まる）`" @click="finish">
    <strong :key="word" class="brain-countdown__word" :class="{ 'brain-countdown__word--go': word === GO_WORD }">{{ word }}</strong>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { brainAudio } from "../brain-audio";

/** よーい→はじめの時間(ms)。合わせて0.9秒(14-4)。 */
const READY_MS = 550;
const GO_MS = 350;
const READY_WORD = "よーい";
const GO_WORD = "はじめ！";

const emit = defineEmits<{ (event: "done"): void }>();

const word = ref(READY_WORD);
let timers: ReturnType<typeof setTimeout>[] = [];
let done = false;

onMounted(() => {
  brainAudio().play("ready");
  timers.push(setTimeout(() => {
    word.value = GO_WORD;
    brainAudio().play("go");
  }, READY_MS));
  timers.push(setTimeout(finish, READY_MS + GO_MS));
});
onBeforeUnmount(() => timers.forEach(clearTimeout));

function finish() {
  if (done) return;
  done = true;
  timers.forEach(clearTimeout);
  timers = [];
  emit("done");
}
</script>

<style>
.shogi-game .brain-countdown {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 7rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--dojo-radius, 14px);
  background: transparent;
  box-shadow: none;
  color: var(--dojo-ink, #1f2a33);
  font: inherit;
  cursor: pointer;
}
.shogi-game .brain-countdown__word {
  font-size: 2.6rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  animation: brain-countdown-pop 240ms cubic-bezier(0.2, 1.4, 0.4, 1);
}
.shogi-game .brain-countdown__word--go { color: var(--dojo-shu, #c4402a); font-size: 3rem; }
@keyframes brain-countdown-pop {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-countdown__word { animation: none; }
}
</style>
