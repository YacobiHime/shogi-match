<template>
  <!-- 竜王戦の組の階段(上が竜王、下が6組)か、名人戦の順位戦の階段(上が名人、下がC級2組)。いまの位置に印を付ける。 -->
  <ol :class="['ryuo-ladder', { 'ryuo-ladder--meijin': kind === 'meijin' }]" :aria-label="ariaLabel">
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
  /** ryuo: 竜王戦の組、meijin: 名人戦の順位戦のクラス。 */
  kind: { type: String, default: "ryuo" },
  group: { type: Number, default: 6 },
  champion: { type: Boolean, default: false },
  /** 名人戦のいまのクラス(A・B1・B2・C1・C2、名人ならmeijin、まだ出ていなければ空)。 */
  meijinClass: { type: String, default: "" },
});

const MEIJIN_STEPS = [["A", "A級"], ["B1", "B級1組"], ["B2", "B級2組"], ["C1", "C級1組"], ["C2", "C級2組"]];
const steps = computed(() => (props.kind === "meijin"
  ? [
    { id: "ryuo", label: "名人", current: props.meijinClass === "meijin" },
    ...MEIJIN_STEPS.map(([cls, label], index) => ({ id: `g${index + 1}`, label, current: props.meijinClass === cls })),
  ]
  : [
    { id: "ryuo", label: "竜王", current: props.champion },
    ...[1, 2, 3, 4, 5, 6].map((group) => ({ id: `g${group}`, label: `${group}組`, current: !props.champion && props.group === group })),
  ]));
const ariaLabel = computed(() => {
  if (props.kind !== "meijin") return `竜王戦の組（いまは${props.champion ? "竜王" : `${props.group}組`}）`;
  const current = steps.value.find((step) => step.current);
  return `名人戦の順位戦のクラス（${current ? `いまは${current.label}` : "まだ出ていない"}）`;
});
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
.shogi-game .ryuo-ladder--meijin { grid-template-columns: 1.25fr repeat(5, minmax(0, 1fr)); }
.shogi-game .ryuo-ladder--meijin .ryuo-ladder__label { font-size: 0.85em; }
.shogi-game .ryuo-ladder__step {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
  color: rgba(255, 252, 244, 0.7);
  background: #172632;
  font-weight: 700;
  font-size: 0.85em;
}
.shogi-game .ryuo-ladder__step--ryuo { height: 4.2rem; color: #172632; background: #f1a54c; }
.shogi-game .ryuo-ladder__step--g1 { height: 3.7rem; }
.shogi-game .ryuo-ladder__step--g2 { height: 3.3rem; }
.shogi-game .ryuo-ladder__step--g3 { height: 2.9rem; }
.shogi-game .ryuo-ladder__step--g4 { height: 2.5rem; }
.shogi-game .ryuo-ladder__step--g5 { height: 2.2rem; }
.shogi-game .ryuo-ladder__step--g6 { height: 1.9rem; }
.shogi-game .ryuo-ladder__step--current:not(.ryuo-ladder__step--ryuo) {
  color: #172632;
  background: #d8d0ff;
  box-shadow: 0 0 0 2px #fffcf4 inset;
}
.shogi-game .ryuo-ladder__step--ryuo.ryuo-ladder__step--current { box-shadow: 0 0 0 2px #fffcf4 inset; }
.shogi-game .ryuo-ladder__label { white-space: nowrap; }
.shogi-game .ryuo-ladder__you {
  position: absolute;
  bottom: calc(100% + 0.25rem);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.05rem 0.4rem;
  color: #172632;
  background: #fffcf4;
  font-size: 0.75em;
  white-space: nowrap;
}
</style>
