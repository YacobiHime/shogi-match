<template>
  <!--
    天鷺羽音の立ち絵(イラスト。docs/hanane-rival-design.mdの12章)。表情は4つ(core/ryuo-story.mjsのHANANE_PORTRAIT)。
    使うのは、対局の始まりを告げる画面(VS画面と開幕の札)だけ。ほかの場面はドット絵(HANANE_SPRITE)。
    crop: face(顔だけ。正方形の札の中)、bust(胸から上)、full(全身)。大きさは置く側で決め、ここは切り抜き方だけを持つ。
    表情が変わったときは、絵を短く入れ替える(動きを減らす設定では、すぐ替える)。
  -->
  <span :class="['hanane-portrait', `hanane-portrait--${crop}`]" :data-hanane-expression="expression" aria-hidden="true">
    <img :key="src" :src="src" alt="" draggable="false" decoding="async">
  </span>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import { HANANE_PORTRAIT, hananePortraitFile } from "./core/ryuo-story.mjs";

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  /** neutral・smile・gentle・worried。 */
  expression: { type: String, default: "neutral" },
  crop: { type: String as PropType<"face" | "bust" | "full">, default: "bust" },
  /** 小さく出すときは、小さい画面用の絵(-320)を読む。 */
  small: { type: Boolean, default: false },
});

const src = computed(() => `${props.assetBaseUrl}/characters/${hananePortraitFile(props.expression, { small: props.small })}?v=${HANANE_PORTRAIT.version}`);
</script>

<style>
/*
 * 絵(662×2325)の中で、顔は上の約15%(髪の上から顎まで)、胸から上は上の約39%。
 * 切り抜きは、絵の幅と位置を枠に対する割合で決める(枠の大きさが変わっても、同じところが見える)。
 * 絵の切り抜き(img)は、置く側のimgの決まりに負けないよう、クラスを2つ重ねる。
 * 枠の大きさと置き場所は、置く側がクラスを重ねて決める(.ryuo-versus__portrait.ryuo-versus__portraitなど)。
 */
.shogi-game .hanane-portrait {
  position: relative;
  display: block;
  overflow: hidden;
  width: 100%;
  padding: 0;
}
.shogi-game .hanane-portrait.hanane-portrait img {
  position: absolute;
  top: 0;
  display: block;
  max-width: none;
  margin: 0;
  image-rendering: auto;
  user-select: none;
  pointer-events: none;
}
.shogi-game .hanane-portrait--face.hanane-portrait--face { aspect-ratio: 1; }
.shogi-game .hanane-portrait.hanane-portrait--face img { left: -35%; width: 170%; height: auto; }
.shogi-game .hanane-portrait--bust.hanane-portrait--bust { aspect-ratio: 0.74; }
.shogi-game .hanane-portrait.hanane-portrait--bust img { left: 0; width: 100%; height: auto; }
.shogi-game .hanane-portrait--full.hanane-portrait--full { aspect-ratio: 662 / 2325; }
.shogi-game .hanane-portrait.hanane-portrait--full img { left: 0; width: 100%; height: 100%; object-fit: contain; }
@media (prefers-reduced-motion: no-preference) {
  .shogi-game .hanane-portrait.hanane-portrait img { animation: hanane-portrait-in 180ms ease-out both; }
}
@keyframes hanane-portrait-in {
  from { opacity: 0.4; }
  to { opacity: 1; }
}
</style>
