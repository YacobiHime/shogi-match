<template>
  <!--
    順番どおりに思い出す(記憶テスト・学校の講・毎日の練習で共通。docs/brain-training-design.mdの11-6)。
    札を順に押す。思い出せない場所は「とばす」で空けて先へ進める(順番がずれて全部まちがいにならないように)。
  -->
  <div class="brain-recall" data-brain-recall>
    <p class="brain-game__status"><span>{{ answer.length }} / {{ count }}</span><span>{{ label }}</span></p>
    <p class="brain-game__prompt">{{ prompt }}</p>
    <ol class="brain-recall__picked" :aria-label="`押した順（${answer.length}個）`">
      <li v-for="(word, index) in answer" :key="index" :class="{ 'brain-recall__picked--skip': !word }">
        <small>{{ numberOf(index) }}</small>{{ word || "？" }}
      </li>
      <li v-if="answer.length < count" class="brain-recall__picked--next"><small>{{ numberOf(answer.length) }}</small>{{ nextLocus }}</li>
    </ol>
    <ul class="brain-recall__pool">
      <li v-for="(word, index) in pool" :key="`${word}-${index}`">
        <button
          type="button"
          class="brain-glance__choice brain-palace__tile"
          :disabled="answer.includes(word)"
          :data-recall-word="word"
          @click="push(word)"
        >{{ word }}</button>
      </li>
    </ul>
    <div class="brain-game__actions">
      <button type="button" class="brain-game__secondary" :disabled="!answer.length" data-recall-undo @click="answer = answer.slice(0, -1)">1つ消す</button>
      <button type="button" class="brain-game__secondary" data-recall-skip @click="push('')">とばす</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";

const props = defineProps({
  pool: { type: Array as PropType<string[]>, required: true },
  count: { type: Number, required: true },
  prompt: { type: String, default: "覚えた順に、札を押してね。" },
  label: { type: String, default: "前から" },
  /** 場所の名前(あれば「次は○○」と出す)。backwardなら後ろの場所から。 */
  loci: { type: Array as PropType<string[]>, default: () => [] },
  backward: { type: Boolean, default: false },
});
const emit = defineEmits<{
  (event: "done", answer: string[]): void;
  (event: "sound", kind: "place"): void;
}>();

const answer = ref<string[]>([]);
const nextLocus = computed(() => props.loci[locusIndex(answer.value.length)] ?? "");

function locusIndex(index: number) {
  return props.backward ? props.count - 1 - index : index;
}
function numberOf(index: number) {
  return locusIndex(index) + 1;
}

function push(word: string) {
  if (answer.value.length >= props.count) return;
  answer.value = [...answer.value, word];
  emit("sound", "place");
  if (answer.value.length >= props.count) emit("done", [...answer.value]);
}
</script>

<style>
.shogi-game .brain-recall {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  width: 100%;
}
.shogi-game .brain-recall__picked {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-recall__picked li {
  display: inline-flex;
  align-items: baseline;
  gap: 0.2rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  color: #172632;
  background: #fffcf4;
  font-size: 0.85rem;
  font-weight: 800;
}
.shogi-game .brain-recall__picked small { color: #8a4b0f; font-size: 0.72rem; }
.shogi-game .brain-recall__picked .brain-recall__picked--skip { color: #5d6f7c; background: #d8d2c4; }
.shogi-game .brain-recall__picked .brain-recall__picked--next { color: #fffcf4; background: transparent; border: 2px dashed #f1a54c; }
/* 札は30枚まで並ぶので、答えのボタン(52px)より小さめにして1画面に収める(44px以上)。 */
.shogi-game .brain-recall__pool .brain-glance__choice { min-width: 44px; min-height: 44px; padding: 0.2rem 0.75rem; font-size: 1rem; }
.shogi-game .brain-recall__pool {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
