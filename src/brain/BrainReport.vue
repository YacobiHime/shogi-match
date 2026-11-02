<template>
  <!--
    今日の成績(docs/brain-training-design.mdの14-4の柱5)。稽古帳の紙に、その日の最初の稽古なら朱肉の判子をポンと押す(止めと音。D:2-2、G:3-1)。
    種目ごとに今日の記録と前との差(下がったときは前の値を並べるだけ。G:6-2)、自己ベストは金の帯で1つだけ目立たせる(UD:5-3)、次の目標を1行(D:5-2)。
  -->
  <section class="brain-report" :class="`brain-report--${room}`" aria-label="今日の成績" data-brain-report>
    <div class="brain-report__head">
      <p class="brain-report__date">{{ dateLabel }}の稽古</p>
      <h2 class="brain-report__title">{{ title }}</h2>
    </div>
    <div v-if="stamp" class="brain-report__stamp" :class="`brain-report__stamp--${room}`" role="img" :aria-label="`${room === 'calc' ? '計算力' : '記憶力'}の判子`" data-brain-stamp>
      <b>{{ room === "calc" ? "計" : "記" }}</b>
      <small>{{ stampDate }}</small>
    </div>
    <ul class="brain-report__rows">
      <li v-for="(row, index) in rows" :key="index" :class="{ 'brain-report__row--best': row.best }">
        <span class="brain-report__name">{{ row.label }}<small v-if="row.measure">（測定）</small></span>
        <span class="brain-report__value">{{ row.value || "記録なし" }}</span>
        <span v-if="row.delta || row.ribbon || row.sub" class="brain-report__delta" :class="`brain-report__delta--${row.deltaKind || 'same'}`">
          <span v-if="row.delta">{{ row.delta }}</span>
          <span v-if="row.ribbon" class="brain-report__ribbon">★ 自己ベスト</span>
          <span v-else-if="row.best" class="brain-report__best-text">自己ベスト</span>
          <small v-if="row.sub">{{ row.sub }}</small>
        </span>
      </li>
    </ul>
    <table v-if="compare.length" class="brain-report__compare">
      <caption>最初とくらべると</caption>
      <tbody>
        <tr v-for="item in compare" :key="item.label">
          <th scope="row">{{ item.label }}</th>
          <td>{{ item.before }}</td>
          <td aria-hidden="true">→</td>
          <td><strong>{{ item.after }}</strong></td>
        </tr>
      </tbody>
    </table>
    <p v-if="goal" class="brain-report__goal" data-brain-goal><b aria-hidden="true">🎯</b><span>{{ goal }}</span></p>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

export type ReportRow = {
  label: string;
  value: string;
  delta?: string;
  deltaKind?: "up" | "same" | "prev";
  best?: boolean;
  /** 金の帯(1回の稽古で1つだけ)。 */
  ribbon?: boolean;
  measure?: boolean;
  sub?: string;
};

defineProps({
  room: { type: String as PropType<"calc" | "memory">, required: true },
  dateLabel: { type: String, required: true },
  title: { type: String, default: "" },
  rows: { type: Array as PropType<ReportRow[]>, default: () => [] },
  compare: { type: Array as PropType<{ label: string; before: string; after: string }[]>, default: () => [] },
  stamp: { type: Boolean, default: false },
  stampDate: { type: String, default: "" },
  goal: { type: String, default: "" },
});
</script>

<style>
.shogi-game .brain-report {
  --room: var(--dojo-shu);
  position: relative;
  display: grid;
  gap: 0.6rem;
  width: 100%;
  padding: 1rem 1rem 0.9rem;
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: repeating-linear-gradient(0deg, transparent 0 27px, rgba(160, 130, 80, 0.06) 27px 28px), var(--dojo-paper);
  box-shadow: var(--dojo-shadow);
}
.shogi-game .brain-report--memory { --room: var(--dojo-ai); }
.shogi-game .brain-report__head { display: grid; gap: 0.1rem; padding-right: 5.6rem; }
.shogi-game .brain-report__date { margin: 0; color: var(--dojo-ink-2); font-size: 0.8rem; font-weight: 800; letter-spacing: 0.08em; }
.shogi-game .brain-report__title { margin: 0; font-size: 1.18rem; font-weight: 900; line-height: 1.3; }
.shogi-game .brain-report__stamp {
  position: absolute;
  top: 0.7rem;
  right: 0.9rem;
  display: grid;
  place-items: center;
  align-content: center;
  width: 76px;
  height: 76px;
  border: 4px double var(--room);
  border-radius: 50%;
  color: var(--room);
  line-height: 1.05;
  text-align: center;
  transform: rotate(-10deg);
  mix-blend-mode: multiply;
  animation: brain-stamp-press 260ms cubic-bezier(0.2, 1.3, 0.4, 1) both;
}
.shogi-game .brain-report__stamp--memory { border-radius: 18px; }
.shogi-game .brain-report__stamp b { font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; font-size: 1.65rem; }
.shogi-game .brain-report__stamp small { font-size: 0.62rem; font-weight: 900; letter-spacing: 0.04em; }
@keyframes brain-stamp-press {
  0% { transform: rotate(-10deg) scale(1.7); opacity: 0; }
  60% { transform: rotate(-10deg) scale(0.94); opacity: 1; }
  100% { transform: rotate(-10deg) scale(1); opacity: 1; }
}
.shogi-game .brain-report__rows { display: grid; margin: 0; padding: 0; border-top: 2px solid var(--dojo-rule); list-style: none; }
.shogi-game .brain-report__rows li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.1rem 0.6rem;
  padding: 0.5rem 0;
  border-bottom: 1px dashed var(--dojo-rule);
}
.shogi-game .brain-report__name { color: var(--dojo-ink-2); font-size: 0.86rem; font-weight: 800; }
.shogi-game .brain-report__name small { font-weight: 700; }
.shogi-game .brain-report__value { font-size: 1.04rem; font-weight: 900; text-align: right; font-variant-numeric: tabular-nums; }
.shogi-game .brain-report__delta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.6rem; font-size: 0.8rem; font-weight: 800; }
.shogi-game .brain-report__delta--up { color: var(--dojo-good); }
.shogi-game .brain-report__delta--same,
.shogi-game .brain-report__delta--prev { color: var(--dojo-ink-2); }
.shogi-game .brain-report__delta small { color: var(--dojo-ink-2); font-weight: 700; }
.shogi-game .brain-report__ribbon { padding: 0.05rem 0.5rem; border-radius: 4px; color: var(--dojo-gold); background: var(--dojo-gold-soft); font-weight: 900; }
.shogi-game .brain-report__best-text { color: var(--dojo-gold); }
.shogi-game .brain-report__compare { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
.shogi-game .brain-report__compare caption { padding-bottom: 0.2rem; color: var(--room); font-weight: 900; text-align: left; }
.shogi-game .brain-report__compare th,
.shogi-game .brain-report__compare td { padding: 0.25rem 0.3rem; border-bottom: 1px dashed var(--dojo-rule); text-align: left; }
.shogi-game .brain-report__compare strong { color: var(--dojo-good); }
.shogi-game .brain-report__goal {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  background: var(--dojo-paper-2);
  font-size: 0.86rem;
  font-weight: 800;
}
.shogi-game .brain-report__goal b { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #fff; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-report__stamp { animation: none; }
}
</style>
