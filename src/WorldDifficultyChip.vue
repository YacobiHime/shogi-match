<template>
  <!--
    大会の途中で難易度を変える札(docs/tournament-strength-spread-design.mdの11章)。上の帯の右に「難易度 5」。
    押すと入口と同じ難易度の選択シートを開き、選び直すと次の対局から強さが変わる(選ぶこと自体が決定。UD:5-2)。
  -->
  <button type="button" class="world-chip" :aria-label="`難易度 ${label}を変える`" data-world-chip @click="open = true">
    <small>難易度</small><b>{{ label }}</b>
  </button>
  <div v-if="open" class="world-chip__picker" data-world-chip-sheet>
    <PregamePicker
      title="難易度を変える"
      :sections="[{ key: 'difficulty', value: difficulty ?? '', groups: [{ options: choices }] }]"
      :note="note"
      @select="pick"
      @close="open = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import PregamePicker, { type PickerValue } from "./PregamePicker.vue";
import { difficultyName } from "./core/tournament-world.mjs";

const props = defineProps({
  /** いまの難易度の番号(なければ「—」)。 */
  difficulty: { type: Number as PropType<number | null>, default: null },
  /** 入口と同じ難易度の選択肢(各大会のdifficultyOptions)。 */
  choices: { type: Array as PropType<{ value: PickerValue; label: string; description?: string }[]>, required: true },
  note: { type: String, default: "選び直すと、次の対局から強さが変わるよ。ここまでの勝ち負けはそのまま。選んだ世界は、次からの大会でも使うよ。" },
});
const emit = defineEmits<{ change: [difficulty: number] }>();
const open = ref(false);
const label = computed(() => (Number.isInteger(props.difficulty) ? difficultyName(props.difficulty as number) : "—"));
function pick(_key: string, value: PickerValue) {
  open.value = false;
  const next = Number(value);
  if (Number.isInteger(next) && next !== props.difficulty) emit("change", next);
}
/** 戻る操作でシートを閉じる(閉じたらtrue)。 */
function goBack() {
  if (!open.value) return false;
  open.value = false;
  return true;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .world-chip {
  display: inline-flex;
  flex: none;
  align-items: baseline;
  gap: 0.3rem;
  min-height: 36px;
  margin-left: auto;
  padding: 0.2rem 0.7rem;
  border: 2px solid #4b6585;
  border-radius: 999px;
  color: #fffcf4;
  background: #172632;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .world-chip small { color: #cfd8de; font-size: 0.7rem; }
.shogi-game .world-chip b { color: #f1a54c; font-size: 0.95rem; }
.shogi-game .world-chip:hover { border-color: #f1a54c; }
/* シートは画面いっぱいに重ねる(上の帯の中に置くので、帯の高さに縛られないよう固定にする)。 */
.shogi-game .world-chip__picker .pregame-picker { position: fixed; z-index: 200; }
</style>
