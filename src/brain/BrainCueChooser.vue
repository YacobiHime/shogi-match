<template>
  <!--
    いつ稽古するか(実行意図。docs/brain-training-design.mdの14-4の柱3、14-3のB29)。
    最初の稽古を終えた成績表で1回だけと、入口の「変える」から。押すとすぐ決まる(確認は出さない)。
  -->
  <section class="brain-cue" aria-label="いつ稽古するか" data-brain-cue>
    <p class="brain-cue__lead">{{ lead }}</p>
    <ul class="brain-cue__options">
      <li v-for="option in CUE_OPTIONS" :key="option.id">
        <button
          type="button"
          class="brain-cue__option"
          :class="{ 'brain-cue__option--on': option.id === modelValue }"
          :aria-pressed="option.id === modelValue"
          :data-brain-cue-option="option.id"
          @click="emit('choose', option.id)"
        >{{ option.label }}</button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { CUE_OPTIONS } from "../core/brain-habit.mjs";

defineProps({
  modelValue: { type: String, default: "" },
  lead: { type: String, default: "いつ稽古するか決めておくと、続けやすいよ。" },
});
const emit = defineEmits<{ (event: "choose", cue: string): void }>();
</script>

<style>
.shogi-game .brain-cue {
  display: grid;
  gap: 0.5rem;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border-radius: var(--dojo-radius);
  color: var(--dojo-light);
  background: var(--dojo-desk-2);
}
.shogi-game .brain-cue__lead { margin: 0; font-size: 0.86rem; font-weight: 800; }
.shogi-game .brain-cue__options { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-cue__option {
  min-height: 40px;
  padding: 0 0.8rem;
  border: 2px solid rgba(255, 252, 244, 0.25);
  border-radius: 999px;
  color: var(--dojo-light);
  background: transparent;
  box-shadow: none;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
}
.shogi-game .brain-cue__option--on { border-color: var(--dojo-now); background: rgba(241, 165, 76, 0.18); }
.shogi-game .brain-cue__option:focus-visible { outline: 2px solid var(--dojo-now); outline-offset: 2px; }
</style>
