<template>
  <!-- 竜王戦の組の階段。上が竜王、下が6組。いまの位置に印を付ける。 -->
  <ol class="ryuo-ladder" :aria-label="`竜王戦の組（いまは${champion ? '竜王' : `${group}組`}）`">
    <li
      v-for="step in steps"
      :key="step.id"
      :class="['ryuo-ladder__step', `ryuo-ladder__step--${step.id}`, { 'ryuo-ladder__step--current': step.current }]"
      :aria-current="step.current ? 'step' : undefined"
    >
      <span class="ryuo-ladder__label">{{ step.label }}</span>
      <span v-if="step.current" class="ryuo-ladder__you">あなた</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  group: { type: Number, default: 6 },
  champion: { type: Boolean, default: false },
});

const steps = computed(() => [
  { id: "ryuo", label: "竜王", current: props.champion },
  ...[1, 2, 3, 4, 5, 6].map((group) => ({ id: `g${group}`, label: `${group}組`, current: !props.champion && props.group === group })),
]);
</script>

<style>
/* 左から竜王・1組…6組。左ほど上の組なので、横幅を少しずつ広げて、階段に見せる。 */
.shogi-game .ryuo-ladder {
  display: grid;
  grid-template-columns: 1.25fr repeat(6, minmax(0, 1fr));
  align-items: end;
  gap: 0.3rem;
  margin: 0;
  padding: 1.5rem 0 0;
  border-bottom: 2px solid rgba(255, 252, 244, 0.35);
  list-style: none;
}
.shogi-game .ryuo-ladder__step {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  border-radius: 0.35rem 0.35rem 0 0;
  color: rgba(255, 252, 244, 0.7);
  background: rgba(255, 252, 244, 0.08);
  font-weight: 700;
  font-size: 0.85em;
}
.shogi-game .ryuo-ladder__step--ryuo { height: 4.2rem; color: #2a1608; background: linear-gradient(180deg, #f3d48a, #c99a3e); }
.shogi-game .ryuo-ladder__step--g1 { height: 3.7rem; }
.shogi-game .ryuo-ladder__step--g2 { height: 3.3rem; }
.shogi-game .ryuo-ladder__step--g3 { height: 2.9rem; }
.shogi-game .ryuo-ladder__step--g4 { height: 2.5rem; }
.shogi-game .ryuo-ladder__step--g5 { height: 2.2rem; }
.shogi-game .ryuo-ladder__step--g6 { height: 1.9rem; }
.shogi-game .ryuo-ladder__step--current:not(.ryuo-ladder__step--ryuo) {
  color: #fffcf4;
  background: #c8483c;
  box-shadow: 0 0 0 2px #fffcf4 inset;
}
.shogi-game .ryuo-ladder__step--ryuo.ryuo-ladder__step--current { box-shadow: 0 0 0 2px #fffcf4 inset, 0 0 1rem rgba(243, 212, 138, 0.6); }
.shogi-game .ryuo-ladder__label { white-space: nowrap; }
.shogi-game .ryuo-ladder__you {
  position: absolute;
  bottom: calc(100% + 0.25rem);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  color: #172632;
  background: #fffcf4;
  font-size: 0.75em;
  white-space: nowrap;
}
</style>
