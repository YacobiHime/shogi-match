<template>
  <!--
    タイトル戦の二日制(docs/title-match-day-design.md)。封じ手のあとの「1日目のまとめ」と、終局後の「観戦記」。
    重ねて開くシートで、対局は止めない。背景を押すか「閉じる」で閉じる(戻る操作も同じ)。
  -->
  <div class="title-day" role="dialog" aria-modal="true" :aria-label="mode === 'summary' ? '1日目のまとめ' : '観戦記'" data-title-day @click.self="emit('close')">
    <section v-if="mode === 'summary' && summary" class="title-day__panel" data-day-summary>
      <header class="title-day__head">
        <small>{{ summary.heading }}</small>
        <h2>1日目のまとめ</h2>
        <span v-if="summary.venue">{{ summary.venue }}</span>
      </header>
      <div v-if="summary.rate !== null" class="title-day__rate" data-day-rate>
        <p><b>形勢</b><span>あなた <strong>{{ summary.rate }}%</strong></span></p>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" :aria-label="`1日目の勝率の移り変わり。封じ手のときあなた${summary.rate}%`">
          <rect x="0" y="0" width="100" height="20" class="title-day__rate-up" />
          <line x1="0" y1="20" x2="100" y2="20" class="title-day__rate-mid" />
          <polyline :points="summary.points" class="title-day__rate-line" />
        </svg>
        <small>上ほどあなたが良い。中継の勝率と同じ読み</small>
      </div>
      <dl class="title-day__facts">
        <div><dt>戦型</dt><dd>{{ summary.formationText }}</dd></div>
        <div><dt>駒の損得</dt><dd>{{ summary.materialText }}</dd></div>
        <div><dt>考えた時間</dt><dd>{{ summary.thinkText }}</dd></div>
        <div v-if="summary.mealText"><dt>勝負メシ</dt><dd>{{ summary.mealText }}</dd></div>
      </dl>
      <h3>控室の声</h3>
      <ul class="title-day__voices" data-day-voices>
        <li v-for="voice in summary.voices" :key="voice.role">
          <b>{{ voice.role }}</b><span class="title-day__voice-name">{{ voice.name }}</span>
          <p>「{{ voice.text }}」</p>
        </li>
      </ul>
      <p v-if="summary.sealText" class="title-day__seal" data-day-seal>
        <span>封じ手</span><b>{{ summary.sealText }}</b>
        <small v-if="summary.predictedText">控室の予想 {{ summary.predictedText }}</small>
      </p>
      <button type="button" class="title-day__close" data-day-close @click="emit('close')">対局へ戻る</button>
    </section>
    <article v-else-if="mode === 'kansenki' && article" class="title-day__panel title-day__paper" data-kansenki>
      <small class="title-day__paper-event">{{ article.eventText }} {{ article.label }}</small>
      <h2 class="title-day__paper-headline">{{ article.headline }}</h2>
      <p v-for="(paragraph, index) in article.paragraphs" :key="index">{{ paragraph }}</p>
      <button type="button" class="title-day__close" data-kansenki-close @click="emit('close')">閉じる</button>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

export type DaySummaryView = {
  heading: string;
  venue: string;
  rate: number | null;
  points: string;
  formationText: string;
  materialText: string;
  thinkText: string;
  mealText: string;
  voices: { role: string; name: string; text: string }[];
  sealText: string;
  predictedText: string;
};
export type KansenkiView = { headline: string; paragraphs: string[]; eventText: string; label: string };

defineProps({
  mode: { type: String as PropType<"summary" | "kansenki">, required: true },
  summary: { type: Object as PropType<DaySummaryView | null>, default: null },
  article: { type: Object as PropType<KansenkiView | null>, default: null },
});
const emit = defineEmits<{ close: [] }>();
</script>

<style>
.shogi-game .title-day {
  position: fixed;
  inset: 0;
  /* 結果の窓(z-index 100)の上に重ねる。 */
  z-index: 110;
  display: grid;
  place-items: center;
  padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom));
  background: rgba(10, 18, 30, 0.72);
}
.shogi-game .title-day__panel {
  box-sizing: border-box;
  display: grid;
  gap: 0.55rem;
  width: min(34rem, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 1rem 1.1rem;
  border: 2px solid #c9962e;
  border-radius: 0.6rem;
  background: #1d303f;
  color: #fffcf4;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.35);
}
.shogi-game .title-day__head { display: grid; gap: 0.1rem; }
.shogi-game .title-day__head small,
.shogi-game .title-day__head span { color: rgba(255, 252, 244, 0.72); font-size: 0.82em; }
.shogi-game .title-day__head h2,
.shogi-game .title-day h3 { margin: 0; color: #e6c15c; }
.shogi-game .title-day__head h2 { font-size: 1.3rem; }
.shogi-game .title-day h3 { font-size: 1rem; }
.shogi-game .title-day__rate { display: grid; gap: 0.25rem; }
.shogi-game .title-day__rate p { display: flex; justify-content: space-between; margin: 0; }
.shogi-game .title-day__rate strong { font-size: 1.25em; }
.shogi-game .title-day__rate svg { width: 100%; height: 3.6rem; border-radius: 0.3rem; background: rgba(200, 67, 58, 0.18); }
.shogi-game .title-day__rate-up { fill: rgba(61, 111, 165, 0.32); }
.shogi-game .title-day__rate-mid { stroke: rgba(255, 252, 244, 0.5); stroke-width: 0.4; stroke-dasharray: 2 2; }
.shogi-game .title-day__rate-line { fill: none; stroke: #fffcf4; stroke-width: 1.4; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.shogi-game .title-day__rate small { color: rgba(255, 252, 244, 0.65); font-size: 0.75em; }
.shogi-game .title-day__facts { display: grid; gap: 0.25rem; margin: 0; }
.shogi-game .title-day__facts div { display: grid; grid-template-columns: 5.5em 1fr; gap: 0.5rem; }
.shogi-game .title-day__facts dt { color: #f1a54c; font-weight: 700; }
.shogi-game .title-day__facts dd { margin: 0; }
.shogi-game .title-day__voices { display: grid; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .title-day__voices li { padding: 0.45rem 0.6rem; border-radius: 0.4rem; background: rgba(255, 252, 244, 0.08); }
.shogi-game .title-day__voices b { margin-right: 0.4em; padding: 0.05em 0.4em; border-radius: 0.3em; background: #e6c15c; color: #172632; font-size: 0.78em; }
.shogi-game .title-day__voice-name { font-weight: 700; }
.shogi-game .title-day__voices p { margin: 0.2rem 0 0; line-height: 1.5; }
.shogi-game .title-day__seal { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; margin: 0; padding: 0.5rem 0.6rem; border: 1px dashed rgba(230, 193, 92, 0.7); border-radius: 0.4rem; }
.shogi-game .title-day__seal span { color: #e6c15c; font-weight: 700; }
.shogi-game .title-day__seal b { font-size: 1.15em; }
.shogi-game .title-day__seal small { color: rgba(255, 252, 244, 0.72); }
.shogi-game .title-day__close {
  justify-self: center;
  min-width: 11rem;
  min-height: 44px;
  padding: 0.5rem 1.2rem;
  border: 0;
  border-radius: 0.5rem;
  background: #f1a54c;
  color: #172632;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
/* 観戦記は新聞の紙面(白い紙に明朝の見出し)。 */
.shogi-game .title-day__paper {
  border-color: #b9ab86;
  background: #fbf8ef;
  color: #2a2016;
  font-family: "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
}
.shogi-game .title-day__paper-event { color: #7a6a4a; }
.shogi-game .title-day__paper-headline { margin: 0; padding-bottom: 0.4rem; border-bottom: 3px double #2a2016; font-size: 1.35rem; line-height: 1.4; }
.shogi-game .title-day__paper p { margin: 0; line-height: 1.8; text-indent: 1em; }
.shogi-game .title-day__paper .title-day__close { font-family: inherit; }
</style>
