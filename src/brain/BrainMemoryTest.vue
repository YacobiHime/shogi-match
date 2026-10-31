<template>
  <!--
    記憶テスト(docs/brain-training-design.mdの11-6)。15個の言葉を60秒見て、順番どおりに思い出す。
    方法を教える前に1回(前の記録)、6週間のコースのあとにもう1回(後の記録)。
  -->
  <section class="brain-game brain-memory-test" aria-label="記憶テスト" data-brain-memory-test>
    <template v-if="phase === 'intro'">
      <p class="brain-game__prompt">{{ measure === 'after' ? "最初と同じテストで、いまの記憶を測ろう。" : "まず、いまの記憶を測ろう。" }}</p>
      <p class="brain-memory-test__lead">
        15個の言葉を{{ MEMORY_TEST_SECONDS }}秒見て、順番どおりに思い出すよ。
        <template v-if="measure === 'before'">覚え方は、いつものやり方でいいよ。</template>
        <template v-else>宮殿を使って覚えてみてね。</template>
      </p>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-start @click="startStudy">はじめる</button>
      </div>
    </template>

    <template v-else-if="phase === 'study'">
      <p class="brain-game__status"><span>覚える</span><span>{{ secondsLeft }}秒</span></p>
      <div class="brain-memory__timer" aria-hidden="true"><span :style="{ animationDuration: `${MEMORY_TEST_SECONDS}s` }"></span></div>
      <ol class="brain-memory-test__words">
        <li v-for="(item, index) in set.words" :key="item.word"><small>{{ index + 1 }}</small>{{ item.word }}</li>
      </ol>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-brain-next @click="startRecall">覚えた</button>
      </div>
    </template>

    <BrainOrderRecall
      v-else-if="phase === 'recall'"
      :pool="set.pool"
      :count="set.words.length"
      prompt="覚えた順に、言葉を押してね。"
      label="順番どおり"
      @sound="emit('sound', 'place')"
      @done="finish"
    />
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, type PropType } from "vue";
import BrainOrderRecall from "./BrainOrderRecall.vue";
import { MEMORY_TEST_SECONDS } from "../core/brain-program.mjs";
import { memoryTestSet, scoreOrder } from "../core/memory-palace.mjs";

const props = defineProps({
  /** before(方法を教える前)か、after(コースのあと)。 */
  measure: { type: String as PropType<"before" | "after">, default: "before" },
});
const emit = defineEmits<{
  (event: "finish", result: { value: number; level: number; correct: number; total: number; text: string; positions: boolean[] }): void;
  (event: "sound", kind: "place"): void;
}>();

const set = memoryTestSet(Math.floor(Math.random() * 1e9));
const phase = ref<"intro" | "study" | "recall">("intro");
const secondsLeft = ref(MEMORY_TEST_SECONDS);
let ticker: ReturnType<typeof setInterval> | null = null;

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}
onBeforeUnmount(stopTicker);

function startStudy() {
  phase.value = "study";
  secondsLeft.value = MEMORY_TEST_SECONDS;
  ticker = setInterval(() => {
    secondsLeft.value -= 1;
    if (secondsLeft.value <= 0) startRecall();
  }, 1000);
}
function startRecall() {
  stopTicker();
  phase.value = "recall";
}
function finish(answer: string[]) {
  const expected = set.words.map(({ word }) => word);
  const score = scoreOrder(expected, answer);
  emit("finish", { value: score.correct, level: 0, correct: score.correct, total: score.total, text: `${score.total}個中${score.correct}個`, positions: score.positions });
}
</script>

<style>
.shogi-game .brain-memory-test__lead { margin: 0; line-height: 1.7; text-align: center; }
.shogi-game .brain-memory-test__words {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-memory-test__words li {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  min-width: 0;
  padding: 0.45rem 0.5rem;
  border-radius: 0.6rem;
  color: #172632;
  background: #fffcf4;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.shogi-game .brain-memory-test__words small { color: #8a4b0f; font-size: 0.75rem; }
</style>
