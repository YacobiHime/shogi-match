<template>
  <!--
    順番どおりに思い出す(記憶テスト・学校の講・毎日の練習で共通。docs/brain-training-design.mdの11-6)。
    札を順に押す。思い出せない場所は「とばす」で空けて先へ進める(順番がずれて全部まちがいにならないように)。
    宮殿の場所(places)があれば「灯籠の道」で見せ、いまの場所の灯籠が光る。押し終えたら、合った灯籠が1つずつ順に灯る(解放。D:2-2)。
    消えたままの灯籠には正しい言葉を出す(答えを確かめる。14-3のB24)。押せば灯る演出は飛ばせる(U:6)。
  -->
  <div class="brain-recall" :class="{ 'brain-recall--lanterns': lanterns.length }" data-brain-recall>
    <p class="brain-game__status"><span>{{ answer.length }} / {{ count }}</span><span>{{ label }}</span></p>
    <p class="brain-game__prompt">{{ revealing || revealed ? revealText : prompt }}</p>
    <ol v-if="lanterns.length" class="brain-recall__lanterns" :aria-label="`${label}の道`" data-brain-lanterns @click="finishReveal">
      <li
        v-for="lantern in lanterns"
        :key="lantern.index"
        class="brain-lantern"
        :class="{
          'brain-lantern--now': lantern.now,
          'brain-lantern--lit': lantern.lit,
          'brain-lantern--out': lantern.out,
          'brain-lantern--wait': lantern.wait,
        }"
        :data-lantern="lantern.index"
      >
        <b aria-hidden="true">{{ lantern.emoji }}</b>
        <span class="brain-lantern__name">{{ lantern.name }}</span>
        <span class="brain-lantern__word">{{ lantern.word }}</span>
        <small v-if="lantern.out && lantern.expected" class="brain-lantern__answer">{{ lantern.expected }}</small>
      </li>
    </ol>
    <ol v-else class="brain-recall__picked" :aria-label="`押した順（${answer.length}個）`">
      <li v-for="(word, index) in answer" :key="index" :class="{ 'brain-recall__picked--skip': !word }">
        <small>{{ numberOf(index) }}</small>{{ word || "？" }}
      </li>
      <li v-if="answer.length < count" class="brain-recall__picked--next"><small>{{ numberOf(answer.length) }}</small>{{ nextLocus }}</li>
    </ol>
    <template v-if="!revealing && !revealed">
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
    </template>
    <div v-else-if="revealed" class="brain-game__actions">
      <button type="button" class="brain-game__primary" data-recall-next @click="emitDone">つぎへ</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type PropType } from "vue";
import { brainAudio } from "../brain-audio";
import { comboStep } from "../core/brain-sound.mjs";

type Place = { name: string; emoji?: string };

const props = defineProps({
  pool: { type: Array as PropType<string[]>, required: true },
  count: { type: Number, required: true },
  prompt: { type: String, default: "覚えた順に、札を押してね。" },
  label: { type: String, default: "前から" },
  /** 場所の名前(あれば「次は○○」と出す)。backwardなら後ろの場所から。 */
  loci: { type: Array as PropType<string[]>, default: () => [] },
  backward: { type: Boolean, default: false },
  /** 宮殿の場所(名前と絵)。あれば灯籠の道で見せる(14-11)。 */
  places: { type: Array as PropType<Place[]>, default: () => [] },
  /** 正しい答え(押す順)。あれば、押し終えたあと合った灯籠を順に灯す。 */
  expected: { type: Array as PropType<string[]>, default: () => [] },
});
const emit = defineEmits<{
  (event: "done", answer: string[]): void;
  (event: "sound", kind: "place"): void;
}>();

/** 灯籠を1つ灯す間(ms)。全部で1.5秒を超えないように縮める(U:6)。 */
const LANTERN_STEP_MS = 140;
const REVEAL_MAX_MS = 1500;

const answer = ref<string[]>([]);
const revealing = ref(false);
const revealed = ref(false);
/** 灯し終えた灯籠の数(押した順)。 */
const revealStep = ref(0);
let revealTimer: ReturnType<typeof setInterval> | null = null;
const nextLocus = computed(() => props.loci[locusIndex(answer.value.length)] ?? "");

onBeforeUnmount(() => {
  if (revealTimer) clearInterval(revealTimer);
});

function locusIndex(index: number) {
  return props.backward ? props.count - 1 - index : index;
}
function numberOf(index: number) {
  return locusIndex(index) + 1;
}

/** 灯籠の道。場所の順に並べ、押した言葉をその場所の下に出す。 */
const lanterns = computed(() => {
  if (!props.places.length) return [];
  return props.places.slice(0, props.count).map((place, index) => {
    const order = props.backward ? props.count - 1 - index : index;
    const word = answer.value[order];
    const expectedWord = props.expected[order] ?? "";
    const shown = revealed.value || (revealing.value && order < revealStep.value);
    const correct = Boolean(word) && word === expectedWord;
    return {
      index,
      emoji: place.emoji || "📍",
      name: place.name,
      word: word === undefined ? (order === answer.value.length && !revealing.value && !revealed.value ? "？" : "") : (word || "—"),
      expected: expectedWord,
      now: order === answer.value.length && !revealing.value && !revealed.value,
      lit: shown && correct,
      out: shown && !correct,
      wait: word === undefined && order !== answer.value.length,
    };
  });
});
const correctCount = computed(() => answer.value.filter((word, index) => word && word === props.expected[index]).length);
const revealText = computed(() => (correctCount.value === props.count
  ? `${props.count}個、全部の灯籠が灯った！`
  : `${props.count}個のうち${correctCount.value}個の灯籠が灯ったよ。消えた灯籠の言葉を見ておこう。`));

function push(word: string) {
  if (answer.value.length >= props.count || revealing.value || revealed.value) return;
  answer.value = [...answer.value, word];
  emit("sound", "place");
  if (answer.value.length < props.count) return;
  if (props.places.length && props.expected.length) startReveal();
  else emit("done", [...answer.value]);
}

/** 押した順に1つずつ灯籠を灯す(合った灯籠だけ鈴の音が1段ずつ上がる)。 */
function startReveal() {
  revealing.value = true;
  revealStep.value = 0;
  const step = Math.min(LANTERN_STEP_MS, Math.floor(REVEAL_MAX_MS / Math.max(1, props.count)));
  let lit = 0;
  revealTimer = setInterval(() => {
    const order = revealStep.value;
    if (answer.value[order] && answer.value[order] === props.expected[order]) {
      lit += 1;
      brainAudio().play("lantern", comboStep(lit));
    }
    revealStep.value += 1;
    if (revealStep.value >= props.count) finishReveal();
  }, step);
}
function finishReveal() {
  if (!revealing.value) return;
  if (revealTimer) clearInterval(revealTimer);
  revealTimer = null;
  revealing.value = false;
  revealed.value = true;
  if (correctCount.value === props.count) brainAudio().play("best");
}
function emitDone() {
  emit("done", [...answer.value]);
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
  color: var(--dojo-ink, #172632);
  background: var(--dojo-paper, #fffcf4);
  font-size: 0.85rem;
  font-weight: 800;
}
.shogi-game .brain-recall__picked small { color: #8a4b0f; font-size: 0.72rem; }
.shogi-game .brain-recall__picked .brain-recall__picked--skip { color: #5d6f7c; background: #d8d2c4; }
.shogi-game .brain-recall__picked .brain-recall__picked--next { color: #fffcf4; background: transparent; border: 2px dashed #f1a54c; }
/* 灯籠の道(14-11)。場所を4列に並べ、いまの場所が光る。灯ったら明かり、消えたら薄く(グレースケールでも縁で分かる。U:7-3)。 */
.shogi-game .brain-recall__lanterns {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(4.4rem, 1fr));
  gap: 0.45rem 0.3rem;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-lantern { display: grid; justify-items: center; gap: 0.1rem; min-width: 0; text-align: center; line-height: 1.2; }
.shogi-game .brain-lantern b {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 2px solid rgba(255, 252, 244, 0.22);
  border-radius: 14px 14px 18px 18px;
  background: var(--dojo-desk-2, #243746);
  font-size: 1.25rem;
  transition: background 160ms, box-shadow 160ms;
}
.shogi-game .brain-lantern__name { max-width: 100%; overflow: hidden; color: var(--dojo-light-2, #b9c6d0); font-size: 0.66rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .brain-lantern__word { min-height: 1.15em; max-width: 100%; overflow: hidden; color: var(--dojo-light, #fffcf4); font-size: 0.74rem; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .brain-lantern__answer { max-width: 100%; overflow: hidden; color: #f3c08f; font-size: 0.68rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .brain-lantern--now b { border-color: var(--dojo-now, #f1a54c); box-shadow: 0 0 0 4px rgba(241, 165, 76, 0.28); }
.shogi-game .brain-lantern--wait b { opacity: 0.55; }
.shogi-game .brain-lantern--lit b { border-color: #f6c46a; background: radial-gradient(circle at 50% 40%, #ffe7a8, #f1a54c 70%); box-shadow: 0 0 16px rgba(246, 196, 106, 0.55); }
.shogi-game .brain-lantern--out b { opacity: 0.4; border-style: dashed; }
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
/* 横向きの低い画面では、灯籠の道を左、札を右に並べて1画面に収める(14-11。スマホ横)。 */
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .brain-recall--lanterns {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    grid-template-areas: "status status" "prompt prompt" "lanterns pool" "lanterns actions";
    align-items: start;
    column-gap: 1rem;
  }
  .shogi-game .brain-recall--lanterns > .brain-game__status { grid-area: status; }
  .shogi-game .brain-recall--lanterns > .brain-game__prompt { grid-area: prompt; margin: 0; }
  .shogi-game .brain-recall--lanterns > .brain-recall__lanterns { grid-area: lanterns; grid-template-columns: repeat(auto-fill, minmax(3.6rem, 1fr)); gap: 0.3rem 0.2rem; }
  .shogi-game .brain-recall--lanterns > .brain-recall__pool { grid-area: pool; }
  .shogi-game .brain-recall--lanterns > .brain-game__actions { grid-area: actions; }
  .shogi-game .brain-recall--lanterns .brain-lantern b { width: 38px; height: 38px; font-size: 1.05rem; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-lantern b { transition: none; }
}
</style>
