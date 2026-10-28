<template>
  <!--
    回戦の中継ボードの欄(docs/tournament-relay-design.mdの18章。名人戦は22章)。竜王戦の表と名人戦のリーグ表で共通。
    大きく出す対局(分身の対局か注目の対局。先後・何手目・勝率・一言。押すと中継)、対局中と終局の数、速さ、結果まで進める。
    回戦が終わったら、主役のボタンが「この回戦の結果へ」などになる。
  -->
  <section class="shogi-tournament__hud shogi-tournament__live" aria-label="回戦の中継" data-live-panel>
    <p class="shogi-tournament__hud-role">
      <span class="shogi-tournament__live-tag" aria-hidden="true">中継</span>{{ panel.label }}
      <small v-if="panel.step" class="shogi-tournament__live-step" data-live-step>{{ panel.step }}</small>
    </p>
    <button v-if="panel.focus" type="button" class="shogi-tournament__live-game" data-live-avatar @click="emit('open')">
      <span class="shogi-tournament__live-names">
        <span class="shogi-tournament__live-name shogi-tournament__live-name--black">☗{{ panel.focus.black }}</span>
        <span class="shogi-tournament__live-name shogi-tournament__live-name--white">☖{{ panel.focus.white }}</span>
      </span>
      <span class="shogi-tournament__live-bar" aria-hidden="true"><span :style="{ width: `${panel.focus.blackPercent}%` }" /></span>
      <span class="shogi-tournament__live-meta">
        <b data-live-ply>{{ panel.focus.done ? "終局" : `${panel.focus.ply}手目` }}</b>
        <span data-live-verdict>{{ panel.focus.verdict }}</span>
        <small>押すと中継</small>
      </span>
    </button>
    <p class="shogi-tournament__live-count" data-live-count>
      対局中 {{ panel.count.playing }}局・終局 {{ panel.count.done }}局。{{ panel.multiple ? `${panel.tableWord}の札を押すと、その対局の中継を見られるよ。` : "押すと、その対局の中継を見られるよ。" }}
    </p>
    <slot />
    <div class="shogi-tournament__hud-row">
      <button type="button" class="shogi-tournament__sub" :aria-label="`速さ ×${panel.speed}。押すと変える`" data-live-speed @click="emit('speed')">速さ ×{{ panel.speed }}</button>
      <button type="button" class="shogi-tournament__sub" :disabled="panel.finished" data-live-skip @click="emit('skip')">結果まで進める</button>
    </div>
    <button v-if="panel.finished" type="button" class="shogi-tournament__start" data-live-finish @click="emit('finish')">{{ panel.finishText }}</button>
    <button v-else type="button" class="shogi-tournament__start" data-live-avatar-watch @click="emit('open')">{{ panel.watchText }}</button>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

export type LivePanelView = {
  label: string;
  /** 敗退後の観戦の、いま何回戦目か(「3/18」)。 */
  step: string;
  focus: { black: string; white: string; ply: number; done: boolean; blackPercent: number; verdict: string } | null;
  count: { playing: number; done: number };
  /** 対局が2局以上(札を押すと中継、と案内する)。 */
  multiple: boolean;
  /** 札のある場所の呼び方(「表」「リーグ表」)。 */
  tableWord: string;
  speed: number;
  finished: boolean;
  finishText: string;
  watchText: string;
};

defineProps({
  panel: { type: Object as PropType<LivePanelView>, required: true },
});
const emit = defineEmits<{ open: []; speed: []; skip: []; finish: [] }>();
</script>
