<template>
  <!--
    今日の稽古の札(docs/brain-training-design.mdの14-4の柱1)。入口と部屋の主役。和紙の札に、部屋・何回目・段取り(飛び石3つまで)・約○分・大きな「はじめる」。
    押せばすぐ最初の種目が始まる(UD:3-2、D:3-3)。部屋の色(計算力は朱、記憶力は藍)を上の帯とボタンに使う。
  -->
  <section class="brain-today" :class="`brain-today--${room}`" :aria-label="`今日の稽古（${roomLabel}）`" data-brain-today-card>
    <p class="brain-today__eyebrow">
      <span>{{ eyebrow }}</span>
      <span class="brain-today__chip"><span aria-hidden="true">{{ roomEmoji }}</span> {{ chip || roomLabel }}</span>
    </p>
    <h2 v-if="title" class="brain-today__title">{{ title }}</h2>
    <ol v-if="steps.length" class="brain-today__stones" :class="`brain-today__stones--${Math.min(3, steps.length)}`">
      <li v-for="(step, index) in steps.slice(0, 3)" :key="index">
        <b aria-hidden="true">{{ step.icon }}</b>
        <span>{{ step.label }}</span>
        <small v-if="step.sub">{{ step.sub }}</small>
      </li>
    </ol>
    <p v-if="note" class="brain-today__note">{{ note }}</p>
    <div class="brain-today__foot">
      <span class="brain-today__time">{{ minutes ? `約${minutes}分` : "" }}</span>
      <button type="button" class="brain-today__go" data-brain-today @click="emit('start')">{{ actionLabel }} <span aria-hidden="true">▶</span></button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";

type Step = { icon: string; label: string; sub?: string };

const props = defineProps({
  room: { type: String as PropType<"calc" | "memory">, required: true },
  title: { type: String, default: "" },
  /** 右上の小さな札(省けば部屋の名前)。 */
  chip: { type: String, default: "" },
  eyebrow: { type: String, default: "今日の稽古" },
  steps: { type: Array as PropType<Step[]>, default: () => [] },
  minutes: { type: Number, default: 0 },
  note: { type: String, default: "" },
  actionLabel: { type: String, default: "はじめる" },
});
const emit = defineEmits<{ (event: "start"): void }>();

const roomLabel = computed(() => (props.room === "calc" ? "計算力" : "記憶力"));
const roomEmoji = computed(() => (props.room === "calc" ? "🧮" : "🏯"));
</script>

<style>
.shogi-game .brain-today {
  --room: var(--dojo-shu);
  --room-deep: var(--dojo-shu-deep);
  --room-soft: var(--dojo-shu-soft);
  display: grid;
  gap: 0.6rem;
  width: 100%;
  padding: 0.85rem 1rem 1rem;
  border-top: 6px solid var(--room);
  border-radius: var(--dojo-radius);
  color: var(--dojo-ink);
  background: repeating-linear-gradient(0deg, transparent 0 27px, rgba(160, 130, 80, 0.06) 27px 28px), var(--dojo-paper);
  box-shadow: var(--dojo-shadow);
}
.shogi-game .brain-today--memory { --room: var(--dojo-ai); --room-deep: var(--dojo-ai-deep); --room-soft: var(--dojo-ai-soft); }
.shogi-game .brain-today__eyebrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0;
  color: var(--dojo-ink-2);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.shogi-game .brain-today__chip {
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  color: var(--room-deep);
  background: var(--room-soft);
  font-size: 0.78rem;
  font-weight: 900;
  white-space: nowrap;
}
.shogi-game .brain-today__title { margin: 0; font-size: 1.3rem; font-weight: 900; line-height: 1.25; }
.shogi-game .brain-today__stones {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0.1rem 0 0;
  padding: 0;
  list-style: none;
}
.shogi-game .brain-today__stones--1 { grid-template-columns: minmax(0, 1fr); }
.shogi-game .brain-today__stones--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .brain-today__stones li {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  font-size: 0.8rem;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
}
.shogi-game .brain-today__stones li + li::before {
  content: "";
  position: absolute;
  top: 21px;
  right: calc(50% + 24px);
  width: calc(100% - 48px);
  height: 3px;
  border-radius: 2px;
  background: repeating-linear-gradient(90deg, var(--dojo-rule) 0 6px, transparent 6px 10px);
}
.shogi-game .brain-today__stones b {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 3px solid var(--room);
  border-radius: 50%;
  background: #fff;
  font-size: 1.25rem;
}
.shogi-game .brain-today__stones small { color: var(--dojo-ink-2); font-weight: 700; }
.shogi-game .brain-today__note { margin: 0; color: var(--dojo-ink-2); font-size: 0.82rem; font-weight: 700; line-height: 1.5; }
.shogi-game .brain-today__foot { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.shogi-game .brain-today__time { color: var(--dojo-ink-2); font-size: 0.86rem; font-weight: 800; }
.shogi-game .brain-today__go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-width: 9.5rem;
  min-height: 52px;
  padding: 0 1.3rem;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: var(--room);
  box-shadow: 0 3px 0 var(--room-deep), 0 6px 14px rgba(0, 0, 0, 0.18);
  font: inherit;
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  cursor: pointer;
}
.shogi-game .brain-today__go:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--room-deep); }
.shogi-game .brain-today__go:focus-visible { outline: 3px solid var(--dojo-now); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-today__go:active { transform: none; }
}
</style>
