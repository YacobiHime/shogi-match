<template>
  <div
    :class="['yakobi-says', `yakobi-says--${size}`, `yakobi-says--${person}`, { 'yakobi-says--merged': merged, 'yakobi-says--notice': notice, 'yakobi-says--bust': bust }]"
    :data-says-person="person"
    data-yakobi-says
  >
    <figure class="yakobi-says__figure">
      <img class="yakobi-says__face" :src="faceUrl" alt="" aria-hidden="true" draggable="false">
      <figcaption v-if="nameTag" class="yakobi-says__name">{{ personName }}</figcaption>
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
import { HANANE_SPRITE } from "./core/ryuo-story.mjs";

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
  /** 話す人。やこび姫(既定)か、竜王戦のライバルの天鷺羽音(core/ryuo-story.mjs)。 */
  person: { type: String as PropType<"yakobihime" | "hanane">, default: "yakobihime" },
  /** 注目の一言(メッセージ分類の「注目」)。吹き出しの縁を、話す人の色にする。 */
  notice: { type: Boolean, default: false },
  /** 狭い画面では、胸から上だけを見せる(縦に長い絵で、札の高さを増やさない)。 */
  bust: { type: Boolean, default: false },
});

const PEOPLE = {
  yakobihime: { name: "やこび姫", file: "yakobihime-mini.webp", version: 4 },
  hanane: { name: "天鷺羽音", file: HANANE_SPRITE.file, version: HANANE_SPRITE.version },
} as const;
const personName = computed(() => PEOPLE[props.person].name);
// 竜王戦とやこびノートでは、ドット絵の全身を使う。切り抜かずに全身を見せる。
const faceUrl = computed(() => `${props.assetBaseUrl}/characters/${PEOPLE[props.person].file}?v=${PEOPLE[props.person].version}`);
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
/*
 * 羽音の絵は縦80ドット、やこび姫は縦53ドット。並べたときに1ドットの大きさがそろうよう、高さを80/53倍(約1.5倍)にする。
 * 名前の札と、注目の一言の吹き出しの縁は、羽音の目の黄色。
 */
.shogi-game .yakobi-says--hanane.yakobi-says--sm .yakobi-says__face { height: 4.8rem; }
.shogi-game .yakobi-says--hanane.yakobi-says--md .yakobi-says__face { height: 7.8rem; }
.shogi-game .yakobi-says--hanane.yakobi-says--lg .yakobi-says__face { height: 13.5rem; }
.shogi-game .yakobi-says--hanane.yakobi-says--xl .yakobi-says__face { height: 17.4rem; }
.shogi-game .yakobi-says--hanane .yakobi-says__name { color: #1e2d3d; background: #d4a93a; }
.shogi-game .yakobi-says--hanane .yakobi-says__bubble { box-shadow: 3px 3px 0 #b9c3c8; }
.shogi-game .yakobi-says--notice .yakobi-says__bubble { border-color: #d4a93a; box-shadow: 3px 3px 0 #d4a93a; }
@media (prefers-reduced-motion: no-preference) {
  .shogi-game .yakobi-says--hanane .yakobi-says__face { animation: yakobi-says-rise 260ms ease-out both; }
}
@keyframes yakobi-says-rise {
  from { transform: translateY(0.6rem); opacity: 0; }
  to { transform: none; opacity: 1; }
}
@media (max-width: 560px) {
  /* 胸から上(上の4割、37×32ドット)だけを見せる。名前の札を隠さないよう、絵の側で切り抜く。 */
  .shogi-game .yakobi-says--bust.yakobi-says--md .yakobi-says__face { width: 3.6rem; height: 3.1rem; object-fit: cover; object-position: top; }
  .shogi-game .yakobi-says--bust .yakobi-says__name { bottom: -0.9rem; padding: 0 0.3rem; font-size: 0.62em; letter-spacing: 0; }
  .shogi-game .yakobi-says--lg .yakobi-says__face { height: 6.5rem; }
  .shogi-game .yakobi-says--xl .yakobi-says__face { height: 7.5rem; }
  .shogi-game .yakobi-says--xl .yakobi-says__bubbles > :first-child::before { top: 1.2rem; }
}
</style>
