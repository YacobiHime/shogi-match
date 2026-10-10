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

const props = defineProps({
  /** やこび姫が話すセリフ。1行ごとに、吹き出しになる。 */
  lines: { type: Array as PropType<string[]>, default: () => [] },
  assetBaseUrl: { type: String, default: "." },
  /** sm: 小さな姿(一言)、md: 姿と吹き出し、lg: 説明、xl: 解説役の大きな姿。 */
  size: { type: String as PropType<"sm" | "md" | "lg" | "xl">, default: "md" },
  /** セリフを、1つの吹き出しにまとめる。 */
  merged: { type: Boolean, default: false },
  /** 顔の下に、名前の札を付ける。 */
  nameTag: { type: Boolean, default: false },
});

// 竜王戦とやこびノートでは、ドット絵のやこび姫(全身)を使う。切り抜かずに全身を見せる。
const faceUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=2`);
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
  width: auto;
  object-fit: contain;
  image-rendering: pixelated;
  user-select: none;
  pointer-events: none;
}
.shogi-game .yakobi-says--sm .yakobi-says__face { height: 3.2rem; }
.shogi-game .yakobi-says--md .yakobi-says__face { height: 5.2rem; }
.shogi-game .yakobi-says--lg .yakobi-says__face { height: 9rem; }
.shogi-game .yakobi-says--xl .yakobi-says__face { height: 11.5rem; }
.shogi-game .yakobi-says__name {
  position: absolute;
  left: 50%;
  bottom: -0.6rem;
  transform: translateX(-50%);
  padding: 0.1rem 0.6rem;
  color: #1e2d3d;
  background: #f1a54c;
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
  border: 2px solid #fffcf4;
  border-radius: 0.2rem;
  color: #1d303f;
  background: #fffcf4;
  font-size: 0.95em;
  font-weight: 700;
  line-height: 1.65;
  overflow-wrap: anywhere;
  box-shadow: 3px 3px 0 #d8d0ff;
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
  .shogi-game .yakobi-says--lg .yakobi-says__face { height: 6.5rem; }
  .shogi-game .yakobi-says--xl .yakobi-says__face { height: 7.5rem; }
  .shogi-game .yakobi-says--xl .yakobi-says__bubbles > :first-child::before { top: 1.2rem; }
}
</style>
