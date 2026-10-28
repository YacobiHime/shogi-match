<template>
  <!--
    縦書きの文字列。1字ずつ1文字分の箱に入れて、上から下へ並べる(賞状・名札掛け・戦法占いの札)。
    字体(フォント)によっては、漢字に縦書きの送り幅がなく、重なって潰れる。箱の中は横書きで描くので、どの字体でも崩れない。
    句読点は右上へ寄せ、長音・括弧は90度回す。句読点と閉じ括弧は前の字と同じかたまりにして、列の頭に来ないようにする。
  -->
  <span class="vtext">
    <span class="vtext__sr">{{ text }}</span>
    <span v-for="(group, index) in groups" :key="index" class="vtext__group" aria-hidden="true">
      <span v-for="(item, at) in group" :key="at" :class="['vtext__ch', item.kind ? `vtext__ch--${item.kind}` : '']">{{ item.ch }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { verticalGroups } from "./core/vertical-text.mjs";

const props = defineProps({
  text: { type: String, default: "" },
});

const groups = computed(() => verticalGroups(props.text));
</script>

<style>
.shogi-game .vtext { display: inline; }
.shogi-game .vtext__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.shogi-game .vtext__group { display: inline-block; white-space: nowrap; }
.shogi-game .vtext__ch {
  display: inline-block;
  vertical-align: middle;
  width: 1em;
  height: 1em;
  margin-block-end: var(--vtext-gap, 0);
  line-height: 1;
  text-align: center;
  writing-mode: horizontal-tb;
}
.shogi-game .vtext__ch--comma { transform: translate(0.6em, -0.6em); }
.shogi-game .vtext__ch--small { transform: translate(0.1em, -0.1em); }
.shogi-game .vtext__ch--turn { rotate: 90deg; }
</style>
