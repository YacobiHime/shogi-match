<template>
  <!--
    今週の判子の帯(docs/brain-training-design.mdの14-4の柱2)。月曜はじまりの7日に、練習した日の判子(計算力は朱の丸「計」、記憶力は藍の角「記」。
    色と形の両方で分ける。U:7-3)。下に週の目安(計算力3回・記憶力5回)。届かなくても何も言わない(D:9-2、14-3のB30)。
  -->
  <section class="brain-week" aria-label="今週の判子" data-brain-week>
    <p class="brain-week__head"><strong>今週</strong><span>{{ dayLabel }}</span></p>
    <ol class="brain-week__days">
      <li
        v-for="cell in strip"
        :key="cell.day"
        :class="{ 'brain-week__day--today': cell.today, 'brain-week__day--future': cell.future }"
        :aria-label="`${cell.weekday}曜 ${cell.date}日${cell.calc ? '・計算力' : ''}${cell.memory ? '・記憶力' : ''}`"
      >
        <span aria-hidden="true">{{ cell.weekday }}</span>
        <strong aria-hidden="true">{{ cell.date }}</strong>
        <span class="brain-week__marks" aria-hidden="true">
          <i v-if="cell.calc" class="brain-seal brain-seal--calc">計</i>
          <i v-if="cell.memory" class="brain-seal brain-seal--memory"><span>記</span></i>
        </span>
      </li>
    </ol>
    <p class="brain-week__goals">
      <span>計算力 {{ counts.calc.done }}/{{ counts.calc.target }}<span class="brain-week__pips brain-week__pips--calc" aria-hidden="true"><i v-for="n in counts.calc.target" :key="n" :class="{ 'brain-week__pip--on': n <= counts.calc.done }"></i></span></span>
      <span>記憶力 {{ counts.memory.done }}/{{ counts.memory.target }}<span class="brain-week__pips brain-week__pips--memory" aria-hidden="true"><i v-for="n in counts.memory.target" :key="n" :class="{ 'brain-week__pip--on': n <= counts.memory.done }"></i></span></span>
    </p>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

type Cell = { day: string; weekday: string; date: number; calc: boolean; memory: boolean; today: boolean; future: boolean };
type Counts = { calc: { done: number; target: number }; memory: { done: number; target: number } };

defineProps({
  strip: { type: Array as PropType<Cell[]>, required: true },
  counts: { type: Object as PropType<Counts>, required: true },
  dayLabel: { type: String, default: "" },
});
</script>

<style>
.shogi-game .brain-week {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  padding: 0.6rem 0.75rem 0.7rem;
  border-radius: var(--dojo-radius);
  color: var(--dojo-light);
  background: var(--dojo-desk-2);
}
.shogi-game .brain-week__head { display: flex; justify-content: space-between; align-items: baseline; margin: 0; color: var(--dojo-light-2); font-size: 0.82rem; font-weight: 800; }
.shogi-game .brain-week__head strong { color: var(--dojo-light); font-size: 0.92rem; }
.shogi-game .brain-week__days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-week__days li {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  padding: 0.3rem 0 0.35rem;
  border-radius: 10px;
  color: var(--dojo-light-2);
  background: rgba(255, 255, 255, 0.04);
  font-size: 0.72rem;
}
.shogi-game .brain-week__days strong { color: var(--dojo-light); font-size: 0.86rem; font-variant-numeric: tabular-nums; }
.shogi-game .brain-week__days .brain-week__day--today { outline: 2px solid var(--dojo-now); outline-offset: -2px; color: var(--dojo-light); }
.shogi-game .brain-week__days .brain-week__day--future { opacity: 0.45; }
.shogi-game .brain-week__marks { display: flex; gap: 0.2rem; align-items: center; min-height: 18px; }
.shogi-game .brain-seal {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: #fff;
  font-size: 0.62rem;
  font-style: normal;
  font-weight: 900;
  line-height: 1;
}
.shogi-game .brain-seal--calc { border-radius: 50%; background: var(--dojo-shu); }
.shogi-game .brain-seal--memory { border-radius: 4px; background: var(--dojo-ai); transform: rotate(45deg) scale(0.92); }
.shogi-game .brain-seal--memory span { transform: rotate(-45deg); }
.shogi-game .brain-week__goals { display: flex; flex-wrap: wrap; gap: 0.3rem 0.9rem; margin: 0.1rem 0 0; color: var(--dojo-light-2); font-size: 0.8rem; font-weight: 800; }
.shogi-game .brain-week__pips { display: inline-flex; gap: 3px; margin-left: 0.4rem; vertical-align: 1px; }
.shogi-game .brain-week__pips i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); }
.shogi-game .brain-week__pips--memory i { border-radius: 2px; }
.shogi-game .brain-week__pips--calc .brain-week__pip--on { background: var(--dojo-shu); }
.shogi-game .brain-week__pips--memory .brain-week__pip--on { background: var(--dojo-ai-light); }
</style>
