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
    <!-- 注目の対局(31章)。ほかの組の羽音・推しの対局も、同じ時に指されていれば並べる。押すと、その対局の中継へ。 -->
    <div v-if="panel.featured?.length" class="relay-live__featured" data-live-featured>
      <p class="relay-live__featured-head">注目の対局</p>
      <button
        v-for="game in panel.featured"
        :key="game.key"
        type="button"
        class="relay-live__featured-game"
        :data-live-featured-game="game.key"
        @click="emit('watch', game.key)"
      >
        <span class="relay-live__featured-names">☗{{ game.black }} ☖{{ game.white }}</span>
        <small class="relay-live__featured-where">{{ game.where }}</small>
        <b class="relay-live__featured-ply">{{ game.done ? "終局" : `${game.ply}手目` }}</b>
      </button>
    </div>
    <p class="shogi-tournament__live-count" data-live-count>
      対局中 {{ panel.count.playing }}局・終局 {{ panel.count.done }}局。{{ panel.multiple ? `${panel.tableWord}の札を押すと、その対局の中継を見られるよ。` : "押すと、その対局の中継を見られるよ。" }}
    </p>
    <!-- 勝敗の予想(24-1)。序盤のうちに勝つ側を選び、終局したら当たり外れ。 -->
    <p v-if="panel.predict" class="relay-live__predict" data-live-predict>
      <span>予想 <b>{{ panel.predict.hit }}/{{ panel.predict.decided }}</b> 的中<small>（通算 {{ panel.predict.totalHit }}/{{ panel.predict.total }}）</small></span>
      <button type="button" class="shogi-tournament__sub" data-live-predict-open @click="predictOpen = true">勝敗を予想<small class="relay-live__predict-mini">{{ panel.predict.hit }}/{{ panel.predict.decided }}</small></button>
    </p>
    <slot />
    <div class="shogi-tournament__hud-row">
      <button type="button" class="shogi-tournament__sub" :aria-label="`速さ ×${panel.speed}。押すと変える`" data-live-speed @click="emit('speed')">速さ ×{{ panel.speed }}</button>
      <!-- 本局はエンジンが指し終えるまで待つので、押したあとは「最後まで指しています…」にする(34章)。 -->
      <button type="button" class="shogi-tournament__sub" :disabled="panel.finished || panel.skipping" :aria-busy="panel.skipping || undefined" data-live-skip @click="emit('skip')">{{ panel.skipping ? "最後まで指しています…" : "結果まで進める" }}</button>
    </div>
    <button v-if="panel.finished" type="button" class="shogi-tournament__start" data-live-finish @click="emit('finish')">{{ panel.finishText }}</button>
    <button v-else type="button" class="shogi-tournament__start" data-live-avatar-watch @click="emit('open')">{{ panel.watchText }}</button>
    <div v-if="predictOpen && panel.predict" class="shogi-tournament__sheet" role="dialog" aria-modal="true" aria-label="勝敗の予想" data-live-predict-sheet @click.self="predictOpen = false">
      <div class="shogi-tournament__sheet-panel shogi-tournament__detail relay-live__predict-sheet">
        <h2>勝敗の予想</h2>
        <p class="shogi-tournament__text">勝つと思うほうを選んでね。予想できるのは{{ untilPly }}手目まで。終局したら、当たったかが分かるよ。</p>
        <ul class="relay-live__predict-list">
          <li v-for="game in panel.predict.games" :key="game.key" :data-live-predict-game="game.key">
            <button
              v-for="side in SIDES"
              :key="side"
              type="button"
              :class="['relay-live__predict-pick', `relay-live__predict-pick--${side}`, { 'is-picked': game.pick === side }]"
              :aria-pressed="game.pick === side"
              :disabled="!game.open"
              :data-live-predict-side="side"
              @click="emit('predict', game.key, side)"
            >{{ side === "black" ? "☗" : "☖" }}{{ game[side] }}</button>
            <span class="relay-live__predict-state">{{ stateText(game) }}</span>
          </li>
        </ul>
        <button type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" @click="predictOpen = false">閉じる</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, type PropType } from "vue";
import { PREDICT_UNTIL_PLY } from "./core/relay-fun.mjs";

export type LivePanelView = {
  label: string;
  /** 敗退後の観戦の、いま何回戦目か(「3/18」)。 */
  step: string;
  focus: { black: string; white: string; ply: number; done: boolean; blackPercent: number; verdict: string } | null;
  /** 注目の対局(31章)。羽音・善彦・推しの、大きく出す対局のほかの局(ほかの組の局を含む)。whereは「5組ランキング戦 1回戦」など。 */
  featured?: { key: string; black: string; white: string; where: string; ply: number; done: boolean }[];
  count: { playing: number; done: number };
  /** 対局が2局以上(札を押すと中継、と案内する)。 */
  multiple: boolean;
  /** 札のある場所の呼び方(「表」「リーグ表」)。 */
  tableWord: string;
  speed: number;
  /** 勝敗の予想(24-1)。この回戦の対局ごとの選んだ側と、当たり外れ。 */
  predict: {
    games: { key: string; black: string; white: string; pick: "black" | "white" | null; open: boolean; winner: "black" | "white" | null }[];
    hit: number; decided: number; total: number; totalHit: number;
  } | null;
  finished: boolean;
  /** 「結果まで進める」を押して、本局が指し終えるのを待っている(34章)。 */
  skipping?: boolean;
  finishText: string;
  watchText: string;
};

defineProps({
  panel: { type: Object as PropType<LivePanelView>, required: true },
});
const emit = defineEmits<{ open: []; watch: [key: string]; speed: []; skip: []; finish: []; predict: [key: string, side: "black" | "white"] }>();
const SIDES = ["black", "white"] as const;
const untilPly = PREDICT_UNTIL_PLY;
const predictOpen = ref(false);
/** 戻る操作(34章)。予想のシートを開いていれば閉じて真(中継ボードは終えない)。 */
function closeSheet() {
  if (!predictOpen.value) return false;
  predictOpen.value = false;
  return true;
}
defineExpose({ closeSheet });
type PredictGame = NonNullable<LivePanelView["predict"]>["games"][number];
function stateText(game: PredictGame) {
  if (game.winner) return game.pick ? (game.pick === game.winner ? "的中！" : "はずれ") : "終局";
  if (game.pick) return "予想した";
  return game.open ? "" : "締め切り";
}
</script>

<style>
/* 注目の対局(31章)。1局1行で、名前・どこの対局か・何手目。押すと中継。 */
.shogi-game .relay-live__featured { display: grid; gap: 0.3rem; margin: 0; }
.shogi-game .relay-live__featured-head { margin: 0; color: #f6a5c0; font-size: 0.85em; font-weight: 900; }
.shogi-game .relay-live__featured-game {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 0.5rem; align-items: center; min-height: 44px;
  padding: 0.3rem 0.6rem; border: 2px solid rgba(246, 165, 192, 0.55); border-radius: 0.5rem;
  color: #fffcf4; background: rgba(15, 24, 40, 0.6); font: inherit; text-align: left; cursor: pointer;
}
.shogi-game .relay-live__featured-names { overflow: hidden; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .relay-live__featured-where { grid-column: 1; overflow: hidden; color: #9fb3c8; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .relay-live__featured-ply { grid-column: 2; grid-row: 1 / span 2; color: #f1a54c; font-weight: 900; white-space: nowrap; }
/* 勝敗の予想(24-1)。 */
.shogi-game .relay-live__predict { display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; margin: 0; font-weight: 800; }
.shogi-game .relay-live__predict b { color: #f1a54c; font-size: 1.1em; }
.shogi-game .relay-live__predict small { margin-left: 0.25rem; color: #9fb3c8; font-weight: 700; }
.shogi-game .relay-live__predict-list { display: grid; gap: 0.4rem; margin: 0.5rem 0; padding: 0; list-style: none; }
.shogi-game .relay-live__predict-list li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 4.5em; gap: 0.35rem; align-items: center; }
.shogi-game .relay-live__predict-pick {
  min-height: 44px; overflow: hidden; padding: 0 0.4rem; border: 2px solid rgba(255, 252, 244, 0.25); border-radius: 0.45rem;
  color: #fffcf4; background: rgba(15, 24, 40, 0.6); font: inherit; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;
}
.shogi-game .relay-live__predict-pick--black.is-picked { border-color: #3d78b8; background: rgba(61, 120, 184, 0.45); }
.shogi-game .relay-live__predict-pick--white.is-picked { border-color: #c8433a; background: rgba(200, 67, 58, 0.45); }
.shogi-game .relay-live__predict-pick:disabled { opacity: 0.55; cursor: default; }
.shogi-game .relay-live__predict-state { color: #f1a54c; font-size: 0.85em; font-weight: 900; text-align: center; }
.shogi-game .relay-live__predict-mini { display: none; }
/* 予想のシートは対局が多いと長いので、「閉じる」をシートの下の端に止めておく(34章。スクロールしなくても閉じられる)。 */
.shogi-game .relay-live__predict-sheet .shogi-tournament__sheet-close {
  position: sticky; bottom: 0; z-index: 1; width: 100%; background: var(--tr-panel, #2c4359); box-shadow: 0 -0.8rem 0.8rem var(--tr-panel, #2c4359);
}
/*
 * 背の低い縦の画面(スマホ縦の小さめ)。欄が高いと上の表がつぶれるので(UD 7-5)、補足の文を省き、
 * 「勝敗を予想」「速さ」「結果まで進める」を横1列にする。的中の数は、予想のボタンの中に残す。
 * スマホの横向き(844×390など)も同じにする。右の列は縦に並べると札がつぶれて字が重なり、
 * 主役のボタンが画面の外へ出ていた(34章)。行は縮めず、はみ出す分は欄の中でスクロールする。
 */
@media (max-width: 899px) and (orientation: portrait) and (max-height: 760px), (orientation: landscape) and (max-height: 500px) {
  .shogi-game .shogi-tournament__hud.shogi-tournament__live { display: flex; flex-direction: row; flex-wrap: wrap; align-content: flex-start; gap: 0.45rem; padding-top: 0.55rem; }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live > * { flex: 1 1 100%; min-width: 0; }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .shogi-tournament__live-count { display: none; }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .relay-live__predict,
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .shogi-tournament__hud-row { display: contents; }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .relay-live__predict > span { display: none; }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .relay-live__predict button,
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .shogi-tournament__hud-row button {
    flex: 1 1 0; min-width: 0; min-height: 44px; padding: 0.2rem 0.3rem; font-size: 0.82em; line-height: 1.2;
  }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .relay-live__predict-mini { display: block; color: #f1a54c; font-size: 0.9em; }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .shogi-tournament__live-game { padding-block: 0.45rem; }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .relay-live__featured-head,
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .relay-live__featured-where { display: none; }
  .shogi-game .shogi-tournament__hud.shogi-tournament__live .shogi-tournament__start { min-height: 48px; padding-block: 0.35rem; }
  /* 中継のあいだは、表の上の段階の説明(補足)も省き、表に高さを回す(竜王戦の表・名人戦のリーグ表)。 */
  .shogi-game .shogi-tournament__stage:has(.shogi-tournament__live) .shogi-tournament__stagehead p { display: none; }
}
</style>
