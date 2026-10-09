<template>
  <div :class="['yakobi-says', `yakobi-says--${size}`, { 'yakobi-says--merged': merged }]" data-yakobi-says>
    <figure class="yakobi-says__figure">
      <img class="yakobi-says__face" :src="faceUrl" alt="" aria-hidden="true" draggable="false">
      <figcaption v-if="nameTag" class="yakobi-says__name">やこび姫</figcaption>
    </figure>
    <div class="yakobi-says__bubbles">
      <!-- 既定は、セリフの行ごとの吹き出し。mergedなら、1つの吹き出しに段落で並べる。凝った吹き出しは、スロットで渡す。 -->
      <slot>
        <div v-if="merged" class="yakobi-says__bubble">
          <p v-for="(line, index) in lines" :key="index">{{ line }}</p>
        </div>
        <template v-else>
          <p v-for="(line, index) in lines" :key="index" class="yakobi-says__bubble">{{ line }}</p>
        </template>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import { COACH_EXPRESSION_ASSET_VERSION, COACH_EXPRESSION_FILES, coachExpressionFilename } from "./core/coach-expression.mjs";

const props = defineProps({
  /** やこび姫が話すセリフ。1行ごとに、吹き出しになる。 */
  lines: { type: Array as PropType<string[]>, default: () => [] },
  assetBaseUrl: { type: String, default: "." },
  /** sm: 小さな顔(一言)、md: 顔と吹き出し、lg: 上半身(説明)、xl: 解説役の大きな上半身。 */
  size: { type: String as PropType<"sm" | "md" | "lg" | "xl">, default: "md" },
  /** 表情。既定は、セリフの内容から決める。 */
  expression: { type: String as PropType<"auto" | "neutral" | "wry" | "worried">, default: "auto" },
  /** セリフを、1つの吹き出しにまとめる。 */
  merged: { type: Boolean, default: false },
  /** 顔の下に、名前の札を付ける。 */
  nameTag: { type: Boolean, default: false },
});

const faceUrl = computed(() => {
  const file = props.expression === "auto"
    ? coachExpressionFilename(props.lines.join(" "))
    : COACH_EXPRESSION_FILES[props.expression];
  return `${props.assetBaseUrl}/characters/${file}?v=${COACH_EXPRESSION_ASSET_VERSION}`;
});
</script>

<style>
.shogi-game .yakobi-says {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.7rem;
  min-width: 0;
}
.shogi-game .yakobi-says__figure { position: relative; margin: 0; }
.shogi-game .yakobi-says__face {
  display: block;
  object-fit: cover;
  object-position: 50% 0;
  background: #fff3df;
  border: 2px solid #f1a54c;
  box-shadow: 0 0.2rem 0.6rem rgba(7, 18, 26, 0.4);
  user-select: none;
  pointer-events: none;
}
.shogi-game .yakobi-says--sm .yakobi-says__face { width: 2.8rem; height: 2.8rem; border-radius: 50%; }
.shogi-game .yakobi-says--md .yakobi-says__face { width: 4.6rem; height: 4.6rem; border-radius: 50%; }
.shogi-game .yakobi-says--lg .yakobi-says__face { width: 8.5rem; height: 11.5rem; border-radius: 1rem; }
.shogi-game .yakobi-says--xl .yakobi-says__face {
  width: 10rem;
  height: 14rem;
  border: 0;
  border-radius: 1rem;
  background: radial-gradient(circle at 50% 30%, #fff6e6 0%, #f7d9b0 70%, #e9b97c 100%);
}
.shogi-game .yakobi-says__name {
  position: absolute;
  left: 50%;
  bottom: -0.6rem;
  transform: translateX(-50%);
  padding: 0.1rem 0.7rem;
  border-radius: 999px;
  color: #fffcf4;
  background: #c8483c;
  font-size: 0.8em;
  font-weight: 800;
  letter-spacing: 0.1em;
  white-space: nowrap;
}
.shogi-game .yakobi-says__bubbles { display: grid; gap: 0.5rem; min-width: 0; }
.shogi-game .yakobi-says__bubble {
  position: relative;
  margin: 0;
  padding: 0.55rem 0.8rem;
  border-radius: 0.8rem;
  color: #1d303f;
  background: #fffcf4;
  font-size: 0.95em;
  font-weight: 700;
  line-height: 1.65;
  overflow-wrap: anywhere;
  box-shadow: 0 0.15rem 0.4rem rgba(7, 18, 26, 0.3);
}
.shogi-game .yakobi-says--merged .yakobi-says__bubble { display: grid; gap: 0.45rem; padding: 0.8rem 1rem; }
.shogi-game .yakobi-says--merged .yakobi-says__bubble p { margin: 0; }
/* 最初の吹き出しだけ、顔に向けて、しっぽを付ける。 */
.shogi-game .yakobi-says__bubbles > :first-child::before {
  content: "";
  position: absolute;
  top: 0.9rem;
  left: -0.45rem;
  border: 0.3rem solid transparent;
  border-right-color: #fffcf4;
  border-left-width: 0;
  border-right-width: 0.5rem;
}
.shogi-game .yakobi-says--xl .yakobi-says__bubbles > :first-child::before { top: 2rem; }
.shogi-game .yakobi-says__bubble strong { color: #b46a14; }
.shogi-game .yakobi-says__bubble small { display: block; margin-top: 0.2rem; color: #4a5d6b; font-weight: 400; }
@media (max-width: 560px) {
  .shogi-game .yakobi-says--lg .yakobi-says__face { width: 5.5rem; height: 7.5rem; }
  .shogi-game .yakobi-says--xl .yakobi-says__face { width: 6rem; height: 8.4rem; }
  .shogi-game .yakobi-says--xl .yakobi-says__bubbles > :first-child::before { top: 1.2rem; }
}
</style>
